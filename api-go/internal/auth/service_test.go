package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

const testSecret = "test-secret-0123456789abcdef0123456789"

type captureSender struct {
	mu    sync.Mutex
	codes map[string]string
}

func (c *captureSender) SendVerificationCode(_ context.Context, to, _ string, code string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.codes == nil {
		c.codes = map[string]string{}
	}
	c.codes[to] = code
	return nil
}

func (c *captureSender) last(to string) string {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.codes[to]
}

func newTestService(t *testing.T) (*Service, *captureSender, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.EmailOTP{}, &domain.RefreshToken{}); err != nil {
		t.Fatal(err)
	}
	sender := &captureSender{}
	svc := NewService(db, NewGormUserRepository(db), NewGormWalletRepository(db), sender, Config{JWTSecret: testSecret}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	return svc, sender, db
}

func wrongCode(code string) string {
	if code == "000000" {
		return "111111"
	}
	return "000000"
}

func TestRegisterVerifyLogin(t *testing.T) {
	svc, sender, _ := newTestService(t)
	ctx := context.Background()

	user, err := svc.Register(ctx, "Ada Obi", "  Ada@Example.com ", "correct-horse", "08030000000")
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	if user.Email != "ada@example.com" || user.EmailVerified || user.Role != "buyer" {
		t.Fatalf("unexpected user: %+v", user)
	}
	if _, err := svc.GetWallet(ctx, user.ID); err != nil {
		t.Fatalf("wallet not created with user: %v", err)
	}

	if _, err := svc.Register(ctx, "Ada", "ada@example.com", "another-pass", ""); !errors.Is(err, ErrEmailTaken) {
		t.Fatalf("duplicate register: got %v", err)
	}

	// Unverified accounts cannot sign in.
	if _, err := svc.Login(ctx, "ada@example.com", "correct-horse"); !errors.Is(err, ErrEmailNotVerified) {
		t.Fatalf("login before verify: got %v", err)
	}

	code := sender.last("ada@example.com")
	if len(code) != 6 {
		t.Fatalf("expected a 6-digit code, got %q", code)
	}
	if _, err := svc.VerifyEmail(ctx, "ada@example.com", wrongCode(code)); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("wrong code: got %v", err)
	}
	verified, err := svc.VerifyEmail(ctx, "ada@example.com", code)
	if err != nil || !verified.EmailVerified {
		t.Fatalf("verify: %v", err)
	}
	// Codes are single-use.
	if _, err := svc.VerifyEmail(ctx, "ada@example.com", code); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("code reuse: got %v", err)
	}

	if _, err := svc.Login(ctx, "ADA@example.com", "correct-horse"); err != nil {
		t.Fatalf("login after verify: %v", err)
	}
	if _, err := svc.Login(ctx, "ada@example.com", "wrong-password"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("wrong password: got %v", err)
	}
	if _, err := svc.Login(ctx, "nobody@example.com", "whatever-pass"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("unknown email must look like a wrong password: got %v", err)
	}
}

func TestOTPAttemptLimitBurnsCode(t *testing.T) {
	svc, sender, _ := newTestService(t)
	ctx := context.Background()
	if _, err := svc.Register(ctx, "Bola", "bola@example.com", "password-123", ""); err != nil {
		t.Fatal(err)
	}
	code := sender.last("bola@example.com")
	for i := 0; i < otpMaxAttempts; i++ {
		if _, err := svc.VerifyEmail(ctx, "bola@example.com", wrongCode(code)); !errors.Is(err, ErrInvalidCode) {
			t.Fatalf("attempt %d: got %v", i, err)
		}
	}
	// The right code no longer works after too many wrong guesses.
	if _, err := svc.VerifyEmail(ctx, "bola@example.com", code); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("burnt code accepted: %v", err)
	}
}

func TestOTPExpiryAndResendGap(t *testing.T) {
	svc, sender, _ := newTestService(t)
	ctx := context.Background()
	if _, err := svc.Register(ctx, "Chi", "chi@example.com", "password-123", ""); err != nil {
		t.Fatal(err)
	}
	if err := svc.ResendVerification(ctx, "chi@example.com"); !errors.Is(err, ErrTooManyCodes) {
		t.Fatalf("immediate resend should be rate limited, got %v", err)
	}
	// Unknown addresses look identical to success.
	if err := svc.ResendVerification(ctx, "ghost@example.com"); err != nil {
		t.Fatalf("unknown email resend: %v", err)
	}

	code := sender.last("chi@example.com")
	svc.otp.now = func() time.Time { return time.Now().Add(otpTTL + time.Minute) }
	if _, err := svc.VerifyEmail(ctx, "chi@example.com", code); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expired code accepted: %v", err)
	}
}

func verifiedUser(t *testing.T, svc *Service, db *gorm.DB, email string) *domain.User {
	t.Helper()
	u, err := svc.Register(context.Background(), "Test User", email, "password-123", "")
	if err != nil {
		t.Fatal(err)
	}
	db.Model(u).Update("email_verified", true)
	u.EmailVerified = true
	return u
}

func TestLockoutAfterRepeatedFailures(t *testing.T) {
	svc, _, db := newTestService(t)
	ctx := context.Background()
	verifiedUser(t, svc, db, "dayo@example.com")

	for i := 0; i < maxFailedLogins; i++ {
		_, _ = svc.Login(ctx, "dayo@example.com", "not-the-password")
	}
	if _, err := svc.Login(ctx, "dayo@example.com", "password-123"); !errors.Is(err, ErrAccountLocked) {
		t.Fatalf("expected lockout even with the right password, got %v", err)
	}
}

func TestRefreshRotationAndReuseDetection(t *testing.T) {
	svc, _, db := newTestService(t)
	ctx := context.Background()
	u := verifiedUser(t, svc, db, "efe@example.com")

	first, err := svc.StartSession(ctx, u)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := svc.Authenticate(ctx, first.AccessToken); err != nil || got.ID != u.ID {
		t.Fatalf("authenticate: %v", err)
	}

	_, second, err := svc.RefreshSession(ctx, first.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if second.RefreshToken == first.RefreshToken {
		t.Fatal("refresh token was not rotated")
	}

	// Replaying the consumed token revokes the whole family, including the
	// token issued by the legitimate rotation.
	if _, _, err := svc.RefreshSession(ctx, first.RefreshToken); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("reuse: got %v", err)
	}
	if _, _, err := svc.RefreshSession(ctx, second.RefreshToken); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("family should be revoked after reuse, got %v", err)
	}
}

func TestLogoutRevokesRefresh(t *testing.T) {
	svc, _, db := newTestService(t)
	ctx := context.Background()
	u := verifiedUser(t, svc, db, "funmi@example.com")
	s, _ := svc.StartSession(ctx, u)
	svc.EndSession(ctx, s.RefreshToken)
	if _, _, err := svc.RefreshSession(ctx, s.RefreshToken); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("refresh after logout: got %v", err)
	}
}

func TestAccessTokenRejectsTamperingAndExpiry(t *testing.T) {
	svc, _, db := newTestService(t)
	ctx := context.Background()
	u := verifiedUser(t, svc, db, "gbenga@example.com")
	s, _ := svc.StartSession(ctx, u)

	// alg=none forgery
	none := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"sub": u.ID, "typ": "access", "iss": issuer, "exp": time.Now().Add(time.Hour).Unix()})
	forged, _ := none.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err := svc.Authenticate(ctx, forged); err == nil {
		t.Fatal("alg=none token accepted")
	}
	// Signed with another secret
	other, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{"sub": u.ID, "typ": "access", "iss": issuer, "exp": time.Now().Add(time.Hour).Unix()}).SignedString([]byte("some-other-secret-0123456789abcdef"))
	if _, err := svc.Authenticate(ctx, other); err == nil {
		t.Fatal("token signed with a different secret accepted")
	}
	// Expired
	svc.tokens.now = func() time.Time { return time.Now().Add(AccessTTL + time.Minute) }
	if _, err := svc.Authenticate(ctx, s.AccessToken); err == nil {
		t.Fatal("expired access token accepted")
	}
}

// ── Google ──

type fakeGoogle struct {
	key *rsa.PrivateKey
	srv *httptest.Server
}

func newFakeGoogle(t *testing.T) *fakeGoogle {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeGoogle{key: key}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=3600")
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "k1", "kty": "RSA", "alg": "RS256",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeGoogle) token(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = "k1"
	s, err := tok.SignedString(f.key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func googleClaims(overrides jwt.MapClaims) jwt.MapClaims {
	c := jwt.MapClaims{
		"iss": "https://accounts.google.com", "aud": "client-123", "sub": "google-sub-1",
		"email": "Hadiza@Example.com", "email_verified": true, "name": "Hadiza Bello",
		"iat": time.Now().Unix(), "exp": time.Now().Add(time.Hour).Unix(),
	}
	for k, v := range overrides {
		c[k] = v
	}
	return c
}

func TestGoogleVerifier(t *testing.T) {
	g := newFakeGoogle(t)
	v := NewGoogleVerifier("client-123")
	v.certsURL = g.srv.URL
	ctx := context.Background()

	claims, err := v.Verify(ctx, g.token(t, googleClaims(nil)))
	if err != nil || claims.Email != "hadiza@example.com" {
		t.Fatalf("valid token rejected: %v", err)
	}
	for name, bad := range map[string]jwt.MapClaims{
		"wrong audience":   {"aud": "someone-else"},
		"wrong issuer":     {"iss": "https://evil.example.com"},
		"unverified email": {"email_verified": false},
		"expired":          {"exp": time.Now().Add(-time.Minute).Unix()},
	} {
		if _, err := v.Verify(ctx, g.token(t, googleClaims(bad))); err == nil {
			t.Errorf("%s: token accepted", name)
		}
	}
	if _, err := NewGoogleVerifier("").Verify(ctx, "x"); !errors.Is(err, ErrGoogleNotConfigured) {
		t.Errorf("unconfigured verifier: got %v", err)
	}
}

func TestGoogleSignInLinksExistingEmail(t *testing.T) {
	svc, _, db := newTestService(t)
	g := newFakeGoogle(t)
	svc.google = NewGoogleVerifier("client-123")
	svc.google.certsURL = g.srv.URL
	ctx := context.Background()

	existing, _ := svc.Register(ctx, "Hadiza", "hadiza@example.com", "password-123", "")
	user, err := svc.GoogleSignIn(ctx, g.token(t, googleClaims(nil)))
	if err != nil {
		t.Fatalf("google sign-in: %v", err)
	}
	if user.ID != existing.ID || !user.EmailVerified {
		t.Fatalf("expected the existing account to be linked and verified: %+v", user)
	}
	// A brand-new Google user becomes a verified buyer.
	fresh, err := svc.GoogleSignIn(ctx, g.token(t, googleClaims(jwt.MapClaims{"sub": "google-sub-2", "email": "ifeoma@example.com"})))
	if err != nil || fresh.Role != "buyer" || !fresh.EmailVerified || fresh.PasswordHash != "" {
		t.Fatalf("new google user: %+v err=%v", fresh, err)
	}
	// Google-only accounts cannot sign in with an empty or guessed password.
	if _, err := svc.Login(ctx, "ifeoma@example.com", "anything-at-all"); !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("password login on google-only account: got %v", err)
	}
	var count int64
	db.Model(&domain.Wallet{}).Where("user_id = ?", fresh.ID).Count(&count)
	if count != 1 {
		t.Fatalf("google user wallet count = %d", count)
	}
}
