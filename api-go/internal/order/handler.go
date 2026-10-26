package order

import (
	"context"
	"log/slog"
	"math"
	"strconv"

	"github.com/gin-gonic/gin"
	"luxebeau/internal/domain"
	"luxebeau/internal/mail"
	"luxebeau/internal/response"
)

type OrderHandler struct {
	service domain.OrderService
	mailer  *mail.Mailer
	logger  *slog.Logger
}

func NewOrderHandler(service domain.OrderService, logger *slog.Logger) *OrderHandler {
	return &OrderHandler{service: service, logger: logger}
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

	buyerID, _ := c.Get("userID")

	// Convert handler request items to the service interface type
	items := make([]struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}, len(req.Items))
	for i, item := range req.Items {
		items[i].ProductID = item.ProductID
		items[i].Qty = item.Qty
	}

	order, err := h.service.CreateCheckout(c.Request.Context(), buyerID.(string), items, req.Address, req.City, req.State, req.Phone, req.PayMethod)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}

	h.sendConfirmation(c, order.ID)
	response.Created(c, gin.H{"order": order})
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
