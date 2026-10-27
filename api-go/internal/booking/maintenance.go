package booking

import (
	"context"
	"log/slog"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
	"luxebeau/internal/mail"
	"luxebeau/internal/schedule"
)

// Maintenance is the booking work that happens on a timer: cancelling requests
// nobody answered, and reminding clients about tomorrow's appointments. It
// claims each booking with a conditional update, so several API instances (or a
// restart mid-run) never expire or remind twice.
type Maintenance struct {
	db     *gorm.DB
	mailer *mail.Mailer
	logger *slog.Logger
}

func NewMaintenance(db *gorm.DB, mailer *mail.Mailer, logger *slog.Logger) *Maintenance {
	return &Maintenance{db: db, mailer: mailer, logger: logger}
}

const batch = 200

func (m *Maintenance) load(ctx context.Context, id string) (*domain.Booking, error) {
	var b domain.Booking
	if err := m.db.WithContext(ctx).Preload("Buyer").Preload("Artisan.User").First(&b, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &b, nil
}

// ExpireStale cancels pending requests whose answer deadline has passed,
// frees their slots and tells the client. It returns how many it cancelled.
func (m *Maintenance) ExpireStale(ctx context.Context) (int, error) {
	now := schedule.Now()
	// Requests made before answer deadlines existed have no expires_at; they
	// expire a day after they were made, like any new request.
	legacyCutoff := now.Add(-domain.ConfirmWithin)
	var ids []string
	if err := m.db.WithContext(ctx).Model(&domain.Booking{}).
		Where("status = ?", domain.BookingPending).
		Where("(expires_at IS NOT NULL AND expires_at <= ?) OR (expires_at IS NULL AND created_at <= ?)", now, legacyCutoff).
		Order("created_at").Limit(batch).Pluck("id", &ids).Error; err != nil {
		return 0, err
	}
	n := 0
	for _, id := range ids {
		claimed := false
		err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			res := tx.Model(&domain.Booking{}).Where("id = ? AND status = ?", id, domain.BookingPending).
				Updates(map[string]any{
					"status": domain.BookingCancelled, "cancelled_at": now, "cancelled_by": "system",
					"cancel_reason": "The artisan didn't answer in time",
				})
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected == 0 {
				return nil // answered or cancelled in the meantime
			}
			claimed = true
			return releaseSlots(tx, id)
		})
		if err != nil {
			m.logger.Warn("expire booking failed", slog.String("booking", id), slog.Any("error", err))
			continue
		}
		if !claimed {
			continue
		}
		n++
		if m.mailer == nil {
			continue
		}
		if b, err := m.load(ctx, id); err == nil && b.Buyer.Email != "" {
			info := m.emailFor(b)
			to, name := b.Buyer.Email, b.Buyer.Name
			c := mail.CancelEmail{By: "system", Reason: b.CancelReason}
			m.mailer.Go("booking_expired", func(ctx context.Context) error {
				return m.mailer.BookingCancelledForClient(ctx, to, name, info, c)
			})
		}
	}
	return n, nil
}

// SendReminders emails clients about confirmed appointments that start within
// the next day. A booking made less than a day ahead is skipped: the client
// has only just seen it.
func (m *Maintenance) SendReminders(ctx context.Context) (int, error) {
	now := schedule.Now()
	today := schedule.Today()
	var due []domain.Booking
	if err := m.db.WithContext(ctx).
		Where("status = ? AND reminder_sent_at IS NULL AND booking_date >= ? AND booking_date <= ?",
			domain.BookingConfirmed, today, today.AddDate(0, 0, 2)).
		Limit(batch).Find(&due).Error; err != nil {
		return 0, err
	}
	n := 0
	for _, d := range due {
		start, err := schedule.StartAt(d.BookingDate, d.BookingTime)
		if err != nil || !start.After(now) || start.Sub(now) > 24*time.Hour {
			continue
		}
		if start.Sub(d.CreatedAt) <= 24*time.Hour {
			// Booked inside a day of the appointment: mark it so it isn't
			// reconsidered every run.
			m.db.WithContext(ctx).Model(&domain.Booking{}).Where("id = ?", d.ID).Update("reminder_sent_at", now)
			continue
		}
		res := m.db.WithContext(ctx).Model(&domain.Booking{}).
			Where("id = ? AND reminder_sent_at IS NULL AND status = ?", d.ID, domain.BookingConfirmed).
			Update("reminder_sent_at", now)
		if res.Error != nil || res.RowsAffected == 0 {
			continue
		}
		n++
		if m.mailer == nil {
			continue
		}
		if b, err := m.load(ctx, d.ID); err == nil && b.Buyer.Email != "" {
			info := m.emailFor(b)
			to, name := b.Buyer.Email, b.Buyer.Name
			m.mailer.Go("booking_reminder", func(ctx context.Context) error {
				return m.mailer.BookingReminder(ctx, to, name, info)
			})
		}
	}
	return n, nil
}

func (m *Maintenance) emailFor(b *domain.Booking) mail.BookingEmail {
	return bookingEmail(b, &b.Artisan, b.Buyer.Name)
}
