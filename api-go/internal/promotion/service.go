package promotion

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

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
	db     *gorm.DB
	logger *slog.Logger
}

func NewService(repo domain.PromotionRepository, logger *slog.Logger) *Service {
	return &Service{
		repo:   repo,
		logger: logger,
	}
}

func NewServiceWithDB(repo domain.PromotionRepository, db *gorm.DB, logger *slog.Logger) *Service {
	return &Service{
		repo:   repo,
		db:     db,
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
		Status:      domain.PromotionStatusPending,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.repo.Create(ctx, ad); err != nil {
		s.logger.Error("failed to create featured ad", slog.Any("error", err))
		return nil, err
	}

	return ad, nil
}

// PayWithWallet debits the merchant's wallet atomically, credits the platform wallet,
// creates an immutable ledger entry, and activates the featured ad promotion.
func (s *Service) PayWithWallet(ctx context.Context, merchantID string, adID string) error {
	if s.db == nil {
		return errors.New("database connection not available")
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var ad domain.FeaturedAd
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&ad, "id = ?", adID).Error; err != nil {
			return fmt.Errorf("ad not found: %w", err)
		}

		if ad.MerchantID != merchantID {
			return errors.New("unauthorized: ad does not belong to this merchant")
		}

		if ad.Status == domain.PromotionStatusActive {
			return nil // already active/paid
		}

		if ad.Status != domain.PromotionStatusPending {
			return fmt.Errorf("ad cannot be paid in status: %s", ad.Status)
		}

		// 1. Conditional UPDATE: atomically debit merchant's wallet
		res := tx.Model(&domain.Wallet{}).
			Where("user_id = ? AND balance >= ?", merchantID, ad.AmountKobo).
			Update("balance", gorm.Expr("balance - ?", ad.AmountKobo))
		if res.Error != nil {
			return fmt.Errorf("failed to deduct wallet balance: %w", res.Error)
		}
		if res.RowsAffected == 0 {
			return errors.New("insufficient wallet balance")
		}

		// 2. Credit platform wallet
		if err := tx.Model(&domain.Wallet{}).
			Where("user_id = ?", domain.PlatformWalletID).
			Update("balance", gorm.Expr("balance + ?", ad.AmountKobo)).Error; err != nil {
			return fmt.Errorf("failed to credit platform wallet: %w", err)
		}

		// 3. Write immutable ledger entry
		now := time.Now().UTC()
		ledger := &domain.LedgerEntry{
			EscrowID:    "ad-" + ad.ID,
			Type:        "ad",
			FromAccount: merchantID,
			ToAccount:   "platform",
			Amount:      ad.AmountKobo,
			Memo:        "Featured ad promotion payment (wallet): " + ad.Title,
			CreatedAt:   now,
		}
		if err := tx.Create(ledger).Error; err != nil {
			return fmt.Errorf("failed to record ledger entry: %w", err)
		}

		// 4. Activate ad
		_, duration, _ := s.CalculatePlan(ad.Plan)
		ad.Status = domain.PromotionStatusActive
		ad.PaidAt = &now
		ad.PaymentMethod = "wallet"
		ad.PaymentRef = "wallet-" + ad.ID
		ad.StartsAt = now
		ad.ExpiresAt = now.Add(duration)
		ad.UpdatedAt = now

		if err := tx.Save(&ad).Error; err != nil {
			return fmt.Errorf("failed to update ad status: %w", err)
		}

		s.logger.Info("ad activated via wallet", slog.String("ad_id", ad.ID), slog.String("merchant_id", merchantID), slog.Int64("amount_kobo", ad.AmountKobo))
		return nil
	})
}

// ConfirmPayment handles Paystack/payment gateway notices for paid ads.
func (s *Service) ConfirmPayment(ctx context.Context, n domain.PaymentNotice) (domain.PaymentOutcome, error) {
	if s.db == nil {
		return "", errors.New("database connection not available")
	}

	var ad domain.FeaturedAd
	err := s.db.WithContext(ctx).First(&ad, "id = ?", n.Reference).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return domain.PaymentUnknownOrder, nil
	}
	if err != nil {
		return "", err
	}

	if !n.Succeeded {
		return domain.PaymentMarkedFailed, nil
	}

	if n.Amount != ad.AmountKobo || !strings.EqualFold(n.Currency, "NGN") {
		s.logger.Warn("ad payment amount mismatch; ad left pending",
			slog.String("ad_id", ad.ID), slog.String("provider", n.Provider),
			slog.Int64("expected", ad.AmountKobo), slog.Int64("received", n.Amount), slog.String("currency", n.Currency))
		return domain.PaymentAmountInvalid, nil
	}

	outcome := domain.PaymentIgnored
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var current domain.FeaturedAd
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&current, "id = ?", ad.ID).Error; err != nil {
			return err
		}

		if current.Status == domain.PromotionStatusActive {
			return nil // already paid & active: duplicate notice
		}

		now := time.Now().UTC()
		_, duration, _ := s.CalculatePlan(current.Plan)
		current.Status = domain.PromotionStatusActive
		current.PaidAt = &now
		current.PaymentMethod = n.Provider
		current.PaymentRef = n.Reference
		current.StartsAt = now
		current.ExpiresAt = now.Add(duration)
		current.UpdatedAt = now

		if err := tx.Save(&current).Error; err != nil {
			return err
		}

		// Credit platform wallet
		if err := tx.Model(&domain.Wallet{}).
			Where("user_id = ?", domain.PlatformWalletID).
			Update("balance", gorm.Expr("balance + ?", current.AmountKobo)).Error; err != nil {
			return err
		}

		// Write ledger entry
		from := "gateway"
		ledger := &domain.LedgerEntry{
			EscrowID:    "ad-" + current.ID,
			Type:        "ad",
			FromAccount: from,
			ToAccount:   "platform",
			Amount:      current.AmountKobo,
			Memo:        "Featured ad promotion payment (" + n.Provider + "): " + current.Title,
			CreatedAt:   now,
		}
		if err := tx.Create(ledger).Error; err != nil {
			return err
		}

		outcome = domain.PaymentMarkedPaid
		return nil
	})
	if err != nil {
		return "", err
	}

	return outcome, nil
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
