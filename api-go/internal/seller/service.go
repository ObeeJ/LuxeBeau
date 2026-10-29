package seller

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

type Service struct {
	repo   Repository
	db     *gorm.DB
	logger *slog.Logger
}

func NewService(repo Repository, logger *slog.Logger) *Service {
	return &Service{repo: repo, logger: logger}
}

func (s *Service) DB() *gorm.DB { return s.repo.(*gormRepository).db }

var slugNonWord = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = slugNonWord.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

func (s *Service) ListProducts(ctx context.Context, sellerID string) ([]domain.Product, error) {
	return s.repo.ListProducts(ctx, sellerID)
}

// CreateProduct stamps the owning seller and a slug, then persists the product.
func (s *Service) CreateProduct(ctx context.Context, sellerID string, p *domain.Product) (*domain.Product, error) {
	if p.Name == "" || p.Brand == "" || p.Price <= 0 {
		return nil, fmt.Errorf("name, brand and a positive price are required")
	}
	p.ID = 0
	p.SellerID = sellerID
	if p.Slug == "" {
		p.Slug = slugify(p.Name)
	}
	if err := s.repo.CreateProduct(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// UpdateProduct applies seller-editable fields after confirming ownership.
func (s *Service) UpdateProduct(ctx context.Context, sellerID string, id uint, in *domain.Product) (*domain.Product, error) {
	existing, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil || existing.SellerID != sellerID {
		return nil, fmt.Errorf("product not found")
	}
	existing.Name = in.Name
	existing.Brand = in.Brand
	existing.Price = in.Price
	existing.OriginalPrice = in.OriginalPrice
	existing.Category = in.Category
	existing.Stock = in.Stock
	existing.Badge = in.Badge
	existing.Blurb = in.Blurb
	existing.Details = in.Details
	existing.ImageURL = in.ImageURL
	if in.BgColor != "" {
		existing.BgColor = in.BgColor
	}
	if in.FgColor != "" {
		existing.FgColor = in.FgColor
	}
	if err := s.repo.UpdateProduct(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeleteProduct(ctx context.Context, sellerID string, id uint) error {
	existing, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil || existing.SellerID != sellerID {
		return fmt.Errorf("product not found")
	}
	return s.repo.DeleteProduct(ctx, id)
}

func (s *Service) ListSales(ctx context.Context, sellerID string) ([]domain.Order, error) {
	return s.repo.ListSales(ctx, sellerID)
}

// Fulfil records the seller's progress on their items in an order.
func (s *Service) Fulfil(ctx context.Context, sellerID, orderID, stage, note string) (*Fulfilment, error) {
	return s.repo.Fulfil(ctx, sellerID, orderID, stage, strings.TrimSpace(note), time.Now().UTC())
}
