package order

import (
	"context"
	"encoding/json"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"luxebeau/internal/domain"
	"luxebeau/internal/mail"
	"luxebeau/internal/middleware"
	"luxebeau/internal/response"
)

// paymentConfirmer is anything that can settle a payment notice, such as the
// ads service.
type paymentConfirmer interface {
	ConfirmPayment(ctx context.Context, n domain.PaymentNotice) (domain.PaymentOutcome, error)
}

// transferHandler settles bank-payout (withdrawal) events that Paystack sends
// through the same webhook as card payments.
type transferHandler interface {
	HandleWebhook(ctx context.Context, event, reference string) error
}

type OrderHandler struct {
	service   domain.OrderService
	fallback  paymentConfirmer
	transfers transferHandler
	mailer    *mail.Mailer
	db        *gorm.DB
	logger    *slog.Logger
}

// WithTransferHandler routes Paystack transfer.* events (bank payouts) to the
// withdrawal service instead of the order code.
func (h *OrderHandler) WithTransferHandler(t transferHandler) *OrderHandler {
	h.transfers = t
	return h
}

// WithFallbackConfirmer offers a payment to another service when its
// reference is not an order (for example, a featured-ad payment).
func (h *OrderHandler) WithFallbackConfirmer(c paymentConfirmer) *OrderHandler {
	h.fallback = c
	return h
}

func NewOrderHandler(service domain.OrderService, db *gorm.DB, logger *slog.Logger) *OrderHandler {
	return &OrderHandler{service: service, db: db, logger: logger}
}

// WithMailer enables order confirmation emails.
func (h *OrderHandler) WithMailer(m *mail.Mailer) *OrderHandler {
	h.mailer = m
	return h
}

func naira(kobo int64) string {
	s := strconv.FormatInt(kobo/100, 10)
	for i := len(s) - 3; i > 0; i -= 3 {
		s = s[:i] + "," + s[i:]
	}
	return "₦" + s
}

// sendConfirmation emails the buyer a receipt built from the stored order.
func (h *OrderHandler) sendConfirmation(c *gin.Context, orderID string) {
	user, _ := c.Get("user")
	buyer, _ := user.(*domain.User)
	if h.mailer == nil || buyer == nil {
		return
	}
	order, err := h.service.GetOrderDetails(c.Request.Context(), orderID)
	if err != nil || order == nil {
		return
	}
	email := mail.OrderEmail{
		OrderID:       order.ID,
		PaymentStatus: order.PaymentStatus,
		Subtotal:      naira(order.Subtotal),
		Delivery:      naira(order.DeliveryFee),
		Total:         naira(order.Total),
		PaymentMethod: order.PaymentMethod,
		Address:       order.Address + ", " + order.City + ", " + order.State,
	}
	if order.DeliveryFee == 0 {
		email.Delivery = "Free"
	}
	for _, it := range order.Items {
		email.Items = append(email.Items, mail.OrderLine{
			Name: it.Product.Name, Brand: it.Product.Brand, Qty: it.Qty, Total: naira(it.Price * int64(it.Qty)),
		})
	}
	to, name := buyer.Email, buyer.Name
	h.mailer.Go("order_placed", func(ctx context.Context) error { return h.mailer.OrderPlaced(ctx, to, name, email) })
}

type CheckoutRequest struct {
	Items []struct {
		ProductID uint `json:"product_id" binding:"required"`
		Qty       int  `json:"qty" binding:"required,min=1,max=100"`
	} `json:"items" binding:"required,min=1,max=50,dive"`
	Address   string `json:"address" binding:"required,max=500"`
	City      string `json:"city" binding:"required,max=100"`
	State     string `json:"state" binding:"required,max=100"`
	Phone     string `json:"phone" binding:"required,max=20"`
	PayMethod string `json:"pay_method" binding:"required,oneof=card transfer ussd wallet monnify flutterwave crypto"`
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Check your bag and delivery details: each item needs a quantity from 1 to 100, and every address field is required.")
		return
	}

	buyerID := c.GetString("userID")

	// ── Idempotency ──────────────────────────────────────────────────────────
	// With an Idempotency-Key header the key is claimed BEFORE the order is
	// created. The database's unique index picks the winner when two requests
	// with one key arrive together, so a retry can never create a second order.
	idempKey := strings.TrimSpace(c.GetHeader("Idempotency-Key"))
	var claimID uint
	if idempKey != "" && h.db != nil {
		outcome, id, stored := h.claimIdempotency(c.Request.Context(), idempKey, buyerID)
		switch outcome {
		case idemReplay:
			var body gin.H
			if err := json.Unmarshal([]byte(stored.ResponseJSON), &body); err != nil {
				h.logger.Error("stored idempotent answer is unreadable", slog.String("key", idempKey), slog.Any("error", err))
				response.InternalError(c, "We couldn't confirm your earlier order. Please check your orders before trying again.")
				return
			}
			// Same envelope as the first answer, so clients read it the same way.
			response.Success(c, stored.StatusCode, body)
			return
		case idemBusy:
			response.Conflict(c, "This order is already being placed. Please wait a moment, then check your orders.")
			return
		case idemUnavailable:
			response.Fail(c, http.StatusServiceUnavailable, "TRY_AGAIN", "We couldn't place your order safely right now. Please try again in a moment.")
			return
		}
		claimID = id
	}

	items := make([]struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}, len(req.Items))
	for i, item := range req.Items {
		items[i].ProductID = item.ProductID
		items[i].Qty = item.Qty
	}

	order, err := h.service.CreateCheckout(c.Request.Context(), buyerID, items, req.Address, req.City, req.State, req.Phone, req.PayMethod)
	if err != nil {
		// Map internal errors to user-safe messages — never expose stock counts
		// or product IDs to the client.
		msg := "Something went wrong placing your order. Please try again."
		switch {
		case strings.Contains(err.Error(), "insufficient stock"),
			strings.Contains(err.Error(), "product") && strings.Contains(err.Error(), "not found"):
			msg = "One or more items in your bag are no longer available. Please review your cart."
		case strings.Contains(err.Error(), "insufficient wallet balance"):
			msg = "Your wallet balance is too low for this order."
		case strings.Contains(err.Error(), "invalid quantity"):
			msg = "Check your bag and delivery details: each item needs a quantity from 1 to 100."
		}
		if claimID != 0 {
			h.releaseIdempotency(c.Request.Context(), claimID) // a failed order must not lock the key
		}
		response.Conflict(c, msg)
		return
	}

	h.sendConfirmation(c, order.ID)

	// ── Store the answer against the claim so retries replay it ─────────────
	if claimID != 0 {
		if b, err := json.Marshal(gin.H{"order": order}); err == nil {
			h.finishIdempotency(c.Request.Context(), claimID, string(b))
		} else {
			h.logger.Error("could not encode the order answer for idempotency",
				slog.String("request_id", c.GetString(middleware.RequestIDKey)), slog.Any("error", err))
		}
	}

	response.Created(c, gin.H{"order": order})
}

// QuoteRequest is what the cart sends to be priced before the buyer pays.
type QuoteRequest struct {
	Items []struct {
		ProductID uint `json:"product_id" binding:"required"`
		Qty       int  `json:"qty" binding:"required,min=1,max=100"`
	} `json:"items" binding:"required,min=1,max=50,dive"`
	City      string `json:"city" binding:"required,max=100"`
	PayMethod string `json:"pay_method" binding:"required,oneof=card transfer ussd wallet monnify flutterwave crypto"`
}

// QuoteOrder: POST /api/v1/orders/quote. Prices a bag exactly as checkout will
// charge it (goods, each seller's delivery, the platform fee and, for card
// payments, the processing fee) without placing an order.
func (h *OrderHandler) QuoteOrder(c *gin.Context) {
	var req QuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Check your bag: each item needs a quantity from 1 to 100, and we need your city and how you'll pay.")
		return
	}
	items := make([]struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}, len(req.Items))
	for i, item := range req.Items {
		items[i].ProductID = item.ProductID
		items[i].Qty = item.Qty
	}
	price, err := h.service.QuoteCheckout(c.Request.Context(), items, req.City, req.PayMethod)
	if err != nil {
		h.logger.Warn("order quote failed", slog.Any("error", err))
		response.Conflict(c, "We couldn't price that bag. Check the items and try again.")
		return
	}
	response.OK(c, gin.H{"quote": price})
}

func (h *OrderHandler) ListMyOrders(c *gin.Context) {
	buyerID, _ := c.Get("userID")
	orders, err := h.service.ListMyOrders(c.Request.Context(), buyerID.(string))
	if err != nil {
		response.InternalError(c, "Failed to fetch orders")
		return
	}
	response.OK(c, gin.H{"orders": orders})
}

func (h *OrderHandler) GetOrder(c *gin.Context) {
	orderID := c.Param("id")
	order, err := h.service.GetOrderDetails(c.Request.Context(), orderID)
	if err != nil {
		response.InternalError(c, "Failed to fetch order")
		return
	}
	// Only the buyer (or an admin) may read an order; anyone else gets the
	// same 404 as a missing order so IDs can't be probed.
	if order == nil || (order.BuyerID != c.GetString("userID") && c.GetString("userRole") != "admin") {
		response.NotFound(c, "Order not found")
		return
	}
	response.OK(c, gin.H{"order": order})
}

// ── Payment webhooks ──
// Signatures are verified by middleware before these run. Each handler only
// translates its provider's payload into a PaymentNotice; ConfirmPayment
// decides what happens. A 200 is returned for everything except a server
// error, so providers don't retry notices we have deliberately ignored.

// nairaToKobo converts a decimal naira amount to kobo without float drift.
func nairaToKobo(n float64) int64 { return int64(math.Round(n * 100)) }

func (h *OrderHandler) applyPayment(c *gin.Context, n domain.PaymentNotice) {
	outcome, err := h.service.ConfirmPayment(c.Request.Context(), n)
	// Ads are only ever paid through Paystack.
	if err == nil && outcome == domain.PaymentUnknownOrder && h.fallback != nil && n.Provider == "paystack" {
		outcome, err = h.fallback.ConfirmPayment(c.Request.Context(), n)
	}
	if err != nil {
		h.logger.Error("payment webhook failed", slog.String("provider", n.Provider), slog.Any("error", err))
		response.InternalError(c, "Webhook processing failed")
		return
	}
	h.logger.Info("payment webhook", slog.String("provider", n.Provider), slog.String("reference", n.Reference), slog.String("outcome", string(outcome)))
	response.OK(c, gin.H{"outcome": outcome})
}

type PaystackWebhookPayload struct {
	Event string `json:"event"`
	Data  struct {
		Reference string `json:"reference"`
		Status    string `json:"status"`
		Amount    int64  `json:"amount"` // kobo
		Currency  string `json:"currency"`
	} `json:"data"`
}

func (h *OrderHandler) PaystackWebhook(c *gin.Context) {
	var p PaystackWebhookPayload
	if err := c.ShouldBindJSON(&p); err != nil || p.Data.Reference == "" {
		response.BadRequest(c, "Invalid webhook payload")
		return
	}
	// Bank payout results are not order payments.
	if strings.HasPrefix(p.Event, "transfer.") {
		if h.transfers != nil {
			if err := h.transfers.HandleWebhook(c.Request.Context(), p.Event, p.Data.Reference); err != nil {
				// A 5xx makes Paystack retry, so a failed payout is still refunded.
				h.logger.Error("transfer webhook failed", slog.String("event", p.Event), slog.Any("error", err))
				response.InternalError(c, "Webhook processing failed")
				return
			}
		}
		response.OK(c, gin.H{"outcome": "transfer"})
		return
	}
	h.applyPayment(c, domain.PaymentNotice{
		Provider: "paystack", Reference: p.Data.Reference,
		Succeeded: p.Event == "charge.success" && p.Data.Status == "success",
		Amount:    p.Data.Amount, Currency: p.Data.Currency,
	})
}

type FlutterwaveWebhookPayload struct {
	Event string `json:"event"`
	Data  struct {
		TxRef    string  `json:"tx_ref"`
		Status   string  `json:"status"`
		Amount   float64 `json:"amount"` // naira
		Currency string  `json:"currency"`
	} `json:"data"`
}

func (h *OrderHandler) FlutterwaveWebhook(c *gin.Context) {
	var p FlutterwaveWebhookPayload
	if err := c.ShouldBindJSON(&p); err != nil || p.Data.TxRef == "" {
		response.BadRequest(c, "Invalid Flutterwave payload")
		return
	}
	h.applyPayment(c, domain.PaymentNotice{
		Provider: "flutterwave", Reference: p.Data.TxRef,
		Succeeded: p.Data.Status == "successful",
		Amount:    nairaToKobo(p.Data.Amount), Currency: p.Data.Currency,
	})
}

type MonnifyWebhookPayload struct {
	EventType string `json:"eventType"`
	EventData struct {
		PaymentReference string  `json:"paymentReference"`
		PaymentStatus    string  `json:"paymentStatus"`
		AmountPaid       float64 `json:"amountPaid"` // naira
		Currency         string  `json:"currency"`
	} `json:"eventData"`
}

func (h *OrderHandler) MonnifyWebhook(c *gin.Context) {
	var p MonnifyWebhookPayload
	if err := c.ShouldBindJSON(&p); err != nil || p.EventData.PaymentReference == "" {
		response.BadRequest(c, "Invalid Monnify payload")
		return
	}
	h.applyPayment(c, domain.PaymentNotice{
		Provider: "monnify", Reference: p.EventData.PaymentReference,
		Succeeded: p.EventData.PaymentStatus == "PAID",
		Amount:    nairaToKobo(p.EventData.AmountPaid), Currency: p.EventData.Currency,
	})
}

// CryptoWebhookPayload is LuxeBeau's own contract with the crypto bridge.
// It must name the order and the amount settled, in kobo.
type CryptoWebhookPayload struct {
	Reference  string `json:"reference"`
	TxHash     string `json:"tx_hash"`
	Status     string `json:"status"` // confirmed, failed, pending
	AmountKobo int64  `json:"amount_kobo"`
	Currency   string `json:"currency"`
}

func (h *OrderHandler) CryptoWebhook(c *gin.Context) {
	var p CryptoWebhookPayload
	if err := c.ShouldBindJSON(&p); err != nil || p.Reference == "" {
		response.BadRequest(c, "Invalid Crypto payload")
		return
	}
	if p.Status != "confirmed" && p.Status != "failed" {
		response.OK(c, gin.H{"outcome": domain.PaymentIgnored}) // still pending
		return
	}
	h.applyPayment(c, domain.PaymentNotice{
		Provider: "crypto", Reference: p.Reference,
		Succeeded: p.Status == "confirmed",
		Amount:    p.AmountKobo, Currency: p.Currency,
	})
}

// VerifyPayment provides a synchronous fallback to query the payment gateway directly.
func (h *OrderHandler) VerifyPayment(c *gin.Context) {
	orderID := c.Param("id")
	reference := c.Query("reference")
	if reference == "" {
		var body struct {
			Reference string `json:"reference"`
		}
		_ = c.ShouldBindJSON(&body)
		reference = body.Reference
	}

	order, err := h.service.GetOrderDetails(c.Request.Context(), orderID)
	if err != nil || order == nil {
		response.NotFound(c, "Order not found")
		return
	}

	// Security: Only the buyer or an admin may verify the payment.
	userID := c.GetString("userID")
	userRole := c.GetString("userRole")
	if order.BuyerID != userID && userRole != "admin" {
		response.Forbidden(c, "You are not authorized to verify this order")
		return
	}

	updated, err := h.service.VerifyPayment(c.Request.Context(), orderID, reference)
	if err != nil {
		h.logger.Warn("order payment verification failed", slog.String("order", orderID), slog.Any("error", err))
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, gin.H{"order": updated, "verified": true})
}
