package seed

import (
	"io"
	"log/slog"
	"testing"

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
