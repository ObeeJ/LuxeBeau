package admin

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func newTestService(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Artisan{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// Start from a clean slate (shared-cache memory db persists across opens).
	db.Exec("DELETE FROM users")
	db.Exec("DELETE FROM artisans")
	return NewService(NewGormRepository(db), slog.New(slog.NewTextHandler(io.Discard, nil))), db
}

func seedUser(t *testing.T, db *gorm.DB, id, role, status string) {
	t.Helper()
	if err := db.Create(&domain.User{ID: id, Name: "U " + id, Email: id + "@x.ng", PasswordHash: "x", Role: role, Status: status}).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
}

func TestListUsers_FiltersByRole(t *testing.T) {
	s, db := newTestService(t)
	seedUser(t, db, "b1", "buyer", "active")
	seedUser(t, db, "s1", "seller", "active")
	seedUser(t, db, "a1", "artisan", "active")

	got, err := s.ListUsers(context.Background(), UserFilter{Role: "seller"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].ID != "s1" {
		t.Fatalf("expected only seller s1, got %+v", got)
	}
}

func TestUpdateUser_CannotGrantAdmin(t *testing.T) {
	s, db := newTestService(t)
	seedUser(t, db, "admin1", "admin", "active")
	seedUser(t, db, "b1", "buyer", "active")

	role := "admin"
	if _, err := s.UpdateUser(context.Background(), "admin1", "b1", UserUpdate{Role: &role}); err == nil {
		t.Fatal("expected error granting admin role, got nil")
	}
}

func TestUpdateUser_CannotModifyAnotherAdmin(t *testing.T) {
	s, db := newTestService(t)
	seedUser(t, db, "admin1", "admin", "active")
	seedUser(t, db, "admin2", "admin", "active")

	suspended := "suspended"
	if _, err := s.UpdateUser(context.Background(), "admin1", "admin2", UserUpdate{Status: &suspended}); err == nil {
		t.Fatal("expected error modifying another admin, got nil")
	}
}

func TestSuspendUser(t *testing.T) {
	s, db := newTestService(t)
	seedUser(t, db, "admin1", "admin", "active")
	seedUser(t, db, "s1", "seller", "active")

	suspended := "suspended"
	updated, err := s.UpdateUser(context.Background(), "admin1", "s1", UserUpdate{Status: &suspended})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Status != "suspended" {
		t.Fatalf("status = %q, want suspended", updated.Status)
	}
}

func TestVerifyUser_SyncsArtisanBadge(t *testing.T) {
	s, db := newTestService(t)
	seedUser(t, db, "a1", "artisan", "active")
	if err := db.Create(&domain.Artisan{UserID: "a1", Specialty: "Braids", PriceFrom: 1000, Location: "Lagos"}).Error; err != nil {
		t.Fatalf("seed artisan: %v", err)
	}

	updated, err := s.VerifyUser(context.Background(), "a1", "RC123456")
	if err != nil {
		t.Fatal(err)
	}
	if !updated.Verified || updated.CACNumber != "RC123456" || updated.KYCStatus != "verified" {
		t.Fatalf("unexpected user after verify: %+v", updated)
	}
	var a domain.Artisan
	db.First(&a, "user_id = ?", "a1")
	if !a.Verified {
		t.Fatal("artisan badge not synced to verified")
	}
}

func TestDeleteUser_CannotDeleteSelfOrAdmin(t *testing.T) {
	s, db := newTestService(t)
	seedUser(t, db, "admin1", "admin", "active")
	seedUser(t, db, "admin2", "admin", "active")
	seedUser(t, db, "b1", "buyer", "active")

	if err := s.DeleteUser(context.Background(), "admin1", "admin1"); err == nil {
		t.Fatal("expected error deleting self")
	}
	if err := s.DeleteUser(context.Background(), "admin1", "admin2"); err == nil {
		t.Fatal("expected error deleting another admin")
	}
	if err := s.DeleteUser(context.Background(), "admin1", "b1"); err != nil {
		t.Fatalf("deleting buyer should succeed: %v", err)
	}
}
