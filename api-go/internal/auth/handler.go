package auth

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

const (
	AccessCookie  = "lb_at"
	RefreshCookie = "lb_rt"
	refreshPath   = "/api/v1/auth"
)

// CookieConfig controls session cookie attributes per environment.
type CookieConfig struct {
	Domain string // empty = host-only
	Secure bool
}

type AuthHandler struct {
	service *Service
	cookies CookieConfig
	logger  *slog.Logger
}

func NewAuthHandler(service *Service, cookies CookieConfig, logger *slog.Logger) *AuthHandler {
	return &AuthHandler{service: service, cookies: cookies, logger: logger}
}

// setCookie writes an HttpOnly, SameSite=Strict cookie. Tokens never appear
// in response bodies or JavaScript-readable storage.
func (h *AuthHandler) setCookie(c *gin.Context, name, value, path string, maxAge time.Duration) {
	http.SetCookie(c.Writer, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     path,
		Domain:   h.cookies.Domain,
		MaxAge:   int(maxAge.Seconds()),
		HttpOnly: true,
		Secure:   h.cookies.Secure,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h *AuthHandler) writeSession(c *gin.Context, s Session) {
	h.setCookie(c, AccessCookie, s.AccessToken, "/", AccessTTL)
	h.setCookie(c, RefreshCookie, s.RefreshToken, refreshPath, RefreshTTL)
}

func (h *AuthHandler) clearSession(c *gin.Context) {
	h.setCookie(c, AccessCookie, "", "/", -time.Second)
	h.setCookie(c, RefreshCookie, "", refreshPath, -time.Second)
}

func (h *AuthHandler) signedIn(c *gin.Context, status int, user *domain.User) {
	session, err := h.service.StartSession(c.Request.Context(), user)
	if err != nil {
		h.logger.Error("start session failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't sign you in. Please try again.")
		return
	}
	h.writeSession(c, session)
	response.Success(c, status, gin.H{"user": user})
}

type registerRequest struct {
	Name     string `json:"name" binding:"required,max=100"`
	Email    string `json:"email" binding:"required,email,max=255"`
	Password string `json:"password" binding:"required,min=8,max=72"`
	Phone    string `json:"phone" binding:"max=20"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter your name, a valid email and a password of at least 8 characters.")
		return
	}
	user, err := h.service.Register(c.Request.Context(), req.Name, req.Email, req.Password, req.Phone)
	switch {
	case errors.Is(err, ErrEmailTaken):
		response.Conflict(c, "An account with this email already exists. Sign in instead.")
		return
	case errors.Is(err, ErrInvalidInput):
		response.BadRequest(c, "Enter your name, a valid email and a password of at least 8 characters.")
		return
	case err != nil:
		h.logger.Error("register failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't create your account. Please try again.")
		return
	}
	response.Created(c, gin.H{"verification_required": true, "email": user.Email})
}

type verifyRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6,numeric"`
}

func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req verifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter the 6-digit code from your email.")
		return
	}
	user, err := h.service.VerifyEmail(c.Request.Context(), req.Email, req.Code)
	switch {
	case errors.Is(err, ErrAccountSuspended):
		response.Fail(c, http.StatusForbidden, "ACCOUNT_SUSPENDED", "This account has been suspended.")
		return
	case err != nil:
		response.Fail(c, http.StatusBadRequest, "INVALID_CODE", "That code is incorrect or has expired. Request a new one.")
		return
	}
	h.signedIn(c, http.StatusOK, user)
}

type emailRequest struct {
	Email string `json:"email" binding:"required,email"`
}

func (h *AuthHandler) ResendCode(c *gin.Context) {
	var req emailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Enter a valid email address.")
		return
	}
	err := h.service.ResendVerification(c.Request.Context(), req.Email)
	if errors.Is(err, ErrTooManyCodes) {
		response.Fail(c, http.StatusTooManyRequests, "TOO_MANY_REQUESTS", "Please wait a minute before requesting another code.")
		return
	}
	if err != nil && !errors.Is(err, ErrInvalidInput) {
		h.logger.Warn("resend code failed", slog.Any("error", err))
	}
	response.Success(c, http.StatusAccepted, gin.H{"message": "If that email needs verifying, a new code is on its way."})
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,max=72"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Unauthorized(c, "Invalid email or password.")
		return
	}
	user, err := h.service.Login(c.Request.Context(), req.Email, req.Password)
	switch {
	case errors.Is(err, ErrEmailNotVerified):
		response.Fail(c, http.StatusForbidden, "EMAIL_NOT_VERIFIED", "Verify your email to continue. We've sent you a code.")
		return
	case errors.Is(err, ErrAccountLocked):
		response.Fail(c, http.StatusTooManyRequests, "ACCOUNT_LOCKED", "Too many attempts. Try again in 15 minutes.")
		return
	case errors.Is(err, ErrAccountSuspended):
		response.Fail(c, http.StatusForbidden, "ACCOUNT_SUSPENDED", "This account has been suspended.")
		return
	case errors.Is(err, ErrInvalidCredentials):
		response.Unauthorized(c, "Invalid email or password.")
		return
	case err != nil:
		h.logger.Error("login failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't sign you in. Please try again.")
		return
	}
	h.signedIn(c, http.StatusOK, user)
}

type googleRequest struct {
	Credential string `json:"credential" binding:"required,max=4096"`
}

func (h *AuthHandler) Google(c *gin.Context) {
	var req googleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Google sign-in failed. Please try again.")
		return
	}
	user, err := h.service.GoogleSignIn(c.Request.Context(), req.Credential)
	switch {
	case errors.Is(err, ErrGoogleNotConfigured):
		response.Fail(c, http.StatusServiceUnavailable, "GOOGLE_NOT_CONFIGURED", "Google sign-in is not available right now.")
		return
	case errors.Is(err, ErrAccountSuspended):
		response.Fail(c, http.StatusForbidden, "ACCOUNT_SUSPENDED", "This account has been suspended.")
		return
	case errors.Is(err, ErrInvalidGoogleToken):
		response.Unauthorized(c, "Google sign-in failed. Please try again.")
		return
	case err != nil:
		h.logger.Error("google sign-in failed", slog.Any("error", err))
		response.InternalError(c, "Google sign-in failed. Please try again.")
		return
	}
	h.signedIn(c, http.StatusOK, user)
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	token, _ := c.Cookie(RefreshCookie)
	user, session, err := h.service.RefreshSession(c.Request.Context(), token)
	if err != nil {
		h.clearSession(c)
		response.Unauthorized(c, "Your session has ended. Please sign in again.")
		return
	}
	h.writeSession(c, session)
	response.OK(c, gin.H{"user": user})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	token, _ := c.Cookie(RefreshCookie)
	h.service.EndSession(c.Request.Context(), token)
	h.clearSession(c)
	response.OK(c, gin.H{"message": "Signed out"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	user, _ := c.Get("user")
	response.OK(c, gin.H{"user": user})
}

// AuthMiddleware authenticates the access-token cookie (or a Bearer header
// for non-browser clients) and loads the current user.
func AuthMiddleware(service *Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, _ := c.Cookie(AccessCookie)
		if token == "" {
			if parts := strings.SplitN(c.GetHeader("Authorization"), " ", 2); len(parts) == 2 && strings.EqualFold(parts[0], "bearer") {
				token = parts[1]
			}
		}
		if token == "" {
			response.Unauthorized(c, "Please sign in.")
			c.Abort()
			return
		}
		user, err := service.Authenticate(c.Request.Context(), token)
		if err != nil {
			response.Unauthorized(c, "Your session has expired. Please sign in again.")
			c.Abort()
			return
		}
		if user.Status == "suspended" {
			response.Fail(c, http.StatusForbidden, "ACCOUNT_SUSPENDED", "Your account has been suspended.")
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
// AuthMiddleware (which injects "userRole").
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		role, _ := c.Get("userRole")
		roleStr, _ := role.(string)
		if !allowed[roleStr] {
			response.Fail(c, http.StatusForbidden, "FORBIDDEN", "You do not have access to this resource.")
			c.Abort()
			return
		}
		c.Next()
	}
}

func (h *AuthHandler) GetWallet(c *gin.Context) {
	userID := c.GetString("userID")
	wallet, err := h.service.GetWallet(c.Request.Context(), userID)
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
	userID := c.GetString("userID")
	var req CreditWalletRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}
	if err := h.service.CreditWallet(c.Request.Context(), userID, req.Amount); err != nil {
		h.logger.Error("Failed to credit wallet", slog.Any("error", err))
		response.InternalError(c, "Failed to credit wallet")
		return
	}
	wallet, _ := h.service.GetWallet(c.Request.Context(), userID)
	response.OK(c, gin.H{"message": "Wallet credited successfully", "wallet": wallet})
}
