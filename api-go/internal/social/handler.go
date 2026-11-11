package social

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

type updateRequest struct {
	AvatarURL    string `json:"avatar_url"`
	Bio          string `json:"bio" binding:"max=300"`
	SocialHandle string `json:"social_handle"`
	Website      string `json:"website"`
}

// GetMyProfile: GET /me/profile/social
func (h *Handler) GetMyProfile(c *gin.Context) {
	uid := c.GetString("userID")
	p, err := h.service.GetByUserID(c.Request.Context(), uid)
	if err != nil {
		h.logger.Error("get profile failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't load your profile.")
		return
	}
	response.OK(c, gin.H{"profile": p})
}

// UpdateMyProfile: PATCH /me/profile/social
func (h *Handler) UpdateMyProfile(c *gin.Context) {
	var req updateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Check your bio (max 300 characters) and handle (3-30 letters, numbers, underscores).")
		return
	}
	uid := c.GetString("userID")
	p, err := h.service.Upsert(c.Request.Context(), uid, UpdateInput{
		AvatarURL: req.AvatarURL, Bio: req.Bio,
		SocialHandle: req.SocialHandle, Website: req.Website,
	})
	switch {
	case err == nil:
	case errors.Is(err, ErrHandleTaken):
		response.Conflict(c, "That handle is already taken. Try a different one.")
		return
	case errors.Is(err, ErrHandleInvalid):
		response.BadRequest(c, "Handle must be 3-30 characters: letters, numbers and underscores only.")
		return
	case errors.Is(err, ErrURLInvalid):
		response.BadRequest(c, "Your website and photo links must start with https://.")
		return
	default:
		h.logger.Error("update profile failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't save your profile.")
		return
	}
	response.OK(c, gin.H{"profile": p})
}

// GetPublicProfile: GET /profiles/:handle
func (h *Handler) GetPublicProfile(c *gin.Context) {
	handle := c.Param("handle")
	p, err := h.service.GetPublic(c.Request.Context(), handle)
	if errors.Is(err, ErrNotFound) {
		response.NotFound(c, "Profile not found.")
		return
	}
	if err != nil {
		h.logger.Error("get public profile failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't load this profile.")
		return
	}
	response.OK(c, gin.H{"profile": p})
}
