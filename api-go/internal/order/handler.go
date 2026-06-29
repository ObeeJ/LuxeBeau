package order

import (
	"log/slog"

	"github.com/gin-gonic/gin"
	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type OrderHandler struct {
	service domain.OrderService
	logger  *slog.Logger
}

func NewOrderHandler(service domain.OrderService, logger *slog.Logger) *OrderHandler {
	return &OrderHandler{service: service, logger: logger}
}

type CheckoutRequest struct {
	Items []struct {
		ProductID uint `json:"product_id" binding:"required"`
		Qty       int  `json:"qty" binding:"required,min=1"`
	} `json:"items" binding:"required,min=1"`
	Address   string `json:"address" binding:"required"`
	City      string `json:"city" binding:"required"`
	State     string `json:"state" binding:"required"`
	Phone     string `json:"phone" binding:"required"`
	PayMethod string `json:"pay_method" binding:"required,oneof=card transfer ussd wallet monnify flutterwave crypto"`
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
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
	if order == nil {
		response.NotFound(c, "Order not found")
		return
	}
	response.OK(c, gin.H{"order": order})
}

type WebhookPayload struct {
	Event string `json:"event"`
	Data  struct {
		Reference string `json:"reference"`
		Status    string `json:"status"`
	} `json:"data"`
}

func (h *OrderHandler) PaystackWebhook(c *gin.Context) {
	var payload WebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "Invalid webhook payload")
		return
	}

	h.logger.Info("Paystack webhook received", slog.String("reference", payload.Data.Reference), slog.String("event", payload.Event))

	if err := h.service.ProcessPaystackWebhook(c.Request.Context(), payload.Data.Reference, payload.Data.Status); err != nil {
		h.logger.Error("Paystack Webhook processing failed", slog.Any("error", err))
		response.InternalError(c, "Webhook processing failed")
		return
	}

	response.OK(c, gin.H{"message": "Webhook processed"})
}

type FlutterwaveWebhookPayload struct {
	Event string `json:"event"`
	Data  struct {
		TxRef  string `json:"tx_ref"`
		Status string `json:"status"`
	} `json:"data"`
}

func (h *OrderHandler) FlutterwaveWebhook(c *gin.Context) {
	var payload FlutterwaveWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "Invalid Flutterwave payload")
		return
	}

	h.logger.Info("Flutterwave webhook received", slog.String("tx_ref", payload.Data.TxRef), slog.String("status", payload.Data.Status))

	// Map status to our service
	status := "failed"
	if payload.Data.Status == "successful" {
		status = "success"
	}
	if err := h.service.ProcessPaystackWebhook(c.Request.Context(), payload.Data.TxRef, status); err != nil {
		h.logger.Error("Flutterwave Webhook processing failed", slog.Any("error", err))
		response.InternalError(c, "Webhook processing failed")
		return
	}

	response.OK(c, gin.H{"message": "Flutterwave Webhook processed"})
}

type MonnifyWebhookPayload struct {
	EventType string `json:"eventType"`
	EventData struct {
		PaymentReference string `json:"paymentReference"`
		PaymentStatus    string `json:"paymentStatus"`
	} `json:"eventData"`
}

func (h *OrderHandler) MonnifyWebhook(c *gin.Context) {
	var payload MonnifyWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "Invalid Monnify payload")
		return
	}

	h.logger.Info("Monnify webhook received", slog.String("ref", payload.EventData.PaymentReference), slog.String("status", payload.EventData.PaymentStatus))

	status := "failed"
	if payload.EventData.PaymentStatus == "PAID" {
		status = "success"
	}
	if err := h.service.ProcessPaystackWebhook(c.Request.Context(), payload.EventData.PaymentReference, status); err != nil {
		h.logger.Error("Monnify Webhook processing failed", slog.Any("error", err))
		response.InternalError(c, "Webhook processing failed")
		return
	}

	response.OK(c, gin.H{"message": "Monnify Webhook processed"})
}

type CryptoWebhookPayload struct {
	TxHash string `json:"tx_hash"`
	Status string `json:"status"` // confirmed, pending
}

func (h *OrderHandler) CryptoWebhook(c *gin.Context) {
	var payload CryptoWebhookPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		response.BadRequest(c, "Invalid Crypto payload")
		return
	}

	h.logger.Info("Crypto bridge webhook received", slog.String("tx_hash", payload.TxHash), slog.String("status", payload.Status))

	if err := h.service.ProcessPaystackWebhook(c.Request.Context(), payload.TxHash, payload.Status); err != nil {
		h.logger.Error("Crypto Webhook processing failed", slog.Any("error", err))
		response.InternalError(c, "Webhook processing failed")
		return
	}

	response.OK(c, gin.H{"message": "Crypto Webhook processed"})
}
