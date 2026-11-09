package seller

import (
	"context"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func zoneDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.DeliveryZone{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func fee(t *testing.T, db *gorm.DB, seller, city string) int64 {
	t.Helper()
	f, err := DeliveryFeeFor(context.Background(), db, seller, city)
	if err != nil {
		t.Fatal(err)
	}
	return f
}

// The buyer's city is free text. A seller who saved "Lagos" must still be
// matched when the buyer types "lagos" or " LAGOS ", or the buyer silently pays
// the platform default instead of the seller's own fee.
func TestDeliveryFeeFor_MatchesTheCityIgnoringCaseAndSpaces(t *testing.T) {
	db := zoneDB(t)
	db.Create(&domain.DeliveryZone{SellerID: "s1", City: "Lagos", FeeKobo: 80_000})

	for _, city := range []string{"Lagos", "lagos", "LAGOS", "  Lagos ", "lAgOs"} {
		if got := fee(t, db, "s1", city); got != 80_000 {
			t.Errorf("city %q: fee = %d, want the seller's 80000", city, got)
		}
	}
}

func TestDeliveryFeeFor_ExactCityBeatsTheCatchAll(t *testing.T) {
	db := zoneDB(t)
	db.Create(&domain.DeliveryZone{SellerID: "s1", City: "Lagos", FeeKobo: 80_000})
	db.Create(&domain.DeliveryZone{SellerID: "s1", City: "", FeeKobo: 200_000})

	if got := fee(t, db, "s1", "lagos"); got != 80_000 {
		t.Errorf("Lagos = %d, want 80000", got)
	}
	if got := fee(t, db, "s1", "Abuja"); got != 200_000 {
		t.Errorf("Abuja = %d, want the catch-all 200000", got)
	}
}

func TestDeliveryFeeFor_FallsBackToThePlatformDefault(t *testing.T) {
	db := zoneDB(t)
	// No zones at all.
	if got := fee(t, db, "nobody", "Lagos"); got != domain.PlatformDeliveryFeeKobo {
		t.Errorf("no zones = %d, want the platform default %d", got, domain.PlatformDeliveryFeeKobo)
	}
	// Zones, but none for this city and no catch-all.
	db.Create(&domain.DeliveryZone{SellerID: "s2", City: "Lagos", FeeKobo: 80_000})
	if got := fee(t, db, "s2", "Kano"); got != domain.PlatformDeliveryFeeKobo {
		t.Errorf("unmatched city = %d, want the platform default", got)
	}
}

// Saving must use the same rule as matching: "Lagos" and "lagos" are the same
// city, so a table that lists both is refused (it would give two answers).
func TestUpsertDeliveryZones_RefusesCitiesThatDifferOnlyByCaseOrSpaces(t *testing.T) {
	db := zoneDB(t)
	err := UpsertDeliveryZones(context.Background(), db, "s1", []domain.DeliveryZone{
		{City: "Lagos", FeeKobo: 80_000}, {City: " lagos ", FeeKobo: 90_000},
	})
	if err == nil {
		t.Fatal("two spellings of one city should be refused")
	}
	var n int64
	db.Model(&domain.DeliveryZone{}).Count(&n)
	if n != 0 {
		t.Errorf("a refused save must store nothing, found %d rows", n)
	}
}

func TestUpsertDeliveryZones_EnforcesSaneLimits(t *testing.T) {
	db := zoneDB(t)
	ctx := context.Background()
	long := make([]rune, 81)
	for i := range long {
		long[i] = 'a'
	}
	for name, z := range map[string]domain.DeliveryZone{
		"negative fee":      {City: "Lagos", FeeKobo: -1},
		"fee over N100000":  {City: "Lagos", FeeKobo: 10_000_001},
		"81 character city": {City: string(long), FeeKobo: 100},
	} {
		if err := UpsertDeliveryZones(ctx, db, "s1", []domain.DeliveryZone{z}); err == nil {
			t.Errorf("%s should be refused", name)
		}
	}
	// The limits themselves are allowed.
	if err := UpsertDeliveryZones(ctx, db, "s1", []domain.DeliveryZone{{City: "Lagos", FeeKobo: 10_000_000}, {City: "", FeeKobo: 0}}); err != nil {
		t.Errorf("a N100,000 fee and a free catch-all should be allowed: %v", err)
	}
}

// Old data saved before the rule existed can hold two spellings of one city.
// The answer must still be the same every time, so a quote and the checkout
// that follows it can never disagree.
func TestDeliveryFeeFor_LegacyDuplicatesResolveTheSameWayEveryTime(t *testing.T) {
	db := zoneDB(t)
	db.Create(&domain.DeliveryZone{SellerID: "s1", City: "Lagos", FeeKobo: 80_000})
	db.Create(&domain.DeliveryZone{SellerID: "s1", City: "lagos", FeeKobo: 90_000})
	for i := 0; i < 20; i++ {
		if got := fee(t, db, "s1", "LAGOS"); got != 80_000 {
			t.Fatalf("attempt %d: fee = %d, want the earliest saved zone (80000) every time", i, got)
		}
	}
}

func TestDeliveryFeeFor_FreeDeliveryIsHonoured(t *testing.T) {
	db := zoneDB(t)
	db.Create(&domain.DeliveryZone{SellerID: "s1", City: "", FeeKobo: 0})
	if got := fee(t, db, "s1", "Anywhere"); got != 0 {
		t.Errorf("a seller who ships free: fee = %d, want 0", got)
	}
}
