package booking

import (
	"context"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"luxebeau/internal/domain"
)

type bookingService struct {
	repo   domain.BookingRepository
	logger *slog.Logger
}

func NewBookingService(repo domain.BookingRepository, logger *slog.Logger) domain.BookingService {
	return &bookingService{repo: repo, logger: logger}
}

func (s *bookingService) BookService(ctx context.Context, buyerID string, artisanID uint, serviceName string, date time.Time, slotTime string, svcType string) (*domain.Booking, error) {
	// Reserve the slot atomically
	if err := s.repo.ReserveSlot(ctx, artisanID, date, slotTime); err != nil {
		s.logger.Warn("Slot reservation failed", slog.Any("artisan_id", artisanID), slog.String("slot", slotTime), slog.Any("error", err))
		return nil, fmt.Errorf("slot unavailable: %w", err)
	}

	artisan, err := s.repo.GetArtisanByID(ctx, artisanID)
	if err != nil || artisan == nil {
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

	if err := s.repo.CreateBooking(ctx, booking); err != nil {
		s.logger.Error("Failed to create booking", slog.Any("error", err))
		return nil, fmt.Errorf("failed to create booking: %w", err)
	}

	s.logger.Info("Booking created", slog.String("id", booking.ID), slog.String("buyer", buyerID))
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
