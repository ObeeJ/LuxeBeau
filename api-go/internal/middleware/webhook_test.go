package middleware

import (
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func sign(secret, body string) string {
	mac := hmac.New(sha512.New, []byte(secret))
	mac.Write([]byte(body))
	return hex.EncodeToString(mac.Sum(nil))
}

// engine wires the middleware in front of a handler that 200s and echoes the
// body, so we can also confirm the body is restored for downstream binding.
func engine(mw gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/hook", mw, func(c *gin.Context) {
		b, _ := io.ReadAll(c.Request.Body)
		c.String(http.StatusOK, string(b))
	})
	return r
}

func TestHMACSignature_ValidPasses(t *testing.T) {
	const secret = "sk_test_secret"
	body := `{"event":"charge.success","data":{"reference":"LB-1","status":"success"}}`
	r := engine(RequireHMACSignature(secret, "x-paystack-signature"))

	req := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(body))
	req.Header.Set("x-paystack-signature", sign(secret, body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("valid signature should pass, got %d", w.Code)
	}
	if w.Body.String() != body {
		t.Fatalf("body not restored for handler: got %q", w.Body.String())
	}
}

func TestHMACSignature_TamperedRejected(t *testing.T) {
	const secret = "sk_test_secret"
	signed := `{"reference":"LB-1","status":"success"}`
	forged := `{"reference":"LB-1","status":"success","amount":0}` // attacker changes body
	r := engine(RequireHMACSignature(secret, "x-paystack-signature"))

	req := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(forged))
	req.Header.Set("x-paystack-signature", sign(secret, signed)) // sig for a different body
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("tampered body must be 401, got %d", w.Code)
	}
}

func TestHMACSignature_MissingHeaderRejected(t *testing.T) {
	r := engine(RequireHMACSignature("sk_test_secret", "x-paystack-signature"))
	req := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(`{}`))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("missing signature must be 401, got %d", w.Code)
	}
}

func TestHMACSignature_UnconfiguredFailsClosed(t *testing.T) {
	r := engine(RequireHMACSignature("", "x-paystack-signature")) // no secret set
	req := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(`{"status":"success"}`))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("unconfigured secret must fail closed (503), got %d", w.Code)
	}
}

func TestHMACSignatureAny_WithWhsecAndSecretKey(t *testing.T) {
	const whsec = "whsec_b6927bc04441dc9ebd92aeecdd54c3f9df645840b0938a77d91869a1c5c425e6"
	const secretKey = "sk_test_e99eb614f281d0953422461442593ffc90b370fa"
	body := `{"event":"charge.success","data":{"reference":"LB-WHSEC","status":"success"}}`

	r := engine(RequireHMACSignatureAny("x-paystack-signature", whsec, secretKey))

	// Test 1: Signed with primary secretKey (HMAC-SHA512)
	req1 := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(body))
	req1.Header.Set("x-paystack-signature", sign(secretKey, body))
	w1 := httptest.NewRecorder()
	r.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Fatalf("secretKey signature should pass, got %d", w1.Code)
	}

	// Test 2: Signed with whsec (HMAC-SHA512)
	req2 := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(body))
	req2.Header.Set("x-paystack-signature", sign(whsec, body))
	w2 := httptest.NewRecorder()
	r.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("whsec signature should pass, got %d", w2.Code)
	}
}

func TestSharedSecret_Behaviour(t *testing.T) {
	r := engine(RequireSharedSecret("verifhash123", "verif-hash"))

	// valid
	req := httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(`{}`))
	req.Header.Set("verif-hash", "verifhash123")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("valid shared secret should pass, got %d", w.Code)
	}

	// wrong
	req = httptest.NewRequest(http.MethodPost, "/hook", strings.NewReader(`{}`))
	req.Header.Set("verif-hash", "wrong")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("wrong shared secret must be 401, got %d", w.Code)
	}
}
