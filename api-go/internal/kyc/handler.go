package kyc

import (
	"log/slog"

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

type submitRequest struct {
	Type  Kind   `json:"type" binding:"required"`
	Value string `json:"value" binding:"required,min=5"`
}

// Submit verifies the signed-in user's identity document. The provider is
// chosen automatically from the user's country_code. Raw values are never stored.
func (h *Handler) Submit(c *gin.Context) {
	var req submitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter a valid document number.")
		return
	}
	user, _ := c.Get("user")
	u, ok := user.(*domain.User)
	if !ok {
		response.Unauthorized(c, "Please sign in.")
		return
	}

	// Validate the kind is accepted for this user's country.
	accepted := h.service.KindsFor(u.CountryCode)
	valid := false
	for _, k := range accepted {
		if k == req.Type {
			valid = true
			break
		}
	}
	if !valid {
		response.BadRequest(c, "That document type is not accepted for your country.")
		return
	}

	res, err := h.service.Submit(c.Request.Context(), u.ID, u.CountryCode, req.Type, req.Value)
	if err != nil {
		response.InternalError(c, "We could not verify your identity right now. Please try again.")
		return
	}
	response.OK(c, gin.H{"kyc_status": res.Status, "reference": res.Reference})
}

// Kinds returns the accepted document types for the signed-in user's country.
// The frontend calls this to render the right form fields.
func (h *Handler) Kinds(c *gin.Context) {
	user, _ := c.Get("user")
	u, ok := user.(*domain.User)
	if !ok {
		response.Unauthorized(c, "Please sign in.")
		return
	}
	kinds := h.service.KindsFor(u.CountryCode)
	response.OK(c, gin.H{"country_code": u.CountryCode, "kinds": kinds})
}
