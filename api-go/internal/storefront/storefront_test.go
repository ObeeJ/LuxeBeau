package storefront

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func newTestStorefrontDB(t *testing.T) (*Service, domain.StorefrontRepository, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(
		&domain.User{},
		&domain.Product{},
		&domain.Artisan{},
		&domain.Storefront{},
		&domain.ReservedHandle{},
		&domain.StorefrontHandleHistory{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	db.Exec("DELETE FROM storefronts")
	db.Exec("DELETE FROM reserved_handles")
	db.Exec("DELETE FROM storefront_handle_histories")
	db.Exec("DELETE FROM products")
	db.Exec("DELETE FROM users")
	db.Exec("DELETE FROM artisans")

	repo := NewGormStorefrontRepository(db)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	service := NewService(repo, db, logger)

	return service, repo, db
}

func TestHandleValidation(t *testing.T) {
	valid := []string{"adunni-organics", "glow", "glow-beauty-123", "a-b"}
	for _, h := range valid {
		if err := ValidateHandleFormat(h); err != nil {
			t.Errorf("expected handle %q to be valid, got %v", h, err)
		}
	}

	invalid := []string{
		"ab",                                                      // too short (<3)
		"-starting-hyphen",                                        // leading hyphen
		"ending-hyphen-",                                          // trailing hyphen
		"has_underscore",                                          // underscore not allowed
		"has.dot",                                                 // dot not allowed
		"this-handle-is-way-too-long-and-exceeds-the-fifty-character-maximum-limit", // >50 chars
	}
	for _, h := range invalid {
		if err := ValidateHandleFormat(h); err == nil {
			t.Errorf("expected handle %q to be invalid, but passed", h)
		}
	}
}

func TestColorDerivationAndContrast(t *testing.T) {
	// Test Dark Gold
	baseHex := "#C5A880"
	variants, err := DeriveVariants(baseHex)
	if err != nil {
		t.Fatalf("failed to derive variants: %v", err)
	}

	if variants.True.AccentHex == "" || variants.Soft.AccentHex == "" || variants.Deep.AccentHex == "" {
		t.Fatalf("missing derived variant colors: %+v", variants)
	}

	// Verify contrast foreground selection
	if variants.True.OnAccentHex != "#000000" && variants.True.OnAccentHex != "#FFFFFF" {
		t.Errorf("unexpected on_accent_hex: %s", variants.True.OnAccentHex)
	}

	// Pure black background should pick white foreground
	fgBlack, ratioBlack, _ := BestForeground("#000000")
	if fgBlack != "#FFFFFF" || ratioBlack < 20.0 {
		t.Errorf("expected black background to pick #FFFFFF with high contrast, got fg=%s, ratio=%f", fgBlack, ratioBlack)
	}

	// Pure white background should pick black foreground
	fgWhite, ratioWhite, _ := BestForeground("#FFFFFF")
	if fgWhite != "#000000" || ratioWhite < 20.0 {
		t.Errorf("expected white background to pick #000000 with high contrast, got fg=%s, ratio=%f", fgWhite, ratioWhite)
	}
}

func TestHandleAvailabilityAndReserved(t *testing.T) {
	service, repo, _ := newTestStorefrontDB(t)
	ctx := context.Background()

	// Seed reserved handles
	reserved := []domain.ReservedHandle{
		{Handle: "admin", Reason: "system"},
		{Handle: "chanel", Reason: "brand", ClaimableByEmail: strPtr("contact@chanel.com")},
	}
	if err := repo.SeedReservedHandles(ctx, reserved); err != nil {
		t.Fatalf("seed reserved handles: %v", err)
	}

	// 1. Check unreserved handle
	avail, reason, err := service.CheckHandleAvailability(ctx, "fresh-glow", nil)
	if err != nil || !avail || reason != "available" {
		t.Errorf("expected fresh-glow to be available, got avail=%v, reason=%s, err=%v", avail, reason, err)
	}

	// 2. Check system reserved handle
	avail, reason, err = service.CheckHandleAvailability(ctx, "admin", nil)
	if err != nil || avail || reason != "reserved" {
		t.Errorf("expected admin to be reserved, got avail=%v, reason=%s", avail, reason)
	}

	// 3. Brand handle claimed by stranger -> reserved
	stranger := &domain.User{ID: "user-1", Email: "stranger@gmail.com"}
	avail, reason, err = service.CheckHandleAvailability(ctx, "chanel", stranger)
	if err != nil || avail || reason != "reserved" {
		t.Errorf("expected stranger to be blocked from brand handle, got avail=%v, reason=%s", avail, reason)
	}

	// 4. Brand handle claimed by authorized email -> available
	brandOwner := &domain.User{ID: "user-2", Email: "contact@chanel.com"}
	avail, reason, err = service.CheckHandleAvailability(ctx, "chanel", brandOwner)
	if err != nil || !avail {
		t.Errorf("expected authorized email to claim brand handle, got avail=%v, reason=%s", avail, reason)
	}
}

func TestSaveStorefrontLifecycle(t *testing.T) {
	service, _, db := newTestStorefrontDB(t)
	ctx := context.Background()

	seller := &domain.User{
		ID:        "00000000-0000-0000-0000-000000000001",
		Role:      "seller",
		Verified:  true,
		KYCStatus: "verified",
	}
	if err := db.Create(seller).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	// 1. Seller attempts to go live with 0 products -> should fail
	req := SaveStorefrontRequest{
		Handle:       "luxe-glow",
		TemplateID:   "editorial",
		BaseHex:      "#C5A880",
		ThemeVariant: "true",
		Bio:          "Luxury beauty brand based in Lagos.",
		Live:         true,
	}
	_, err := service.SaveStorefront(ctx, seller, req)
	if err != ErrNoProductsOrServices {
		t.Fatalf("expected ErrNoProductsOrServices, got %v", err)
	}

	// 2. Save as draft (live = false) -> should succeed even with 0 products
	req.Live = false
	sf, err := service.SaveStorefront(ctx, seller, req)
	if err != nil {
		t.Fatalf("expected draft save to succeed, got %v", err)
	}
	if sf.Handle != "luxe-glow" || sf.Live != false {
		t.Errorf("unexpected storefront saved: %+v", sf)
	}

	// 3. Add a product for seller
	product := domain.Product{
		SellerID: seller.ID,
		Name:     "Golden Radiance Oil",
		Brand:    "Luxe Glow",
		Price:    2500000,
		Category: "Skincare",
	}
	if err := db.Create(&product).Error; err != nil {
		t.Fatalf("create product: %v", err)
	}

	// 4. Now attempt to go live -> should succeed
	req.Live = true
	sfLive, err := service.SaveStorefront(ctx, seller, req)
	if err != nil {
		t.Fatalf("expected go live to succeed after adding product, got %v", err)
	}
	if !sfLive.Live {
		t.Errorf("expected storefront to be live")
	}

	// 5. Public storefront fetch
	pub, err := service.GetPublicStorefront(ctx, "luxe-glow", "")
	if err != nil {
		t.Fatalf("expected get public storefront to succeed, got %v", err)
	}
	if pub.Storefront.Handle != "luxe-glow" {
		t.Errorf("expected handle luxe-glow, got %s", pub.Storefront.Handle)
	}
	if len(pub.Products) != 1 {
		t.Errorf("expected 1 product attached, got %d", len(pub.Products))
	}
}

func TestStorefrontHandleChangeAndRedirect(t *testing.T) {
	service, _, db := newTestStorefrontDB(t)
	ctx := context.Background()

	seller := &domain.User{
		ID:        "00000000-0000-0000-0000-000000000002",
		Role:      "seller",
		Verified:  true,
		KYCStatus: "verified",
	}
	db.Create(seller)
	db.Create(&domain.Product{SellerID: seller.ID, Name: "Silk Cream", Price: 10000, Category: "Skincare"})

	// Initial storefront
	_, err := service.SaveStorefront(ctx, seller, SaveStorefrontRequest{
		Handle:       "original-handle",
		TemplateID:   "editorial",
		BaseHex:      "#C5A880",
		ThemeVariant: "true",
		Live:         true,
	})
	if err != nil {
		t.Fatalf("initial save: %v", err)
	}

	// Change handle to "rebranded-handle"
	_, err = service.SaveStorefront(ctx, seller, SaveStorefrontRequest{
		Handle:       "rebranded-handle",
		TemplateID:   "editorial",
		BaseHex:      "#C5A880",
		ThemeVariant: "true",
		Live:         true,
	})
	if err != nil {
		t.Fatalf("handle change: %v", err)
	}

	// Fetch old handle publicly -> should receive 301 redirect indication
	pubRedirect, err := service.GetPublicStorefront(ctx, "original-handle", "")
	if err != nil {
		t.Fatalf("failed to query old handle: %v", err)
	}
	if pubRedirect.RedirectHandle != "rebranded-handle" {
		t.Errorf("expected redirect to rebranded-handle, got %q", pubRedirect.RedirectHandle)
	}

	// Immediate second handle change within 90 days -> should fail with ErrHandleChangedRecent
	_, err = service.SaveStorefront(ctx, seller, SaveStorefrontRequest{
		Handle:       "third-handle",
		TemplateID:   "editorial",
		BaseHex:      "#C5A880",
		ThemeVariant: "true",
		Live:         true,
	})
	if err != ErrHandleChangedRecent {
		t.Fatalf("expected ErrHandleChangedRecent on rapid rename, got %v", err)
	}
}

func strPtr(s string) *string {
	return &s
}
