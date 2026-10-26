package domain

import (
	"context"
	"time"
)

type Artisan struct {
	ID            uint        `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID        string      `gorm:"type:uuid;not null" json:"user_id"`
	User          User        `gorm:"foreignKey:UserID" json:"user"`
	Slug          string      `gorm:"type:varchar(150);index" json:"slug"`
	Specialty     string      `gorm:"type:varchar(100);not null;index:idx_artisan_search" json:"specialty" binding:"required"`
	Craft         string      `gorm:"type:varchar(100)" json:"craft"`
	Studio        string      `gorm:"type:varchar(150)" json:"studio"`
	PriceFrom     int64       `gorm:"type:bigint;not null" json:"price_from" binding:"required"` // stored in Kobo
	Location      string      `gorm:"type:varchar(150);not null;index:idx_artisan_search" json:"location" binding:"required"`
	City          string      `gorm:"type:varchar(80)" json:"city"`
	Area          string      `gorm:"type:varchar(120)" json:"area"`
	Experience    string      `gorm:"type:varchar(50)" json:"experience"`
	Rating        float64     `gorm:"type:decimal(2,1);default:0.0" json:"rating"`
	JobsCompleted int         `gorm:"type:integer;default:0" json:"jobs_completed"`
	Verified      bool        `gorm:"type:boolean;default:false" json:"verified"`
	Available     bool        `gorm:"type:boolean;default:true" json:"available"`
	ServiceMode   string      `gorm:"type:varchar(10);not null;default:'studio'" json:"service_mode"` // studio, home, both
	ImageURL      string      `gorm:"type:varchar(500)" json:"image_url"`
	BgColor       string      `gorm:"type:varchar(10)" json:"bg_color"`
	FgColor       string      `gorm:"type:varchar(10)" json:"fg_color"`
	Bio           string      `gorm:"type:text" json:"bio"`
	Services      ServiceList `gorm:"type:text" json:"services"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

// Artisan service modes: where an artisan is willing to work.
const (
	ServiceStudio = "studio"
	ServiceHome   = "home"
	ServiceBoth   = "both"
)

// Offers reports whether an artisan with this mode takes the given visit type.
func (a *Artisan) Offers(visit string) bool {
	switch a.ServiceMode {
	case ServiceBoth:
		return visit == ServiceStudio || visit == ServiceHome
	case ServiceHome:
		return visit == ServiceHome
	default:
		return visit == ServiceStudio
	}
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
	ServiceType string    `gorm:"type:varchar(20);not null" json:"service_type"`         // studio or home
	Address     string    `gorm:"type:text" json:"address"`                              // client address for home visits
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
	GetArtisanByUserID(ctx context.Context, userID string) (*Artisan, error)
	ListArtisans(ctx context.Context, specialty, location string) ([]Artisan, error)
	GetAvailableSlots(ctx context.Context, artisanID uint, date time.Time) ([]BookingSlot, error)
	ReserveSlot(ctx context.Context, artisanID uint, date time.Time, slotTime string) error
	UpdateBookingStatus(ctx context.Context, id string, status string) error
	SaveArtisan(ctx context.Context, artisan *Artisan) error
}

type BookingService interface {
	BookService(ctx context.Context, buyerID string, artisanID uint, serviceName string, date time.Time, slotTime string, svcType string, address string) (*Booking, error)
	GetArtisanProfile(ctx context.Context, artisanID uint) (*Artisan, []BookingSlot, error)
	ListArtisans(ctx context.Context, specialty, location string) ([]Artisan, error)
	ConfirmBooking(ctx context.Context, bookingID, actorID string, admin bool) (*Booking, error)
	ListMyBookings(ctx context.Context, userID string) ([]Booking, error)
	OnboardArtisan(ctx context.Context, userID string, artisan *Artisan) (*Artisan, error)
	OnboardSeller(ctx context.Context, userID string, cacNumber string) error
	GetArtisanByUserID(ctx context.Context, userID string) (*Artisan, error)
}
