package withdrawal

import (
	"errors"
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
	BankCode      string `json:"bank_code" binding:"required,min=3,max=10"`
	AccountNumber string `json:"account_number" binding:"required,len=10,numeric"`
	AccountName   string `json:"account_name" binding:"required,min=2,max=120"`
}

// respond maps a service error to a status code and a message that is safe to
// show. Anything unexpected is logged and reported generically.
func (h *Handler) respond(c *gin.Context, what string, err error) {
	switch {
	case errors.Is(err, ErrDuplicateWithdrawal):
		response.Conflict(c, "This withdrawal was already submitted. Check your withdrawal history.")
	case errors.Is(err, ErrInsufficientBalance):
		response.Conflict(c, "Your wallet balance is too low for this withdrawal.")
	case errors.Is(err, ErrKYCRequired):
		response.Fail(c, 403, "KYC_REQUIRED", "Complete identity verification before withdrawing.")
	case errors.Is(err, ErrMinAmount):
		response.BadRequest(c, "Minimum withdrawal is ₦1,000.")
	case errors.Is(err, ErrAccountNotFound):
		response.BadRequest(c, "We couldn't find that bank account. Check the account number and the bank.")
	case errors.Is(err, ErrNotConfigured):
		response.Fail(c, 503, "PAYOUTS_UNAVAILABLE", "Bank withdrawals aren't available yet. Your money is safe in your wallet.")
	default:
		h.logger.Error(what+" failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't process that. Your wallet was not charged. Please try again.")
	}
}

// Initiate: POST /me/wallet/withdraw
func (h *Handler) Initiate(c *gin.Context) {
	var req initiateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter a valid amount, bank and 10-digit account number.")
		return
	}
	// Idempotency-Key header lets clients safely retry without double-debiting.
	idempotencyKey := c.GetHeader("Idempotency-Key")
	if idempotencyKey == "" {
		response.BadRequest(c, "Idempotency-Key header is required.")
		return
	}
	if len(idempotencyKey) > 80 {
		response.BadRequest(c, "Idempotency-Key must be 80 characters or fewer.")
		return
	}
	uid, ok := c.Get("userID")
	if !ok {
		response.Fail(c, 401, "UNAUTHORIZED", "Not authenticated.")
		return
	}
	userID, _ := uid.(string)
	w, err := h.service.Initiate(c.Request.Context(), WithdrawInput{
		UserID:         userID,
		Amount:         req.Amount,
		BankCode:       req.BankCode,
		AccountNumber:  req.AccountNumber,
		AccountName:    req.AccountName,
		IdempotencyKey: idempotencyKey,
	})
	if err != nil {
		h.respond(c, "withdrawal", err)
		return
	}
	response.Created(c, gin.H{"withdrawal": w})
}

type resolveRequest struct {
	BankCode      string `json:"bank_code" binding:"required,min=3,max=10"`
	AccountNumber string `json:"account_number" binding:"required,len=10,numeric"`
}

// ResolveAccount: POST /me/wallet/resolve-account. Returns the name the bank
// holds the account under, so the partner can confirm it before withdrawing.
func (h *Handler) ResolveAccount(c *gin.Context) {
	var req resolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter a bank and a 10-digit account number.")
		return
	}
	name, err := h.service.ResolveAccount(c.Request.Context(), req.AccountNumber, req.BankCode)
	if err != nil {
		h.respond(c, "resolve account", err)
		return
	}
	response.OK(c, gin.H{"account_name": name})
}

// List: GET /me/wallet/withdrawals
func (h *Handler) List(c *gin.Context) {
	uid, _ := c.Get("userID")
	userID, _ := uid.(string)
	list, err := h.service.List(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("list withdrawals failed", slog.Any("error", err))
		response.InternalError(c, "Failed to fetch withdrawals")
		return
	}
	response.OK(c, gin.H{"withdrawals": list})
}
