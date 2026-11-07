package order

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/domain"
)

// stubOrders answers every payment notice with a fixed outcome.
type stubOrders struct {
	domain.OrderService
	outcome domain.PaymentOutcome
}

func (s stubOrders) ConfirmPayment(context.Context, domain.PaymentNotice) (domain.PaymentOutcome, error) {
	return s.outcome, nil
}

type stubAds struct {
	got     *domain.PaymentNotice
	outcome domain.PaymentOutcome
}

func (s *stubAds) ConfirmPayment(_ context.Context, n domain.PaymentNotice) (domain.PaymentOutcome, error) {
	s.got = &n
	return s.outcome, nil
}

func hookEngine(h *OrderHandler) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/paystack", h.PaystackWebhook)
	return r
}

func fire(r *gin.Engine) (int, string) {
	body := `{"event":"charge.success","data":{"reference":"AD-123","status":"success","amount":500000,"currency":"NGN"}}`
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/paystack", strings.NewReader(body)))
	var out struct {
		Data struct {
			Outcome string `json:"outcome"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out.Data.Outcome
}

func newHandler(o domain.PaymentOutcome) *OrderHandler {
	return NewOrderHandler(stubOrders{outcome: o}, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

// A Paystack payment whose reference is not an order belongs to something else
// (an ad). The webhook must offer it to the ads service instead of dropping it.
func TestWebhook_UnknownOrderFallsBackToAds(t *testing.T) {
	ads := &stubAds{outcome: domain.PaymentMarkedPaid}
	h := newHandler(domain.PaymentUnknownOrder).WithFallbackConfirmer(ads)

	code, outcome := fire(hookEngine(h))
	if code != http.StatusOK || outcome != "paid" {
		t.Fatalf("got %d %q, want 200 paid", code, outcome)
	}
	if ads.got == nil || ads.got.Reference != "AD-123" || ads.got.Amount != 500000 {
		t.Fatalf("ads service did not receive the notice: %+v", ads.got)
	}
}

func TestWebhook_KnownOrderNeverReachesAds(t *testing.T) {
	ads := &stubAds{outcome: domain.PaymentMarkedPaid}
	h := newHandler(domain.PaymentMarkedPaid).WithFallbackConfirmer(ads)

	if code, outcome := fire(hookEngine(h)); code != http.StatusOK || outcome != "paid" {
		t.Fatalf("got %d %q", code, outcome)
	}
	if ads.got != nil {
		t.Fatal("a payment that matched an order must not also be offered to ads")
	}
}

func TestWebhook_UnknownEverywhereIsStillAcknowledged(t *testing.T) {
	ads := &stubAds{outcome: domain.PaymentUnknownOrder}
	h := newHandler(domain.PaymentUnknownOrder).WithFallbackConfirmer(ads)

	if code, outcome := fire(hookEngine(h)); code != http.StatusOK || outcome != "unknown_order" {
		t.Fatalf("got %d %q, want 200 unknown_order (so Paystack stops retrying)", code, outcome)
	}
}

func TestWebhook_WorksWithoutAFallback(t *testing.T) {
	h := newHandler(domain.PaymentUnknownOrder)
	if code, outcome := fire(hookEngine(h)); code != http.StatusOK || outcome != "unknown_order" {
		t.Fatalf("got %d %q", code, outcome)
	}
}
