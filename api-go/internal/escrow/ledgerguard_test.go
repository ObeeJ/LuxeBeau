package escrow

import (
	"os"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// On SQLite (the unit-test database) there are no triggers to install; the
// call must be a harmless no-op so tests and local runs keep working.
func TestEnsureLedgerGuards_NoOpOnSQLite(t *testing.T) {
	_, db := newTestService(t)
	if err := EnsureLedgerGuards(db); err != nil {
		t.Fatalf("expected no-op on sqlite, got %v", err)
	}
}

// pgForGuards opens the Postgres named by LUXEBEAU_TEST_PG_DSN, or skips.
// The database must be disposable: the test creates and drops ledger_entries.
func pgForGuards(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("LUXEBEAU_TEST_PG_DSN")
	if dsn == "" {
		t.Skip("set LUXEBEAU_TEST_PG_DSN to a disposable Postgres to run this test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open postgres: %v", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS ledger_entries").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.LedgerEntry{}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Exec("DROP TABLE IF EXISTS ledger_entries") })
	return db
}

func insert(db *gorm.DB, amount int64) error {
	return db.Create(&domain.LedgerEntry{
		EscrowID: "e1", Type: "fund", FromAccount: "u1", ToAccount: "escrow", Amount: amount,
	}).Error
}

func TestEnsureLedgerGuards_Postgres(t *testing.T) {
	db := pgForGuards(t)

	// An old bad row that predates the guards must not stop the migration.
	if err := insert(db, 0); err != nil {
		t.Fatalf("seed legacy row: %v", err)
	}
	if err := EnsureLedgerGuards(db); err != nil {
		t.Fatalf("install guards over legacy data: %v", err)
	}
	// Running it again (every startup) must be safe.
	if err := EnsureLedgerGuards(db); err != nil {
		t.Fatalf("second run should be idempotent: %v", err)
	}

	t.Run("positive amount accepted", func(t *testing.T) {
		if err := insert(db, 5000); err != nil {
			t.Fatalf("valid entry rejected: %v", err)
		}
	})
	t.Run("zero amount rejected", func(t *testing.T) {
		if err := insert(db, 0); err == nil {
			t.Fatal("zero-amount entry should be rejected")
		}
	})
	t.Run("negative amount rejected", func(t *testing.T) {
		if err := insert(db, -100); err == nil {
			t.Fatal("negative entry should be rejected")
		}
	})
	t.Run("update rejected", func(t *testing.T) {
		err := db.Exec("UPDATE ledger_entries SET amount = 1 WHERE amount = 5000").Error
		if err == nil || !strings.Contains(err.Error(), "append-only") {
			t.Fatalf("update should be refused as append-only, got %v", err)
		}
	})
	t.Run("delete rejected", func(t *testing.T) {
		err := db.Exec("DELETE FROM ledger_entries WHERE amount = 5000").Error
		if err == nil || !strings.Contains(err.Error(), "append-only") {
			t.Fatalf("delete should be refused as append-only, got %v", err)
		}
	})
	t.Run("truncate rejected", func(t *testing.T) {
		err := db.Exec("TRUNCATE ledger_entries").Error
		if err == nil || !strings.Contains(err.Error(), "append-only") {
			t.Fatalf("truncate should be refused as append-only, got %v", err)
		}
	})
	t.Run("rows intact after the attempts", func(t *testing.T) {
		var n int64
		db.Model(&domain.LedgerEntry{}).Where("amount = 5000").Count(&n)
		if n != 1 {
			t.Fatalf("expected the 5000 entry to survive, found %d", n)
		}
	})
}
