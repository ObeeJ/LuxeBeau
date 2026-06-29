package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

type authService struct {
	repo       domain.UserRepository
	walletRepo domain.WalletRepository
	jwtSecret  []byte
	logger     *slog.Logger
}

func NewAuthService(repo domain.UserRepository, walletRepo domain.WalletRepository, jwtSecret string, logger *slog.Logger) domain.UserService {
	return &authService{repo: repo, walletRepo: walletRepo, jwtSecret: []byte(jwtSecret), logger: logger}
}

func (s *authService) Register(ctx context.Context, name, email, password, phone, role string) (*domain.User, string, error) {
	// Admin is an internal, privileged role. It can never be self-registered
	// through the public API; admins are provisioned out-of-band (seed/console).
	if role == "admin" {
		return nil, "", fmt.Errorf("invalid role")
	}
	if role != "seller" && role != "artisan" {
		role = "buyer"
	}

	// Check if user already exists
	existing, err := s.repo.GetByEmail(ctx, email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		s.logger.Error("Failed to check existing user", slog.String("email", email), slog.Any("error", err))
		return nil, "", fmt.Errorf("failed to check existing user: %w", err)
	}
	if existing != nil {
		return nil, "", fmt.Errorf("user with email %s already exists", email)
	}

	// Hash password with cost 12
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, "", fmt.Errorf("failed to hash password: %w", err)
	}

	user := &domain.User{
		ID:           uuid.NewString(),
		Name:         name,
		Email:        email,
		PasswordHash: string(hash),
		Phone:        phone,
		Role:         role,
	}

	if err := s.repo.Create(ctx, user); err != nil {
		s.logger.Error("Failed to create user", slog.String("email", email), slog.Any("error", err))
		return nil, "", fmt.Errorf("failed to create user: %w", err)
	}

	// Initialize new User Wallet with 0 balance
	wallet := &domain.Wallet{
		UserID:  user.ID,
		Balance: 0,
	}
	if err := s.walletRepo.Create(ctx, wallet); err != nil {
		s.logger.Error("Failed to create user wallet", slog.String("userId", user.ID), slog.Any("error", err))
		// Log error but proceed to generate token so registration doesn't hard-crash the client
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", err
	}

	s.logger.Info("User registered successfully with wallet", slog.String("email", email), slog.String("role", role))
	return user, token, nil
}

func (s *authService) Login(ctx context.Context, email, password string) (*domain.User, string, error) {
	user, err := s.repo.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, "", fmt.Errorf("invalid email or password")
		}
		return nil, "", fmt.Errorf("failed to find user: %w", err)
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", fmt.Errorf("invalid email or password")
	}

	if user.Status == "suspended" {
		return nil, "", fmt.Errorf("account suspended")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", err
	}

	s.logger.Info("User logged in", slog.String("email", email))
	return user, token, nil
}

func (s *authService) ValidateToken(ctx context.Context, tokenStr string) (*domain.User, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token claims")
	}

	userID, ok := claims["sub"].(string)
	if !ok {
		return nil, fmt.Errorf("invalid token subject")
	}

	user, err := s.repo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	return user, nil
}

func (s *authService) GetWallet(ctx context.Context, userID string) (*domain.Wallet, error) {
	return s.walletRepo.GetByUserID(ctx, userID)
}

func (s *authService) CreditWallet(ctx context.Context, userID string, amount int64) error {
	return s.walletRepo.UpdateBalance(ctx, userID, amount)
}

func (s *authService) generateToken(user *domain.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":  user.ID,
		"name": user.Name,
		"role": user.Role,
		"exp":  time.Now().Add(72 * time.Hour).Unix(),
		"iat":  time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}
