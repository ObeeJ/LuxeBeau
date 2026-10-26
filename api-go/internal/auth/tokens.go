package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

const (
	AccessTTL  = 15 * time.Minute
	RefreshTTL = 30 * 24 * time.Hour
	issuer     = "luxebeau-api"
)

var ErrInvalidSession = errors.New("invalid or expired session")

// Session is the pair of credentials set as cookies after sign-in.
type Session struct {
	AccessToken  string
	RefreshToken string
}

// TokenIssuer signs short-lived access JWTs and manages rotating, single-use
// refresh tokens stored as SHA-256 digests.
type TokenIssuer struct {
	db     *gorm.DB
	secret []byte
	now    func() time.Time
}

func NewTokenIssuer(db *gorm.DB, secret string) *TokenIssuer {
	return &TokenIssuer{db: db, secret: []byte(secret), now: time.Now}
}

type accessClaims struct {
	Role string `json:"role"`
	Type string `json:"typ"`
	jwt.RegisteredClaims
}

func digest(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// Issue creates an access token and a new refresh token. An empty familyID
// starts a new family (a fresh sign-in).
func (t *TokenIssuer) Issue(ctx context.Context, user *domain.User, familyID string) (Session, error) {
	now := t.now()
	access, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims{
		Role: user.Role,
		Type: "access",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			Issuer:    issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(AccessTTL)),
			ID:        uuid.NewString(),
		},
	}).SignedString(t.secret)
	if err != nil {
		return Session{}, fmt.Errorf("sign access token: %w", err)
	}

	refresh, err := randomToken()
	if err != nil {
		return Session{}, fmt.Errorf("generate refresh token: %w", err)
	}
	if familyID == "" {
		familyID = uuid.NewString()
	}
	row := &domain.RefreshToken{
		ID:        uuid.NewString(),
		UserID:    user.ID,
		FamilyID:  familyID,
		TokenHash: digest(refresh),
		ExpiresAt: now.Add(RefreshTTL),
	}
	if err := t.db.WithContext(ctx).Create(row).Error; err != nil {
		return Session{}, fmt.Errorf("store refresh token: %w", err)
	}
	return Session{AccessToken: access, RefreshToken: refresh}, nil
}

// ParseAccess validates signature, algorithm, issuer, type and expiry.
func (t *TokenIssuer) ParseAccess(token string) (string, error) {
	var claims accessClaims
	parsed, err := jwt.ParseWithClaims(token, &claims, func(*jwt.Token) (any, error) { return t.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(t.now),
	)
	if err != nil || !parsed.Valid || claims.Type != "access" || claims.Subject == "" {
		return "", ErrInvalidSession
	}
	return claims.Subject, nil
}

// Rotate consumes a refresh token. Presenting a token that was already used
// or revoked is treated as theft: the whole family is revoked.
func (t *TokenIssuer) Rotate(ctx context.Context, refresh string) (userID, familyID string, err error) {
	if refresh == "" {
		return "", "", ErrInvalidSession
	}
	now := t.now()
	var reusedFamily string
	err = t.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row domain.RefreshToken
		if err := tx.Where("token_hash = ?", digest(refresh)).First(&row).Error; err != nil {
			return ErrInvalidSession
		}
		if row.RevokedAt != nil {
			reusedFamily = row.FamilyID
			return errReuse
		}
		if now.After(row.ExpiresAt) {
			return ErrInvalidSession
		}
		// Conditional update: of two concurrent refreshes only one wins.
		res := tx.Model(&domain.RefreshToken{}).Where("id = ? AND revoked_at IS NULL", row.ID).Update("revoked_at", now)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrInvalidSession
		}
		userID, familyID = row.UserID, row.FamilyID
		return nil
	})
	if errors.Is(err, errReuse) {
		// Revoke outside the rolled-back transaction so it sticks.
		t.RevokeFamily(ctx, reusedFamily)
		return "", "", ErrInvalidSession
	}
	return userID, familyID, err
}

var errReuse = errors.New("refresh token reuse")

func (t *TokenIssuer) Revoke(ctx context.Context, refresh string) {
	if refresh == "" {
		return
	}
	var row domain.RefreshToken
	if err := t.db.WithContext(ctx).Where("token_hash = ?", digest(refresh)).First(&row).Error; err != nil {
		return
	}
	t.RevokeFamily(ctx, row.FamilyID)
}

func (t *TokenIssuer) RevokeFamily(ctx context.Context, familyID string) {
	t.db.WithContext(ctx).Model(&domain.RefreshToken{}).
		Where("family_id = ? AND revoked_at IS NULL", familyID).
		Update("revoked_at", t.now())
}
