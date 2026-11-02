package storefront

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

type GormStorefrontRepository struct {
	db *gorm.DB
}

func NewGormStorefrontRepository(db *gorm.DB) domain.StorefrontRepository {
	return &GormStorefrontRepository{db: db}
}

func (r *GormStorefrontRepository) GetByOwnerID(ctx context.Context, ownerID string) (*domain.Storefront, error) {
	var sf domain.Storefront
	err := r.db.WithContext(ctx).Where("owner_id = ?", ownerID).First(&sf).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &sf, nil
}

func (r *GormStorefrontRepository) GetByHandle(ctx context.Context, handle string) (*domain.Storefront, error) {
	norm := NormalizeHandle(handle)
	var sf domain.Storefront
	err := r.db.WithContext(ctx).Where("handle = ?", norm).First(&sf).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &sf, nil
}

func (r *GormStorefrontRepository) Save(ctx context.Context, sf *domain.Storefront) error {
	sf.Handle = NormalizeHandle(sf.Handle)
	return r.db.WithContext(ctx).Save(sf).Error
}

func (r *GormStorefrontRepository) IsHandleAvailable(ctx context.Context, handle string, callerOwnerID string, callerEmail string) (bool, string, error) {
	norm := NormalizeHandle(handle)
	if err := ValidateHandleFormat(norm); err != nil {
		return false, "invalid_format", nil
	}

	// 1. Check Reserved Handles
	var reserved domain.ReservedHandle
	err := r.db.WithContext(ctx).Where("handle = ?", norm).First(&reserved).Error
	if err == nil {
		if reserved.ClaimableByEmail != nil && callerEmail != "" && strings.EqualFold(*reserved.ClaimableByEmail, strings.TrimSpace(callerEmail)) {
			// Allowed to be claimed by this specific verified email
		} else {
			return false, "reserved", nil
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", err
	}

	// 2. Check Active Storefronts
	var active domain.Storefront
	err = r.db.WithContext(ctx).Where("handle = ?", norm).First(&active).Error
	if err == nil {
		if callerOwnerID != "" && active.OwnerID == callerOwnerID {
			return true, "current_handle", nil
		}
		return false, "taken", nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", err
	}

	// 3. Check Handle Quarantine & History
	now := time.Now()
	var history domain.StorefrontHandleHistory
	err = r.db.WithContext(ctx).
		Where("old_handle = ? AND quarantine_ends_at > ?", norm, now).
		Order("changed_at DESC").
		First(&history).Error
	if err == nil {
		if callerOwnerID != "" && history.OwnerID == callerOwnerID {
			return true, "yours_in_quarantine", nil
		}
		return false, "quarantined", nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return false, "", err
	}

	return true, "available", nil
}

func (r *GormStorefrontRepository) RecordHandleChange(ctx context.Context, ownerID string, oldHandle string, newHandle string) error {
	normOld := NormalizeHandle(oldHandle)
	normNew := NormalizeHandle(newHandle)
	if normOld == normNew {
		return nil
	}

	now := time.Now()
	ninetyDaysAgo := now.AddDate(0, 0, -90)

	// Check if handle changed in last 90 days
	var recentCount int64
	err := r.db.WithContext(ctx).
		Model(&domain.StorefrontHandleHistory{}).
		Where("owner_id = ? AND changed_at > ?", ownerID, ninetyDaysAgo).
		Count(&recentCount).Error
	if err != nil {
		return err
	}
	if recentCount > 0 {
		return ErrHandleChangedRecent
	}

	history := domain.StorefrontHandleHistory{
		OwnerID:           ownerID,
		OldHandle:         normOld,
		NewHandle:         normNew,
		ChangedAt:         now,
		RedirectExpiresAt: now.AddDate(0, 0, 180), // 180 days 301 redirect
		QuarantineEndsAt:  now.AddDate(0, 0, 210), // 180 + 30 days quarantine
	}

	return r.db.WithContext(ctx).Create(&history).Error
}

func (r *GormStorefrontRepository) GetHistoricalHandleRedirect(ctx context.Context, handle string) (*domain.StorefrontHandleHistory, error) {
	norm := NormalizeHandle(handle)
	now := time.Now()
	var history domain.StorefrontHandleHistory
	err := r.db.WithContext(ctx).
		Where("old_handle = ? AND redirect_expires_at > ?", norm, now).
		Order("changed_at DESC").
		First(&history).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &history, nil
}

func (r *GormStorefrontRepository) IncrementViews(ctx context.Context, storefrontID uint) error {
	return r.db.WithContext(ctx).
		Model(&domain.Storefront{}).
		Where("id = ?", storefrontID).
		UpdateColumn("total_views", gorm.Expr("total_views + 1")).Error
}

func (r *GormStorefrontRepository) SeedReservedHandles(ctx context.Context, handles []domain.ReservedHandle) error {
	if len(handles) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&handles).Error
}
