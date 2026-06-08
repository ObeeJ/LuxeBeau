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
	PayMethod string `json:"pay_method" binding:"required,oneof=card transfer ussd wallet"`
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var req CheckoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	buyerID, _ := c.Get("userID")

	order, err := h.service.CreateCheckout(c.Request.Context(), buyerID.(string), req.Items, req.Address, req.City, req.State, req.Phone, req.PayMethod)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}

	response.Created(c, gin.H{"order": order})
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

	if err := h.service.ProcessPaystackWebhook(c.Request.Context(), payload.Data.Reference, payload.Data.Status); err != nil {
		h.logger.Error("Webhook processing failed", slog.Any("error", err))
		response.InternalError(c, "Webhook processing failed")
		return
	}

	response.OK(c, gin.H{"message": "Webhook processed"})
}
