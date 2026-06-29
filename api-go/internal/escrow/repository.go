package escrow

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// Filter narrows an escrow listing for users and admins. Empty fields are ignored.
type Filter struct {
	BuyerID string
	PayeeID string
	State   string
	Kind    string
}

type Repository interface {
	Create(ctx context.Context, e *domain.Escrow) error
	Get(ctx context.Context, id string) (*domain.Escrow, error)
	List(ctx context.Context, f Filter) ([]domain.Escrow, error)
	DB() *gorm.DB
}

type gormRepository struct {
	db *gorm.DB
}

func NewGormRepository(db *gorm.DB) Repository {
	return &gormRepository{db: db}
}

func (r *gormRepository) DB() *gorm.DB { return r.db }

func (r *gormRepository) Create(ctx context.Context, e *domain.Escrow) error {
	return r.db.WithContext(ctx).Create(e).Error
}

func (r *gormRepository) Get(ctx context.Context, id string) (*domain.Escrow, error) {
	var e domain.Escrow
	if err := r.db.WithContext(ctx).First(&e, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}

func (r *gormRepository) List(ctx context.Context, f Filter) ([]domain.Escrow, error) {
	q := r.db.WithContext(ctx).Model(&domain.Escrow{})
	if f.BuyerID != "" {
		q = q.Where("buyer_id = ?", f.BuyerID)
	}
	if f.PayeeID != "" {
		q = q.Where("payee_id = ?", f.PayeeID)
	}
	if f.State != "" {
		q = q.Where("state = ?", f.State)
	}
	if f.Kind != "" {
		q = q.Where("kind = ?", f.Kind)
	}
	var list []domain.Escrow
	if err := q.Order("created_at DESC").Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}
