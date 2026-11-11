package review

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func router(t *testing.T, as string) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	s, _ := world(t)
	h := NewHandler(s, slog.New(slog.NewTextHandler(io.Discard, nil)))
	r := gin.New()
	r.GET("/reviews", h.List)
	r.Use(func(c *gin.Context) {
		if as != "" {
			c.Set("userID", as)
		}
	})
	r.POST("/reviews", h.Create)
	r.GET("/me/reviewable", h.Reviewable)
	r.GET("/admin/reviews", h.AdminList)
	r.PATCH("/admin/reviews/:id", h.SetStatus)
	return r
}

func do(r *gin.Engine, method, path, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestHandler_CreateStatusCodes(t *testing.T) {
	r := router(t, buyer)
	cases := []struct {
		name, body string
		want       int
	}{
		{"bad json", `{`, 400},
		{"rating out of range", `{"target_type":"product","target_id":"1","rating":9}`, 400},
		{"not eligible (payout still held)", `{"target_type":"product","target_id":"2","rating":5}`, 403},
		{"ok", `{"target_type":"product","target_id":"1","rating":5,"body":"Great"}`, 201},
		{"second time", `{"target_type":"product","target_id":"1","rating":4}`, 409},
	}
	for _, c := range cases {
		if w := do(r, "POST", "/reviews", c.body); w.Code != c.want {
			t.Errorf("%s: status %d, want %d (%s)", c.name, w.Code, c.want, w.Body.String())
		}
	}
	if w := do(r, "POST", "/reviews", `{"target_type":"product","target_id":"2","rating":5}`); !strings.Contains(w.Body.String(), "NOT_ELIGIBLE") {
		t.Errorf("a not-eligible reply should carry the NOT_ELIGIBLE code: %s", w.Body.String())
	}
}

func TestHandler_CreateNeedsASignedInUser(t *testing.T) {
	r := router(t, "")
	if w := do(r, "POST", "/reviews", `{"target_type":"product","target_id":"1","rating":5}`); w.Code != 401 {
		t.Errorf("status %d, want 401", w.Code)
	}
}

func TestHandler_PublicListShape(t *testing.T) {
	r := router(t, buyer)
	do(r, "POST", "/reviews", `{"target_type":"product","target_id":"1","rating":5,"body":"Great"}`)
	w := do(r, "GET", "/reviews?target_type=product&target_id=1", "")
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var out struct {
		Data struct {
			Reviews []map[string]any `json:"reviews"`
			Count   int              `json:"count"`
			Average float64          `json:"average"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Data.Count != 1 || out.Data.Average != 5 || len(out.Data.Reviews) != 1 {
		t.Fatalf("body = %s", w.Body.String())
	}
	for _, k := range []string{"id", "author", "verified_buyer", "rating", "date", "text", "item"} {
		if _, ok := out.Data.Reviews[0][k]; !ok {
			t.Errorf("review is missing %q: %v", k, out.Data.Reviews[0])
		}
	}
	if _, leaked := out.Data.Reviews[0]["reviewer_id"]; leaked {
		t.Error("the public list must not expose the reviewer's id")
	}
	if w := do(r, "GET", "/reviews?target_type=storefront&target_id=1", ""); w.Code != 400 {
		t.Errorf("unknown target type: status %d, want 400", w.Code)
	}
}

func TestHandler_AdminModeration(t *testing.T) {
	r := router(t, buyer)
	do(r, "POST", "/reviews", `{"target_type":"product","target_id":"1","rating":1,"body":"rude"}`)
	if w := do(r, "PATCH", "/admin/reviews/1", `{"status":"banana"}`); w.Code != 400 {
		t.Errorf("bad status: %d, want 400", w.Code)
	}
	if w := do(r, "PATCH", "/admin/reviews/abc", `{"status":"hidden"}`); w.Code != 400 {
		t.Errorf("bad id: %d, want 400", w.Code)
	}
	if w := do(r, "PATCH", "/admin/reviews/999", `{"status":"hidden"}`); w.Code != http.StatusNotFound {
		t.Errorf("missing review: %d, want 404", w.Code)
	}
	if w := do(r, "PATCH", "/admin/reviews/1", `{"status":"hidden"}`); w.Code != 200 {
		t.Errorf("hide: %d, want 200", w.Code)
	}
	w := do(r, "GET", "/reviews?target_type=product&target_id=1", "")
	if !strings.Contains(w.Body.String(), `"count":0`) {
		t.Errorf("a hidden review must leave the public list: %s", w.Body.String())
	}
	if w := do(r, "GET", "/admin/reviews?status=hidden", ""); w.Code != 200 || !strings.Contains(w.Body.String(), "rude") {
		t.Errorf("admin list: %d %s", w.Code, w.Body.String())
	}
}

func TestHandler_Reviewable(t *testing.T) {
	r := router(t, buyer)
	w := do(r, "GET", "/me/reviewable", "")
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Black soap") || !strings.Contains(w.Body.String(), "Knotless braids") {
		t.Errorf("reviewable: %d %s", w.Code, w.Body.String())
	}
}
