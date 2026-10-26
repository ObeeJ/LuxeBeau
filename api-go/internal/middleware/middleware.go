package middleware

import (
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

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

		if status >= 400 {
			logger.Warn("HTTP Request Error",
				slog.String("method", c.Request.Method),
				slog.String("path", path),
				slog.Int("status", status),
				slog.Duration("duration", duration),
				slog.String("ip", c.ClientIP()),
			)
		} else {
			logger.Info("HTTP Request Completed",
				slog.String("method", c.Request.Method),
				slog.String("path", path),
				slog.Int("status", status),
				slog.Duration("duration", duration),
				slog.String("ip", c.ClientIP()),
			)
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

var (
	limiters = make(map[string]*clientLimiter)
	mu       sync.Mutex
)

func init() {
	// Start clean up worker for dead rate limiters
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			mu.Lock()
			for key, cl := range limiters {
				if time.Since(cl.lastSeen) > 5*time.Minute {
					delete(limiters, key)
				}
			}
			mu.Unlock()
		}
	}()
}

// RateLimiter returns a middleware that limits requests by IP.
// r: number of operations allowed per second
// b: bucket size (maximum burst)
func RateLimiter(r rate.Limit, b int) gin.HandlerFunc {
	return func(c *gin.Context) {
		// One bucket per route and client, so a tight limit on one endpoint
		// never inherits a looser bucket created by another.
		key := c.FullPath() + "|" + c.ClientIP()
		mu.Lock()
		cl, exists := limiters[key]
		if !exists {
			cl = &clientLimiter{
				limiter: rate.NewLimiter(r, b),
			}
			limiters[key] = cl
		}
		cl.lastSeen = time.Now()
		mu.Unlock()

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
