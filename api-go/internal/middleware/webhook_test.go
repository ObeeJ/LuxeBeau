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
