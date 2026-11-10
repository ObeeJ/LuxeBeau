package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/time/rate"
)

const RequestIDKey = "request_id"
const RequestIDHeader = "X-Request-Id"

// RequestID generates a UUID for every request, injects it into the Gin
// context under RequestIDKey, and echoes it back as X-Request-Id so clients
// and logs can correlate a request end-to-end.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(RequestIDHeader)
		if id == "" {
			id = uuid.NewString()
		}
		c.Set(RequestIDKey, id)
		c.Header(RequestIDHeader, id)
		c.Next()
	}
}

func Logger(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		c.Next()

		if raw != "" {
			path = path + "?" + raw
		}

		status := c.Writer.Status()
		duration := time.Since(start)
		requestID, _ := c.Get(RequestIDKey)

		attrs := []any{
			slog.String("method", c.Request.Method),
			slog.String("path", path),
			slog.Int("status", status),
			slog.Duration("duration", duration),
			slog.String("ip", c.ClientIP()),
			slog.Any("request_id", requestID),
		}
		if status >= 400 {
			logger.Warn("HTTP Request Error", attrs...)
		} else {
			logger.Info("HTTP Request Completed", attrs...)
		}
	}
}

func Recovery(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				logger.Error("Panic recovered", slog.Any("error", err))
				c.JSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "INTERNAL_SERVER_ERROR",
						"message": "An unexpected error occurred. Please try again later.",
					},
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}

// CORS allows credentialed requests only from an exact list of origins
// (ALLOWED_ORIGINS, comma separated). A wildcard is never honoured because
// session cookies ride on these requests.
func CORS(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if o = strings.TrimRight(strings.TrimSpace(o), "/"); o != "" && o != "*" {
			allowed[o] = true
		}
	}
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		c.Writer.Header().Add("Vary", "Origin")
		if origin != "" && allowed[origin] {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, "+CSRFHeader)
			c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			c.Writer.Header().Set("Access-Control-Max-Age", "600")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

// CSRFHeader must accompany every state-changing request. Browsers cannot
// attach a custom header cross-site without a CORS preflight, which CORS
// above only grants to allowed origins. Together with SameSite=Strict
// cookies this blocks cross-site request forgery.
const CSRFHeader = "X-LuxeBeau-Client"

func CSRF() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			c.Next()
			return
		}
		if c.GetHeader(CSRFHeader) == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   gin.H{"code": "CSRF_REJECTED", "message": "Request blocked. Please reload the page and try again."},
			})
			return
		}
		c.Next()
	}
}

type clientLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// IPRateLimiter holds per-(route,IP) token-bucket state. Create one with
// NewIPRateLimiter and pass its RateLimit method as a Gin middleware.
// NOTE: state is in-process memory. Replace with a Redis-backed sliding window
// before running more than one API instance.
type IPRateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*clientLimiter
}

func NewIPRateLimiter(ctx context.Context) *IPRateLimiter {
	rl := &IPRateLimiter{limiters: make(map[string]*clientLimiter)}
	go rl.cleanup(ctx)
	return rl
}

func (rl *IPRateLimiter) cleanup(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			rl.mu.Lock()
			for key, cl := range rl.limiters {
				if time.Since(cl.lastSeen) > 5*time.Minute {
					delete(rl.limiters, key)
				}
			}
			rl.mu.Unlock()
		}
	}
}

// RateLimiter returns a middleware that limits requests by (route, IP).
// r: tokens per second; b: burst size.
func (rl *IPRateLimiter) RateLimit(r rate.Limit, b int) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.FullPath() + "|" + c.ClientIP()
		rl.mu.Lock()
		cl, exists := rl.limiters[key]
		if !exists {
			cl = &clientLimiter{limiter: rate.NewLimiter(r, b)}
			rl.limiters[key] = cl
		}
		cl.lastSeen = time.Now()
		rl.mu.Unlock()

		if !cl.limiter.Allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TOO_MANY_REQUESTS",
					"message": "Too many requests. Please slow down and try again.",
				},
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// RateLimiter is kept for backward compatibility in tests. Production code
// should use NewIPRateLimiter and call RateLimit on the returned struct so the
// cleanup goroutine respects the server's shutdown context.
