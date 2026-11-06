package promotion_test

import (
	"context"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"luxebeau/internal/domain"
	"luxebeau/internal/promotion"
)

type mockRepo struct {
	ads []domain.FeaturedAd
}

func (m *mockRepo) Create(ctx context.Context, ad *domain.FeaturedAd) error {
	m.ads = append(m.ads, *ad)
	return nil
}

func (m *mockRepo) Update(ctx context.Context, ad *domain.FeaturedAd) error {
	for i, a := range m.ads {
		if a.ID == ad.ID {
			m.ads[i] = *ad
			return nil
		}
	}
	m.ads = append(m.ads, *ad)
	return nil
}

func (m *mockRepo) GetByID(ctx context.Context, id string) (*domain.FeaturedAd, error) {
	for _, a := range m.ads {
		if a.ID == id {
			return &a, nil
		}
	}
	return nil, nil
}

func (m *mockRepo) ListActive(ctx context.Context, limit int) ([]domain.FeaturedAd, error) {
	var active []domain.FeaturedAd
	for _, a := range m.ads {
		if a.Status == domain.PromotionStatusActive {
			active = append(active, a)
		}
	}
	return active, nil
}

func (m *mockRepo) ListByMerchant(ctx context.Context, merchantID string) ([]domain.FeaturedAd, error) {
	var userAds []domain.FeaturedAd
	for _, a := range m.ads {
		if a.MerchantID == merchantID {
			userAds = append(userAds, a)
		}
	}
	return userAds, nil
}

func (m *mockRepo) ListAll(ctx context.Context, limit, offset int) ([]domain.FeaturedAd, int64, error) {
	return m.ads, int64(len(m.ads)), nil
}

func (m *mockRepo) UpdateStatus(ctx context.Context, id string, status domain.PromotionStatus) error {
	for i, a := range m.ads {
		if a.ID == id {
			m.ads[i].Status = status
			return nil
		}
	}
	return nil
}

func (m *mockRepo) IncrementImpression(ctx context.Context, id string) error {
	for i, a := range m.ads {
		if a.ID == id {
			m.ads[i].ImpressionsCount++
			return nil
		}
	}
	return nil
}

func (m *mockRepo) IncrementClick(ctx context.Context, id string) error {
	for i, a := range m.ads {
		if a.ID == id {
			m.ads[i].ClicksCount++
			return nil
		}
	}
	return nil
}

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestPromotionMathAndPlans(t *testing.T) {
	repo := &mockRepo{}
	svc := promotion.NewService(repo, testLogger())

	// 7 days = ₦5,000 (500,000 kobo)
	kobo7, dur7, err := svc.CalculatePlan(domain.Plan7Days)
	require.NoError(t, err)
	assert.Equal(t, domain.AdPrice7DaysKobo, kobo7)
	assert.Equal(t, 7*24*time.Hour, dur7)

	// 30 days = ₦15,000 (1,500,000 kobo)
	kobo30, dur30, err := svc.CalculatePlan(domain.Plan30Days)
	require.NoError(t, err)
	assert.Equal(t, domain.AdPrice30DaysKobo, kobo30)
	assert.Equal(t, 30*24*time.Hour, dur30)

	// Annual = ₦120,000 (12,000,000 kobo) -> ₦10,000/mo effective
	koboAnnual, durAnnual, err := svc.CalculatePlan(domain.PlanAnnual)
	require.NoError(t, err)
	assert.Equal(t, domain.AdPriceAnnualKobo, koboAnnual)
	assert.Equal(t, 365*24*time.Hour, durAnnual)

	// Invalid plan
	_, _, err = svc.CalculatePlan("invalid")
	assert.ErrorIs(t, err, promotion.ErrInvalidPlan)
}

func TestCreatePromotion(t *testing.T) {
	repo := &mockRepo{}
	svc := promotion.NewService(repo, testLogger())
	ctx := context.Background()

	ad, err := svc.CreatePromotion(ctx, "merchant-123", promotion.CreatePromotionInput{
		Type:        domain.PromotionTypeStorefront,
		TargetID:    "adunni-organics",
		Title:       "Adunni Organics Luxury Skincare",
		Tagline:     "Pure African Botanicals Handcrafted for Glowing Skin",
		Description: "Explore our award-winning cold-processed black soaps and toner essences.",
		Badge:       "Featured Spotlight",
		ImageURL:    "https://example.com/adunni.jpg",
		Plan:        domain.Plan30Days,
	})

	require.NoError(t, err)
	assert.NotEmpty(t, ad.ID)
	assert.Equal(t, "merchant-123", ad.MerchantID)
	assert.Equal(t, domain.AdPrice30DaysKobo, ad.AmountKobo)
	assert.Equal(t, "/s/adunni-organics", ad.LinkURL)
	assert.Equal(t, domain.PromotionStatusPending, ad.Status)

	// Inactive while pending
	activePending, err := svc.ListActive(ctx, 10)
	require.NoError(t, err)
	assert.Empty(t, activePending)

	// Activate ad
	err = repo.UpdateStatus(ctx, ad.ID, domain.PromotionStatusActive)
	require.NoError(t, err)

	// Check active list
	active, err := svc.ListActive(ctx, 10)
	require.NoError(t, err)
	assert.Len(t, active, 1)

	// Test impression and click
	err = svc.RecordImpression(ctx, ad.ID)
	require.NoError(t, err)
	err = svc.RecordClick(ctx, ad.ID)
	require.NoError(t, err)

	assert.Equal(t, int64(1), repo.ads[0].ImpressionsCount)
	assert.Equal(t, int64(1), repo.ads[0].ClicksCount)
}
