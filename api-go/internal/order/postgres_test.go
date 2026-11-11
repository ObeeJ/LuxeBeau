package order

import (
	"net/http"
	"os"
	"sync"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"luxebeau/internal/domain"
)

// These tests need a real PostgreSQL, because the guarantee they check (the
// database's unique index picking one winner among truly simultaneous requests)
// is not something SQLite reproduces faithfully. They are skipped unless
// TEST_PG_DSN is set, e.g.
//
//	TEST_PG_DSN="host=localhost port=55432 user=postgres password=pw dbname=t sslmode=disable" go test ./internal/order -run Postgres
func pgDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_PG_DSN")
	if dsn == "" {
		t.Skip("TEST_PG_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	_ = db.Migrator().DropTable(&domain.IdempotencyRecord{})
	if err := db.AutoMigrate(&domain.IdempotencyRecord{}); err != nil {
		t.Fatal(err)
	}
	return db
}

func TestPostgres_TwentySimultaneousRequestsCreateExactlyOneOrder(t *testing.T) {
	db := pgDB(t)
	svc := &countingOrders{}

	const n = 20
	codes := make([]int, n)
	var start, done sync.WaitGroup
	start.Add(1)
	for i := 0; i < n; i++ {
		done.Add(1)
		go func() {
			defer done.Done()
			start.Wait() // release every request at the same moment
			codes[i], _ = placeOrder(t, svc, db, idemUser1, "key-pg-race")
		}()
	}
	start.Done()
	done.Wait()

	if got := svc.created.Load(); got != 1 {
		t.Fatalf("%d orders were created from one idempotency key, want exactly 1", got)
	}
	for i, c := range codes {
		if c != http.StatusCreated && c != http.StatusConflict {
			t.Errorf("request %d returned %d; every request must be a 201 (winner or replay) or a 409 (told to wait)", i, c)
		}
	}
}

func TestPostgres_TheIndexRefusesADuplicateRecord(t *testing.T) {
	db := pgDB(t)
	mk := func() *domain.IdempotencyRecord {
		return &domain.IdempotencyRecord{Key: "k", UserID: idemUser1, Operation: "create_order"}
	}
	if err := db.Create(mk()).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(mk()).Error; !isUniqueViolation(err) {
		t.Errorf("err = %v, want a unique violation that isUniqueViolation recognises on Postgres", err)
	}
}
