package promotion_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
	"luxebeau/internal/promotion"
)

func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	require.NoError(t, err)
	err = db.AutoMigrate(&domain.FeaturedAd{}, &domain.Wallet{}, &domain.LedgerEntry{})
	require.NoError(t, err)

	// Ensure platform wallet exists
	db.Create(&domain.Wallet{
		UserID:  domain.PlatformWalletID,
		Balance: 0,
	})

	return db
}

func TestAdCreatedAsPending(t *testing.T) {
	db := setupTestDB(t)
	repo := promotion.NewGormRepository(db)
	svc := promotion.NewServiceWithDB(repo, db, testLogger())
	ctx := context.Background()

	ad, err := svc.CreatePromotion(ctx, "merchant-1", promotion.CreatePromotionInput{
		Type:     domain.PromotionTypeStorefront,
		TargetID: "adunni-organics",
		Title:    "Adunni Organics",
		ImageURL: "https://example.com/adunni.jpg",
		Plan:     domain.Plan7Days,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.PromotionStatusPending, ad.Status, "New ad must start in pending status")

	// Must NOT appear in ListActive until paid
	active, err := svc.ListActive(ctx, 10)
	require.NoError(t, err)
	assert.Empty(t, active, "Pending ad must not appear in active ads list")
}

func TestAdWalletPayment(t *testing.T) {
	db := setupTestDB(t)
	repo := promotion.NewGormRepository(db)
	svc := promotion.NewServiceWithDB(repo, db, testLogger())
	ctx := context.Background()

	// Seed merchant wallet with ₦10,000 (1,000,000 kobo)
	merchantID := "merchant-wallet-1"
	db.Create(&domain.Wallet{
		UserID:  merchantID,
		Balance: 1000000,
	})

	// Create pending ad (Plan 7 days = ₦5,000 = 500,000 kobo)
	ad, err := svc.CreatePromotion(ctx, merchantID, promotion.CreatePromotionInput{
		Type:     domain.PromotionTypeProduct,
		TargetID: "chebe-hair-butter",
		Title:    "Chebe Hair Butter",
		ImageURL: "https://example.com/chebe.jpg",
		Plan:     domain.Plan7Days,
	})
	require.NoError(t, err)
	assert.Equal(t, domain.PromotionStatusPending, ad.Status)

	// Pay from wallet
	err = svc.PayWithWallet(ctx, merchantID, ad.ID)
	require.NoError(t, err)

	// Verify ad is now active
	updatedAd, err := repo.GetByID(ctx, ad.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.PromotionStatusActive, updatedAd.Status)
	assert.NotNil(t, updatedAd.PaidAt)
	assert.Equal(t, "wallet", updatedAd.PaymentMethod)

	// Verify merchant wallet debited by ₦5,000
	var merchantWallet domain.Wallet
	err = db.Where("user_id = ?", merchantID).First(&merchantWallet).Error
	require.NoError(t, err)
	assert.Equal(t, int64(500000), merchantWallet.Balance)

	// Verify platform wallet credited by ₦5,000
	var platformWallet domain.Wallet
	err = db.Where("user_id = ?", domain.PlatformWalletID).First(&platformWallet).Error
	require.NoError(t, err)
	assert.Equal(t, int64(500000), platformWallet.Balance)

	// Verify ledger entry created
	var ledger domain.LedgerEntry
	err = db.Where("escrow_id = ?", "ad-"+ad.ID).First(&ledger).Error
	require.NoError(t, err)
	assert.Equal(t, "ad", ledger.Type)
	assert.Equal(t, merchantID, ledger.FromAccount)
	assert.Equal(t, "platform", ledger.ToAccount)
	assert.Equal(t, domain.AdPrice7DaysKobo, ledger.Amount)

	// Must now appear in active list
	active, err := svc.ListActive(ctx, 10)
	require.NoError(t, err)
	assert.Len(t, active, 1)
}

func TestAdWalletInsufficientBalance(t *testing.T) {
	db := setupTestDB(t)
	repo := promotion.NewGormRepository(db)
	svc := promotion.NewServiceWithDB(repo, db, testLogger())
	ctx := context.Background()

	// Seed merchant wallet with only ₦1,000 (100,000 kobo)
	merchantID := "merchant-poor"
	db.Create(&domain.Wallet{
		UserID:  merchantID,
		Balance: 100000,
	})

	ad, err := svc.CreatePromotion(ctx, merchantID, promotion.CreatePromotionInput{
		Type:     domain.PromotionTypeStorefront,
		TargetID: "poor-merchant",
		Title:    "Poor Merchant Ad",
		ImageURL: "https://example.com/poor.jpg",
		Plan:     domain.Plan7Days, // 500,000 kobo
	})
	require.NoError(t, err)

	err = svc.PayWithWallet(ctx, merchantID, ad.ID)
	assert.Error(t, err, "Should fail with insufficient balance")
	assert.Contains(t, err.Error(), "insufficient wallet balance")

	// Ad remains pending
	updatedAd, err := repo.GetByID(ctx, ad.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.PromotionStatusPending, updatedAd.Status)
}

func TestAdPaystackWebhookConfirmation(t *testing.T) {
	db := setupTestDB(t)
	repo := promotion.NewGormRepository(db)
	svc := promotion.NewServiceWithDB(repo, db, testLogger())
	ctx := context.Background()

	merchantID := "merchant-card"
	ad, err := svc.CreatePromotion(ctx, merchantID, promotion.CreatePromotionInput{
		Type:     domain.PromotionTypeStorefront,
		TargetID: "card-store",
		Title:    "Card Store Ad",
		ImageURL: "https://example.com/card.jpg",
		Plan:     domain.Plan30Days, // ₦15,000 = 1,500,000 kobo
	})
	require.NoError(t, err)

	// Legitimate Paystack webhook
	outcome, err := svc.ConfirmPayment(ctx, domain.PaymentNotice{
		Provider:  "paystack",
		Reference: ad.ID,
		Succeeded: true,
		Amount:    domain.AdPrice30DaysKobo,
		Currency:  "NGN",
	})
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentMarkedPaid, outcome)

	// Ad is now active
	updatedAd, err := repo.GetByID(ctx, ad.ID)
	require.NoError(t, err)
	assert.Equal(t, domain.PromotionStatusActive, updatedAd.Status)
	assert.Equal(t, "paystack", updatedAd.PaymentMethod)

	// Platform wallet received funds
	var platformWallet domain.Wallet
	err = db.Where("user_id = ?", domain.PlatformWalletID).First(&platformWallet).Error
	require.NoError(t, err)
	assert.Equal(t, domain.AdPrice30DaysKobo, platformWallet.Balance)

	// Replay webhook idempotency check
	outcome2, err := svc.ConfirmPayment(ctx, domain.PaymentNotice{
		Provider:  "paystack",
		Reference: ad.ID,
		Succeeded: true,
		Amount:    domain.AdPrice30DaysKobo,
		Currency:  "NGN",
	})
	require.NoError(t, err)
	assert.Equal(t, domain.PaymentIgnored, outcome2, "Duplicate payment notice must be ignored")
}
