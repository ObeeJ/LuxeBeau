package middleware

import (
	"bytes"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/sync/singleflight"
)

// maxCachedBody is the largest answer kept in memory. Bigger answers are still
// sent in full, just not stored.
const maxCachedBody = 512 << 10

type cacheEntry struct {
	status  int
	ctype   string
	body    []byte
	expires time.Time
}

// PublicCache keeps short-lived copies of public, read-only answers (the shop
// catalogue, artisans, reviews) so that most requests never touch the database.
// It only applies to GET requests without an Authorization header, only keeps
// successful answers, holds a bounded number of entries, and when many identical
// requests arrive together it lets exactly one of them do the work.
//
// Use it only on routes whose answer does not depend on who is asking. A route
// that reads the sign-in cookie itself (such as the public storefront, which
// shows an owner their own draft) must not use it.
type PublicCache struct {
	ttl   time.Duration
	max   int
	mu    sync.Mutex
	items map[string]*cacheEntry
	group singleflight.Group
}

func NewPublicCache(ttl time.Duration, maxEntries int) *PublicCache {
	if maxEntries < 1 {
		maxEntries = 1
	}
	return &PublicCache{ttl: ttl, max: maxEntries, items: make(map[string]*cacheEntry)}
}

// Len reports how many answers are held right now.
func (p *PublicCache) Len() int {
	p.mu.Lock()
	defer p.mu.Unlock()
	return len(p.items)
}

func (p *PublicCache) get(key string) *cacheEntry {
	p.mu.Lock()
	defer p.mu.Unlock()
	e := p.items[key]
	if e == nil {
		return nil
	}
	if time.Now().After(e.expires) {
		delete(p.items, key)
		return nil
	}
	return e
}

func (p *PublicCache) put(key string, e *cacheEntry) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if _, exists := p.items[key]; !exists && len(p.items) >= p.max {
		now := time.Now()
		for k, v := range p.items { // make room: drop anything already expired first
			if now.After(v.expires) {
				delete(p.items, k)
			}
		}
		for k := range p.items { // still full: drop one entry
			if len(p.items) < p.max {
				break
			}
			delete(p.items, k)
		}
	}
	e.expires = time.Now().Add(p.ttl)
	p.items[key] = e
}

// browserMaxAge is how long a browser may reuse an answer without asking again:
// half the server's lifetime, so a browser copy is never staler than the server's.
func (p *PublicCache) browserMaxAge() int {
	return int(p.ttl.Seconds() / 2)
}

func (p *PublicCache) cacheControl() string {
	return fmt.Sprintf("public, max-age=%d, stale-while-revalidate=60", p.browserMaxAge())
}

func (p *PublicCache) replay(c *gin.Context, e *cacheEntry) {
	c.Header("X-Cache", "HIT")
	c.Header("Cache-Control", p.cacheControl())
	c.Data(e.status, e.ctype, e.body)
	c.Abort()
}

func (p *PublicCache) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Anything tied to a person is never shared: an Authorization header, or a
		// user already identified by an auth step that ran before this one.
		if c.Request.Method != http.MethodGet || c.GetHeader("Authorization") != "" || c.GetString("userID") != "" {
			c.Next()
			return
		}
		key := c.Request.URL.RequestURI()
		if e := p.get(key); e != nil {
			p.replay(c, e)
			return
		}
		type outcome struct{ entry *cacheEntry }
		v, _, shared := p.group.Do(key, func() (any, error) {
			rec := &cacheRecorder{ResponseWriter: c.Writer, cache: p}
			c.Writer = rec
			c.Next()
			c.Writer = rec.ResponseWriter
			e := rec.entry()
			if e != nil {
				p.put(key, e)
			}
			return outcome{entry: e}, nil
		})
		if !shared {
			return // this request did the work and has already been answered
		}
		// Another identical request was already working: reuse its answer, or, if
		// it was not cacheable (an error), answer this one normally.
		if e := v.(outcome).entry; e != nil {
			p.replay(c, e)
			return
		}
		c.Next()
	}
}

// cacheRecorder passes the response through to the client while keeping a copy.
type cacheRecorder struct {
	gin.ResponseWriter
	cache    *PublicCache
	buf      bytes.Buffer
	tooBig   bool
	prepared bool
	wrote    bool
}

// prepare runs once, just before the first byte goes out, so the headers can say
// whether this answer may be kept.
func (r *cacheRecorder) prepare() {
	if r.prepared {
		return
	}
	r.prepared = true
	h := r.Header()
	if r.ResponseWriter.Status() == http.StatusOK {
		h.Set("Cache-Control", r.cache.cacheControl())
		h.Set("X-Cache", "MISS")
	} else {
		h.Set("Cache-Control", "no-store")
	}
}

func (r *cacheRecorder) WriteHeaderNow() {
	r.prepare()
	r.ResponseWriter.WriteHeaderNow()
}

func (r *cacheRecorder) keep(b []byte) {
	r.wrote = true
	if r.tooBig {
		return
	}
	if r.buf.Len()+len(b) > maxCachedBody {
		r.tooBig = true
		r.buf.Reset()
		return
	}
	r.buf.Write(b)
}

func (r *cacheRecorder) Write(b []byte) (int, error) {
	r.prepare()
	r.keep(b)
	return r.ResponseWriter.Write(b)
}

func (r *cacheRecorder) WriteString(s string) (int, error) {
	r.prepare()
	r.keep([]byte(s))
	return r.ResponseWriter.WriteString(s)
}

func (r *cacheRecorder) entry() *cacheEntry {
	if !r.wrote || r.tooBig || r.ResponseWriter.Status() != http.StatusOK {
		return nil
	}
	return &cacheEntry{
		status: http.StatusOK,
		ctype:  r.Header().Get("Content-Type"),
		body:   append([]byte(nil), r.buf.Bytes()...),
	}
}
