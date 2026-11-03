package storefront

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/auth"
	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type Handler struct {
	service     *Service
	authService *auth.Service
	logger      *slog.Logger
}

func NewHandler(service *Service, authService *auth.Service, logger *slog.Logger) *Handler {
	return &Handler{
		service:     service,
		authService: authService,
		logger:      logger,
	}
}

// GetMyStorefront returns the caller's configured storefront, if any.
func (h *Handler) GetMyStorefront(c *gin.Context) {
	v, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "Please sign in.")
		return
	}
	userID, _ := v.(string)

	sf, err := h.service.GetMyStorefront(c.Request.Context(), userID)
	if err != nil {
		h.logger.Error("Failed to fetch merchant storefront", slog.String("user_id", userID), slog.Any("error", err))
		response.InternalError(c, "Failed to fetch storefront configuration.")
		return
	}

	response.OK(c, gin.H{"storefront": sf})
}

// SaveStorefront creates or updates the caller's storefront configuration.
func (h *Handler) SaveStorefront(c *gin.Context) {
	userVal, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Please sign in.")
		return
	}
	user, ok := userVal.(*domain.User)
	if !ok || user == nil {
		response.Unauthorized(c, "Invalid user session.")
		return
	}

	var req SaveStorefrontRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid storefront payload: "+err.Error())
		return
	}

	sf, err := h.service.SaveStorefront(c.Request.Context(), user, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidHandleFormat),
			errors.Is(err, ErrInvalidTemplate),
			errors.Is(err, ErrBioTooLong):
			response.BadRequest(c, err.Error())
		case errors.Is(err, ErrHandleReserved),
			errors.Is(err, ErrHandleUnavailable),
			errors.Is(err, ErrHandleChangedRecent):
			response.Conflict(c, err.Error())
		case errors.Is(err, ErrUnverifiedMerchant),
			errors.Is(err, ErrStudioArtisanOnly),
			errors.Is(err, ErrNoProductsOrServices):
			response.Fail(c, http.StatusUnprocessableEntity, "VALIDATION_FAILED", err.Error())
		default:
			h.logger.Error("Failed to save storefront", slog.String("user_id", user.ID), slog.Any("error", err))
			response.InternalError(c, "Failed to save storefront configuration: "+err.Error())
		}
		return
	}

	response.OK(c, gin.H{"storefront": sf})
}

type checkHandleRequest struct {
	Handle string `json:"handle" binding:"required"`
}

// CheckHandle validates format and availability of a chosen handle.
func (h *Handler) CheckHandle(c *gin.Context) {
	var req checkHandleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Handle is required.")
		return
	}

	var user *domain.User
	if userVal, exists := c.Get("user"); exists {
		user, _ = userVal.(*domain.User)
	}

	available, reason, err := h.service.CheckHandleAvailability(c.Request.Context(), req.Handle, user)
	if err != nil {
		h.logger.Error("Failed to check handle availability", slog.String("handle", req.Handle), slog.Any("error", err))
		response.InternalError(c, "Failed to check handle availability.")
		return
	}

	response.OK(c, gin.H{
		"handle":    NormalizeHandle(req.Handle),
		"available": available,
		"reason":    reason,
	})
}

type themePreviewRequest struct {
	BaseHex string `json:"base_hex" binding:"required"`
}

// ThemePreview derives the 5 theme variants and contrast ratios for a base hex colour.
func (h *Handler) ThemePreview(c *gin.Context) {
	var req themePreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Base hex colour is required.")
		return
	}

	variants, err := h.service.PreviewTheme(req.BaseHex)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, gin.H{"variants": variants})
}

// GetPublicStorefront fetches a public storefront by handle.
func (h *Handler) GetPublicStorefront(c *gin.Context) {
	handle := c.Param("handle")
	if strings.TrimSpace(handle) == "" {
		response.BadRequest(c, "Handle parameter is required.")
		return
	}

	callerUserID := h.optionalUserID(c)

	data, err := h.service.GetPublicStorefront(c.Request.Context(), handle, callerUserID)
	if err != nil {
		if errors.Is(err, ErrStorefrontNotLive) {
			response.NotFound(c, "This storefront is not currently live.")
			return
		}
		h.logger.Error("Failed to get public storefront", slog.String("handle", handle), slog.Any("error", err))
		response.InternalError(c, "Failed to retrieve storefront.")
		return
	}

	if data == nil {
		response.NotFound(c, "Storefront not found.")
		return
	}

	// 301 redirection if handle was migrated
	if data.RedirectHandle != "" {
		c.Header("Location", "/s/"+data.RedirectHandle)
		c.JSON(http.StatusMovedPermanently, gin.H{
			"success":         true,
			"redirect_handle": data.RedirectHandle,
		})
		return
	}

	response.OK(c, data)
}

// optionalUserID retrieves the authenticated user ID if an access cookie/bearer header exists,
// without aborting when unauthenticated.
func (h *Handler) optionalUserID(c *gin.Context) string {
	if h.authService == nil {
		return ""
	}
	token, _ := c.Cookie(auth.AccessCookie)
	if token == "" {
		if parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2); len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
			token = parts[1]
		}
	}
	if token == "" {
		return ""
	}
	user, err := h.authService.Authenticate(c.Request.Context(), token)
	if err != nil || user == nil {
		return ""
	}
	return user.ID
}
