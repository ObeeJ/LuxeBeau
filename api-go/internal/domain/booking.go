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
	// Availability: weekly opening hours generate bookable start times of
	// SlotMinutes each; DaysOff (YYYY-MM-DD) suppress whole days.
	WeeklyHours  WeeklyHours `gorm:"type:text" json:"weekly_hours"`
	SlotMinutes  int         `gorm:"type:integer;not null;default:60" json:"slot_minutes"`
	DaysOff      StringArray `gorm:"type:text" json:"days_off"`
	SlotsThrough *time.Time  `gorm:"type:date" json:"-"` // weekly slots exist up to this date
	// CancelWindowHours is how much notice a client must give to cancel a
	// confirmed booking for free. A later cancellation is recorded as late.
	CancelWindowHours int `gorm:"type:integer;not null;default:24" json:"cancel_window_hours"`
	// NoShowFeeBps is the percentage of the booking amount the artisan keeps
	// when a confirmed client doesn't show up. 0 = no charge, 5000 = 50%.
	NoShowFeeBps int `gorm:"type:integer;not null;default:0" json:"no_show_fee_bps"`
	// StorefrontSlug is the artisan's unique brand handle for their shareable
	// storefront URL, e.g. "arike-spa" → arike-spa.luxebeau.com
	StorefrontSlug *string   `gorm:"type:varchar(80);uniqueIndex" json:"storefront_slug,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
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
	Source    string    `gorm:"type:varchar(10);not null;default:'weekly'" json:"source"` // weekly or manual
	BookingID string    `gorm:"type:varchar(50);index" json:"booking_id,omitempty"`
}

// AvailableDay lists the start times a service can be booked on one date.
type AvailableDay struct {
	Date  string   `json:"date"`
	Times []string `json:"times"`
}

// Slot sources.
const (
	SlotWeekly = "weekly"
	SlotManual = "manual"
)

// FindService returns the artisan's service with this exact name.
func (a *Artisan) FindService(name string) (ArtisanService, bool) {
	for _, s := range a.Services {
		if s.Name == name {
			return s, true
		}
	}
	return ArtisanService{}, false
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
	Status      string    `gorm:"type:varchar(20);default:'pending'" json:"status"`      // pending, confirmed, completed, cancelled, no_show
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	// PolicyHours is the cancellation notice the artisan required when this
	// was booked. It is copied here so later changes to the artisan's policy
	// never change the terms the client agreed to.
	PolicyHours int `gorm:"type:integer;not null;default:24" json:"policy_hours"`
	// NoShowFeeBps is the percentage of the booking amount the artisan keeps
	// when a client no-shows, copied from the artisan's setting at booking time.
	NoShowFeeBps int `gorm:"type:integer;not null;default:0" json:"no_show_fee_bps"`
	// EscrowID links to the escrow holding this booking's payment. Empty until
	// the artisan confirms and the client pays.
	EscrowID string `gorm:"type:varchar(40);index" json:"escrow_id,omitempty"`
	// ExpiresAt is when an unanswered request is cancelled automatically.
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	CancelledAt    *time.Time `json:"cancelled_at,omitempty"`
	CancelledBy    string     `gorm:"type:varchar(10)" json:"cancelled_by,omitempty"` // buyer, artisan, admin, system
	CancelReason   string     `gorm:"type:varchar(300)" json:"cancel_reason,omitempty"`
	LateCancel     bool       `gorm:"type:boolean;not null;default:false" json:"late_cancel"` // the client cancelled a confirmed booking inside the notice window
	ReminderSentAt *time.Time `json:"-"`

	// Computed when listing; never stored.
	FreeCancelUntil *time.Time `gorm:"-" json:"free_cancel_until,omitempty"`
	BuyerStrikes    int        `gorm:"-" json:"buyer_strikes,omitempty"` // late cancellations and no-shows in the last 90 days
}

// Booking statuses.
const (
	BookingPending   = "pending"
	BookingConfirmed = "confirmed"
	BookingCompleted = "completed"
	BookingCancelled = "cancelled"
	BookingNoShow    = "no_show"
)

// Booking policy.
const (
	DefaultCancelWindowHours = 24
	// ConfirmWithin is how long an artisan has to answer a request.
	ConfirmWithin = 24 * time.Hour
	// NoShowGrace is how long after the start time an artisan waits before
	// marking a client as a no-show.
	NoShowGrace = 15 * time.Minute
	// StrikeWindow is how far back late cancellations and no-shows count.
	StrikeWindow = 90 * 24 * time.Hour
)

// CancelWindowChoices are the notice periods an artisan can pick, in hours.
// Zero means clients can always cancel for free.
var CancelWindowChoices = []int{0, 12, 24, 48, 72}

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
	// GetArtisanProfile and ListArtisans are public: approved artisans only,
	// with the account reduced to non-contact fields.
	GetArtisanProfile(ctx context.Context, artisanID uint) (*Artisan, error)
	ListArtisans(ctx context.Context, specialty, location string) ([]Artisan, error)
	Availability(ctx context.Context, artisanID uint, serviceName string, days int) ([]AvailableDay, error)
	// ArtisanUser returns the artisan's account for notifications.
	ArtisanUser(ctx context.Context, artisanID uint) (*User, error)
	ConfirmBooking(ctx context.Context, bookingID, actorID string, admin bool) (*Booking, error)
	// CancelBooking cancels a pending or confirmed booking before it starts.
	// The client, the artisan or an admin may cancel; anyone else gets "not found".
	CancelBooking(ctx context.Context, bookingID, actorID string, admin bool, reason string) (*Booking, error)
	// CompleteBooking and MarkNoShow close a confirmed booking after its start time.
	CompleteBooking(ctx context.Context, bookingID, actorID string, admin bool) (*Booking, error)
	MarkNoShow(ctx context.Context, bookingID, actorID string, admin bool) (*Booking, error)
	ListMyBookings(ctx context.Context, userID string) ([]Booking, error)
	OnboardArtisan(ctx context.Context, userID string, artisan *Artisan) (*Artisan, error)
	OnboardSeller(ctx context.Context, userID string, cacNumber string) error
	GetArtisanByUserID(ctx context.Context, userID string) (*Artisan, error)
}
