package booking

import (
	"context"
	crand "crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"strings"
	"time"

	"gorm.io/gorm"
	"luxebeau/internal/domain"
	"luxebeau/internal/escrow"
	"luxebeau/internal/schedule"
)

type bookingService struct {
	repo   domain.BookingRepository
	db     *gorm.DB
	logger *slog.Logger
}

func NewBookingService(repo domain.BookingRepository, db *gorm.DB, logger *slog.Logger) domain.BookingService {
	return &bookingService{repo: repo, db: db, logger: logger}
}

// Errors the handler maps to client-facing messages.
var (
	ErrSlotTaken        = schedule.ErrSlotTaken
	ErrArtisanNotFound  = errors.New("artisan not found")
	ErrVisitUnavailable = errors.New("this artisan does not offer that type of visit")
	ErrAddressRequired  = errors.New("an address is required for home visits")
	ErrBookingNotFound  = errors.New("booking not found")
	ErrNotYourBooking   = errors.New("not your booking")
	ErrServiceNotFound  = errors.New("service not found")
	ErrDateInPast       = errors.New("date is in the past")
)

// newBookingID returns BK- plus 8 random hex characters.
func newBookingID() (string, error) {
	b := make([]byte, 4)
	if _, err := crand.Read(b); err != nil {
		return "", err
	}
	return "BK-" + strings.ToUpper(hex.EncodeToString(b)), nil
}

// bookableArtisan loads an artisan buyers may book: approved by an admin
// (users.verified) and marked available.
func (s *bookingService) bookableArtisan(ctx context.Context, artisanID uint) (*domain.Artisan, error) {
	var a domain.Artisan
	err := s.db.WithContext(ctx).
		Joins("JOIN users ON users.id = artisans.user_id AND users.verified = ?", true).
		Where("artisans.id = ? AND artisans.available = ?", artisanID, true).
		First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrArtisanNotFound
		}
		return nil, err
	}
	return &a, nil
}

func (s *bookingService) BookService(ctx context.Context, buyerID string, artisanID uint, serviceName string, date time.Time, slotTime string, svcType string, address string) (*domain.Booking, error) {
	address = strings.TrimSpace(address)

	// Validate everything about the request before touching any slot.
	artisan, err := s.bookableArtisan(ctx, artisanID)
	if err != nil {
		return nil, err
	}
	service, ok := artisan.FindService(serviceName)
	if !ok {
		return nil, ErrServiceNotFound
	}
	if !artisan.Offers(svcType) {
		return nil, ErrVisitUnavailable
	}
	if svcType == domain.ServiceHome && len(address) < 8 {
		return nil, ErrAddressRequired
	}
	if svcType != domain.ServiceHome {
		address = ""
	}
	if date.Before(schedule.Today()) {
		return nil, ErrDateInPast
	}
	// Make sure weekly slots exist for the requested date.
	if err := schedule.Ensure(ctx, s.db, artisan); err != nil {
		return nil, err
	}

	id, err := newBookingID()
	if err != nil {
		return nil, err
	}
	amount := service.Price
	if amount <= 0 {
		amount = artisan.PriceFrom
	}
	booking := &domain.Booking{
		ID:          id,
		BuyerID:     buyerID,
		ArtisanID:   artisanID,
		ServiceName: service.Name,
		BookingDate: date,
		BookingTime: slotTime,
		ServiceType: svcType,
		Address:     address,
		Amount:      amount,
		Status:      domain.BookingPending,
		PolicyHours: artisan.CancelWindowHours,
	}
	if start, err := schedule.StartAt(date, slotTime); err == nil {
		expires := expiryFor(schedule.Now(), start)
		booking.ExpiresAt = &expires
	}

	// Reserve every slot the service needs and insert the booking atomically.
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := schedule.Reserve(tx, artisan, date, slotTime, service.DurationMins, id); err != nil {
			return err
		}
		return tx.Create(booking).Error
	})
	if err != nil {
		if !errors.Is(err, ErrSlotTaken) && !errors.Is(err, schedule.ErrInvalidSlot) {
			s.logger.Error("create booking failed", slog.Any("error", err))
		}
		if errors.Is(err, schedule.ErrInvalidSlot) {
			return nil, ErrSlotTaken
		}
		return nil, err
	}

	s.logger.Info("booking created", slog.String("id", booking.ID), slog.Uint64("artisan", uint64(artisanID)))
	return booking, nil
}

// publicUser trims the preloaded account to fields safe to show anyone.
func publicUser(db *gorm.DB) *gorm.DB {
	return db.Select("id", "name", "verified")
}

func (s *bookingService) GetArtisanProfile(ctx context.Context, artisanID uint) (*domain.Artisan, error) {
	if _, err := s.bookableArtisan(ctx, artisanID); err != nil {
		return nil, err
	}
	var a domain.Artisan
	if err := s.db.WithContext(ctx).Preload("User", publicUser).First(&a, artisanID).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *bookingService) ListArtisans(ctx context.Context, specialty, location string) ([]domain.Artisan, error) {
	var artisans []domain.Artisan
	q := s.db.WithContext(ctx).Preload("User", publicUser).
		Joins("JOIN users ON users.id = artisans.user_id AND users.verified = ?", true).
		Where("artisans.available = ?", true)
	if specialty != "" {
		q = q.Where("LOWER(artisans.specialty) LIKE ?", "%"+strings.ToLower(specialty)+"%")
	}
	if location != "" {
		q = q.Where("LOWER(artisans.location) LIKE ?", "%"+strings.ToLower(location)+"%")
	}
	if err := q.Order("artisans.rating DESC, artisans.id").Find(&artisans).Error; err != nil {
		return nil, err
	}
	return artisans, nil
}

// Availability lists start times where the named service fits.
func (s *bookingService) Availability(ctx context.Context, artisanID uint, serviceName string, days int) ([]domain.AvailableDay, error) {
	artisan, err := s.bookableArtisan(ctx, artisanID)
	if err != nil {
		return nil, err
	}
	service, ok := artisan.FindService(serviceName)
	if !ok {
		return nil, ErrServiceNotFound
	}
	return schedule.Availability(ctx, s.db, artisan, service.DurationMins, days)
}

func (s *bookingService) ArtisanUser(ctx context.Context, artisanID uint) (*domain.User, error) {
	var u domain.User
	err := s.db.WithContext(ctx).
		Joins("JOIN artisans ON artisans.user_id = users.id").
		Where("artisans.id = ?", artisanID).First(&u).Error
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// ConfirmBooking lets the booked artisan (or an admin) confirm a request that
// is still waiting for an answer. On confirmation the client's wallet is debited
// and the payment is held in escrow — the artisan only gets paid after they
// mark the appointment completed. A cancelled, expired or finished booking
// can't be confirmed.
func (s *bookingService) ConfirmBooking(ctx context.Context, bookingID, actorID string, admin bool) (*domain.Booking, error) {
	b, err := s.loadFull(ctx, bookingID)
	if err != nil {
		return nil, err
	}
	if !admin && b.Artisan.UserID != actorID {
		return nil, ErrNotYourBooking
	}
	if start, err := schedule.StartAt(b.BookingDate, b.BookingTime); err != nil || !start.After(schedule.Now()) {
		return nil, ErrNotPending
	}

	// Load the artisan's user account to read their fee tier.
	var artisanUser domain.User
	if err := s.db.WithContext(ctx).Select("id", "fee_bps", "release_window_hours").
		First(&artisanUser, "id = ?", b.Artisan.UserID).Error; err != nil {
		return nil, fmt.Errorf("load artisan account: %w", err)
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		res := tx.Model(&domain.Booking{}).
			Where("id = ? AND status = ?", b.ID, domain.BookingPending).
			Updates(map[string]any{"status": domain.BookingConfirmed, "expires_at": nil})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return ErrNotPending
		}
		// Hold the payment in escrow in the same transaction.
		if _, err := escrow.HoldBooking(tx, b, &artisanUser); err != nil {
			return fmt.Errorf("hold booking payment: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	b.Status = domain.BookingConfirmed
	b.ExpiresAt = nil
	return b, nil
}

func (s *bookingService) ListMyBookings(ctx context.Context, userID string) ([]domain.Booking, error) {
	// If the user owns an artisan profile, surface their incoming bookings;
	// otherwise surface the bookings they made as a buyer. The artisan lookup
	// goes through the service's db handle so the repository port stays frozen.
	var artisan domain.Artisan
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&artisan).Error
	if err == nil {
		list, err := s.repo.ListBookingsByArtisan(ctx, artisan.ID)
		if err != nil {
			return nil, err
		}
		return list, s.decorate(ctx, list, true)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	list, err := s.repo.ListBookingsByBuyer(ctx, userID)
	if err != nil {
		return nil, err
	}
	return list, s.decorate(ctx, list, false)
}

func (s *bookingService) OnboardArtisan(ctx context.Context, userID string, artisan *domain.Artisan) (*domain.Artisan, error) {
	existing, err := s.repo.GetArtisanByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing artisan profile: %w", err)
	}

	tx := s.db.WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if existing != nil {
		existing.Specialty = artisan.Specialty
		existing.Craft = artisan.Craft
		existing.Studio = artisan.Studio
		existing.PriceFrom = artisan.PriceFrom
		existing.Location = artisan.Location
		existing.City = artisan.City
		existing.Area = artisan.Area
		existing.Bio = artisan.Bio
		existing.ServiceMode = artisan.ServiceMode
		if artisan.ImageURL != "" {
			existing.ImageURL = artisan.ImageURL
		}
		existing.Available = true

		if err := tx.Save(existing).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to update artisan profile: %w", err)
		}
		artisan = existing
	} else {
		artisan.UserID = userID
		artisan.Rating = 5.0
		artisan.JobsCompleted = 0
		artisan.Verified = false
		artisan.Available = true
		artisan.Slug = strings.ToLower(strings.ReplaceAll(artisan.Studio, " ", "-"))

		tints := [][]string{
			{"#ec4899", "#8b5cf6"},
			{"#3b82f6", "#10b981"},
			{"#f59e0b", "#ef4444"},
		}
		selectedTint := tints[rand.Intn(len(tints))]
		artisan.BgColor = selectedTint[0]
		artisan.FgColor = selectedTint[1]

		if err := tx.Create(artisan).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to create artisan profile: %w", err)
		}
	}

	if err := becomePartner(tx, userID, "artisan"); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("transaction commit failed: %w", err)
	}

	return s.repo.GetArtisanByID(ctx, artisan.ID)
}

// ErrRoleChangeNotAllowed stops an admin from turning into a partner.
var ErrRoleChangeNotAllowed = errors.New("this account can't become a partner")

// becomePartner switches a user to a partner role. Taking on a new role
// (buyer to seller, seller to artisan) puts the account back in the admin
// approval queue; resubmitting the same role keeps an existing approval.
func becomePartner(tx *gorm.DB, userID, role string) error {
	var u domain.User
	if err := tx.Select("id", "role").First(&u, "id = ?", userID).Error; err != nil {
		return fmt.Errorf("load user: %w", err)
	}
	if u.Role == "admin" {
		return ErrRoleChangeNotAllowed
	}
	if u.Role == role {
		return nil
	}
	if err := tx.Model(&domain.User{}).Where("id = ?", userID).
		Updates(map[string]any{"role": role, "verified": false, "kyc_status": "pending"}).Error; err != nil {
		return fmt.Errorf("update user role: %w", err)
	}
	return tx.Model(&domain.Artisan{}).Where("user_id = ?", userID).Update("verified", false).Error
}

func (s *bookingService) OnboardSeller(ctx context.Context, userID string, cacNumber string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := becomePartner(tx, userID, "seller"); err != nil {
			return err
		}
		return tx.Model(&domain.User{}).Where("id = ?", userID).Update("cac_number", cacNumber).Error
	})
}

func (s *bookingService) GetArtisanByUserID(ctx context.Context, userID string) (*domain.Artisan, error) {
	return s.repo.GetArtisanByUserID(ctx, userID)
}
