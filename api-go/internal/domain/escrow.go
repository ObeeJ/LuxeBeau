package domain

import "time"

// Escrow lifecycle states.
const (
	EscrowPending  = "pending"  // created, awaiting funding
	EscrowFunded   = "funded"   // buyer funded; amount held in custody
	EscrowReleased = "released" // released to the payee (seller/artisan)
	EscrowRefunded = "refunded" // returned to the buyer
	EscrowDisputed = "disputed" // flagged, awaiting admin resolution
)

// Escrow kinds describe what the held funds are for.
const (
	EscrowKindOrder   = "order"   // marketplace product order
	EscrowKindBooking = "booking" // artisan service booking
	EscrowKindLink    = "link"    // B2B2C escrow link for an off-platform buyer
)

// Settlement rails.
const (
	RailWallet = "wallet" // in-app wallet balance (live)
	RailCNGN   = "cngn"   // cNGN stablecoin on-chain (future)
	// RailHeld is for money the platform already holds when the escrow is
	// created (an order paid from the wallet or captured by a payment gateway
	// at checkout). Holding it is a no-op; release pays the payee's wallet and
	// refund credits the buyer's wallet.
	RailHeld = "held"
)

// DefaultFeeBps and OrderReleaseWindow are intentionally removed.
// Use User.EffectiveFeeBps() and User.EffectiveReleaseWindowHours() instead.
// Platform-wide defaults live in domain/user.go as PlatformFeeBps and
// PlatformReleaseWindowHours so there is exactly one place to change them.

// OrderHold is the buyer's or seller's view of the escrow holding one
// seller's share of an order. It carries no account ids or contact details.
type OrderHold struct {
	ID                string     `json:"id"`
	State             string     `json:"state"`
	Amount            int64      `json:"amount"` // kobo, the seller's items
	Net               int64      `json:"net"`    // kobo the seller receives after the platform fee
	Seller            string     `json:"seller"`
	ReleaseEligibleAt *time.Time `json:"release_eligible_at"`
}

// Escrow is a single held-funds agreement between a buyer and a payee. Funds are
// held from funding until the buyer (or an auto-release timer, or an admin)
// resolves it. The settlement rail abstracts where the money actually lives.
type Escrow struct {
	ID                string     `gorm:"type:varchar(40);primaryKey" json:"id"` // ESC-XXXXXX
	Kind              string     `gorm:"type:varchar(20);not null" json:"kind"`
	Reference         string     `gorm:"type:varchar(60);index" json:"reference"` // order/booking id, blank for links
	BuyerID           string     `gorm:"type:uuid;index" json:"buyer_id"`         // empty for off-platform link buyers
	BuyerPhone        string     `gorm:"type:varchar(20)" json:"buyer_phone"`     // for WhatsApp/off-platform
	BuyerName         string     `gorm:"type:varchar(120)" json:"buyer_name"`
	PayeeID           string     `gorm:"type:uuid;index" json:"payee_id"` // seller/artisan to be paid
	Title             string     `gorm:"type:varchar(200)" json:"title"`
	Amount            int64      `gorm:"type:bigint;not null" json:"amount"`      // kobo
	FeeBps            int        `gorm:"type:integer;default:100" json:"fee_bps"` // platform fee, basis points (100 = 1%)
	State             string     `gorm:"type:varchar(20);default:'pending'" json:"state"`
	SettlementRail    string     `gorm:"type:varchar(20);default:'wallet'" json:"settlement_rail"`
	DeliveryCity      string     `gorm:"type:varchar(80)" json:"delivery_city"`
	ServiceType       string     `gorm:"type:varchar(20)" json:"service_type"` // home/studio/both for bookings
	Note              string     `gorm:"type:text" json:"note"`
	DisputeReason     string     `gorm:"type:text" json:"dispute_reason"`
	ReleaseEligibleAt *time.Time `json:"release_eligible_at"` // auto-release after this time
	FundedAt          *time.Time `json:"funded_at"`
	ResolvedAt        *time.Time `json:"resolved_at"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

// Fee returns the platform fee and the net amount paid to the payee on release.
func (e *Escrow) Fee() (fee int64, net int64) {
	fee = e.Amount * int64(e.FeeBps) / 10000
	return fee, e.Amount - fee
}

// LedgerEntry is an append-only record of every value movement, giving a full
// audit trail for reconciliation and admin arbitration.
type LedgerEntry struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	EscrowID    string    `gorm:"type:varchar(40);index;not null" json:"escrow_id"`
	Type        string    `gorm:"type:varchar(20);not null" json:"type"` // fund, release, refund, fee
	FromAccount string    `gorm:"type:varchar(60)" json:"from_account"`  // user id, "escrow", "platform"
	ToAccount   string    `gorm:"type:varchar(60)" json:"to_account"`
	Amount      int64     `gorm:"type:bigint;not null" json:"amount"`
	Memo        string    `gorm:"type:varchar(200)" json:"memo"`
	CreatedAt   time.Time `json:"created_at"`
}
