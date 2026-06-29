package booking

import (
	"log/slog"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"luxebeau/internal/domain"
	"luxebeau/internal/response"
)

type BookingHandler struct {
	service domain.BookingService
	logger  *slog.Logger
}

func NewBookingHandler(service domain.BookingService, logger *slog.Logger) *BookingHandler {
	return &BookingHandler{service: service, logger: logger}
}

type CreateBookingRequest struct {
	ArtisanID   uint   `json:"artisan_id" binding:"required"`
	ServiceName string `json:"service_name" binding:"required"`
	Date        string `json:"date" binding:"required"`
	SlotTime    string `json:"slot_time" binding:"required"`
	ServiceType string `json:"service_type" binding:"required,oneof=home studio both"`
}

func (h *BookingHandler) CreateBooking(c *gin.Context) {
	var req CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	buyerID, _ := c.Get("userID")

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		response.BadRequest(c, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	b, err := h.service.BookService(c.Request.Context(), buyerID.(string), req.ArtisanID, req.ServiceName, date, req.SlotTime, req.ServiceType)
	if err != nil {
		response.Conflict(c, err.Error())
		return
	}

	response.Created(c, gin.H{"booking": b})
}

func (h *BookingHandler) ListMyBookings(c *gin.Context) {
	userID, _ := c.Get("userID")
	bookings, err := h.service.ListMyBookings(c.Request.Context(), userID.(string))
	if err != nil {
		response.InternalError(c, "Failed to fetch bookings")
		return
	}
	response.OK(c, gin.H{"bookings": bookings})
}

func (h *BookingHandler) ListArtisans(c *gin.Context) {
	specialty := c.Query("specialty")
	location := c.Query("location")

	artisans, err := h.service.ListArtisans(c.Request.Context(), specialty, location)
	if err != nil {
		response.InternalError(c, "Failed to fetch artisans")
		return
	}

	response.OK(c, gin.H{"artisans": artisans})
}

func (h *BookingHandler) GetArtisanProfile(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid artisan ID")
		return
	}

	artisan, slots, err := h.service.GetArtisanProfile(c.Request.Context(), uint(id))
	if err != nil {
		response.NotFound(c, "Artisan not found")
		return
	}

	response.OK(c, gin.H{"artisan": artisan, "available_slots": slots})
}

func (h *BookingHandler) ConfirmBooking(c *gin.Context) {
	bookingID := c.Param("id")
	if err := h.service.ConfirmBooking(c.Request.Context(), bookingID); err != nil {
		response.InternalError(c, "Failed to confirm booking")
		return
	}
	response.OK(c, gin.H{"message": "Booking confirmed"})
}

type OnboardArtisanRequest struct {
	Specialty string `json:"specialty" binding:"required"`
	Craft     string `json:"craft" binding:"required"`
	Studio    string `json:"studio" binding:"required"`
	PriceFrom int64  `json:"price_from" binding:"required"`
	Location  string `json:"location" binding:"required"`
	City      string `json:"city" binding:"required"`
	Area      string `json:"area" binding:"required"`
	Bio       string `json:"bio"`
}

type OnboardSellerRequest struct {
	CACNumber string `json:"cac_number" binding:"required"`
}

func (h *BookingHandler) OnboardArtisan(c *gin.Context) {
	var req OnboardArtisanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	userID, _ := c.Get("userID")

	artisan := domain.Artisan{
		Specialty: req.Specialty,
		Craft:     req.Craft,
		Studio:    req.Studio,
		PriceFrom: req.PriceFrom * 100, // Convert to Kobo
		Location:  req.Location,
		City:      req.City,
		Area:      req.Area,
		Bio:       req.Bio,
	}

	profile, err := h.service.OnboardArtisan(c.Request.Context(), userID.(string), &artisan)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"message": "Artisan onboarded successfully",
		"profile": profile,
	})
}

func (h *BookingHandler) OnboardSeller(c *gin.Context) {
	var req OnboardSellerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	userID, _ := c.Get("userID")

	err := h.service.OnboardSeller(c.Request.Context(), userID.(string), req.CACNumber)
	if err != nil {
		response.InternalError(c, err.Error())
		return
	}

	response.OK(c, gin.H{
		"message": "Seller onboarded successfully",
	})
}

func (h *BookingHandler) GetMyArtisanProfile(c *gin.Context) {
	userID, _ := c.Get("userID")
	artisan, err := h.service.GetArtisanByUserID(c.Request.Context(), userID.(string))
	if err != nil {
		response.InternalError(c, "Failed to fetch artisan profile")
		return
	}
	if artisan == nil {
		response.NotFound(c, "Artisan profile not found")
		return
	}
	response.OK(c, gin.H{"artisan": artisan})
}
