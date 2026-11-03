package middleware

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"io"
	"net/http"
	"strings"

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
	return RequireHMACSignatureAny(header, secret)
}

// RequireHMACSignatureAny tests inbound signatures against a list of candidate secrets.
// It supports standard Paystack HMAC-SHA512 as well as whsec_ webhook signing secrets.
func RequireHMACSignatureAny(header string, secrets ...string) gin.HandlerFunc {
	validSecrets := make([]string, 0, len(secrets))
	for _, s := range secrets {
		if strings.TrimSpace(s) != "" {
			validSecrets = append(validSecrets, strings.TrimSpace(s))
		}
	}

	return func(c *gin.Context) {
		if len(validSecrets) == 0 {
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

		got := c.GetHeader(header)
		if got == "" {
			// Fallback checks for standard webhook header aliases
			if alt := c.GetHeader("webhook-signature"); alt != "" {
				got = alt
			} else if alt := c.GetHeader("x-signature"); alt != "" {
				got = alt
			}
		}

		if got == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{"code": "INVALID_SIGNATURE", "message": "Missing webhook signature header."}})
			return
		}

		// Try all configured candidate secrets
		matched := false
		for _, s := range validSecrets {
			// 1. Paystack standard: HMAC-SHA512 hex
			mac512 := hmac.New(sha512.New, []byte(s))
			mac512.Write(body)
			exp512 := hex.EncodeToString(mac512.Sum(nil))
			if subtle.ConstantTimeCompare([]byte(exp512), []byte(got)) == 1 {
				matched = true
				break
			}

			// 2. HMAC-SHA256 hex (standard for whsec_ secrets)
			mac256 := hmac.New(sha256.New, []byte(s))
			mac256.Write(body)
			exp256 := hex.EncodeToString(mac256.Sum(nil))
			if subtle.ConstantTimeCompare([]byte(exp256), []byte(got)) == 1 {
				matched = true
				break
			}

			// 3. Svix-style whsec_ base64 secret parsing
			if strings.HasPrefix(s, "whsec_") {
				rawSec, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(s, "whsec_"))
				if err == nil {
					macRaw := hmac.New(sha256.New, rawSec)
					macRaw.Write(body)
					rawHex := hex.EncodeToString(macRaw.Sum(nil))
					rawB64 := base64.StdEncoding.EncodeToString(macRaw.Sum(nil))
					if subtle.ConstantTimeCompare([]byte(rawHex), []byte(got)) == 1 ||
						subtle.ConstantTimeCompare([]byte(rawB64), []byte(got)) == 1 {
						matched = true
						break
					}
				}
			}
		}

		if !matched {
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
