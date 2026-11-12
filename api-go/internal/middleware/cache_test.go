package middleware

import (
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func cacheRouter(c *PublicCache, calls *atomic.Int32, h gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(ctx *gin.Context) { ctx.Header("X-Upstream", "kept") }) // stands in for CORS headers
	r.Any("/items", c.Middleware(), func(ctx *gin.Context) {
		calls.Add(1)
		h(ctx)
	})
	return r
}

func okJSON(ctx *gin.Context) { ctx.JSON(200, gin.H{"n": 1, "q": ctx.Query("q")}) }

func do(r *gin.Engine, method, url string, hdr map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, url, nil)
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestPublicCache_TheSecondRequestIsServedFromMemory(t *testing.T) {
	var calls atomic.Int32
	r := cacheRouter(NewPublicCache(time.Minute, 50), &calls, okJSON)
	a := do(r, "GET", "/items?q=soap", nil)
	b := do(r, "GET", "/items?q=soap", nil)
	if calls.Load() != 1 {
		t.Fatalf("handler ran %d times, want 1 (the second answer should come from memory)", calls.Load())
	}
	if a.Code != 200 || b.Code != 200 || a.Body.String() != b.Body.String() {
		t.Errorf("answers differ: %d %q vs %d %q", a.Code, a.Body.String(), b.Code, b.Body.String())
	}
	if a.Header().Get("X-Cache") != "MISS" || b.Header().Get("X-Cache") != "HIT" {
		t.Errorf("X-Cache = %q then %q, want MISS then HIT", a.Header().Get("X-Cache"), b.Header().Get("X-Cache"))
	}
	for _, w := range []*httptest.ResponseRecorder{a, b} {
		cc := w.Header().Get("Cache-Control")
		if !strings.Contains(cc, "public") || !strings.Contains(cc, "max-age=") {
			t.Errorf("Cache-Control = %q; browsers should be told they may keep it briefly", cc)
		}
		if w.Header().Get("X-Upstream") != "kept" {
			t.Error("headers set before the cache (such as CORS) must survive on both the miss and the hit")
		}
		if !strings.HasPrefix(w.Header().Get("Content-Type"), "application/json") {
			t.Errorf("content type = %q", w.Header().Get("Content-Type"))
		}
	}
}

func TestPublicCache_DifferentAddressesAreCachedSeparately(t *testing.T) {
	var calls atomic.Int32
	r := cacheRouter(NewPublicCache(time.Minute, 50), &calls, okJSON)
	a := do(r, "GET", "/items?q=soap", nil)
	b := do(r, "GET", "/items?q=butter", nil)
	if calls.Load() != 2 || a.Body.String() == b.Body.String() {
		t.Errorf("calls %d; a search for butter must not get the soap answer: %q / %q", calls.Load(), a.Body.String(), b.Body.String())
	}
}

func TestPublicCache_OnlySuccessfulGetsAreKept(t *testing.T) {
	var calls atomic.Int32
	r := cacheRouter(NewPublicCache(time.Minute, 50), &calls, func(ctx *gin.Context) { ctx.JSON(500, gin.H{"error": "boom"}) })
	do(r, "GET", "/items", nil)
	w := do(r, "GET", "/items", nil)
	if calls.Load() != 2 || w.Code != 500 {
		t.Errorf("an error must not be cached: calls %d code %d", calls.Load(), w.Code)
	}
	if cc := w.Header().Get("Cache-Control"); cc != "" && !strings.Contains(cc, "no-store") {
		t.Errorf("an error response must not tell browsers to keep it: %q", cc)
	}

	var calls2 atomic.Int32
	r2 := cacheRouter(NewPublicCache(time.Minute, 50), &calls2, okJSON)
	do(r2, "POST", "/items", nil)
	do(r2, "POST", "/items", nil)
	do(r2, "GET", "/items", nil)
	if calls2.Load() != 3 {
		t.Errorf("writes must always reach the handler, and must not be cached: calls %d, want 3", calls2.Load())
	}
}

func TestPublicCache_SignedInRequestsAreNotCached(t *testing.T) {
	var calls atomic.Int32
	r := cacheRouter(NewPublicCache(time.Minute, 50), &calls, okJSON)
	do(r, "GET", "/items", map[string]string{"Authorization": "Bearer abc"})
	do(r, "GET", "/items", map[string]string{"Authorization": "Bearer abc"})
	if calls.Load() != 2 {
		t.Errorf("a request with an Authorization header must bypass the cache: calls %d, want 2", calls.Load())
	}
}

func TestPublicCache_AnswersExpire(t *testing.T) {
	var calls atomic.Int32
	r := cacheRouter(NewPublicCache(60*time.Millisecond, 50), &calls, okJSON)
	do(r, "GET", "/items", nil)
	time.Sleep(110 * time.Millisecond)
	w := do(r, "GET", "/items", nil)
	if calls.Load() != 2 || w.Header().Get("X-Cache") != "MISS" {
		t.Errorf("an expired answer must be fetched again: calls %d, X-Cache %q", calls.Load(), w.Header().Get("X-Cache"))
	}
}

func TestPublicCache_ABurstOfIdenticalRequestsReachesTheHandlerOnce(t *testing.T) {
	var calls atomic.Int32
	r := cacheRouter(NewPublicCache(time.Minute, 50), &calls, func(ctx *gin.Context) {
		time.Sleep(150 * time.Millisecond) // a slow database read
		ctx.JSON(200, gin.H{"n": 1})
	})
	var wg sync.WaitGroup
	codes := make([]int, 20)
	for i := range codes {
		wg.Add(1)
		go func() {
			defer wg.Done()
			codes[i] = do(r, "GET", "/items", nil).Code
		}()
	}
	wg.Wait()
	if calls.Load() != 1 {
		t.Errorf("20 simultaneous identical requests ran the handler %d times, want 1", calls.Load())
	}
	for i, c := range codes {
		if c != 200 {
			t.Errorf("request %d got %d", i, c)
		}
	}
}

func TestPublicCache_MemoryIsBounded(t *testing.T) {
	var calls atomic.Int32
	c := NewPublicCache(time.Minute, 3)
	r := cacheRouter(c, &calls, okJSON)
	for i := 0; i < 12; i++ {
		do(r, "GET", "/items?q="+strings.Repeat("x", i+1), nil)
	}
	if c.Len() > 3 {
		t.Errorf("cache holds %d entries, want at most 3: a stream of different searches must not grow memory", c.Len())
	}
}

func TestPublicCache_HugeAnswersAreSentButNotKept(t *testing.T) {
	var calls atomic.Int32
	r := cacheRouter(NewPublicCache(time.Minute, 50), &calls, func(ctx *gin.Context) {
		ctx.String(200, strings.Repeat("a", maxCachedBody+1))
	})
	a := do(r, "GET", "/items", nil)
	do(r, "GET", "/items", nil)
	if calls.Load() != 2 || a.Body.Len() != maxCachedBody+1 {
		t.Errorf("calls %d, body %d bytes; an oversized answer is sent in full but not stored", calls.Load(), a.Body.Len())
	}
}

// If the route has already identified a user (an auth step ran before the cache),
// the answer may depend on that person, so it must never be shared. This protects
// against the cache being put on a personalised route by mistake.
func TestPublicCache_NeverSharesAnAnswerForAnIdentifiedUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var calls atomic.Int32
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if u := c.GetHeader("X-Test-User"); u != "" {
			c.Set("userID", u) // stands in for the auth middleware
		}
	})
	r.GET("/items", NewPublicCache(time.Minute, 50).Middleware(), func(c *gin.Context) {
		calls.Add(1)
		c.JSON(200, gin.H{"for": c.GetString("userID")})
	})
	a := do(r, "GET", "/items", map[string]string{"X-Test-User": "ada"})
	b := do(r, "GET", "/items", map[string]string{"X-Test-User": "bayo"})
	if calls.Load() != 2 || a.Body.String() == b.Body.String() {
		t.Errorf("calls %d; bayo got %q after ada's %q: an identified user must bypass the shared cache", calls.Load(), b.Body.String(), a.Body.String())
	}
	if a.Header().Get("X-Cache") != "" {
		t.Errorf("an identified user's answer must not be marked cacheable: %q", a.Header().Get("X-Cache"))
	}
	// An anonymous visitor afterwards must not receive ada's answer either.
	c := do(r, "GET", "/items", nil)
	if strings.Contains(c.Body.String(), "ada") {
		t.Errorf("an anonymous visitor received a signed-in user's answer: %q", c.Body.String())
	}
}
