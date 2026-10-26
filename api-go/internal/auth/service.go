package auth

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"
	"log/slog"
	"net/mail"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

const (
	bcryptCost       = 12
	maxFailedLogins  = 5
	lockoutDuration  = 15 * time.Minute
	minPasswordChars = 8
)

// Errors the handler maps to HTTP responses. Messages never reveal whether a
// password or an email was the wrong half of a credential pair.
var (
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailTaken         = errors.New("an account with this email already exists")
	ErrEmailNotVerified   = errors.New("email not verified")
	ErrAccountLocked      = errors.New("account temporarily locked")
	ErrAccountSuspended   = errors.New("account suspended")
	ErrInvalidCode        = errors.New("invalid or expired code")
	ErrTooManyCodes       = errors.New("too many codes requested")
	ErrInvalidInput       = errors.New("invalid input")
	// ErrSecondFactorRequired: the password (or Google) step passed for an
	// admin and a sign-in code was emailed; no session is issued yet.
	ErrSecondFactorRequired = errors.New("second factor required")
)

// CodeSender delivers verification codes (implemented by the mail package).
type CodeSender interface {
	SendVerificationCode(ctx context.Context, to, name, code string) error
	SendLoginCode(ctx context.Context, to, name, code string) error
}

// Service owns identity: registration, email verification, password and
// Google sign-in, and the session (access + rotating refresh token) lifecycle.
type Service struct {
	db         *gorm.DB
	repo       domain.UserRepository
	walletRepo domain.WalletRepository
	tokens     *TokenIssuer
	otp        *OTPStore
	codes      CodeSender
	google     *GoogleVerifier
	logger     *slog.Logger
	// dummyHash keeps login timing constant when the email does not exist.
	dummyHash []byte
}

type Config struct {
	JWTSecret      string
	GoogleClientID string
}

func NewService(db *gorm.DB, repo domain.UserRepository, walletRepo domain.WalletRepository, codes CodeSender, cfg Config, logger *slog.Logger) *Service {
	dummy, _ := bcrypt.GenerateFromPassword([]byte("timing-equaliser"), bcryptCost)
	return &Service{
		db:         db,
		repo:       repo,
		walletRepo: walletRepo,
		tokens:     NewTokenIssuer(db, cfg.JWTSecret),
		otp:        NewOTPStore(db, cfg.JWTSecret),
		codes:      codes,
		google:     NewGoogleVerifier(cfg.GoogleClientID),
		logger:     logger,
		dummyHash:  dummy,
	}
}

func normaliseEmail(email string) (string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Address != email {
		return "", ErrInvalidInput
	}
	return email, nil
}

// Register creates an unverified account (and its wallet) atomically and
// emails a verification code. No session is issued until the code is
// confirmed. Partner roles are granted later through onboarding.
func (s *Service) Register(ctx context.Context, name, email, password, phone string) (*domain.User, error) {
	email, err := normaliseEmail(email)
	if err != nil {
		return nil, err
	}
	name = strings.TrimSpace(name)
	if name == "" || len(password) < minPasswordChars || len(password) > 72 {
		return nil, ErrInvalidInput
	}

	existing, err := s.repo.GetByEmail(ctx, email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("check existing user: %w", err)
	}
	if existing != nil {
		return nil, ErrEmailTaken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}

	user := &domain.User{
		ID:           uuid.NewString(),
		Name:         name,
		Email:        email,
		PasswordHash: string(hash),
		Phone:        strings.TrimSpace(phone),
		Role:         "buyer",
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		return tx.Create(&domain.Wallet{UserID: user.ID}).Error
	})
	if err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}

	s.logger.Info("user registered", slog.String("user_id", user.ID))
	if err := s.sendCode(ctx, user); err != nil {
		// The account exists; the user can request a new code.
		s.logger.Warn("verification email failed", slog.String("user_id", user.ID), slog.Any("error", err))
	}
	return user, nil
}

func (s *Service) sendCode(ctx context.Context, user *domain.User) error {
	code, err := s.otp.Issue(ctx, user.ID, PurposeVerifyEmail)
	if err != nil {
		return err
	}
	return s.codes.SendVerificationCode(ctx, user.Email, user.Name, code)
}

// ResendVerification emails a fresh code to an unverified account. It reports
// success for unknown or already-verified emails so it cannot be used to
// discover which addresses have accounts.
func (s *Service) ResendVerification(ctx context.Context, email string) error {
	email, err := normaliseEmail(email)
	if err != nil {
		return ErrInvalidInput
	}
	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil || user.EmailVerified {
		return nil
	}
	return s.sendCode(ctx, user)
}

// VerifyEmail consumes a code and marks the email verified.
func (s *Service) VerifyEmail(ctx context.Context, email, code string) (*domain.User, error) {
	email, err := normaliseEmail(email)
	if err != nil {
		return nil, ErrInvalidCode
	}
	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		return nil, ErrInvalidCode
	}
	if err := s.otp.Verify(ctx, user.ID, PurposeVerifyEmail, code); err != nil {
		return nil, err
	}
	if !user.EmailVerified {
		if err := s.db.WithContext(ctx).Model(user).Update("email_verified", true).Error; err != nil {
			return nil, fmt.Errorf("mark verified: %w", err)
		}
		user.EmailVerified = true
	}
	if user.Status == "suspended" {
		return nil, ErrAccountSuspended
	}
	return user, nil
}

// Login checks a password with lockout after repeated failures. Unverified
// accounts get a fresh code and ErrEmailNotVerified.
func (s *Service) Login(ctx context.Context, email, password string) (*domain.User, error) {
	email, err := normaliseEmail(email)
	if err != nil {
		return nil, ErrInvalidCredentials
	}
	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			_ = bcrypt.CompareHashAndPassword(s.dummyHash, []byte(password))
			return nil, ErrInvalidCredentials
		}
		return nil, fmt.Errorf("find user: %w", err)
	}

	now := time.Now()
	if user.LockedUntil != nil && user.LockedUntil.After(now) {
		return nil, ErrAccountLocked
	}

	hash := []byte(user.PasswordHash)
	if len(hash) == 0 {
		hash = s.dummyHash // Google-only account: never matches
	}
	if bcrypt.CompareHashAndPassword(hash, []byte(password)) != nil || len(user.PasswordHash) == 0 {
		s.recordFailure(ctx, user, now)
		return nil, ErrInvalidCredentials
	}

	if user.FailedLogins > 0 || user.LockedUntil != nil {
		s.db.WithContext(ctx).Model(user).Updates(map[string]any{"failed_logins": 0, "locked_until": nil})
	}
	if user.Status == "suspended" {
		return nil, ErrAccountSuspended
	}
	if !user.EmailVerified {
		if err := s.sendCode(ctx, user); err != nil && !errors.Is(err, ErrTooManyCodes) {
			s.logger.Warn("verification email failed", slog.String("user_id", user.ID), slog.Any("error", err))
		}
		return nil, ErrEmailNotVerified
	}
	if user.Role == "admin" {
		return user, s.requireSecondFactor(ctx, user)
	}
	return user, nil
}

// requireSecondFactor emails an admin a one-time sign-in code. It always
// ends in ErrSecondFactorRequired unless the email can't be sent. If a code
// went out in the last minute, that code stays valid and no new one is sent.
func (s *Service) requireSecondFactor(ctx context.Context, user *domain.User) error {
	code, err := s.otp.Issue(ctx, user.ID, PurposeAdminLogin)
	if errors.Is(err, ErrTooManyCodes) {
		return ErrSecondFactorRequired
	}
	if err != nil {
		return fmt.Errorf("issue login code: %w", err)
	}
	if err := s.codes.SendLoginCode(ctx, user.Email, user.Name, code); err != nil {
		return fmt.Errorf("send login code: %w", err)
	}
	return ErrSecondFactorRequired
}

// VerifyLogin completes an admin sign-in with the emailed code. Codes are
// only issued after the password or Google step, so the code proves both.
func (s *Service) VerifyLogin(ctx context.Context, email, code string) (*domain.User, error) {
	email, err := normaliseEmail(email)
	if err != nil {
		return nil, ErrInvalidCode
	}
	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil || user.Role != "admin" {
		return nil, ErrInvalidCode
	}
	if err := s.otp.Verify(ctx, user.ID, PurposeAdminLogin, code); err != nil {
		return nil, ErrInvalidCode
	}
	if user.Status == "suspended" {
		return nil, ErrAccountSuspended
	}
	return user, nil
}

func (s *Service) recordFailure(ctx context.Context, user *domain.User, now time.Time) {
	failed := user.FailedLogins + 1
	updates := map[string]any{"failed_logins": failed}
	if failed >= maxFailedLogins {
		until := now.Add(lockoutDuration)
		updates["locked_until"] = until
		updates["failed_logins"] = 0
		s.logger.Warn("account locked after failed logins", slog.String("user_id", user.ID))
	}
	s.db.WithContext(ctx).Model(user).Updates(updates)
}

// GoogleSignIn verifies a Google ID token and returns the matching account,
// linking it to an existing verified email or creating a buyer.
func (s *Service) GoogleSignIn(ctx context.Context, credential string) (*domain.User, error) {
	claims, err := s.google.Verify(ctx, credential)
	if err != nil {
		return nil, err
	}

	var user domain.User
	err = s.db.WithContext(ctx).Where("google_sub = ?", claims.Subject).First(&user).Error
	if err == nil {
		if user.Status == "suspended" {
			return nil, ErrAccountSuspended
		}
		if user.Role == "admin" {
			return &user, s.requireSecondFactor(ctx, &user)
		}
		return &user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("find google user: %w", err)
	}

	sub := claims.Subject
	existing, err := s.repo.GetByEmail(ctx, claims.Email)
	if err == nil {
		// Google has verified ownership of this address, so linking is safe.
		updates := map[string]any{"google_sub": sub, "email_verified": true}
		if err := s.db.WithContext(ctx).Model(existing).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("link google account: %w", err)
		}
		existing.GoogleSub, existing.EmailVerified = &sub, true
		if existing.Status == "suspended" {
			return nil, ErrAccountSuspended
		}
		if existing.Role == "admin" {
			return existing, s.requireSecondFactor(ctx, existing)
		}
		return existing, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("find user by email: %w", err)
	}

	name := strings.TrimSpace(claims.Name)
	if name == "" {
		name = strings.Split(claims.Email, "@")[0]
	}
	created := &domain.User{
		ID:            uuid.NewString(),
		Name:          name,
		Email:         claims.Email,
		EmailVerified: true,
		GoogleSub:     &sub,
		Role:          "buyer",
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(created).Error; err != nil {
			return err
		}
		return tx.Create(&domain.Wallet{UserID: created.ID}).Error
	})
	if err != nil {
		return nil, fmt.Errorf("create google user: %w", err)
	}
	s.logger.Info("user registered via google", slog.String("user_id", created.ID))
	return created, nil
}

// ── Sessions ──

func (s *Service) StartSession(ctx context.Context, user *domain.User) (Session, error) {
	return s.tokens.Issue(ctx, user, "")
}

func (s *Service) RefreshSession(ctx context.Context, refreshToken string) (*domain.User, Session, error) {
	userID, familyID, err := s.tokens.Rotate(ctx, refreshToken)
	if err != nil {
		return nil, Session{}, err
	}
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, Session{}, ErrInvalidSession
	}
	if user.Status == "suspended" {
		s.tokens.RevokeFamily(ctx, familyID)
		return nil, Session{}, ErrAccountSuspended
	}
	session, err := s.tokens.Issue(ctx, user, familyID)
	return user, session, err
}

func (s *Service) EndSession(ctx context.Context, refreshToken string) {
	s.tokens.Revoke(ctx, refreshToken)
}

// Authenticate validates an access token and loads the current user, so a
// role change or suspension takes effect on the next request.
func (s *Service) Authenticate(ctx context.Context, accessToken string) (*domain.User, error) {
	userID, err := s.tokens.ParseAccess(accessToken)
	if err != nil {
		return nil, err
	}
	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, ErrInvalidSession
	}
	return user, nil
}

// ── Wallet ──

func (s *Service) GetWallet(ctx context.Context, userID string) (*domain.Wallet, error) {
	return s.walletRepo.GetByUserID(ctx, userID)
}

// constantTimeEqual compares two hex digests without leaking timing.
func constantTimeEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
