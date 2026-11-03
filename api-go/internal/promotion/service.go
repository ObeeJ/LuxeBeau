package promotion

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"luxebeau/internal/domain"
)

var (
	ErrInvalidPlan   = errors.New("invalid promotion plan: choose 7_days, 30_days, or annual")
	ErrInvalidTarget = errors.New("invalid target: specify product, storefront, or artisan")
	ErrTitleRequired = errors.New("title and image url are required")
)

type CreatePromotionInput struct {
	Type        domain.PromotionType `json:"type"`
	TargetID    string               `json:"target_id"`
	Title       string               `json:"title"`
	Tagline     string               `json:"tagline"`
	Description string               `json:"description"`
	Badge       string               `json:"badge"`
	ImageURL    string               `json:"image_url"`
	LinkURL     string               `json:"link_url"`
	Plan        domain.PromotionPlan `json:"plan"`
}

type Service struct {
	repo   domain.PromotionRepository
	logger *slog.Logger
}

func NewService(repo domain.PromotionRepository, logger *slog.Logger) *Service {
	return &Service{
		repo:   repo,
		logger: logger,
	}
}

// CalculatePlan returns the Kobo amount and time duration for the chosen plan.
func (s *Service) CalculatePlan(plan domain.PromotionPlan) (int64, time.Duration, error) {
	switch plan {
	case domain.Plan7Days:
		return domain.AdPrice7DaysKobo, 7 * 24 * time.Hour, nil
	case domain.Plan30Days:
		return domain.AdPrice30DaysKobo, 30 * 24 * time.Hour, nil
	case domain.PlanAnnual:
		return domain.AdPriceAnnualKobo, 365 * 24 * time.Hour, nil
	default:
		return 0, 0, ErrInvalidPlan
	}
}

func (s *Service) CreatePromotion(ctx context.Context, merchantID string, input CreatePromotionInput) (*domain.FeaturedAd, error) {
	if strings.TrimSpace(input.Title) == "" || strings.TrimSpace(input.ImageURL) == "" {
		return nil, ErrTitleRequired
	}
	if input.Type != domain.PromotionTypeProduct &&
		input.Type != domain.PromotionTypeStorefront &&
		input.Type != domain.PromotionTypeArtisan {
		return nil, ErrInvalidTarget
	}

	amountKobo, duration, err := s.CalculatePlan(input.Plan)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	badge := strings.TrimSpace(input.Badge)
	if badge == "" {
		badge = "Featured Partner"
	}

	linkURL := strings.TrimSpace(input.LinkURL)
	if linkURL == "" {
		switch input.Type {
		case domain.PromotionTypeStorefront:
			linkURL = fmt.Sprintf("/s/%s", strings.TrimPrefix(input.TargetID, "/s/"))
		case domain.PromotionTypeProduct:
			linkURL = fmt.Sprintf("/shop/%s", strings.TrimPrefix(input.TargetID, "/shop/"))
		case domain.PromotionTypeArtisan:
			linkURL = fmt.Sprintf("/services/%s", strings.TrimPrefix(input.TargetID, "/services/"))
		}
	}

	ad := &domain.FeaturedAd{
		ID:          uuid.New().String(),
		MerchantID:  merchantID,
		Type:        input.Type,
		TargetID:    input.TargetID,
		Title:       strings.TrimSpace(input.Title),
		Tagline:     strings.TrimSpace(input.Tagline),
		Description: strings.TrimSpace(input.Description),
		Badge:       badge,
		ImageURL:    strings.TrimSpace(input.ImageURL),
		LinkURL:     linkURL,
		Plan:        input.Plan,
		AmountKobo:  amountKobo,
		StartsAt:    now,
		ExpiresAt:   now.Add(duration),
		Status:      domain.PromotionStatusActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, ad); err != nil {
		s.logger.Error("failed to create featured ad", slog.Any("error", err))
		return nil, err
	}

	return ad, nil
}

func (s *Service) ListActive(ctx context.Context, limit int) ([]domain.FeaturedAd, error) {
	return s.repo.ListActive(ctx, limit)
}

func (s *Service) ListByMerchant(ctx context.Context, merchantID string) ([]domain.FeaturedAd, error) {
	return s.repo.ListByMerchant(ctx, merchantID)
}

func (s *Service) RecordImpression(ctx context.Context, id string) error {
	return s.repo.IncrementImpression(ctx, id)
}

func (s *Service) RecordClick(ctx context.Context, id string) error {
	return s.repo.IncrementClick(ctx, id)
}

func (s *Service) AdminList(ctx context.Context, limit, offset int) ([]domain.FeaturedAd, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.ListAll(ctx, limit, offset)
}

func (s *Service) AdminUpdateStatus(ctx context.Context, id string, status domain.PromotionStatus) error {
	return s.repo.UpdateStatus(ctx, id, status)
}
