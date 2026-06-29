package auth

import (
	"log/slog"
	"strings"

	"github.com/gin-gonic/gin"
	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type AuthHandler struct {
	service domain.UserService
	logger  *slog.Logger
}

func NewAuthHandler(service domain.UserService, logger *slog.Logger) *AuthHandler {
	return &AuthHandler{service: service, logger: logger}
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Phone    string `json:"phone"`
	Role     string `json:"role" binding:"required,oneof=buyer seller artisan"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, token, err := h.service.Register(c.Request.Context(), req.Name, req.Email, req.Password, req.Phone, req.Role)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			response.Conflict(c, err.Error())
			return
		}
		response.InternalError(c, "Registration failed")
		return
	}

	response.Created(c, gin.H{"user": user, "token": token})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, token, err := h.service.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		response.Unauthorized(c, "Invalid email or password")
		return
	}

	response.OK(c, gin.H{"user": user, "token": token})
}

func (h *AuthHandler) Me(c *gin.Context) {
	user, exists := c.Get("user")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}
	response.OK(c, gin.H{"user": user})
}

// AuthMiddleware validates JWT tokens and injects the user into the context.
func AuthMiddleware(service domain.UserService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "Authorization header required")
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			response.Unauthorized(c, "Invalid authorization format. Use: Bearer <token>")
			c.Abort()
			return
		}

		user, err := service.ValidateToken(c.Request.Context(), parts[1])
		if err != nil {
			response.Unauthorized(c, "Invalid or expired token")
			c.Abort()
			return
		}

		if user.Status == "suspended" {
			response.Fail(c, 403, "ACCOUNT_SUSPENDED", "Your account has been suspended.")
			c.Abort()
			return
		}

		c.Set("user", user)
		c.Set("userID", user.ID)
		c.Set("userRole", user.Role)
		c.Next()
	}
}

// RequireRole gates a route to one or more roles. It must run after
// AuthMiddleware (which injects "userRole"). Admin-only routes use this so the
// admin surface is never reachable by buyers, sellers or artisans.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		roleStr, _ := role.(string)
		if !allowed[roleStr] {
			response.Fail(c, 403, "FORBIDDEN", "You do not have access to this resource.")
			c.Abort()
			return
		}
		c.Next()
	}
}

func (h *AuthHandler) GetWallet(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	wallet, err := h.service.GetWallet(c.Request.Context(), userID.(string))
	if err != nil {
		h.logger.Error("Failed to fetch wallet", slog.Any("error", err))
		response.InternalError(c, "Failed to fetch wallet")
		return
	}

	response.OK(c, gin.H{"wallet": wallet})
}

type CreditWalletRequest struct {
	Amount int64 `json:"amount" binding:"required,gt=0"`
}

func (h *AuthHandler) CreditWallet(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		response.Unauthorized(c, "Not authenticated")
		return
	}

	var req CreditWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	err := h.service.CreditWallet(c.Request.Context(), userID.(string), req.Amount)
	if err != nil {
		h.logger.Error("Failed to credit wallet", slog.Any("error", err))
		response.InternalError(c, "Failed to credit wallet")
		return
	}

	// Fetch updated wallet
	wallet, _ := h.service.GetWallet(c.Request.Context(), userID.(string))
	response.OK(c, gin.H{"message": "Wallet credited successfully", "wallet": wallet})
}
