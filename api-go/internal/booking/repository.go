package booking

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

type gormBookingRepository struct {
	db *gorm.DB
}

func NewGormBookingRepository(db *gorm.DB) domain.BookingRepository {
	return &gormBookingRepository{db: db}
}

func (r *gormBookingRepository) CreateBooking(ctx context.Context, b *domain.Booking) error {
	return r.db.WithContext(ctx).Create(b).Error
}

func (r *gormBookingRepository) GetBookingByID(ctx context.Context, id string) (*domain.Booking, error) {
	var b domain.Booking
	if err := r.db.WithContext(ctx).Preload("Artisan").Preload("Buyer").First(&b, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *gormBookingRepository) ListBookingsByBuyer(ctx context.Context, buyerID string) ([]domain.Booking, error) {
	var bookings []domain.Booking
	if err := r.db.WithContext(ctx).Preload("Artisan").Where("buyer_id = ?", buyerID).Order("created_at DESC").Find(&bookings).Error; err != nil {
		return nil, err
	}
	return bookings, nil
}

func (r *gormBookingRepository) ListBookingsByArtisan(ctx context.Context, artisanID uint) ([]domain.Booking, error) {
	var bookings []domain.Booking
	if err := r.db.WithContext(ctx).Preload("Buyer").Where("artisan_id = ?", artisanID).Order("created_at DESC").Find(&bookings).Error; err != nil {
		return nil, err
	}
	return bookings, nil
}

func (r *gormBookingRepository) GetArtisanByID(ctx context.Context, id uint) (*domain.Artisan, error) {
	var a domain.Artisan
	if err := r.db.WithContext(ctx).Preload("User").First(&a, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func (r *gormBookingRepository) ListArtisans(ctx context.Context, specialty, location string) ([]domain.Artisan, error) {
	var artisans []domain.Artisan
	query := r.db.WithContext(ctx).Preload("User").Where("available = ?", true)
	if specialty != "" {
		query = query.Where("specialty ILIKE ?", "%"+specialty+"%")
	}
	if location != "" {
		query = query.Where("location ILIKE ?", "%"+location+"%")
	}
	if err := query.Find(&artisans).Error; err != nil {
		return nil, err
	}
	return artisans, nil
}

func (r *gormBookingRepository) GetAvailableSlots(ctx context.Context, artisanID uint, date time.Time) ([]domain.BookingSlot, error) {
	var slots []domain.BookingSlot
	if err := r.db.WithContext(ctx).Where("artisan_id = ? AND slot_date = ? AND reserved = ?", artisanID, date, false).Find(&slots).Error; err != nil {
		return nil, err
	}
	return slots, nil
}

func (r *gormBookingRepository) ReserveSlot(ctx context.Context, artisanID uint, date time.Time, slotTime string) error {
	result := r.db.WithContext(ctx).Model(&domain.BookingSlot{}).
		Where("artisan_id = ? AND slot_date = ? AND slot_time = ? AND reserved = ?", artisanID, date, slotTime, false).
		Update("reserved", true)
	if result.RowsAffected == 0 {
		return errors.New("slot is no longer available")
	}
	return result.Error
}

func (r *gormBookingRepository) UpdateBookingStatus(ctx context.Context, id string, status string) error {
	return r.db.WithContext(ctx).Model(&domain.Booking{}).Where("id = ?", id).Update("status", status).Error
}

func (r *gormBookingRepository) GetArtisanByUserID(ctx context.Context, userID string) (*domain.Artisan, error) {
	var a domain.Artisan
	if err := r.db.WithContext(ctx).Preload("User").Where("user_id = ?", userID).First(&a).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func (r *gormBookingRepository) SaveArtisan(ctx context.Context, artisan *domain.Artisan) error {
	return r.db.WithContext(ctx).Save(artisan).Error
}
