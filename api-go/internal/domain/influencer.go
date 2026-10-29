package domain

import "time"

// Influencer package lifecycle states.
const (
	InfluencerPackageActive   = "active"
	InfluencerPackagePaused   = "paused"   // owner paused it
	InfluencerPackageExpired  = "expired"  // tenure ended
	InfluencerPackageCancelled = "cancelled"
)

// Commission states mirror the escrow they depend on.
const (
	CommissionPending   = "pending"   // order paid, escrow funded, waiting for delivery
	CommissionEarned    = "earned"    // escrow released, ready to pay out
	CommissionPaid      = "paid"      // transferred to influencer's bank
	CommissionCancelled = "cancelled" // order refunded, commission voided
)

// AttributionWindowDays is how long a referral click is remembered.
// If the buyer purchases within this window, the influencer gets credit.
const AttributionWindowDays = 30

// InfluencerPackage is the contract a business owner creates for one influencer.
// A seller/artisan can create as many as they want, each with its own terms.
type InfluencerPackage struct {
	ID       uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID  string `gorm:"type:uuid;not null;index" json:"owner_id"` // seller or artisan user id
	// Slug is the unique handle for this influencer's link, e.g. "chioma-beauty".
	// Combined with the owner's storefront: arike-spa.luxebeau.com?ref=chioma-beauty
	Slug string `gorm:"type:varchar(80);not null;uniqueIndex:idx_owner_slug" json:"slug"`

	// Influencer details (filled by the business owner).
	InfluencerName    string `gorm:"type:varchar(120);not null" json:"influencer_name"`
	InfluencerEmail   string `gorm:"type:varchar(255)" json:"influencer_email"`
	InfluencerPhone   string `gorm:"type:varchar(20)" json:"influencer_phone"`
	InfluencerHandle  string `gorm:"type:varchar(120)" json:"influencer_handle"` // IG/TikTok handle
	// Scope describes what the influencer will do (free text, shown in the agreement).
	Scope string `gorm:"type:text;not null" json:"scope"`
	// Agreement is the full terms the owner sets. Stored verbatim; shown to
	// the influencer when they view their link dashboard.
	Agreement string `gorm:"type:text" json:"agreement"`

	// CommissionBps is the influencer's cut of the seller's net payout,
	// in basis points. 1000 = 10%. Capped at 5000 (50%) by the service.
	CommissionBps int `gorm:"type:integer;not null" json:"commission_bps"`

	// Payout details — where to send the influencer's earnings.
	BankCode      string `gorm:"type:varchar(10)" json:"bank_code"`
	AccountNumber string `gorm:"type:varchar(20)" json:"account_number"`
	AccountName   string `gorm:"type:varchar(120)" json:"account_name"`

	// Tenure: the package is only active between these dates.
	// StartsAt nil = active immediately. EndsAt nil = no expiry.
	StartsAt *time.Time `json:"starts_at,omitempty"`
	EndsAt   *time.Time `json:"ends_at,omitempty"`

	State     string    `gorm:"type:varchar(20);default:'active'" json:"state"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Computed on read, never stored.
	TotalEarned    int64 `gorm:"-" json:"total_earned_kobo,omitempty"`
	TotalPaid      int64 `gorm:"-" json:"total_paid_kobo,omitempty"`
	TotalPending   int64 `gorm:"-" json:"total_pending_kobo,omitempty"`
	ConversionCount int  `gorm:"-" json:"conversion_count,omitempty"`
}

// InfluencerReferral records one attribution: a buyer arrived via a package
// link and later placed an order within the attribution window.
type InfluencerReferral struct {
	ID        uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	PackageID uint   `gorm:"not null;index" json:"package_id"`
	// BuyerID is set when the buyer is logged in; empty for guests who later
	// sign in (matched by session token until checkout).
	BuyerID   string `gorm:"type:uuid;index" json:"buyer_id,omitempty"`
	// Token is the anonymous session identifier set in the cookie.
	Token     string    `gorm:"type:varchar(64);index" json:"-"`
	ClickedAt time.Time `gorm:"not null" json:"clicked_at"`
	ExpiresAt time.Time `gorm:"not null" json:"expires_at"`
	// OrderID is set when the referral converts to a purchase.
	OrderID   string    `gorm:"type:varchar(50);index" json:"order_id,omitempty"`
	Converted bool      `gorm:"default:false" json:"converted"`
	CreatedAt time.Time `json:"created_at"`
}

// InfluencerCommission is one payment owed to an influencer for one order.
// It is created when the order's escrow is funded and paid when it releases.
type InfluencerCommission struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	PackageID  uint   `gorm:"not null;index" json:"package_id"`
	ReferralID uint   `gorm:"not null;index" json:"referral_id"`
	OrderID    string `gorm:"type:varchar(50);not null;index" json:"order_id"`
	EscrowID   string `gorm:"type:varchar(40);index" json:"escrow_id"` // the seller's escrow for this order

	// Amounts in kobo.
	OrderAmount      int64 `gorm:"type:bigint;not null" json:"order_amount"`      // seller's share of the order
	PlatformFee      int64 `gorm:"type:bigint;not null" json:"platform_fee"`      // platform's 2.5%
	SellerNet        int64 `gorm:"type:bigint;not null" json:"seller_net"`        // after platform fee
	CommissionAmount int64 `gorm:"type:bigint;not null" json:"commission_amount"` // influencer's cut of seller net

	State string `gorm:"type:varchar(20);default:'pending'" json:"state"`
	// WithdrawalID links to the Withdrawal row when paid out.
	WithdrawalID *uint     `gorm:"index" json:"withdrawal_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
