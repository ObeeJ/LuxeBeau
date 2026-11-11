package review

import (
	"errors"
	"log/slog"
	"strconv"

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

func (h *Handler) fail(c *gin.Context, what string, err error) {
	switch {
	case errors.Is(err, ErrInvalidReview):
		response.BadRequest(c, "Give a rating from 1 to 5 stars and keep your comment under 500 characters.")
	case errors.Is(err, ErrNotEligible):
		response.Fail(c, 403, "NOT_ELIGIBLE", "You can review this once your order has been delivered and paid out, or your appointment is completed.")
	case errors.Is(err, ErrAlreadyReviewed):
		response.Conflict(c, "You have already reviewed this.")
	case errors.Is(err, ErrNotFound):
		response.NotFound(c, "Review not found.")
	default:
		h.logger.Error(what+" failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't process that. Please try again.")
	}
}

func intQuery(c *gin.Context, key string, def int) int {
	if v, err := strconv.Atoi(c.Query(key)); err == nil {
		return v
	}
	return def
}

// List: GET /reviews?target_type=product|artisan&target_id=ID (public)
func (h *Handler) List(c *gin.Context) {
	page, err := h.service.List(c.Request.Context(), c.Query("target_type"), c.Query("target_id"),
		intQuery(c, "limit", 20), intQuery(c, "offset", 0))
	if err != nil {
		h.fail(c, "list reviews", err)
		return
	}
	response.OK(c, page)
}

type createRequest struct {
	TargetType string `json:"target_type"`
	TargetID   string `json:"target_id"`
	Rating     int    `json:"rating"`
	Body       string `json:"body"`
}

// Create: POST /reviews
func (h *Handler) Create(c *gin.Context) {
	var req createRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Give a rating from 1 to 5 stars and keep your comment under 500 characters.")
		return
	}
	uid, _ := c.Get("userID")
	userID, _ := uid.(string)
	if userID == "" {
		response.Unauthorized(c, "Not authenticated.")
		return
	}
	r, err := h.service.Create(c.Request.Context(), userID, CreateInput{
		TargetType: req.TargetType, TargetID: req.TargetID, Rating: req.Rating, Body: req.Body})
	if err != nil {
		h.fail(c, "create review", err)
		return
	}
	response.Created(c, gin.H{"review": r})
}

// Reviewable: GET /me/reviewable
func (h *Handler) Reviewable(c *gin.Context) {
	uid, _ := c.Get("userID")
	userID, _ := uid.(string)
	items, err := h.service.Reviewable(c.Request.Context(), userID)
	if err != nil {
		h.fail(c, "list reviewable", err)
		return
	}
	response.OK(c, gin.H{"items": items})
}

// AdminList: GET /admin/reviews?status=visible|hidden
func (h *Handler) AdminList(c *gin.Context) {
	items, total, err := h.service.AdminList(c.Request.Context(), c.Query("status"),
		intQuery(c, "limit", 20), intQuery(c, "offset", 0))
	if err != nil {
		h.fail(c, "admin list reviews", err)
		return
	}
	response.OK(c, gin.H{"reviews": items, "total": total})
}

// SetStatus: PATCH /admin/reviews/:id  {"status":"hidden"|"visible"}
func (h *Handler) SetStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil || id == 0 {
		response.BadRequest(c, "Invalid review id.")
		return
	}
	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "status must be visible or hidden.")
		return
	}
	if err := h.service.SetStatus(c.Request.Context(), uint(id), req.Status); err != nil {
		if errors.Is(err, ErrInvalidReview) {
			response.BadRequest(c, "status must be visible or hidden.")
			return
		}
		h.fail(c, "moderate review", err)
		return
	}
	response.OK(c, gin.H{"status": req.Status})
}
