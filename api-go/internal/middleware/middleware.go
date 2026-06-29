package middleware

import (
	"log/slog"
	"net/http"
	"os"
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

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		allowedOrigin := os.Getenv("ALLOWED_ORIGINS")
		
		// Fallback check if allowed origin matches or is empty (defaulting to safe dev paths)
		if allowedOrigin == "" {
			if origin == "http://localhost:3000" || origin == "http://localhost:3001" || origin == "https://luxebeau.vercel.app" || 
				strings.HasPrefix(origin, "http://localhost:") || strings.HasPrefix(origin, "http://127.0.0.1:") {
				c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
			}
		} else if allowedOrigin == "*" {
			// In production do not use wildcard with credentials; reflect origin if it matches list or just reflect origin
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		}

		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
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
			for ip, cl := range limiters {
				if time.Since(cl.lastSeen) > 5*time.Minute {
					delete(limiters, ip)
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
		ip := c.ClientIP()
		mu.Lock()
		cl, exists := limiters[ip]
		if !exists {
			cl = &clientLimiter{
				limiter: rate.NewLimiter(r, b),
			}
			limiters[ip] = cl
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
