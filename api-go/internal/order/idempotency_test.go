package order

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

const (
	idemUser1 = "00000000-0000-0000-0000-000000000001"
	idemUser2 = "00000000-0000-0000-0000-000000000002"
)

// countingOrders counts how many orders were really created. It can be told to
// pause inside CreateCheckout (to simulate a slow first request) or to fail.
type countingOrders struct {
	domain.OrderService
	created atomic.Int32
	started chan struct{} // signalled when a CreateCheckout begins (if set)
	gate    chan struct{} // CreateCheckout waits for this to close (if set)
	fail    atomic.Bool
}

func (s *countingOrders) CreateCheckout(_ context.Context, buyerID string, _ []struct {
	ProductID uint `json:"product_id"`
	Qty       int  `json:"qty"`
}, _, _, _, _, _ string) (*domain.Order, error) {
	if s.started != nil {
		s.started <- struct{}{}
	}
	if s.gate != nil {
		select {
		case <-s.gate:
		case <-time.After(3 * time.Second): // never hang a failing test
		}
	}
	if s.fail.Load() {
		return nil, errors.New("insufficient stock")
	}
	n := s.created.Add(1)
	return &domain.Order{ID: fmt.Sprintf("LB-%d", n), BuyerID: buyerID, Total: 1000}, nil
}

func idemDB(t *testing.T) *gorm.DB {
	t.Helper()
	name := "file:idem_" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(name), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.IdempotencyRecord{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func placeOrder(t *testing.T, svc *countingOrders, db *gorm.DB, user, key string) (int, string) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	h := NewOrderHandler(svc, db, slog.New(slog.NewTextHandler(io.Discard, nil)))
	r := gin.New()
	r.POST("/orders", func(c *gin.Context) { c.Set("userID", user) }, h.CreateOrder)
	body := `{"items":[{"product_id":1,"qty":1}],"address":"1 Road","city":"Lagos","state":"Lagos","phone":"0800","pay_method":"card"}`
	req := httptest.NewRequest(http.MethodPost, "/orders", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code, w.Body.String()
}

func TestCreateOrder_ARetryWithTheSameKeyDoesNotCreateASecondOrder(t *testing.T) {
	db := idemDB(t)
	svc := &countingOrders{}

	c1, b1 := placeOrder(t, svc, db, idemUser1, "key-1")
	c2, b2 := placeOrder(t, svc, db, idemUser1, "key-1")
	if c1 != 201 || c2 != 201 || svc.created.Load() != 1 {
		t.Fatalf("codes %d/%d, orders created %d; want 201/201 and exactly 1", c1, c2, svc.created.Load())
	}
	var j1, j2 any
	_ = json.Unmarshal([]byte(b1), &j1)
	_ = json.Unmarshal([]byte(b2), &j2)
	if !strings.Contains(b2, "LB-") || !reflect.DeepEqual(j1, j2) {
		t.Errorf("the retry must return the first order unchanged:\n%s\n%s", b1, b2)
	}
	// Another buyer using the same key is a different request.
	placeOrder(t, svc, db, idemUser2, "key-1")
	if svc.created.Load() != 2 {
		t.Errorf("a key is scoped to its buyer; created %d, want 2", svc.created.Load())
	}
	// A different key from the same buyer is a new order, and no key means no protection.
	placeOrder(t, svc, db, idemUser1, "key-2")
	placeOrder(t, svc, db, idemUser1, "")
	if svc.created.Load() != 4 {
		t.Errorf("created %d, want 4", svc.created.Load())
	}
}

// The real race: the retry arrives while the first request is still working.
// It must not create a second order, and must tell the client to wait.
func TestCreateOrder_ASimultaneousDuplicateIsHeldOffNotDoubled(t *testing.T) {
	db := idemDB(t)
	svc := &countingOrders{started: make(chan struct{}, 4), gate: make(chan struct{})}

	firstDone := make(chan int, 1)
	go func() {
		code, _ := placeOrder(t, svc, db, idemUser1, "key-race")
		firstDone <- code
	}()
	<-svc.started // the first request is now inside CreateCheckout

	code, body := placeOrder(t, svc, db, idemUser1, "key-race")
	if code != http.StatusConflict {
		t.Fatalf("duplicate while in flight: status %d, want 409 (%s)", code, body)
	}
	select {
	case <-svc.started:
		t.Fatal("the duplicate reached CreateCheckout: a second order would have been created")
	default:
	}

	close(svc.gate)
	if c := <-firstDone; c != 201 {
		t.Fatalf("first request finished with %d, want 201", c)
	}
	// After it finishes, the same key replays the stored answer.
	code, _ = placeOrder(t, svc, db, idemUser1, "key-race")
	if code != 201 || svc.created.Load() != 1 {
		t.Errorf("retry after completion: status %d, orders created %d; want 201 and 1", code, svc.created.Load())
	}
}

// A failed order must free its key so the buyer can try again.
func TestCreateOrder_AFailedOrderFreesTheKey(t *testing.T) {
	db := idemDB(t)
	svc := &countingOrders{}
	svc.fail.Store(true)
	if code, _ := placeOrder(t, svc, db, idemUser1, "key-fail"); code == 201 {
		t.Fatal("the failing order should not return 201")
	}
	svc.fail.Store(false)
	if code, _ := placeOrder(t, svc, db, idemUser1, "key-fail"); code != 201 || svc.created.Load() != 1 {
		t.Errorf("after the failure: status %d, created %d; want 201 and 1", code, svc.created.Load())
	}
}

// A claim left behind by a crashed server, and an expired record, must not
// lock the key forever.
func TestCreateOrder_StaleAndExpiredRecordsCanBeReused(t *testing.T) {
	db := idemDB(t)
	svc := &countingOrders{}
	old := time.Now().Add(-time.Hour)
	// A claim that never finished (status 0), made an hour ago.
	db.Create(&domain.IdempotencyRecord{Key: "key-stale", UserID: idemUser1, Operation: "create_order", ExpiresAt: time.Now().Add(23 * time.Hour), CreatedAt: old})
	// A finished record that has expired.
	db.Create(&domain.IdempotencyRecord{Key: "key-exp", UserID: idemUser1, Operation: "create_order", ResponseJSON: `{"order":{"id":"LB-OLD"}}`, StatusCode: 201, ExpiresAt: old, CreatedAt: old})

	if code, _ := placeOrder(t, svc, db, idemUser1, "key-stale"); code != 201 || svc.created.Load() != 1 {
		t.Errorf("stale claim: status %d, created %d; want 201 and 1", code, svc.created.Load())
	}
	code, body := placeOrder(t, svc, db, idemUser1, "key-exp")
	if code != 201 || svc.created.Load() != 2 || strings.Contains(body, "LB-OLD") {
		t.Errorf("expired record: status %d, created %d, body %s; want a fresh order", code, svc.created.Load(), body)
	}
}

// The database itself must refuse two records for one (key, buyer, operation).
func TestIdempotencyRecord_DatabaseEnforcesOnePerKey(t *testing.T) {
	db := idemDB(t)
	r := func() *domain.IdempotencyRecord {
		return &domain.IdempotencyRecord{Key: "k", UserID: idemUser1, Operation: "create_order", ExpiresAt: time.Now().Add(time.Hour)}
	}
	if err := db.Create(r()).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(r()).Error; err == nil {
		t.Error("a second record for the same key and buyer must be rejected by a unique index")
	}
}

// If the buyer's connection drops right after the order was created, the request
// context is cancelled. The answer must still be saved, or a retry minutes later
// would create a second order.
func TestIdempotency_TheAnswerIsSavedEvenIfTheClientHasGone(t *testing.T) {
	db := idemDB(t)
	h := NewOrderHandler(&countingOrders{}, db, slog.New(slog.NewTextHandler(io.Discard, nil)))

	outcome, claimID, _ := h.claimIdempotency(context.Background(), "key-gone", idemUser1)
	if outcome != idemClaimed {
		t.Fatalf("outcome = %v, want a claim", outcome)
	}
	gone, cancel := context.WithCancel(context.Background())
	cancel() // the client disconnected
	h.finishIdempotency(gone, claimID, `{"order":{"id":"LB-9"}}`)

	var rec domain.IdempotencyRecord
	if err := db.First(&rec, claimID).Error; err != nil {
		t.Fatal(err)
	}
	if rec.StatusCode != http.StatusCreated || !strings.Contains(rec.ResponseJSON, "LB-9") {
		t.Errorf("record = status %d, body %q; the answer was lost because the request context was cancelled", rec.StatusCode, rec.ResponseJSON)
	}
	// Releasing after a failed order must also survive a cancelled request.
	_, claim2, _ := h.claimIdempotency(context.Background(), "key-gone-2", idemUser1)
	h.releaseIdempotency(gone, claim2)
	var n int64
	db.Model(&domain.IdempotencyRecord{}).Where("id = ?", claim2).Count(&n)
	if n != 0 {
		t.Error("the claim was not released after a cancelled request, so the key would stay locked")
	}
}
