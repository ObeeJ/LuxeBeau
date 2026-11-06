package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func limitedEngine(limit int64) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(BodyLimit(limit))
	r.POST("/echo", func(c *gin.Context) {
		b, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.Status(http.StatusRequestEntityTooLarge)
			return
		}
		c.String(http.StatusOK, string(b))
	})
	return r
}

func post(r *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/echo", strings.NewReader(body))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestBodyLimit_SmallBodyPasses(t *testing.T) {
	w := post(limitedEngine(16), "hello")
	if w.Code != http.StatusOK || w.Body.String() != "hello" {
		t.Fatalf("got %d %q, want 200 hello", w.Code, w.Body.String())
	}
}

func TestBodyLimit_BodyAtLimitPasses(t *testing.T) {
	w := post(limitedEngine(5), "12345")
	if w.Code != http.StatusOK {
		t.Fatalf("a body exactly at the limit should pass, got %d", w.Code)
	}
}

func TestBodyLimit_OversizedBodyIsRejectedByDeclaredLength(t *testing.T) {
	// httptest sets ContentLength from the reader, so this is the fast path:
	// refused before the handler reads a single byte.
	w := post(limitedEngine(5), "123456")
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("got %d, want 413", w.Code)
	}
}

func TestBodyLimit_OversizedStreamedBodyIsCutOff(t *testing.T) {
	// A client can lie or stream (ContentLength -1). The reader must still stop.
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(BodyLimit(5))
	r.POST("/echo", func(c *gin.Context) {
		if _, err := io.ReadAll(c.Request.Body); err != nil {
			c.Status(http.StatusRequestEntityTooLarge)
			return
		}
		c.Status(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/echo", strings.NewReader("123456789"))
	req.ContentLength = -1
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("got %d, want 413 for an unbounded oversized stream", w.Code)
	}
}

func TestBodyLimit_GETWithoutBodyUnaffected(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(BodyLimit(1))
	r.GET("/ok", func(c *gin.Context) { c.Status(http.StatusOK) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/ok", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
}
