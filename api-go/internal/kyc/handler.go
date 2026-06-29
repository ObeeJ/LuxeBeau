package kyc

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

type submitRequest struct {
	Type  Kind   `json:"type" binding:"required,oneof=nin bvn"`
	Value string `json:"value" binding:"required,min=10"`
}

// Submit records the signed-in user's NIN/BVN for verification. The raw value
// is forwarded to the provider but never stored.
func (h *Handler) Submit(c *gin.Context) {
	var req submitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter a valid NIN or BVN.")
		return
	}
	userID, _ := c.Get("userID")
	res, err := h.service.Submit(c.Request.Context(), userID.(string), req.Type, req.Value)
	if err != nil {
		response.InternalError(c, "We could not verify your identity right now. Please try again.")
		return
	}
	response.OK(c, gin.H{"kyc_status": res.Status, "reference": res.Reference})
}
