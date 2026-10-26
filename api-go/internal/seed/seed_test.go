package seed

import (
	"io"
	"log/slog"
	"testing"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func newTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(
		&domain.User{}, &domain.Wallet{}, &domain.Product{},
		&domain.Artisan{}, &domain.BookingSlot{}, &domain.Booking{},
		&domain.Order{}, &domain.OrderItem{},
	); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestRun_SeedsAndIsIdempotent(t *testing.T) {
	db := newTestDB(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	if err := Run(db, logger); err != nil {
		t.Fatalf("first seed: %v", err)
	}
	// Second run must be a no-op (idempotent), not a duplicate-key error.
	if err := Run(db, logger); err != nil {
		t.Fatalf("second seed should be idempotent: %v", err)
	}

	var products, artisans, slots int64
	db.Model(&domain.Product{}).Count(&products)
	db.Model(&domain.Artisan{}).Count(&artisans)
	db.Model(&domain.BookingSlot{}).Count(&slots)

	if products != 6 {
		t.Errorf("products = %d, want 6", products)
	}
	if artisans != 6 {
		t.Errorf("artisans = %d, want 6", artisans)
	}
	var wallets int64
	db.Model(&domain.Wallet{}).Count(&wallets)
	if wallets != 9 {
		t.Errorf("wallets = %d, want one per seeded account (9)", wallets)
	}
	if slots != 0 {
		t.Errorf("slots = %d, want 0 (generated on demand from weekly hours)", slots)
	}
	var approved int64
	db.Model(&domain.User{}).Where("role IN ? AND verified = ?", []string{"seller", "artisan"}, true).Count(&approved)
	if approved != 7 {
		t.Errorf("approved partners = %d, want 7 (demo seller + 6 artisans)", approved)
	}

	// JSON columns must round-trip through the driver.
	var p domain.Product
	if err := db.Where("slug = ?", "ose-dudu-honey-cleansing-bar").First(&p).Error; err != nil {
		t.Fatalf("load product: %v", err)
	}
	if len(p.Details) != 3 {
		t.Errorf("product details = %d, want 3", len(p.Details))
	}

	var a domain.Artisan
	if err := db.Where("slug = ?", "amaka-eze").First(&a).Error; err != nil {
		t.Fatalf("load artisan: %v", err)
	}
	if len(a.Services) != 3 {
		t.Errorf("artisan services = %d, want 3", len(a.Services))
	}
	if a.Services[0].Price != 4500000 { // ₦45,000 in kobo
		t.Errorf("first service price = %d, want 4500000", a.Services[0].Price)
	}
}

func passwordOf(t *testing.T, db *gorm.DB, email string) string {
	t.Helper()
	var u domain.User
	if err := db.Where("email = ?", email).First(&u).Error; err != nil {
		t.Fatalf("load %s: %v", email, err)
	}
	return u.PasswordHash
}

func TestRun_DemoAccountsHaveNoPasswordByDefault(t *testing.T) {
	t.Setenv("SEED_DEMO_PASSWORD", "")
	db, err := gorm.Open(sqlite.Open("file:seed_nopw?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Product{}, &domain.Artisan{}, &domain.BookingSlot{})
	if err := Run(db, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	var withPassword int64
	db.Model(&domain.User{}).Where("password_hash <> ?", "").Count(&withPassword)
	if withPassword != 0 {
		t.Errorf("%d seeded accounts have a password without SEED_DEMO_PASSWORD", withPassword)
	}
}

func TestRun_DemoPasswordFromEnv(t *testing.T) {
	t.Setenv("SEED_DEMO_PASSWORD", "harmattan-breeze-2026")
	db, err := gorm.Open(sqlite.Open("file:seed_envpw?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Product{}, &domain.Artisan{}, &domain.BookingSlot{})
	if err := Run(db, slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}
	hash := passwordOf(t, db, "seller@luxebeau.ng")
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte("harmattan-breeze-2026")) != nil {
		t.Error("demo account doesn't accept SEED_DEMO_PASSWORD")
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte("password123")) == nil {
		t.Error("demo account still accepts password123")
	}
}

func TestDemoPasswordHash_RejectsWeakValues(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	for _, weak := range []string{"short", "password123"} {
		t.Setenv("SEED_DEMO_PASSWORD", weak)
		if h, err := demoPasswordHash(logger); err != nil || h != "" {
			t.Errorf("SEED_DEMO_PASSWORD=%q produced a password hash", weak)
		}
	}
}

func TestRetireDefaultPassword(t *testing.T) {
	t.Setenv("SEED_DEMO_PASSWORD", "")
	db, err := gorm.Open(sqlite.Open("file:seed_retire?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	db.AutoMigrate(&domain.User{})
	legacy, _ := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.MinCost)
	changed, _ := bcrypt.GenerateFromPassword([]byte("my-own-new-password"), bcrypt.MinCost)
	db.Create(&domain.User{ID: "00000000-0000-0000-0000-000000000003", Name: "Admin", Email: "admin@luxebeau.ng", PasswordHash: string(legacy), Role: "admin"})
	db.Create(&domain.User{ID: "10000000-0000-0000-0000-000000000001", Name: "Amaka", Email: "amaka@luxebeau.ng", PasswordHash: string(changed), Role: "artisan"})
	db.Create(&domain.User{ID: "aaaaaaaa-0000-0000-0000-000000000001", Name: "Real user", Email: "real@example.com", PasswordHash: string(legacy), Role: "buyer"})

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	if err := RetireDefaultPassword(db, logger); err != nil {
		t.Fatal(err)
	}
	if h := passwordOf(t, db, "admin@luxebeau.ng"); h != "" {
		t.Error("demo admin still has the old shared password")
	}
	if h := passwordOf(t, db, "amaka@luxebeau.ng"); h != string(changed) {
		t.Error("a demo account with a changed password was touched")
	}
	if h := passwordOf(t, db, "real@example.com"); h != string(legacy) {
		t.Error("a non-demo account was touched")
	}
	// Second run is a no-op.
	if err := RetireDefaultPassword(db, logger); err != nil {
		t.Fatal(err)
	}
}
