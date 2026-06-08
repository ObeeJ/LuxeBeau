package catalog

import (
	"context"
	"fmt"
	"log/slog"

	"luxebeau/internal/domain"
)

type catalogService struct {
	repo   domain.ProductRepository
	logger *slog.Logger
}

func NewCatalogService(repo domain.ProductRepository, logger *slog.Logger) domain.ProductService {
	return &catalogService{repo: repo, logger: logger}
}

func (s *catalogService) GetProduct(ctx context.Context, id uint) (*domain.Product, error) {
	prod, err := s.repo.GetByID(ctx, id)
	if err != nil {
		s.logger.Error("Failed to get product", slog.Any("id", id), slog.Any("error", err))
		return nil, fmt.Errorf("failed to get product: %w", err)
	}
	return prod, nil
}

func (s *catalogService) ListProducts(ctx context.Context, category string, search string, page, limit int) ([]domain.Product, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	products, err := s.repo.List(ctx, category, search, limit, offset)
	if err != nil {
		s.logger.Error("Failed to list products", slog.Any("error", err))
		return nil, fmt.Errorf("failed to list products: %w", err)
	}
	return products, nil
}

func (s *catalogService) CreateProduct(ctx context.Context, prod *domain.Product) error {
	if err := s.repo.Create(ctx, prod); err != nil {
		s.logger.Error("Failed to create product", slog.String("name", prod.Name), slog.Any("error", err))
		return fmt.Errorf("failed to create product: %w", err)
	}
	s.logger.Info("Product created", slog.String("name", prod.Name), slog.Any("id", prod.ID))
	return nil
}
