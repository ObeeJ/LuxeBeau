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

// Ads are only ever paid through Paystack, so other providers' notices must
// never be offered to the ads service.
func TestWebhook_FallbackIsPaystackOnly(t *testing.T) {
	ads := &stubAds{outcome: domain.PaymentMarkedPaid}
	h := newHandler(domain.PaymentUnknownOrder).WithFallbackConfirmer(ads)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/x", func(c *gin.Context) {
		h.applyPayment(c, domain.PaymentNotice{Provider: "flutterwave", Reference: "AD-1", Succeeded: true, Amount: 1, Currency: "NGN"})
	})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/x", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
	if ads.got != nil {
		t.Fatal("a non-Paystack notice must not reach the ads service")
	}
}

// Paystack tells us how a bank payout went through the same webhook as card
// payments. Those events belong to the withdrawal service and must never be
// treated as an order payment.
type stubTransfers struct {
	events []string
	refs   []string
	err    error
}

func (s *stubTransfers) HandleWebhook(_ context.Context, event, ref string) error {
	s.events = append(s.events, event)
	s.refs = append(s.refs, ref)
	return s.err
}

func fireEvent(r *gin.Engine, event string) int {
	body := `{"event":"` + event + `","data":{"reference":"lb-wd-7-abcdef0123","status":"success","amount":500000}}`
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/paystack", strings.NewReader(body)))
	return w.Code
}

func TestWebhook_TransferEventsGoToWithdrawalsNotOrders(t *testing.T) {
	transfers := &stubTransfers{}
	ads := &stubAds{outcome: domain.PaymentMarkedPaid}
	// If this reached the order service it would answer "paid".
	h := newHandler(domain.PaymentMarkedPaid).WithFallbackConfirmer(ads).WithTransferHandler(transfers)
	r := hookEngine(h)

	for _, ev := range []string{"transfer.success", "transfer.failed", "transfer.reversed"} {
		if code := fireEvent(r, ev); code != http.StatusOK {
			t.Errorf("%s: got %d, want 200", ev, code)
		}
	}
	if len(transfers.events) != 3 || transfers.refs[0] != "lb-wd-7-abcdef0123" {
		t.Fatalf("withdrawal service got %v %v, want all three events with the reference", transfers.events, transfers.refs)
	}
	if ads.got != nil {
		t.Error("a transfer event must never be offered to the ads service")
	}
}

func TestWebhook_ACardPaymentStillGoesToOrders(t *testing.T) {
	transfers := &stubTransfers{}
	h := newHandler(domain.PaymentMarkedPaid).WithTransferHandler(transfers)
	if code, outcome := fire(hookEngine(h)); code != http.StatusOK || outcome != "paid" {
		t.Fatalf("got %d %q, want a normal card payment to be handled as before", code, outcome)
	}
	if len(transfers.events) != 0 {
		t.Error("a charge event must not reach the withdrawal service")
	}
}

// If recording the result fails, Paystack must be told to retry (500), or a
// failed payout would never be refunded.
func TestWebhook_ATransferFailureAsksPaystackToRetry(t *testing.T) {
	transfers := &stubTransfers{err: context.DeadlineExceeded}
	h := newHandler(domain.PaymentMarkedPaid).WithTransferHandler(transfers)
	if code := fireEvent(hookEngine(h), "transfer.failed"); code != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500 so Paystack retries", code)
	}
}

func TestWebhook_TransferEventsWithoutAHandlerAreAcknowledged(t *testing.T) {
	h := newHandler(domain.PaymentMarkedPaid)
	if code := fireEvent(hookEngine(h), "transfer.success"); code != http.StatusOK {
		t.Fatalf("got %d, want 200", code)
	}
}

func TestWebhook_WorksWithoutAFallback(t *testing.T) {
	h := newHandler(domain.PaymentUnknownOrder)
	if code, outcome := fire(hookEngine(h)); code != http.StatusOK || outcome != "unknown_order" {
		t.Fatalf("got %d %q", code, outcome)
	}
}
