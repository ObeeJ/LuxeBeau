package domain

import "testing"

func TestPlatformFeeBps_TierBoundaries(t *testing.T) {
	cases := []struct {
		name     string
		subtotal int64 // kobo
		want     int
	}{
		{"1 kobo", 1, 350},
		{"just under N10,000", 999_999, 350},
		{"exactly N10,000 stays in the lowest band", 1_000_000, 350},
		{"one kobo over N10,000", 1_000_001, 300},
		{"mid band N30,000", 3_000_000, 300},
		{"exactly N50,000 stays in the middle band", 5_000_000, 300},
		{"one kobo over N50,000", 5_000_001, 250},
		{"N500,000", 50_000_000, 250},
	}
	for _, c := range cases {
		if got := PlatformFeeBps(c.subtotal); got != c.want {
			t.Errorf("%s: PlatformFeeBps(%d) = %d, want %d", c.name, c.subtotal, got, c.want)
		}
	}
}

func TestPlatformFee_AppliesTheTierToTheWholeOrder(t *testing.T) {
	cases := []struct {
		subtotal, want int64
	}{
		{550_000, 19_250},    // N5,500 at 3.5% = N192.50
		{100_000, 3_500},     // N1,000 at 3.5% = N35
		{1_000_000, 35_000},  // N10,000 at 3.5% = N350
		{1_200_000, 36_000},  // N12,000 at 3% (whole order, not per band) = N360
		{5_000_000, 150_000}, // N50,000 at 3% = N1,500
		{6_000_000, 150_000}, // N60,000 at 2.5% = N1,500
		{1_001, 35},          // odd amount: 35.035 rounds to 35
		{1_015, 36},          // 35.525 rounds half up to 36
		{0, 0},
	}
	for _, c := range cases {
		if got := PlatformFee(c.subtotal); got != c.want {
			t.Errorf("PlatformFee(%d) = %d, want %d", c.subtotal, got, c.want)
		}
	}
}

func TestProcessingFee_BuyerPaysSoSellerAndPlatformAreWhole(t *testing.T) {
	// Whatever the buyer is charged, the gateway's cut of it must leave us
	// exactly the base amount (never less), and almost never more.
	for _, base := range []int64{100_000, 249_000, 250_000, 550_000, 1_000_000, 5_000_000, 50_000_000, 200_000_000} {
		fee := ProcessingFee(base)
		charged := base + fee
		left := charged - gatewayCut(charged)
		if left < base {
			t.Errorf("base %d: buyer charged %d, gateway keeps %d, leaves %d (short by %d)", base, charged, gatewayCut(charged), left, base-left)
		}
		if left > base+150 {
			t.Errorf("base %d: over-collected by %d kobo", base, left-base)
		}
	}
}

func TestProcessingFee_Shape(t *testing.T) {
	if got := ProcessingFee(0); got != 0 {
		t.Errorf("nothing to charge, fee = %d", got)
	}
	// Under N2,500 only the percentage applies: no flat N100.
	if got := ProcessingFee(100_000); got < 1_500 || got > 1_600 {
		t.Errorf("N1,000 base: fee = %d kobo, want about 1.5%% (~1,523)", got)
	}
	// The gateway's own cap (N2,000) limits the fee on very large orders.
	if got := ProcessingFee(500_000_000); got != 200_000 {
		t.Errorf("huge order: fee = %d, want the N2,000 cap (200000)", got)
	}
}

func TestPriceOrder_WalletPaysNoProcessingFee(t *testing.T) {
	b := PriceOrder(550_000, 150_000, false)
	if b.ProcessingFee != 0 {
		t.Errorf("wallet payment should carry no processing fee, got %d", b.ProcessingFee)
	}
	if b.PlatformFee != 19_250 {
		t.Errorf("platform fee = %d, want 19250", b.PlatformFee)
	}
	if b.Total != 550_000+150_000+19_250 {
		t.Errorf("total = %d", b.Total)
	}
}

func TestPriceOrder_GatewayAddsProcessingFeeOnTop(t *testing.T) {
	b := PriceOrder(550_000, 150_000, true)
	base := int64(550_000 + 150_000 + 19_250)
	if b.ProcessingFee <= 0 {
		t.Fatal("a gateway payment should carry a processing fee")
	}
	if b.Total != base+b.ProcessingFee {
		t.Errorf("total %d != base %d + processing %d", b.Total, base, b.ProcessingFee)
	}
	// The seller's money (items + delivery) is untouched by either fee.
	if b.Subtotal != 550_000 || b.DeliveryFee != 150_000 {
		t.Errorf("seller amounts must not change: %+v", b)
	}
}
