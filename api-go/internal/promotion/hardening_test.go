package promotion_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"luxebeau/internal/domain"
	"luxebeau/internal/promotion"
)

func newPendingAd(t *testing.T, svc *promotion.Service, merchant string) *domain.FeaturedAd {
	t.Helper()
	ad, err := svc.CreatePromotion(context.Background(), merchant, promotion.CreatePromotionInput{
		Type: domain.PromotionTypeStorefront, TargetID: "shop", Title: "Shop",
		ImageURL: "https://example.com/a.jpg", Plan: domain.Plan7Days,
	})
	require.NoError(t, err)
	return ad
}

func TestPayWithWallet_MissingPlatformWalletRollsEverythingBack(t *testing.T) {
	db := setupTestDB(t)
	svc := promotion.NewServiceWithDB(promotion.NewGormRepository(db), db, testLogger())
	db.Create(&domain.Wallet{UserID: "m1", Balance: 1000000})
	db.Where("user_id = ?", domain.PlatformWalletID).Delete(&domain.Wallet{})
	ad := newPendingAd(t, svc, "m1")

	err := svc.PayWithWallet(context.Background(), "m1", ad.ID)
	require.Error(t, err, "charging a merchant with nowhere to credit must fail")

	var w domain.Wallet
	require.NoError(t, db.First(&w, "user_id = ?", "m1").Error)
	assert.Equal(t, int64(1000000), w.Balance, "merchant must not be charged")
	var n int64
	db.Model(&domain.LedgerEntry{}).Count(&n)
	assert.Zero(t, n, "no ledger entry may survive the rollback")
	got, _ := promotion.NewGormRepository(db).GetByID(context.Background(), ad.ID)
	assert.Equal(t, domain.PromotionStatusPending, got.Status)
}

func TestConfirmPayment_MissingPlatformWalletRollsBack(t *testing.T) {
	db := setupTestDB(t)
	svc := promotion.NewServiceWithDB(promotion.NewGormRepository(db), db, testLogger())
	db.Where("user_id = ?", domain.PlatformWalletID).Delete(&domain.Wallet{})
	ad := newPendingAd(t, svc, "m1")

	_, err := svc.ConfirmPayment(context.Background(), domain.PaymentNotice{
		Provider: "paystack", Reference: ad.ID, Succeeded: true, Amount: ad.AmountKobo, Currency: "NGN",
	})
	require.Error(t, err)
	got, _ := promotion.NewGormRepository(db).GetByID(context.Background(), ad.ID)
	assert.Equal(t, domain.PromotionStatusPending, got.Status, "an ad must not go live when the platform could not be credited")
}

func TestPayWithWallet_ErrorsAreClassified(t *testing.T) {
	db := setupTestDB(t)
	svc := promotion.NewServiceWithDB(promotion.NewGormRepository(db), db, testLogger())
	ctx := context.Background()
	db.Create(&domain.Wallet{UserID: "rich", Balance: 1000000})
	db.Create(&domain.Wallet{UserID: "poor", Balance: 1})

	assert.ErrorIs(t, svc.PayWithWallet(ctx, "rich", "no-such-ad"), promotion.ErrAdNotFound)

	ad := newPendingAd(t, svc, "rich")
	assert.ErrorIs(t, svc.PayWithWallet(ctx, "poor", ad.ID), promotion.ErrAdNotFound,
		"someone else's ad must look exactly like a missing one")

	poorAd := newPendingAd(t, svc, "poor")
	assert.ErrorIs(t, svc.PayWithWallet(ctx, "poor", poorAd.ID), promotion.ErrInsufficientBalance)

	expired := newPendingAd(t, svc, "rich")
	db.Model(&domain.FeaturedAd{}).Where("id = ?", expired.ID).Update("status", domain.PromotionStatusExpired)
	assert.ErrorIs(t, svc.PayWithWallet(ctx, "rich", expired.ID), promotion.ErrAdNotPayable)
}

func TestAdminCannotActivateAnUnpaidAd(t *testing.T) {
	db := setupTestDB(t)
	svc := promotion.NewServiceWithDB(promotion.NewGormRepository(db), db, testLogger())
	ctx := context.Background()
	db.Create(&domain.Wallet{UserID: "m1", Balance: 1000000})
	ad := newPendingAd(t, svc, "m1")

	assert.ErrorIs(t, svc.AdminUpdateStatus(ctx, ad.ID, domain.PromotionStatusActive), promotion.ErrAdNotPaid)
	got, _ := promotion.NewGormRepository(db).GetByID(ctx, ad.ID)
	assert.Equal(t, domain.PromotionStatusPending, got.Status, "unpaid ad must stay pending")

	assert.ErrorIs(t, svc.AdminUpdateStatus(ctx, ad.ID, domain.PromotionStatus("bogus")), promotion.ErrInvalidStatus)
	assert.ErrorIs(t, svc.AdminUpdateStatus(ctx, ad.ID, domain.PromotionStatusPending), promotion.ErrInvalidStatus)

	require.NoError(t, svc.PayWithWallet(ctx, "m1", ad.ID))
	require.NoError(t, svc.AdminUpdateStatus(ctx, ad.ID, domain.PromotionStatusPaused))
	require.NoError(t, svc.AdminUpdateStatus(ctx, ad.ID, domain.PromotionStatusActive),
		"a paid ad can be paused and resumed")
}

// Paystack retries notices. One arriving after the ad has expired or been
// paused must not bring the ad back or credit the platform a second time.
func TestConfirmPayment_ReplayAfterExpiryDoesNothing(t *testing.T) {
	db := setupTestDB(t)
	repo := promotion.NewGormRepository(db)
	svc := promotion.NewServiceWithDB(repo, db, testLogger())
	ctx := context.Background()
	ad := newPendingAd(t, svc, "m1")
	notice := domain.PaymentNotice{Provider: "paystack", Reference: ad.ID, Succeeded: true, Amount: ad.AmountKobo, Currency: "NGN"}

	out, err := svc.ConfirmPayment(ctx, notice)
	require.NoError(t, err)
	require.Equal(t, domain.PaymentMarkedPaid, out)

	for _, st := range []domain.PromotionStatus{domain.PromotionStatusExpired, domain.PromotionStatusPaused} {
		db.Model(&domain.FeaturedAd{}).Where("id = ?", ad.ID).Update("status", st)
		out, err = svc.ConfirmPayment(ctx, notice)
		require.NoError(t, err)
		assert.Equal(t, domain.PaymentIgnored, out)
		got, _ := repo.GetByID(ctx, ad.ID)
		assert.Equal(t, st, got.Status, "a replayed notice must not revive an ad")
	}

	var w domain.Wallet
	require.NoError(t, db.First(&w, "user_id = ?", domain.PlatformWalletID).Error)
	assert.Equal(t, ad.AmountKobo, w.Balance, "the platform is credited once, however often Paystack retries")
	var rows int64
	db.Model(&domain.LedgerEntry{}).Where("type = ?", "ad").Count(&rows)
	assert.Equal(t, int64(1), rows)
}
