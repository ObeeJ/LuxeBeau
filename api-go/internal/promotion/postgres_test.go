package promotion_test

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"luxebeau/internal/domain"
	"luxebeau/internal/promotion"
)

// PostgreSQL refuses a malformed value for a uuid column with an error, where
// SQLite quietly finds nothing. So "an ad ID that is not an ID" only shows up as
// a 500 on the real database. Skipped unless TEST_PG_DSN is set, e.g.
//
//	TEST_PG_DSN="host=localhost port=55440 user=postgres password=test dbname=lb_promo sslmode=disable" go test ./internal/promotion -run Postgres
func pgDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_PG_DSN")
	if dsn == "" {
		t.Skip("TEST_PG_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&domain.FeaturedAd{}, &domain.Wallet{}))
	return db
}

func TestPostgres_MalformedAdIDIsNotFoundNeverAServerError(t *testing.T) {
	db := pgDB(t)
	svc := promotion.NewServiceWithDB(promotion.NewGormRepository(db), db, testLogger())
	ctx := context.Background()

	for _, id := range []string{"does-not-exist", "99999", "'; DROP TABLE featured_ads;--", "00000000-0000-0000-0000-000000000099"} {
		assert.ErrorIs(t, svc.PayWithWallet(ctx, "m1", id), promotion.ErrAdNotFound, "pay: %q", id)
		assert.ErrorIs(t, svc.AdminUpdateStatus(ctx, id, domain.PromotionStatusPaused), promotion.ErrAdNotFound, "admin pause: %q", id)
		assert.ErrorIs(t, svc.AdminUpdateStatus(ctx, id, domain.PromotionStatusActive), promotion.ErrAdNotFound, "admin activate: %q", id)
	}
}
