package revenue

import (
	"context"
	"errors"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Order{}, &domain.OrderItem{}, &domain.Escrow{}, &domain.LedgerEntry{}, &domain.FeaturedAd{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func utc(s string) time.Time {
	tm, err := time.Parse(time.RFC3339, s)
	if err != nil {
		panic(err)
	}
	return tm
}

func ledger(db *gorm.DB, at, typ, from, to string, amount int64) {
	db.Create(&domain.LedgerEntry{EscrowID: "e-" + typ, Type: typ, FromAccount: from, ToAccount: to, Amount: amount, CreatedAt: utc(at)})
}

// seed lays out a few days of money, with the tricky cases on purpose.
func seed(db *gorm.DB) {
	ledger(db, "2026-11-02T10:00:00Z", "fee", "gateway", "platform", 24_500)  // buyer-paid platform fee
	ledger(db, "2026-11-02T11:00:00Z", "fee", "escrow", "platform", 1_000)    // an older order's commission
	ledger(db, "2026-11-02T23:30:00Z", "fee", "gateway", "platform", 7_000)   // 00:30 on 3 Nov in Lagos
	ledger(db, "2026-11-03T09:00:00Z", "ad", "seller-1", "platform", 500_000) // an ad paid by wallet
	ledger(db, "2026-11-04T09:00:00Z", "fee_refund", "platform", "buyer-1", 24_500)
	ledger(db, "2026-11-04T09:00:00Z", "processing", "gateway", "processor", 25_754) // not revenue
	ledger(db, "2026-11-03T09:00:00Z", "fund", "gateway", "escrow", 1_000_000)       // not revenue
	ledger(db, "2026-10-20T09:00:00Z", "fee", "gateway", "platform", 99_999)         // before the range

	for _, o := range []domain.Order{
		{ID: "LB-1", BuyerID: "b", PaymentStatus: "paid", CreatedAt: utc("2026-11-02T10:00:00Z")},
		{ID: "LB-2", BuyerID: "b", PaymentStatus: "paid", CreatedAt: utc("2026-11-03T10:00:00Z")},
		{ID: "LB-3", BuyerID: "b", PaymentStatus: "pending", CreatedAt: utc("2026-11-03T10:00:00Z")},
		{ID: "LB-4", BuyerID: "b", PaymentStatus: "paid", CreatedAt: utc("2026-10-01T10:00:00Z")},
	} {
		o := o
		db.Omit("Buyer").Create(&o)
	}
	paid := utc("2026-11-03T09:00:00Z")
	db.Create(&domain.FeaturedAd{ID: "ad-1", MerchantID: "seller-1", Type: domain.PromotionTypeStorefront, Plan: domain.Plan7Days, Title: "t", ImageURL: "i",
		AmountKobo: 500_000, Status: domain.PromotionStatusActive, PaidAt: &paid, StartsAt: paid, ExpiresAt: paid.Add(time.Hour)})
	db.Create(&domain.FeaturedAd{ID: "ad-2", MerchantID: "seller-1", Type: domain.PromotionTypeStorefront, Plan: domain.Plan7Days, Title: "t", ImageURL: "i",
		AmountKobo: 500_000, Status: domain.PromotionStatusPending, StartsAt: paid, ExpiresAt: paid.Add(time.Hour)})
}

func point(t *testing.T, s *Summary, period string) Point {
	t.Helper()
	for _, p := range s.Series {
		if p.Period == period {
			return p
		}
	}
	t.Fatalf("no %s in series %+v", period, s.Series)
	return Point{}
}

func TestBuild_CountsOnlyLuxeBeausOwnRevenue(t *testing.T) {
	db := testDB(t)
	seed(db)

	s, err := Build(context.Background(), db, "2026-11-01", "2026-11-05", "day")
	if err != nil {
		t.Fatal(err)
	}
	tot := s.Totals
	// Fees: 24,500 + 1,000 + 7,000. Ads: 500,000. Refunded fee: 24,500.
	if tot.PlatformFees != 32_500 || tot.AdRevenue != 500_000 || tot.FeeRefunds != 24_500 {
		t.Fatalf("fees=%d ads=%d refunds=%d, want 32500 / 500000 / 24500", tot.PlatformFees, tot.AdRevenue, tot.FeeRefunds)
	}
	if tot.Net != 508_000 {
		t.Errorf("net = %d, want 508000 (fees + ads - refunded fees)", tot.Net)
	}
	if tot.ProcessingFeesCollected != 25_754 {
		t.Errorf("processing fees = %d, want 25754 reported as pass-through", tot.ProcessingFeesCollected)
	}
	if tot.EstimatedVAT != 35_441 { // 7.5% assumed inside net: 508000 * 750 / 10750
		t.Errorf("estimated VAT = %d, want 35441", tot.EstimatedVAT)
	}
	if tot.OrdersPaid != 2 || tot.AdsPaid != 1 {
		t.Errorf("orders paid = %d, ads paid = %d, want 2 and 1 (pending and out-of-range ones excluded)", tot.OrdersPaid, tot.AdsPaid)
	}
}

func TestBuild_DaysAreLagosDaysAndEmptyDaysAreZeroFilled(t *testing.T) {
	db := testDB(t)
	seed(db)
	s, _ := Build(context.Background(), db, "2026-11-01", "2026-11-05", "day")

	if len(s.Series) != 5 {
		t.Fatalf("series has %d days, want 5 (1 to 5 Nov, empty days included)", len(s.Series))
	}
	if got := point(t, s, "2026-11-01"); got.Net != 0 {
		t.Errorf("1 Nov = %+v, want zeros", got)
	}
	// 23:30 UTC on 2 Nov is 00:30 in Lagos on 3 Nov.
	if got := point(t, s, "2026-11-02"); got.PlatformFees != 25_500 {
		t.Errorf("2 Nov fees = %d, want 25500 (the 00:30 Lagos sale belongs to 3 Nov)", got.PlatformFees)
	}
	if got := point(t, s, "2026-11-03"); got.PlatformFees != 7_000 || got.AdRevenue != 500_000 || got.Net != 507_000 {
		t.Errorf("3 Nov = %+v, want fees 7000, ads 500000, net 507000", got)
	}
	if got := point(t, s, "2026-11-04"); got.FeeRefunds != 24_500 || got.Net != -24_500 {
		t.Errorf("4 Nov = %+v, want a refund of 24500 and net -24500", got)
	}
	var sum int64
	for _, p := range s.Series {
		sum += p.Net
	}
	if sum != s.Totals.Net {
		t.Errorf("the series adds up to %d but the total is %d", sum, s.Totals.Net)
	}
}

func TestBuild_RangeIsInclusiveAndExcludesOutsideRows(t *testing.T) {
	db := testDB(t)
	seed(db)
	s, _ := Build(context.Background(), db, "2026-11-02", "2026-11-02", "day")
	if len(s.Series) != 1 || s.Totals.PlatformFees != 25_500 || s.Totals.AdRevenue != 0 {
		t.Fatalf("a single day should hold only that day's money: %+v", s.Totals)
	}
}

func TestBuild_WeeksStartOnMondayAndMonthsGroupByMonth(t *testing.T) {
	db := testDB(t)
	seed(db)

	w, _ := Build(context.Background(), db, "2026-11-02", "2026-11-08", "week") // Mon to Sun
	if len(w.Series) != 1 || w.Series[0].Period != "2026-11-02" || w.Series[0].Net != 508_000 {
		t.Fatalf("week = %+v, want one week starting Monday 2 Nov worth 508000", w.Series)
	}

	m, _ := Build(context.Background(), db, "2026-10-01", "2026-11-30", "month")
	if len(m.Series) != 2 {
		t.Fatalf("months = %+v, want Oct and Nov", m.Series)
	}
	if got := point(t, m, "2026-10"); got.PlatformFees != 99_999 {
		t.Errorf("Oct = %+v, want the 99999 fee", got)
	}
	if got := point(t, m, "2026-11"); got.Net != 508_000 {
		t.Errorf("Nov = %+v, want 508000", got)
	}
}

func TestBuild_RejectsBadInput(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	for _, c := range []struct {
		name, from, to, group string
		want                  error
	}{
		{"backwards", "2026-11-05", "2026-11-01", "day", ErrInvalidRange},
		{"too long", "2025-01-01", "2026-11-01", "day", ErrInvalidRange},
		{"not a date", "yesterday", "2026-11-01", "day", ErrInvalidRange},
		{"bad group", "2026-11-01", "2026-11-05", "decade", ErrInvalidGroup},
	} {
		if _, err := Build(ctx, db, c.from, c.to, c.group); !errors.Is(err, c.want) {
			t.Errorf("%s: err = %v, want %v", c.name, err, c.want)
		}
	}
	// A full year (366 days) is the most that is allowed.
	if _, err := Build(ctx, db, "2025-11-01", "2026-11-01", "month"); err != nil {
		t.Errorf("a 366-day range should be allowed: %v", err)
	}
}

func TestBuild_ReportsEscrowsThatDoNotBalance(t *testing.T) {
	db := testDB(t)
	ctx := context.Background()
	s, _ := Build(ctx, db, "2026-11-01", "2026-11-05", "day")
	if s.Health.UnbalancedEscrows != 0 {
		t.Fatalf("an empty book has %d unbalanced escrows", s.Health.UnbalancedEscrows)
	}
	// Released, but only 900 of the 1,000 funded was paid out.
	db.Create(&domain.Escrow{ID: "ESC-BAD", Kind: domain.EscrowKindOrder, Amount: 1000, State: domain.EscrowReleased})
	db.Create(&domain.LedgerEntry{EscrowID: "ESC-BAD", Type: "fund", FromAccount: "gateway", ToAccount: "escrow", Amount: 1000})
	db.Create(&domain.LedgerEntry{EscrowID: "ESC-BAD", Type: "release", FromAccount: "escrow", ToAccount: "seller", Amount: 900})
	s, _ = Build(ctx, db, "2026-11-01", "2026-11-05", "day")
	if s.Health.UnbalancedEscrows != 1 {
		t.Fatalf("unbalanced escrows = %d, want 1", s.Health.UnbalancedEscrows)
	}
}
