package admin

import (
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

func (h *Handler) ListUsers(c *gin.Context) {
	f := UserFilter{
		Role:         c.Query("role"),
		Jurisdiction: c.Query("jurisdiction"),
		Status:       c.Query("status"),
		Search:       c.Query("search"),
	}
	if v := c.Query("verified"); v != "" {
		b := v == "true"
		f.Verified = &b
	}
	users, err := h.service.ListUsers(c.Request.Context(), f)
	if err != nil {
		response.InternalError(c, "Failed to fetch users")
		return
	}
	response.OK(c, gin.H{"users": users})
}

func (h *Handler) GetUser(c *gin.Context) {
	user, err := h.service.GetUser(c.Request.Context(), c.Param("id"))
	if err != nil {
		response.InternalError(c, "Failed to fetch user")
		return
	}
	if user == nil {
		response.NotFound(c, "User not found")
		return
	}
	response.OK(c, gin.H{"user": user})
}

type updateUserRequest struct {
	Role         *string `json:"role"`
	Status       *string `json:"status" binding:"omitempty,oneof=active suspended"`
	Jurisdiction *string `json:"jurisdiction"`
	Verified     *bool   `json:"verified"`
	CACNumber    *string `json:"cac_number"`
	KYCStatus    *string `json:"kyc_status" binding:"omitempty,oneof=unverified pending verified failed"`
}

func (h *Handler) UpdateUser(c *gin.Context) {
	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if req.Role != nil && *req.Role != "buyer" && *req.Role != "seller" && *req.Role != "artisan" {
		response.BadRequest(c, "Role must be buyer, seller or artisan")
		return
	}
	actorID, _ := c.Get("userID")
	updated, err := h.service.UpdateUser(c.Request.Context(), actorID.(string), c.Param("id"), UserUpdate(req))
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"user": updated})
}

type verifyRequest struct {
	CACNumber string `json:"cac_number"`
}

func (h *Handler) VerifyUser(c *gin.Context) {
	var req verifyRequest
	_ = c.ShouldBindJSON(&req)
	updated, err := h.service.VerifyUser(c.Request.Context(), c.Param("id"), req.CACNumber)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"user": updated})
}

func (h *Handler) DeleteUser(c *gin.Context) {
	actorID, _ := c.Get("userID")
	if err := h.service.DeleteUser(c.Request.Context(), actorID.(string), c.Param("id")); err != nil {
		response.Conflict(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "User removed"})
}

func (h *Handler) ListProducts(c *gin.Context) {
	products, err := h.service.ListProducts(c.Request.Context(), c.Query("jurisdiction"))
	if err != nil {
		response.InternalError(c, "Failed to fetch products")
		return
	}
	response.OK(c, gin.H{"products": products})
}

func (h *Handler) ListOrders(c *gin.Context) {
	orders, err := h.service.ListOrders(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to fetch orders")
		return
	}
	response.OK(c, gin.H{"orders": orders})
}

func (h *Handler) ListBookings(c *gin.Context) {
	bookings, err := h.service.ListBookings(c.Request.Context())
	if err != nil {
		response.InternalError(c, "Failed to fetch bookings")
		return
	}
	response.OK(c, gin.H{"bookings": bookings})
}

func (h *Handler) DeleteProduct(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid product ID")
		return
	}
	if err := h.service.DeleteProduct(c.Request.Context(), uint(id)); err != nil {
		response.InternalError(c, "Failed to delete product")
		return
	}
	response.OK(c, gin.H{"message": "Product removed"})
}
