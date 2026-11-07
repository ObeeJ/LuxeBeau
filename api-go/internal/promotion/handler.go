package promotion

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type Handler struct {
	service *Service
	logger  *slog.Logger
}

func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
	}
}

// ListActive: GET /api/v1/featured-ads/active (Public)
func (h *Handler) ListActive(c *gin.Context) {
	limit := 6
	if l, err := strconv.Atoi(c.Query("limit")); err == nil && l > 0 && l <= 20 {
		limit = l
	}

	ads, err := h.service.ListActive(c.Request.Context(), limit)
	if err != nil {
		h.logger.Error("list active ads failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't load featured ads.")
		return
	}

	// Trigger impressions asynchronously
	go func(items []domain.FeaturedAd) {
		for _, ad := range items {
			_ = h.service.RecordImpression(context.Background(), ad.ID)
		}
	}(ads)

	response.OK(c, gin.H{"ads": ads})
}

// RecordClick: POST /api/v1/featured-ads/:id/click (Public)
func (h *Handler) RecordClick(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Ad ID is required")
		return
	}
	_ = h.service.RecordClick(c.Request.Context(), id)
	response.OK(c, gin.H{"clicked": true})
}

// CreatePromotion: POST /api/v1/me/promotions (Protected - seller, artisan, admin)
func (h *Handler) CreatePromotion(c *gin.Context) {
	var input CreatePromotionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, "Provide title, image, promotion type, and plan (7_days, 30_days, or annual).")
		return
	}

	v, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "Authentication required")
		return
	}
	merchantID, _ := v.(string)

	ad, err := h.service.CreatePromotion(c.Request.Context(), merchantID, input)
	if err != nil {
		h.logger.Warn("create promotion failed", slog.Any("error", err))
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, gin.H{"ad": ad})
}

// PayAdWithWallet: POST /api/v1/me/promotions/:id/pay-wallet (Protected - seller, artisan, admin)
func (h *Handler) PayAdWithWallet(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Ad ID is required")
		return
	}

	v, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "Authentication required")
		return
	}
	merchantID, _ := v.(string)

	if err := h.service.PayWithWallet(c.Request.Context(), merchantID, id); err != nil {
		h.respondAdError(c, "pay ad with wallet", id, err)
		return
	}

	response.OK(c, gin.H{"message": "Promotion paid and activated successfully"})
}

// respondAdError turns a service error into a status code and a message that is
// safe to show. Anything unexpected is logged and reported generically, so no
// database or internal detail reaches the client.
func (h *Handler) respondAdError(c *gin.Context, action, adID string, err error) {
	switch {
	case errors.Is(err, ErrAdNotFound):
		response.NotFound(c, "Ad not found.")
	case errors.Is(err, ErrInsufficientBalance):
		response.Fail(c, http.StatusPaymentRequired, "INSUFFICIENT_BALANCE", "Your wallet balance is too low to pay for this ad.")
	case errors.Is(err, ErrAdNotPayable):
		response.Conflict(c, "This ad can no longer be paid for.")
	case errors.Is(err, ErrAdNotPaid):
		response.Conflict(c, "This ad has not been paid for yet, so it cannot go live.")
	case errors.Is(err, ErrInvalidStatus):
		response.BadRequest(c, "Invalid status: choose active, paused, or expired.")
	default:
		h.logger.Error(action+" failed", slog.String("ad_id", adID), slog.Any("error", err))
		response.InternalError(c, "Something went wrong. Please try again.")
	}
}

// ListMyPromotions: GET /api/v1/me/promotions (Protected - seller, artisan, admin)
func (h *Handler) ListMyPromotions(c *gin.Context) {
	v, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "Authentication required")
		return
	}
	merchantID, _ := v.(string)

	ads, err := h.service.ListByMerchant(c.Request.Context(), merchantID)
	if err != nil {
		h.logger.Error("list my promotions failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't load your promotions.")
		return
	}

	response.OK(c, gin.H{"ads": ads})
}

// PricingInfo: GET /api/v1/featured-ads/pricing (Public)
func (h *Handler) PricingInfo(c *gin.Context) {
	response.OK(c, gin.H{
		"pricing": gin.H{
			"7_days": gin.H{
				"amount_kobo": domain.AdPrice7DaysKobo,
				"amount_ngn":  5000,
				"days":        7,
				"daily_rate":  714.28,
				"tag":         "Starter Boost",
			},
			"30_days": gin.H{
				"amount_kobo": domain.AdPrice30DaysKobo,
				"amount_ngn":  15000,
				"days":        30,
				"daily_rate":  500.00,
				"tag":         "Most Popular (Save 25%)",
			},
			"annual": gin.H{
				"amount_kobo": domain.AdPriceAnnualKobo,
				"amount_ngn":  120000,
				"days":        365,
				"daily_rate":  328.76,
				"monthly_eq":  10000,
				"tag":         "Best Value (4 Months Free · 33% Off)",
			},
		},
	})
}

// AdminList: GET /api/v1/admin/promotions (Admin only)
func (h *Handler) AdminList(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	ads, count, err := h.service.AdminList(c.Request.Context(), limit, offset)
	if err != nil {
		h.logger.Error("admin list promotions failed", slog.Any("error", err))
		response.InternalError(c, "Failed to load promotions.")
		return
	}

	response.OK(c, gin.H{"ads": ads, "total": count})
}

// AdminUpdateStatus: PATCH /api/v1/admin/promotions/:id/status (Admin only)
func (h *Handler) AdminUpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status domain.PromotionStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid status: choose active, paused, or expired")
		return
	}

	if err := h.service.AdminUpdateStatus(c.Request.Context(), id, req.Status); err != nil {
		h.respondAdError(c, "admin update ad status", id, err)
		return
	}

	response.OK(c, gin.H{"message": "Promotion status updated successfully"})
}
