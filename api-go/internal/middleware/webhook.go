package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Payment webhooks mutate money state (mark an order paid), so they must be
// authenticated even though they carry no user session. We verify the provider
// signature over the RAW request body before the handler runs.
//
// SECURITY: all verifiers FAIL CLOSED — if the signing secret is not configured
// the endpoint returns 503 rather than trusting an unsigned payload. Without
// this, anyone could POST {"status":"success"} and mark orders paid for free.

const maxWebhookBody = 1 << 20 // 1 MiB

// readAndRestoreBody reads the body once (for verification) and puts it back so
// the downstream handler's c.ShouldBindJSON still works.
func readAndRestoreBody(c *gin.Context) ([]byte, bool) {
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, maxWebhookBody))
	if err != nil {
		return nil, false
	}
	c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
	return body, true
}

// RequireHMACSignature verifies header == hex(HMAC_SHA512(rawBody, secret)).
// Used by Paystack (x-paystack-signature) and Monnify (monnify-signature).
func RequireHMACSignature(secret, header string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if secret == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"error":   gin.H{"code": "WEBHOOK_NOT_CONFIGURED", "message": "Webhook signing secret is not configured."},
			})
			return
		}
		body, ok := readAndRestoreBody(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": "Could not read request body."}})
			return
		}
		mac := hmac.New(sha512.New, []byte(secret))
		mac.Write(body)
		expected := hex.EncodeToString(mac.Sum(nil))
		got := c.GetHeader(header)
		// constant-time compare to avoid timing leaks
		if subtle.ConstantTimeCompare([]byte(expected), []byte(got)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "INVALID_SIGNATURE", "message": "Webhook signature verification failed."}})
			return
		}
		c.Next()
	}
}

// RequireSharedSecret verifies a header equals a pre-shared secret in constant
// time. Used by Flutterwave (verif-hash) and the crypto bridge.
func RequireSharedSecret(secret, header string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if secret == "" {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"success": false,
				"error":   gin.H{"code": "WEBHOOK_NOT_CONFIGURED", "message": "Webhook secret is not configured."},
			})
			return
		}
		got := c.GetHeader(header)
		if subtle.ConstantTimeCompare([]byte(secret), []byte(got)) != 1 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "INVALID_SIGNATURE", "message": "Webhook secret verification failed."}})
			return
		}
		c.Next()
	}
}
