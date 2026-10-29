package domain

import "time"

// Withdrawal lifecycle states.
const (
	WithdrawalPending    = "pending"    // queued, not yet sent to Paystack
	WithdrawalProcessing = "processing" // Paystack transfer initiated
	WithdrawalSucceeded  = "succeeded"  // Paystack confirmed success
	WithdrawalFailed     = "failed"     // Paystack reported failure; wallet credited back
	WithdrawalReversed   = "reversed"   // Paystack reversed after success
)

// Withdrawal is one bank payout request from a partner's wallet.
// Money is debited from the wallet atomically when the row is created;
// if Paystack fails the debit is reversed and the state moves to failed.
type Withdrawal struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID        string    `gorm:"type:uuid;not null;index" json:"user_id"`
	Amount        int64     `gorm:"type:bigint;not null" json:"amount"` // kobo
	BankCode      string    `gorm:"type:varchar(10);not null" json:"bank_code"`
	AccountNumber string    `gorm:"type:varchar(20);not null" json:"account_number"`
	AccountName   string    `gorm:"type:varchar(120);not null" json:"account_name"`
	// IdempotencyKey prevents double-submission on retries.
	IdempotencyKey string `gorm:"type:varchar(80);uniqueIndex;not null" json:"-"`
	// TransferCode is Paystack's handle for the transfer, set once initiated.
	TransferCode string    `gorm:"type:varchar(60)" json:"transfer_code,omitempty"`
	State        string    `gorm:"type:varchar(20);default:'pending'" json:"state"`
	FailReason   string    `gorm:"type:varchar(300)" json:"fail_reason,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// DeliveryZone is a seller's delivery fee for a specific city or state.
// Sellers set their own rates; checkout picks the most specific match.
type DeliveryZone struct {
	ID       uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	SellerID string `gorm:"type:uuid;not null;index:idx_seller_zone,unique" json:"seller_id"`
	// City is the destination city, e.g. "Lagos". Empty means "everywhere else"
	// (the catch-all zone for this seller).
	City    string `gorm:"type:varchar(80);not null;index:idx_seller_zone,unique" json:"city"`
	FeeKobo int64  `gorm:"type:bigint;not null" json:"fee_kobo"`
}
