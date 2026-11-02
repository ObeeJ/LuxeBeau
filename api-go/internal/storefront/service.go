package storefront

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"unicode/utf8"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

type Service struct {
	repo   domain.StorefrontRepository
	db     *gorm.DB
	logger *slog.Logger
}

func NewService(repo domain.StorefrontRepository, db *gorm.DB, logger *slog.Logger) *Service {
	return &Service{
		repo:   repo,
		db:     db,
		logger: logger,
	}
}

type SaveStorefrontRequest struct {
	Handle       string  `json:"handle" binding:"required"`
	TemplateID   string  `json:"template_id" binding:"required"`
	LogoURL      *string `json:"logo_url"`
	BannerURL    *string `json:"banner_url"`
	BaseHex      string  `json:"base_hex" binding:"required"`
	ThemeVariant string  `json:"theme_variant" binding:"required"`
	Bio          string  `json:"bio"`
	Live         bool    `json:"live"`
}

type PublicStorefrontResponse struct {
	Storefront      *domain.Storefront `json:"storefront"`
	Owner           domain.User        `json:"owner"`
	Products        []domain.Product   `json:"products,omitempty"`
	Artisan         *domain.Artisan    `json:"artisan,omitempty"`
	RedirectHandle  string             `json:"redirect_handle,omitempty"`
	IsOwner         bool               `json:"is_owner"`
}

func (s *Service) GetMyStorefront(ctx context.Context, userID string) (*domain.Storefront, error) {
	return s.repo.GetByOwnerID(ctx, userID)
}

func (s *Service) CheckHandleAvailability(ctx context.Context, handle string, caller *domain.User) (bool, string, error) {
	var callerID, callerEmail string
	if caller != nil {
		callerID = caller.ID
		callerEmail = caller.Email
	}
	return s.repo.IsHandleAvailable(ctx, handle, callerID, callerEmail)
}

func (s *Service) PreviewTheme(baseHex string) (*ThemeVariants, error) {
	return DeriveVariants(baseHex)
}

func (s *Service) SaveStorefront(ctx context.Context, user *domain.User, req SaveStorefrontRequest) (*domain.Storefront, error) {
	if user.Role != "seller" && user.Role != "artisan" && user.Role != "admin" {
		return nil, fmt.Errorf("only sellers and artisans can configure a storefront")
	}

	normHandle := NormalizeHandle(req.Handle)
	if err := ValidateHandleFormat(normHandle); err != nil {
		return nil, err
	}

	// Template validation
	templateID := strings.ToLower(strings.TrimSpace(req.TemplateID))
	validTemplates := map[string]bool{
		"editorial": true,
		"split":     true,
		"minimal":   true,
		"hero":      true,
		"studio":    true,
	}
	if !validTemplates[templateID] {
		return nil, ErrInvalidTemplate
	}
	if templateID == "studio" && user.Role == "seller" {
		return nil, ErrStudioArtisanOnly
	}

	// Bio length validation (max 280 unicode runes)
	if utf8.RuneCountInString(req.Bio) > 280 {
		return nil, ErrBioTooLong
	}

	// Check handle availability
	available, reason, err := s.repo.IsHandleAvailable(ctx, normHandle, user.ID, user.Email)
	if err != nil {
		return nil, err
	}
	if !available {
		if reason == "reserved" {
			return nil, ErrHandleReserved
		}
		return nil, ErrHandleUnavailable
	}

	// Check eligibility if merchant attempts to go live or claim handle
	isVerified := user.Verified || user.KYCStatus == "verified"
	if req.Live && !isVerified {
		return nil, ErrUnverifiedMerchant
	}

	// Risk mitigation (PRD section 15): Must have at least 1 product / service before going live
	if req.Live {
		if user.Role == "seller" {
			var prodCount int64
			if err := s.db.WithContext(ctx).Model(&domain.Product{}).Where("seller_id = ?", user.ID).Count(&prodCount).Error; err != nil {
				return nil, err
			}
			if prodCount == 0 {
				return nil, ErrNoProductsOrServices
			}
		} else if user.Role == "artisan" {
			var artisan domain.Artisan
			if err := s.db.WithContext(ctx).Where("user_id = ?", user.ID).First(&artisan).Error; err != nil {
				return nil, ErrNoProductsOrServices
			}
			if len(artisan.Services) == 0 {
				return nil, ErrNoProductsOrServices
			}
		}
	}

	// Color derivation & contrast safety
	variants, err := DeriveVariants(req.BaseHex)
	if err != nil {
		return nil, fmt.Errorf("invalid base color: %w", err)
	}

	themeVariant := strings.ToLower(strings.TrimSpace(req.ThemeVariant))
	var chosen VariantConfig
	switch themeVariant {
	case "soft":
		chosen = variants.Soft
	case "deep":
		chosen = variants.Deep
	case "muted":
		chosen = variants.Muted
	case "vivid":
		chosen = variants.Vivid
	default:
		themeVariant = "true"
		chosen = variants.True
	}

	existing, err := s.repo.GetByOwnerID(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	ownerType := user.Role
	if ownerType != "artisan" {
		ownerType = "seller"
	}

	// Handle change logic
	if existing != nil && existing.Handle != "" && existing.Handle != normHandle {
		if err := s.repo.RecordHandleChange(ctx, user.ID, existing.Handle, normHandle); err != nil {
			return nil, err
		}
	}

	var sf domain.Storefront
	if existing != nil {
		sf = *existing
	} else {
		sf.OwnerID = user.ID
		sf.OwnerType = ownerType
	}

	sf.Handle = normHandle
	sf.TemplateID = templateID
	sf.LogoURL = req.LogoURL
	sf.BannerURL = req.BannerURL
	sf.AccentHex = chosen.AccentHex
	sf.OnAccentHex = chosen.OnAccentHex
	sf.SoftHex = variants.Soft.AccentHex
	sf.DeepHex = variants.Deep.AccentHex
	sf.ThemeVariant = themeVariant
	sf.Bio = req.Bio
	sf.Live = req.Live

	if err := s.repo.Save(ctx, &sf); err != nil {
		return nil, err
	}

	return &sf, nil
}

func (s *Service) GetPublicStorefront(ctx context.Context, handle string, callerUserID string) (*PublicStorefrontResponse, error) {
	norm := NormalizeHandle(handle)
	sf, err := s.repo.GetByHandle(ctx, norm)
	if err != nil {
		return nil, err
	}

	// If not found, check 301 history redirect
	if sf == nil {
		history, err := s.repo.GetHistoricalHandleRedirect(ctx, norm)
		if err != nil {
			return nil, err
		}
		if history != nil {
			return &PublicStorefrontResponse{
				RedirectHandle: history.NewHandle,
			}, nil
		}
		return nil, nil // 404
	}

	isOwner := callerUserID != "" && callerUserID == sf.OwnerID
	if !sf.Live && !isOwner {
		return nil, ErrStorefrontNotLive
	}

	// Increment total views asynchronously if not owner
	if !isOwner {
		go func(id uint) {
			_ = s.repo.IncrementViews(context.Background(), id)
		}(sf.ID)
	}

	// Fetch owner user record (sanitized)
	var owner domain.User
	if err := s.db.WithContext(ctx).Select("id, name, email, role, verified, kyc_status, jurisdiction").Where("id = ?", sf.OwnerID).First(&owner).Error; err != nil {
		return nil, err
	}

	resp := &PublicStorefrontResponse{
		Storefront: sf,
		Owner:      owner,
		IsOwner:    isOwner,
	}

	if sf.OwnerType == "artisan" {
		var artisan domain.Artisan
		if err := s.db.WithContext(ctx).Where("user_id = ?", sf.OwnerID).First(&artisan).Error; err == nil {
			resp.Artisan = &artisan
		}
	} else {
		var products []domain.Product
		if err := s.db.WithContext(ctx).Where("seller_id = ?", sf.OwnerID).Order("created_at DESC").Find(&products).Error; err == nil {
			resp.Products = products
		}
	}

	return resp, nil
}
