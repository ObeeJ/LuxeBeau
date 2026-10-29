package booking

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
	"luxebeau/internal/schedule"
)

// Errors for the booking lifecycle. Handlers turn them into messages written
// for the person using the app.
var (
	ErrNotCancellable = errors.New("this booking can no longer be cancelled")
	ErrAlreadyStarted = errors.New("the appointment has already started")
	ErrNotStartedYet  = errors.New("the appointment hasn't started yet")
	ErrNotConfirmed   = errors.New("only a confirmed booking can be closed")
	ErrNotPending     = errors.New("this request is no longer waiting for an answer")
)

const maxReasonRunes = 300

func cleanReason(s string) string {
	s = strings.TrimSpace(s)
	if r := []rune(s); len(r) > maxReasonRunes {
		s = string(r[:maxReasonRunes])
	}
	return s
}

// loadFull loads a booking with the client and the artisan (and their account),
// which the lifecycle rules and the notification emails both need.
func (s *bookingService) loadFull(ctx context.Context, id string) (*domain.Booking, error) {
	var b domain.Booking
	if err := s.db.WithContext(ctx).Preload("Buyer").Preload("Artisan.User").First(&b, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrBookingNotFound
		}
		return nil, err
	}
	return &b, nil
}

// releaseSlots frees every slot a booking was holding.
func releaseSlots(tx *gorm.DB, bookingID string) error {
	return tx.Model(&domain.BookingSlot{}).Where("booking_id = ?", bookingID).
		Updates(map[string]any{"reserved": false, "booking_id": ""}).Error
}

// expiryFor is when an unanswered request is cancelled automatically: a day
// after it was made, or half an hour before the appointment if that is sooner,
// but never less than 15 minutes from now so the artisan has a chance to answer.
func expiryFor(now, start time.Time) time.Time {
	expires := now.Add(domain.ConfirmWithin)
	if latest := start.Add(-30 * time.Minute); latest.Before(expires) {
		expires = latest
	}
	if floor := now.Add(15 * time.Minute); expires.Before(floor) {
		expires = floor
	}
	return expires
}

// CancelBooking cancels a pending or confirmed booking before it starts and
// frees its slots. Cancelling a confirmed booking inside the artisan's notice
// window is recorded as a late cancellation. Nobody is charged: bookings take
// no online payment today.
func (s *bookingService) CancelBooking(ctx context.Context, bookingID, actorID string, admin bool, reason string) (*domain.Booking, error) {
	b, err := s.loadFull(ctx, bookingID)
	if err != nil {
		return nil, err
	}
	var by string
	switch {
	case b.BuyerID == actorID:
		by = "buyer"
	case b.Artisan.UserID == actorID:
		by = "artisan"
	case admin:
		by = "admin"
	default:
		return nil, ErrBookingNotFound // not yours: indistinguishable from missing
	}

	start, err := schedule.StartAt(b.BookingDate, b.BookingTime)
	if err != nil {
		return nil, err
	}
	now := schedule.Now()
	if !start.After(now) {
		return nil, ErrAlreadyStarted
	}
	// The notice window protects the artisan's confirmed appointments. A
	// request nobody agreed to yet can always be withdrawn, and an artisan or
	// admin cancelling is never "late" on the client's record.
	late := by == "buyer" && b.Status == domain.BookingConfirmed &&
		start.Sub(now) < time.Duration(b.PolicyHours)*time.Hour

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Matching on the status we read keeps a concurrent confirm or cancel
		// from slipping through with the wrong "late" decision.
		res := tx.Model(&domain.Booking{}).Where("id = ? AND status = ?", b.ID, b.Status).
			Where("status IN ?", []string{domain.BookingPending, domain.BookingConfirmed}).
			Updates(map[string]any{
				"status": domain.BookingCancelled, "cancelled_at": now, "cancelled_by": by,
				"cancel_reason": cleanReason(reason), "late_cancel": late,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrNotCancellable
		}
		return releaseSlots(tx, b.ID)
	})
	if err != nil {
		return nil, err
	}
	return s.loadFull(ctx, bookingID)
}

// closeBooking moves a confirmed booking to a final status once its start time
// (plus a grace period) has passed. Only the booked artisan or an admin may.
func (s *bookingService) closeBooking(ctx context.Context, bookingID, actorID string, admin bool, status string, grace time.Duration) (*domain.Booking, error) {
	b, err := s.loadFull(ctx, bookingID)
	if err != nil {
		return nil, err
	}
	if !admin && b.Artisan.UserID != actorID {
		return nil, ErrBookingNotFound
	}
	if b.Status != domain.BookingConfirmed {
		return nil, ErrNotConfirmed
	}
	start, err := schedule.StartAt(b.BookingDate, b.BookingTime)
	if err != nil {
		return nil, err
	}
	if schedule.Now().Before(start.Add(grace)) {
		return nil, ErrNotStartedYet
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&domain.Booking{}).Where("id = ? AND status = ?", b.ID, domain.BookingConfirmed).Update("status", status)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrNotConfirmed
		}
		if status == domain.BookingCompleted {
			// A finished job adds to the count clients see on the artisan's profile.
			return tx.Model(&domain.Artisan{}).Where("id = ?", b.ArtisanID).
				Update("jobs_completed", gorm.Expr("jobs_completed + 1")).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return s.loadFull(ctx, bookingID)
}

func (s *bookingService) CompleteBooking(ctx context.Context, bookingID, actorID string, admin bool) (*domain.Booking, error) {
	return s.closeBooking(ctx, bookingID, actorID, admin, domain.BookingCompleted, 0)
}

func (s *bookingService) MarkNoShow(ctx context.Context, bookingID, actorID string, admin bool) (*domain.Booking, error) {
	return s.closeBooking(ctx, bookingID, actorID, admin, domain.BookingNoShow, domain.NoShowGrace)
}

// decorate fills in the computed fields on listed bookings: when free
// cancellation ends, and (for an artisan's list) how reliable each client has been.
func (s *bookingService) decorate(ctx context.Context, bookings []domain.Booking, withStrikes bool) error {
	for i := range bookings {
		b := &bookings[i]
		if b.Status != domain.BookingPending && b.Status != domain.BookingConfirmed {
			continue
		}
		if start, err := schedule.StartAt(b.BookingDate, b.BookingTime); err == nil {
			until := start.Add(-time.Duration(b.PolicyHours) * time.Hour)
			b.FreeCancelUntil = &until
		}
	}
	if !withStrikes || len(bookings) == 0 {
		return nil
	}
	seen := map[string]bool{}
	var buyers []string
	for _, b := range bookings {
		if !seen[b.BuyerID] {
			seen[b.BuyerID] = true
			buyers = append(buyers, b.BuyerID)
		}
	}
	since := schedule.Now().Add(-domain.StrikeWindow)
	var rows []struct {
		BuyerID string
		N       int
	}
	err := s.db.WithContext(ctx).Model(&domain.Booking{}).
		Select("buyer_id, COUNT(*) AS n").
		Where("buyer_id IN ?", buyers).
		Where("(late_cancel = ? AND cancelled_at >= ?) OR (status = ? AND booking_date >= ?)", true, since, domain.BookingNoShow, since).
		Group("buyer_id").Scan(&rows).Error
	if err != nil {
		return err
	}
	counts := make(map[string]int, len(rows))
	for _, r := range rows {
		counts[r.BuyerID] = r.N
	}
	for i := range bookings {
		bookings[i].BuyerStrikes = counts[bookings[i].BuyerID]
	}
	return nil
}
