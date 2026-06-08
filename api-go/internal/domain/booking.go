package domain

import (
	"context"
	"time"
)

type Artisan struct {
	ID             uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID         string    `gorm:"type:uuid;not null" json:"user_id"`
	User           User      `gorm:"foreignKey:UserID" json:"user"`
	Specialty      string    `gorm:"type:varchar(100);not null" json:"specialty" binding:"required"`
	PriceFrom      int64     `gorm:"type:bigint;not null" json:"price_from" binding:"required"` // stored in Kobo
	Location       string    `gorm:"type:varchar(150);not null" json:"location" binding:"required"`
	Experience     string    `gorm:"type:varchar(50)" json:"experience"`
	JobsCompleted  int       `gorm:"type:integer;default:0" json:"jobs_completed"`
	Available      bool      `gorm:"type:boolean;default:true" json:"available"`
	BgColor        string    `gorm:"type:varchar(10)" json:"bg_color"`
	Bio            string    `gorm:"type:text" json:"bio"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type BookingSlot struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ArtisanID uint      `gorm:"not null;uniqueIndex:idx_artisan_slot" json:"artisan_id"`
	SlotDate  time.Time `gorm:"type:date;not null;uniqueIndex:idx_artisan_slot" json:"slot_date"`
	SlotTime  string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_artisan_slot" json:"slot_time"` // e.g. "14:00"
	Reserved  bool      `gorm:"type:boolean;default:false" json:"reserved"`
}

type Booking struct {
	ID          string    `gorm:"type:varchar(50);primaryKey" json:"id"` // BK-XXXXXX
	BuyerID     string    `gorm:"type:uuid;not null" json:"buyer_id"`
	Buyer       User      `gorm:"foreignKey:BuyerID" json:"buyer"`
	ArtisanID   uint      `gorm:"not null" json:"artisan_id"`
	Artisan     Artisan   `gorm:"foreignKey:ArtisanID" json:"artisan"`
	ServiceName string    `gorm:"type:varchar(255);not null" json:"service_name" binding:"required"`
	BookingDate time.Time `gorm:"type:date;not null" json:"booking_date" binding:"required"`
	BookingTime string    `gorm:"type:varchar(10);not null" json:"booking_time" binding:"required"`
	ServiceType string    `gorm:"type:varchar(20);not null" json:"service_type" binding:"required,oneof=home studio both"`
	Amount      int64     `gorm:"type:bigint;not null" json:"amount" binding:"required"` // stored in Kobo
	Status      string    `gorm:"type:varchar(20);default:'pending'" json:"status"`      // pending, confirmed, completed, cancelled
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type BookingRepository interface {
	CreateBooking(ctx context.Context, booking *Booking) error
	GetBookingByID(ctx context.Context, id string) (*Booking, error)
	ListBookingsByBuyer(ctx context.Context, buyerID string) ([]Booking, error)
	ListBookingsByArtisan(ctx context.Context, artisanID uint) ([]Booking, error)
	GetArtisanByID(ctx context.Context, id uint) (*Artisan, error)
	ListArtisans(ctx context.Context, specialty, location string) ([]Artisan, error)
	GetAvailableSlots(ctx context.Context, artisanID uint, date time.Time) ([]BookingSlot, error)
	ReserveSlot(ctx context.Context, artisanID uint, date time.Time, slotTime string) error
	UpdateBookingStatus(ctx context.Context, id string, status string) error
}

type BookingService interface {
	BookService(ctx context.Context, buyerID string, artisanID uint, serviceName string, date time.Time, slotTime string, svcType string) (*Booking, error)
	GetArtisanProfile(ctx context.Context, artisanID uint) (*Artisan, []BookingSlot, error)
	ListArtisans(ctx context.Context, specialty, location string) ([]Artisan, error)
	ConfirmBooking(ctx context.Context, bookingID string) error
}
