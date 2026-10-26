package booking

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"luxebeau/internal/domain"
	"luxebeau/internal/mail"
	"luxebeau/internal/media"
	"luxebeau/internal/response"
)

type BookingHandler struct {
	service domain.BookingService
	mailer  *mail.Mailer
	images  *media.Images
	logger  *slog.Logger
}

func NewBookingHandler(service domain.BookingService, mailer *mail.Mailer, images *media.Images, logger *slog.Logger) *BookingHandler {
	return &BookingHandler{service: service, mailer: mailer, images: images, logger: logger}
}

type CreateBookingRequest struct {
	ArtisanID   uint   `json:"artisan_id" binding:"required"`
	ServiceName string `json:"service_name" binding:"required,max=255"`
	Date        string `json:"date" binding:"required"`
	SlotTime    string `json:"slot_time" binding:"required,max=10"`
	ServiceType string `json:"service_type" binding:"required,oneof=home studio"`
	Address     string `json:"address" binding:"max=500"`
}

func naira(kobo int64) string {
	n := kobo / 100
	s := strconv.FormatInt(n, 10)
	for i := len(s) - 3; i > 0; i -= 3 {
		s = s[:i] + "," + s[i:]
	}
	return "₦" + s
}

func bookingEmail(b *domain.Booking, artisan *domain.Artisan, clientName string) mail.BookingEmail {
	where := artisan.Studio
	if artisan.Area != "" {
		where += ", " + artisan.Area
	}
	if b.ServiceType == domain.ServiceHome {
		where = "Home visit: " + b.Address
	}
	return mail.BookingEmail{
		BookingID: b.ID,
		Service:   b.ServiceName,
		Artisan:   artisan.User.Name,
		Client:    clientName,
		When:      fmt.Sprintf("%s at %s", b.BookingDate.Format("Mon 2 Jan 2006"), b.BookingTime),
		Where:     where,
		Price:     "from " + naira(b.Amount),
	}
}

func (h *BookingHandler) CreateBooking(c *gin.Context) {
	var req CreateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Choose a service, a day, a time and where you'd like the appointment.")
		return
	}
	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		response.BadRequest(c, "Invalid date format. Use YYYY-MM-DD")
		return
	}

	user, _ := c.Get("user")
	buyer, _ := user.(*domain.User)
	if buyer == nil {
		response.Unauthorized(c, "Please sign in.")
		return
	}

	b, err := h.service.BookService(c.Request.Context(), buyer.ID, req.ArtisanID, req.ServiceName, date, req.SlotTime, req.ServiceType, req.Address)
	switch {
	case errors.Is(err, ErrSlotTaken):
		response.Conflict(c, "That time was just taken. Please pick another slot.")
		return
	case errors.Is(err, ErrVisitUnavailable):
		response.BadRequest(c, "This artisan doesn't offer that type of appointment.")
		return
	case errors.Is(err, ErrAddressRequired):
		response.BadRequest(c, "Enter the address for your home appointment.")
		return
	case errors.Is(err, ErrArtisanNotFound):
		response.NotFound(c, "Artisan not found")
		return
	case err != nil:
		h.logger.Error("create booking failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't reserve that slot. Please try again.")
		return
	}

	if h.mailer != nil {
		if artisan, _, aerr := h.service.GetArtisanProfile(c.Request.Context(), req.ArtisanID); aerr == nil && artisan != nil {
			info := bookingEmail(b, artisan, buyer.Name)
			to, name := buyer.Email, buyer.Name
			h.mailer.Go("booking_requested", func(ctx context.Context) error { return h.mailer.BookingRequested(ctx, to, name, info) })
			if artisan.User.Email != "" {
				aTo, aName := artisan.User.Email, artisan.User.Name
				h.mailer.Go("booking_new", func(ctx context.Context) error { return h.mailer.NewBookingForArtisan(ctx, aTo, aName, info) })
			}
		}
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

// ConfirmBooking: only the booked artisan (or an admin) may confirm.
func (h *BookingHandler) ConfirmBooking(c *gin.Context) {
	actorID := c.GetString("userID")
	isAdmin := c.GetString("userRole") == "admin"
	b, err := h.service.ConfirmBooking(c.Request.Context(), c.Param("id"), actorID, isAdmin)
	switch {
	case errors.Is(err, ErrBookingNotFound), errors.Is(err, ErrNotYourBooking):
		response.NotFound(c, "Booking not found")
		return
	case err != nil:
		h.logger.Error("confirm booking failed", slog.Any("error", err))
		response.InternalError(c, "Failed to confirm booking")
		return
	}
	if h.mailer != nil && b.Buyer.Email != "" {
		info := bookingEmail(b, &b.Artisan, b.Buyer.Name)
		to, name := b.Buyer.Email, b.Buyer.Name
		h.mailer.Go("booking_confirmed", func(ctx context.Context) error { return h.mailer.BookingConfirmed(ctx, to, name, info) })
	}
	response.OK(c, gin.H{"message": "Booking confirmed"})
}

type OnboardArtisanRequest struct {
	Specialty   string `json:"specialty" binding:"required,max=100"`
	Craft       string `json:"craft" binding:"required,max=100"`
	Studio      string `json:"studio" binding:"required,max=150"`
	PriceFrom   int64  `json:"price_from" binding:"required,gt=0,lt=100000000"`
	Location    string `json:"location" binding:"required,max=150"`
	City        string `json:"city" binding:"required,max=80"`
	Area        string `json:"area" binding:"required,max=120"`
	Bio         string `json:"bio" binding:"max=2000"`
	ServiceMode string `json:"service_mode" binding:"required,oneof=studio home both"`
	ImageURL    string `json:"image_url" binding:"max=500"`
}

type OnboardSellerRequest struct {
	CACNumber string `json:"cac_number" binding:"required,max=30"`
}

func (h *BookingHandler) OnboardArtisan(c *gin.Context) {
	var req OnboardArtisanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Please complete every required field.")
		return
	}
	if !h.images.ValidURL(req.ImageURL) {
		response.BadRequest(c, "Upload your photo through LuxeBeau.")
		return
	}

	userID, _ := c.Get("userID")

	artisan := domain.Artisan{
		Specialty:   req.Specialty,
		Craft:       req.Craft,
		Studio:      req.Studio,
		PriceFrom:   req.PriceFrom * 100, // Convert to Kobo
		Location:    req.Location,
		City:        req.City,
		Area:        req.Area,
		Bio:         req.Bio,
		ServiceMode: req.ServiceMode,
		ImageURL:    req.ImageURL,
	}

	profile, err := h.service.OnboardArtisan(c.Request.Context(), userID.(string), &artisan)
	if err != nil {
		h.logger.Error("onboard artisan failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't save your profile. Please try again.")
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
		response.BadRequest(c, "Enter your CAC registration number.")
		return
	}

	userID, _ := c.Get("userID")

	if err := h.service.OnboardSeller(c.Request.Context(), userID.(string), req.CACNumber); err != nil {
		h.logger.Error("onboard seller failed", slog.Any("error", err))
		response.InternalError(c, "We couldn't save your registration. Please try again.")
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
