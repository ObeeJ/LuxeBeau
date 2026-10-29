package influencer

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type Handler struct {
	service *Service
	logger  *slog.Logger
}

func NewHandler(service *Service, logger *slog.Logger) *Handler {
	return &Handler{service: service, logger: logger}
}

type packageRequest struct {
	Slug             string  `json:"slug" binding:"required,min=3,max=80"`
	InfluencerName   string  `json:"influencer_name" binding:"required,max=120"`
	InfluencerEmail  string  `json:"influencer_email" binding:"omitempty,email"`
	InfluencerPhone  string  `json:"influencer_phone" binding:"omitempty,max=20"`
	InfluencerHandle string  `json:"influencer_handle" binding:"omitempty,max=120"`
	Scope            string  `json:"scope" binding:"required,min=10,max=2000"`
	Agreement        string  `json:"agreement" binding:"omitempty,max=10000"`
	CommissionBps    int     `json:"commission_bps" binding:"required,min=1,max=5000"`
	BankCode         string  `json:"bank_code" binding:"omitempty,len=3"`
	AccountNumber    string  `json:"account_number" binding:"omitempty,len=10"`
	AccountName      string  `json:"account_name" binding:"omitempty,max=120"`
	StartsAt         *string `json:"starts_at"` // ISO 8601 date string
	EndsAt           *string `json:"ends_at"`
}

func parseDate(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", *s)
	if err != nil {
		return nil
	}
	return &t
}

func (r packageRequest) toInput() PackageInput {
	return PackageInput{
		Slug:             r.Slug,
		InfluencerName:   r.InfluencerName,
		InfluencerEmail:  r.InfluencerEmail,
		InfluencerPhone:  r.InfluencerPhone,
		InfluencerHandle: r.InfluencerHandle,
		Scope:            r.Scope,
		Agreement:        r.Agreement,
		CommissionBps:    r.CommissionBps,
		BankCode:         r.BankCode,
		AccountNumber:    r.AccountNumber,
		AccountName:      r.AccountName,
		StartsAt:         parseDate(r.StartsAt),
		EndsAt:           parseDate(r.EndsAt),
	}
}

func ownerID(c *gin.Context) string {
	v, _ := c.Get("userID")
	s, _ := v.(string)
	return s
}

// Create: POST /me/influencer-packages
func (h *Handler) Create(c *gin.Context) {
	var req packageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Check all required fields: slug, influencer name, scope and commission.")
		return
	}
	pkg, err := h.service.Create(c.Request.Context(), ownerID(c), req.toInput())
	switch err {
	case nil:
	case ErrSlugTaken:
		response.Conflict(c, "That link name is already used. Try a different one.")
		return
	case ErrSlugInvalid:
		response.BadRequest(c, "Link name must be lowercase letters, numbers and hyphens only.")
		return
	case ErrCommissionTooHigh:
		response.BadRequest(c, "Commission cannot exceed 50% of your net payout.")
		return
	default:
		h.logger.Error("create influencer package failed", slog.Any("error", err))
		response.InternalError(c, "Could not create package.")
		return
	}
	response.Created(c, gin.H{"package": pkg})
}

// List: GET /me/influencer-packages
func (h *Handler) List(c *gin.Context) {
	pkgs, err := h.service.List(c.Request.Context(), ownerID(c))
	if err != nil {
		response.InternalError(c, "Failed to fetch packages")
		return
	}
	response.OK(c, gin.H{"packages": pkgs})
}

// Get: GET /me/influencer-packages/:id
func (h *Handler) Get(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.NotFound(c, "Package not found")
		return
	}
	pkg, err := h.service.Get(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c, "Package not found")
		return
	}
	if pkg.OwnerID != ownerID(c) {
		response.NotFound(c, "Package not found")
		return
	}
	response.OK(c, gin.H{"package": pkg})
}

// Update: PATCH /me/influencer-packages/:id
func (h *Handler) Update(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.NotFound(c, "Package not found")
		return
	}
	var req packageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid package data.")
		return
	}
	pkg, err := h.service.Update(c.Request.Context(), ownerID(c), uint(id), req.toInput())
	switch err {
	case nil:
	case ErrPackageNotFound, ErrNotOwner:
		response.NotFound(c, "Package not found")
		return
	case ErrCommissionTooHigh:
		response.BadRequest(c, "Commission cannot exceed 50% of your net payout.")
		return
	default:
		response.InternalError(c, "Could not update package.")
		return
	}
	response.OK(c, gin.H{"package": pkg})
}

type stateRequest struct {
	State string `json:"state" binding:"required,oneof=active paused cancelled"`
}

// SetState: PATCH /me/influencer-packages/:id/state
func (h *Handler) SetState(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.NotFound(c, "Package not found")
		return
	}
	var req stateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "State must be active, paused or cancelled.")
		return
	}
	if err := h.service.SetState(c.Request.Context(), ownerID(c), uint(id), req.State); err != nil {
		response.NotFound(c, "Package not found")
		return
	}
	response.OK(c, gin.H{"message": "Package updated"})
}

// Track: GET /ref/:ownerSlug/:influencerSlug
// This is the public tracking link. It records the click, sets a cookie,
// and redirects to the owner's storefront.
func (h *Handler) Track(c *gin.Context) {
	ownerSlug := c.Param("ownerSlug")
	influencerSlug := c.Param("influencerSlug")

	pkg, err := h.service.GetByOwnerSlug(c.Request.Context(), ownerSlug, influencerSlug)
	if err != nil {
		// Redirect to homepage rather than showing a 404 — broken links
		// should still land the visitor somewhere useful.
		c.Redirect(http.StatusFound, "/")
		return
	}

	// Read existing token from cookie (returning visitor keeps attribution).
	existingToken, _ := c.Cookie("lb_ref")
	buyerID, _ := c.Get("userID")
	bid, _ := buyerID.(string)

	token, err := h.service.TrackClick(c.Request.Context(), pkg.ID, bid, existingToken)
	if err != nil {
		h.logger.Warn("track click failed", slog.Any("error", err))
	}

	// Set a 30-day cookie so the attribution survives across sessions.
	c.SetCookie("lb_ref", token, 30*24*3600, "/", "", true, false)
	// Also store which package this token belongs to so checkout can look it up.
	c.SetCookie("lb_ref_pkg", strconv.FormatUint(uint64(pkg.ID), 10), 30*24*3600, "/", "", true, false)

	// Redirect to the owner's storefront (or homepage if no slug set).
	dest := "/"
	var owner struct{ StorefrontSlug string }
	if h.service.db.Raw("SELECT storefront_slug FROM users WHERE id = ?", pkg.OwnerID).Scan(&owner).Error == nil && owner.StorefrontSlug != "" {
		dest = "/storefront/" + owner.StorefrontSlug
	}
	c.Redirect(http.StatusFound, dest)
}

// ── Admin handlers ───────────────────────────────────────────────────────────

// AdminList: GET /admin/influencer-packages — all packages across all owners.
func (h *Handler) AdminList(c *gin.Context) {
	var pkgs []domain.InfluencerPackage
	q := h.service.db.WithContext(c.Request.Context()).Order("created_at DESC").Limit(500)
	if state := c.Query("state"); state != "" {
		q = q.Where("state = ?", state)
	}
	if ownerID := c.Query("owner_id"); ownerID != "" {
		q = q.Where("owner_id = ?", ownerID)
	}
	if err := q.Find(&pkgs).Error; err != nil {
		response.InternalError(c, "Failed to fetch packages")
		return
	}
	h.service.attachStats(c.Request.Context(), pkgs)
	response.OK(c, gin.H{"packages": pkgs})
}

// AdminCommissions: GET /admin/influencer-commissions — full commission ledger.
func (h *Handler) AdminCommissions(c *gin.Context) {
	var commissions []domain.InfluencerCommission
	q := h.service.db.WithContext(c.Request.Context()).Order("created_at DESC").Limit(500)
	if state := c.Query("state"); state != "" {
		q = q.Where("state = ?", state)
	}
	if pkgID := c.Query("package_id"); pkgID != "" {
		q = q.Where("package_id = ?", pkgID)
	}
	if err := q.Find(&commissions).Error; err != nil {
		response.InternalError(c, "Failed to fetch commissions")
		return
	}
	response.OK(c, gin.H{"commissions": commissions})
}
