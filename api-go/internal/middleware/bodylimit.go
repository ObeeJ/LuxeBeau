package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// DefaultBodyLimit is the largest JSON request body the API accepts (1 MiB).
// Every legitimate request here is small; media goes straight to object
// storage, never through the API.
const DefaultBodyLimit int64 = 1 << 20

// BodyLimit caps how many bytes a handler can read from a request body.
//
// Two layers: a request that declares a too-large Content-Length is refused
// straight away with 413, and for streamed or understated bodies the reader is
// wrapped so reading stops at the limit (the handler then sees an error).
func BodyLimit(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "PAYLOAD_TOO_LARGE",
					"message": "That request is too large.",
				},
			})
			return
		}
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}
