package seller

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

var (
	ErrSlugTaken   = errors.New("that storefront name is already taken")
	ErrSlugInvalid = errors.New("storefront name may only contain letters, numbers and hyphens")
	slugRe         = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$`)
)

// SetStorefrontSlug lets a seller or artisan claim their brand handle.
// e.g. "arike-spa" → arike-spa.luxebeau.com
// The slug is lowercased and validated; uniqueness is enforced by the DB index.
func SetStorefrontSlug(ctx context.Context, db *gorm.DB, userID, raw string) (string, error) {
	slug := strings.ToLower(strings.TrimSpace(raw))
	if !slugRe.MatchString(slug) {
		return "", ErrSlugInvalid
	}
	res := db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ?", userID).
		Update("storefront_slug", &slug)
	if res.Error != nil {
		if strings.Contains(res.Error.Error(), "unique") || strings.Contains(res.Error.Error(), "duplicate") {
			return "", ErrSlugTaken
		}
		return "", res.Error
	}
	return slug, nil
}

// UpsertDeliveryZones replaces a seller's delivery zone table in one transaction.
// An empty city string is the catch-all ("everywhere else") zone.
// Checkout calls DeliveryFeeFor to pick the right fee.
func UpsertDeliveryZones(ctx context.Context, db *gorm.DB, sellerID string, zones []domain.DeliveryZone) error {
	if len(zones) == 0 {
		return fmt.Errorf("at least one delivery zone is required")
	}
	seen := map[string]bool{}
	for i := range zones {
		zones[i].SellerID = sellerID
		city := strings.TrimSpace(zones[i].City)
		zones[i].City = city
		if seen[city] {
			return fmt.Errorf("duplicate city %q in delivery zones", city)
		}
		seen[city] = true
		if zones[i].FeeKobo < 0 {
			return fmt.Errorf("delivery fee cannot be negative")
		}
	}
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("seller_id = ?", sellerID).Delete(&domain.DeliveryZone{}).Error; err != nil {
			return err
		}
		return tx.Clauses(clause.OnConflict{UpdateAll: true}).Create(&zones).Error
	})
}

// ListDeliveryZones returns a seller's configured zones.
func ListDeliveryZones(ctx context.Context, db *gorm.DB, sellerID string) ([]domain.DeliveryZone, error) {
	var zones []domain.DeliveryZone
	if err := db.WithContext(ctx).Where("seller_id = ?", sellerID).
		Order("city").Find(&zones).Error; err != nil {
		return nil, err
	}
	return zones, nil
}

// DeliveryFeeFor returns the delivery fee a specific seller charges to a city.
// It picks the exact city match first, then the catch-all (empty city), then
// falls back to the platform default if the seller has no zones configured.
func DeliveryFeeFor(ctx context.Context, db *gorm.DB, sellerID, city string) (int64, error) {
	var zones []domain.DeliveryZone
	if err := db.WithContext(ctx).
		Where("seller_id = ? AND (city = ? OR city = '')", sellerID, city).
		Order("CASE WHEN city = '' THEN 1 ELSE 0 END"). // exact match first
		Find(&zones).Error; err != nil {
		return 0, err
	}
	if len(zones) == 0 {
		return domain.PlatformDeliveryFeeKobo, nil
	}
	return zones[0].FeeKobo, nil
}
