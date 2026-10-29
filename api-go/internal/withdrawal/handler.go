package withdrawal

import (
	"log/slog"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/response"
)

type Handler struct {
	service *Service
	logger  *slog.Logger
}

func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

type initiateRequest struct {
	Amount        int64  `json:"amount" binding:"required,min=100000"` // min ₦1,000 in kobo
	BankCode      string `json:"bank_code" binding:"required,len=3"`
	AccountNumber string `json:"account_number" binding:"required,len=10"`
	AccountName   string `json:"account_name" binding:"required,min=2,max=120"`
}

// Initiate: POST /me/wallet/withdraw
func (h *Handler) Initiate(c *gin.Context) {
	var req initiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter a valid amount, bank code and 10-digit account number.")
		return
	}
	uid, _ := c.Get("userID")
	w, err := h.service.Initiate(c.Request.Context(), WithdrawInput{
		UserID:        uid.(string),
		Amount:        req.Amount,
		BankCode:      req.BankCode,
		AccountNumber: req.AccountNumber,
		AccountName:   req.AccountName,
	})
	switch err {
	case nil:
	case ErrInsufficientBalance:
		response.Conflict(c, "Your wallet balance is too low for this withdrawal.")
		return
	case ErrKYCRequired:
		response.Fail(c, 403, "KYC_REQUIRED", "Complete identity verification before withdrawing.")
		return
	case ErrMinAmount:
		response.BadRequest(c, "Minimum withdrawal is ₦1,000.")
		return
	default:
		h.logger.Error("withdrawal initiate failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't process your withdrawal. Please try again.")
		return
	}
	response.Created(c, gin.H{"withdrawal": w})
}

// List: GET /me/wallet/withdrawals
func (h *Handler) List(c *gin.Context) {
	uid, _ := c.Get("userID")
	list, err := h.service.List(c.Request.Context(), uid.(string))
	if err != nil {
		response.InternalError(c, "Failed to fetch withdrawals")
		return
	}
	response.OK(c, gin.H{"withdrawals": list})
}

// Webhook: POST /api/v1/webhooks/paystack (shared with order webhooks)
// The order handler already handles charge events; this handles transfer events.
// The middleware has already verified the Paystack HMAC signature.
type paystackEvent struct {
	Event string `json:"event"`
	Data  struct {
		Reference string `json:"reference"`
	} `json:"data"`
}

func (h *Handler) Webhook(c *gin.Context) {
	var evt paystackEvent
	if err := c.ShouldBindJSON(&evt); err != nil {
		c.Status(200) // always 200 to Paystack
		return
	}
	if err := h.service.HandleWebhook(c.Request.Context(), evt.Event, evt.Data.Reference); err != nil {
		h.logger.Error("withdrawal webhook failed", slog.String("event", evt.Event), slog.Any("error", err))
	}
	c.Status(200)
}
