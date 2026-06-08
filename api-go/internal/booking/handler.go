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
