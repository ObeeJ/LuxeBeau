package booking

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
	"luxebeau/internal/response"
	"luxebeau/internal/schedule"
)

// Studio is the artisan's own management of services and availability. Every
// method acts on the signed-in user's artisan profile only.
type Studio struct {
	db     *gorm.DB
	logger *slog.Logger
}

func NewStudio(db *gorm.DB, logger *slog.Logger) *Studio {
	return &Studio{db: db, logger: logger}
}

var (
	ErrNoProfile        = errors.New("no artisan profile")
	ErrInvalidServices  = errors.New("invalid services")
	ErrSlotLengthLocked = errors.New("slot length locked while bookings are upcoming")
)

const maxServices = 20

func (s *Studio) profile(ctx context.Context, userID string) (*domain.Artisan, error) {
	var a domain.Artisan
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNoProfile
	}
	return &a, err
}

// ServiceInput is one service as the artisan edits it; price is in naira.
type ServiceInput struct {
	Name         string `json:"name"`
	DurationMins int    `json:"duration_mins"`
	Price        int64  `json:"price"`
	Description  string `json:"description"`
}

// validServices normalises and checks the artisan's service menu.
func validServices(in []ServiceInput) (domain.ServiceList, error) {
	if len(in) == 0 || len(in) > maxServices {
		return nil, fmt.Errorf("%w: list between 1 and %d services", ErrInvalidServices, maxServices)
	}
	seen := map[string]bool{}
	out := make(domain.ServiceList, 0, len(in))
	for _, svc := range in {
		name := strings.TrimSpace(svc.Name)
		key := strings.ToLower(name)
		switch {
		case name == "" || len(name) > 80:
			return nil, fmt.Errorf("%w: each service needs a name of up to 80 characters", ErrInvalidServices)
		case seen[key]:
			return nil, fmt.Errorf("%w: %q is listed twice", ErrInvalidServices, name)
		case svc.Price <= 0 || svc.Price > 10_000_000:
			return nil, fmt.Errorf("%w: %q needs a price between ₦1 and ₦10,000,000", ErrInvalidServices, name)
		case svc.DurationMins < 15 || svc.DurationMins > 720 || svc.DurationMins%15 != 0:
			return nil, fmt.Errorf("%w: %q must last 15 minutes to 12 hours, in 15-minute steps", ErrInvalidServices, name)
		case len(svc.Description) > 300:
			return nil, fmt.Errorf("%w: keep %q's description under 300 characters", ErrInvalidServices, name)
		}
		seen[key] = true
		out = append(out, domain.ArtisanService{
			Name:         name,
			DurationMins: svc.DurationMins,
			Price:        svc.Price * 100,
			Description:  strings.TrimSpace(svc.Description),
		})
	}
	return out, nil
}

// SetServices replaces the service menu and keeps "from" price in step.
func (s *Studio) SetServices(ctx context.Context, userID string, in []ServiceInput) (domain.ServiceList, error) {
	a, err := s.profile(ctx, userID)
	if err != nil {
		return nil, err
	}
	list, err := validServices(in)
	if err != nil {
		return nil, err
	}
	from := list[0].Price
	for _, svc := range list {
		if svc.Price < from {
			from = svc.Price
		}
	}
	err = s.db.WithContext(ctx).Model(&domain.Artisan{}).Where("id = ?", a.ID).
		Updates(map[string]any{"services": list, "price_from": from}).Error
	return list, err
}

// ScheduleInput is the artisan's weekly hours, slot length and days off.
type ScheduleInput struct {
	WeeklyHours domain.WeeklyHours `json:"weekly_hours"`
	SlotMinutes int                `json:"slot_minutes"`
	DaysOff     []string           `json:"days_off"`
}

func (s *Studio) GetSchedule(ctx context.Context, userID string) (*ScheduleInput, error) {
	a, err := s.profile(ctx, userID)
	if err != nil {
		return nil, err
	}
	hours := a.WeeklyHours
	if hours == nil {
		hours = domain.WeeklyHours{}
	}
	off := []string(a.DaysOff)
	if off == nil {
		off = []string{}
	}
	return &ScheduleInput{WeeklyHours: hours, SlotMinutes: a.SlotMinutes, DaysOff: off}, nil
}

// SetSchedule saves new hours and regenerates future free slots. Booked
// slots are never moved. Slot length can't change while bookings are
// upcoming, since old and new grids would overlap.
func (s *Studio) SetSchedule(ctx context.Context, userID string, in ScheduleInput) error {
	a, err := s.profile(ctx, userID)
	if err != nil {
		return err
	}
	if err := schedule.ValidateHours(in.WeeklyHours, in.SlotMinutes, in.DaysOff); err != nil {
		return err
	}
	if in.SlotMinutes != a.SlotMinutes {
		var booked int64
		if err := s.db.WithContext(ctx).Model(&domain.BookingSlot{}).
			Where("artisan_id = ? AND reserved = ? AND slot_date >= ?", a.ID, true, schedule.Today()).
			Count(&booked).Error; err != nil {
			return err
		}
		if booked > 0 {
			return ErrSlotLengthLocked
		}
	}
	off := domain.StringArray(in.DaysOff)
	if off == nil {
		off = domain.StringArray{}
	}
	if err := s.db.WithContext(ctx).Model(&domain.Artisan{}).Where("id = ?", a.ID).
		Updates(map[string]any{"weekly_hours": in.WeeklyHours, "slot_minutes": in.SlotMinutes, "days_off": off}).Error; err != nil {
		return err
	}
	a.WeeklyHours, a.SlotMinutes, a.DaysOff = in.WeeklyHours, in.SlotMinutes, off
	return schedule.Rebuild(ctx, s.db, a)
}

func (s *Studio) Slots(ctx context.Context, userID string, days int) ([]domain.BookingSlot, error) {
	a, err := s.profile(ctx, userID)
	if err != nil {
		return nil, err
	}
	return schedule.Upcoming(ctx, s.db, a, days)
}

func (s *Studio) AddSlot(ctx context.Context, userID, date, start string) (*domain.BookingSlot, error) {
	a, err := s.profile(ctx, userID)
	if err != nil {
		return nil, err
	}
	d, err := schedule.ParseDate(date)
	if err != nil {
		return nil, schedule.ErrInvalidSlot
	}
	return schedule.AddManual(ctx, s.db, a, d, start)
}

func (s *Studio) RemoveSlot(ctx context.Context, userID string, slotID uint) error {
	a, err := s.profile(ctx, userID)
	if err != nil {
		return err
	}
	return schedule.RemoveFree(ctx, s.db, a, slotID)
}

// ── HTTP ──────────────────────────────────────────────────────

func (s *Studio) fail(c *gin.Context, err error, action string) {
	switch {
	case errors.Is(err, ErrNoProfile):
		response.NotFound(c, "Set up your artisan profile first.")
	case errors.Is(err, ErrInvalidServices), errors.Is(err, schedule.ErrInvalidHours):
		// These messages are written for the artisan and carry no internals.
		msg := err.Error()
		if i := strings.Index(msg, ": "); i >= 0 {
			msg = msg[i+2:]
		}
		response.BadRequest(c, strings.ToUpper(msg[:1])+msg[1:]+".")
	case errors.Is(err, ErrSlotLengthLocked):
		response.Conflict(c, "You can change slot length once your upcoming bookings are done.")
	case errors.Is(err, schedule.ErrInvalidSlot):
		response.BadRequest(c, "Pick a free future time that isn't already open.")
	default:
		s.logger.Error(action+" failed", slog.Any("error", err))
		response.InternalError(c, "Something went wrong. Please try again.")
	}
}

// PUT /me/artisan/services
func (s *Studio) PutServices(c *gin.Context) {
	var req struct {
		Services []ServiceInput `json:"services"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Send your list of services.")
		return
	}
	list, err := s.SetServices(c.Request.Context(), c.GetString("userID"), req.Services)
	if err != nil {
		s.fail(c, err, "set services")
		return
	}
	response.OK(c, gin.H{"services": list})
}

// GET /me/artisan/schedule
func (s *Studio) GetScheduleHandler(c *gin.Context) {
	out, err := s.GetSchedule(c.Request.Context(), c.GetString("userID"))
	if err != nil {
		s.fail(c, err, "get schedule")
		return
	}
	response.OK(c, out)
}

// PUT /me/artisan/schedule
func (s *Studio) PutSchedule(c *gin.Context) {
	var req ScheduleInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Send your opening hours.")
		return
	}
	if err := s.SetSchedule(c.Request.Context(), c.GetString("userID"), req); err != nil {
		s.fail(c, err, "set schedule")
		return
	}
	response.OK(c, gin.H{"message": "Hours saved"})
}

// GET /me/artisan/slots?days=
func (s *Studio) GetSlots(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "14"))
	if days < 1 || days > schedule.WindowDays {
		days = 14
	}
	slots, err := s.Slots(c.Request.Context(), c.GetString("userID"), days)
	if err != nil {
		s.fail(c, err, "list slots")
		return
	}
	response.OK(c, gin.H{"slots": slots})
}

// POST /me/artisan/slots {date, time}
func (s *Studio) PostSlot(c *gin.Context) {
	var req struct {
		Date string `json:"date" binding:"required,len=10"`
		Time string `json:"time" binding:"required,len=5"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Choose a date and a time.")
		return
	}
	slot, err := s.AddSlot(c.Request.Context(), c.GetString("userID"), req.Date, req.Time)
	if err != nil {
		s.fail(c, err, "add slot")
		return
	}
	response.Created(c, gin.H{"slot": slot})
}

// DELETE /me/artisan/slots/:id
func (s *Studio) DeleteSlot(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.BadRequest(c, "Invalid slot")
		return
	}
	if err := s.RemoveSlot(c.Request.Context(), c.GetString("userID"), uint(id)); err != nil {
		s.fail(c, err, "remove slot")
		return
	}
	response.OK(c, gin.H{"message": "Slot removed"})
}
