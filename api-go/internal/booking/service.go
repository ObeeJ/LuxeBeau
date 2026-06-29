package booking

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"math/rand"
	"strings"
	"time"

	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

type bookingService struct {
	repo   domain.BookingRepository
	db     *gorm.DB
	logger *slog.Logger
}

func NewBookingService(repo domain.BookingRepository, db *gorm.DB, logger *slog.Logger) domain.BookingService {
	return &bookingService{repo: repo, db: db, logger: logger}
}

func (s *bookingService) BookService(ctx context.Context, buyerID string, artisanID uint, serviceName string, date time.Time, slotTime string, svcType string) (*domain.Booking, error) {
	// Wrap the entire slot reservation and booking insertion inside a transaction
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Reserve the slot atomically in the transaction context
	result := tx.WithContext(ctx).Model(&domain.BookingSlot{}).
		Where("artisan_id = ? AND slot_date = ? AND slot_time = ? AND reserved = ?", artisanID, date, slotTime, false).
		Update("reserved", true)
	if result.Error != nil {
		tx.Rollback()
		return nil, result.Error
	}
	if result.RowsAffected == 0 {
		tx.Rollback()
		return nil, fmt.Errorf("slot is no longer available")
	}

	var artisan domain.Artisan
	if err := tx.WithContext(ctx).First(&artisan, artisanID).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("artisan not found")
	}

	booking := &domain.Booking{
		ID:          fmt.Sprintf("BK-%05d", rand.Intn(90000)+10000),
		BuyerID:     buyerID,
		ArtisanID:   artisanID,
		ServiceName: serviceName,
		BookingDate: date,
		BookingTime: slotTime,
		ServiceType: svcType,
		Amount:      artisan.PriceFrom,
		Status:      "pending",
	}

	if err := tx.WithContext(ctx).Create(booking).Error; err != nil {
		tx.Rollback()
		s.logger.Error("Failed to create booking in transaction", slog.Any("error", err))
		return nil, fmt.Errorf("failed to create booking: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	s.logger.Info("Booking created successfully in transaction", slog.String("id", booking.ID), slog.String("buyer", buyerID))
	return booking, nil
}

func (s *bookingService) GetArtisanProfile(ctx context.Context, artisanID uint) (*domain.Artisan, []domain.BookingSlot, error) {
	artisan, err := s.repo.GetArtisanByID(ctx, artisanID)
	if err != nil {
		return nil, nil, err
	}
	if artisan == nil {
		return nil, nil, fmt.Errorf("artisan not found")
	}

	today := time.Now().Truncate(24 * time.Hour)
	slots, err := s.repo.GetAvailableSlots(ctx, artisanID, today)
	if err != nil {
		return nil, nil, err
	}

	return artisan, slots, nil
}

func (s *bookingService) ListArtisans(ctx context.Context, specialty, location string) ([]domain.Artisan, error) {
	return s.repo.ListArtisans(ctx, specialty, location)
}

func (s *bookingService) ConfirmBooking(ctx context.Context, bookingID string) error {
	return s.repo.UpdateBookingStatus(ctx, bookingID, "confirmed")
}

func (s *bookingService) ListMyBookings(ctx context.Context, userID string) ([]domain.Booking, error) {
	// If the user owns an artisan profile, surface their incoming bookings;
	// otherwise surface the bookings they made as a buyer. The artisan lookup
	// goes through the service's db handle so the repository port stays frozen.
	var artisan domain.Artisan
	err := s.db.WithContext(ctx).Where("user_id = ?", userID).First(&artisan).Error
	if err == nil {
		return s.repo.ListBookingsByArtisan(ctx, artisan.ID)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	return s.repo.ListBookingsByBuyer(ctx, userID)
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

	if err := tx.Model(&domain.User{}).Where("id = ?", userID).Update("role", "artisan").Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update user role: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("transaction commit failed: %w", err)
	}

	return s.repo.GetArtisanByID(ctx, artisan.ID)
}

func (s *bookingService) OnboardSeller(ctx context.Context, userID string, cacNumber string) error {
	return s.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"role":       "seller",
		"cac_number": cacNumber,
	}).Error
}

func (s *bookingService) GetArtisanByUserID(ctx context.Context, userID string) (*domain.Artisan, error) {
	return s.repo.GetArtisanByUserID(ctx, userID)
}
