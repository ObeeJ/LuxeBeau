package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

const (
	PurposeVerifyEmail = "verify_email"
	PurposeAdminLogin  = "admin_login"

	otpTTL         = 10 * time.Minute
	otpMaxAttempts = 5
	otpResendGap   = 60 * time.Second
	otpHourlyLimit = 5
	otpDigits      = 6
)

// OTPStore issues and checks single-use numeric codes. Codes are stored as
// HMAC-SHA256 digests keyed by a server secret, so a database leak does not
// reveal live codes.
type OTPStore struct {
	db  *gorm.DB
	key []byte
	now func() time.Time
}

func NewOTPStore(db *gorm.DB, secret string) *OTPStore {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("luxebeau-otp-v1"))
	return &OTPStore{db: db, key: mac.Sum(nil), now: time.Now}
}

func (o *OTPStore) hash(userID, purpose, code string) string {
	mac := hmac.New(sha256.New, o.key)
	mac.Write([]byte(userID + "|" + purpose + "|" + code))
	return hex.EncodeToString(mac.Sum(nil))
}

func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%0*d", otpDigits, n.Int64()), nil
}

// Issue invalidates earlier codes for the purpose and returns a new one,
// enforcing a resend gap and an hourly cap per user.
func (o *OTPStore) Issue(ctx context.Context, userID, purpose string) (string, error) {
	now := o.now()
	var recent []domain.EmailOTP
	if err := o.db.WithContext(ctx).
		Where("user_id = ? AND purpose = ? AND created_at > ?", userID, purpose, now.Add(-time.Hour)).
		Order("created_at DESC").Find(&recent).Error; err != nil {
		return "", err
	}
	if len(recent) >= otpHourlyLimit || (len(recent) > 0 && now.Sub(recent[0].CreatedAt) < otpResendGap) {
		return "", ErrTooManyCodes
	}

	code, err := newCode()
	if err != nil {
		return "", err
	}
	err = o.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&domain.EmailOTP{}).
			Where("user_id = ? AND purpose = ? AND consumed_at IS NULL", userID, purpose).
			Update("consumed_at", now).Error; err != nil {
			return err
		}
		return tx.Create(&domain.EmailOTP{
			UserID:    userID,
			Purpose:   purpose,
			CodeHash:  o.hash(userID, purpose, code),
			ExpiresAt: now.Add(otpTTL),
			CreatedAt: now,
		}).Error
	})
	if err != nil {
		return "", err
	}
	return code, nil
}

// Verify checks the latest live code. Each wrong guess counts; after the
// limit the code is burnt and a new one must be requested.
func (o *OTPStore) Verify(ctx context.Context, userID, purpose, code string) error {
	code = strings.TrimSpace(code)
	if len(code) != otpDigits {
		return ErrInvalidCode
	}
	now := o.now()
	wrong := false
	err := o.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row domain.EmailOTP
		if err := tx.Where("user_id = ? AND purpose = ? AND consumed_at IS NULL", userID, purpose).
			Order("created_at DESC").First(&row).Error; err != nil {
			return ErrInvalidCode
		}
		if now.After(row.ExpiresAt) || row.Attempts >= otpMaxAttempts {
			return ErrInvalidCode
		}
		if !constantTimeEqual(row.CodeHash, o.hash(userID, purpose, code)) {
			updates := map[string]any{"attempts": row.Attempts + 1}
			if row.Attempts+1 >= otpMaxAttempts {
				updates["consumed_at"] = now
			}
			// Commit the failed attempt; the error is returned after commit.
			wrong = true
			return tx.Model(&row).Updates(updates).Error
		}
		return tx.Model(&row).Update("consumed_at", now).Error
	})
	if err != nil {
		return err
	}
	if wrong {
		return ErrInvalidCode
	}
	return nil
}
