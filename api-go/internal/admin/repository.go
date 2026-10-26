// Package admin provides the internal administrative surface: user governance,
// verification, and catalogue oversight. Every route that reaches this package
// is gated by auth.RequireRole("admin"); nothing here is public.
package admin

import (
	"context"
	"errors"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// UserFilter narrows a user listing. Empty fields are ignored. Verified is a
// pointer so "false" is distinguishable from "unset".
type UserFilter struct {
	Role         string
	Jurisdiction string
	Status       string
	Search       string
	Verified     *bool
}

// UserUpdate carries the admin-editable fields. Nil pointers are left untouched.
type UserUpdate struct {
	Role         *string
	Status       *string
	Jurisdiction *string
	Verified     *bool
	CACNumber    *string
	KYCStatus    *string
}

type Repository interface {
	ListUsers(ctx context.Context, f UserFilter) ([]domain.User, error)
	GetUser(ctx context.Context, id string) (*domain.User, error)
	UpdateUser(ctx context.Context, id string, u UserUpdate) (*domain.User, error)
	DeleteUser(ctx context.Context, id string) error
	GetArtisanByUserID(ctx context.Context, userID string) (*domain.Artisan, error)
	SetArtisanVerified(ctx context.Context, userID string, verified bool) error
	ListProducts(ctx context.Context, jurisdiction string) ([]domain.Product, error)
	DeleteProduct(ctx context.Context, id uint) error
	ListOrders(ctx context.Context) ([]domain.Order, error)
	ListBookings(ctx context.Context) ([]domain.Booking, error)
	ListApplications(ctx context.Context) ([]Application, error)
}

// Application is a seller or artisan waiting for approval, with what they
// submitted so an admin can review it in one place.
type Application struct {
	User     domain.User     `json:"user"`
	Artisan  *domain.Artisan `json:"artisan,omitempty"`
	Products int64           `json:"products"`
}

type gormRepository struct {
	db *gorm.DB
}

func NewGormRepository(db *gorm.DB) Repository {
	return &gormRepository{db: db}
}

func (r *gormRepository) ListUsers(ctx context.Context, f UserFilter) ([]domain.User, error) {
	q := r.db.WithContext(ctx).Model(&domain.User{})
	if f.Role != "" {
		q = q.Where("role = ?", f.Role)
	}
	if f.Jurisdiction != "" {
		q = q.Where("jurisdiction = ?", f.Jurisdiction)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.Verified != nil {
		q = q.Where("verified = ?", *f.Verified)
	}
	if f.Search != "" {
		like := "%" + f.Search + "%"
		q = q.Where("LOWER(name) LIKE LOWER(?) OR LOWER(email) LIKE LOWER(?)", like, like)
	}
	var users []domain.User
	if err := q.Order("created_at DESC").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *gormRepository) GetUser(ctx context.Context, id string) (*domain.User, error) {
	var u domain.User
	if err := r.db.WithContext(ctx).First(&u, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &u, nil
}

func (r *gormRepository) UpdateUser(ctx context.Context, id string, u UserUpdate) (*domain.User, error) {
	updates := map[string]any{}
	if u.Role != nil {
		updates["role"] = *u.Role
	}
	if u.Status != nil {
		updates["status"] = *u.Status
	}
	if u.Jurisdiction != nil {
		updates["jurisdiction"] = *u.Jurisdiction
	}
	if u.Verified != nil {
		updates["verified"] = *u.Verified
	}
	if u.CACNumber != nil {
		updates["cac_number"] = *u.CACNumber
	}
	if u.KYCStatus != nil {
		updates["kyc_status"] = *u.KYCStatus
	}
	if len(updates) > 0 {
		if err := r.db.WithContext(ctx).Model(&domain.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return nil, err
		}
	}
	return r.GetUser(ctx, id)
}

func (r *gormRepository) DeleteUser(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&domain.User{}, "id = ?", id).Error
}

func (r *gormRepository) GetArtisanByUserID(ctx context.Context, userID string) (*domain.Artisan, error) {
	var a domain.Artisan
	if err := r.db.WithContext(ctx).First(&a, "user_id = ?", userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func (r *gormRepository) SetArtisanVerified(ctx context.Context, userID string, verified bool) error {
	return r.db.WithContext(ctx).Model(&domain.Artisan{}).Where("user_id = ?", userID).Update("verified", verified).Error
}

func (r *gormRepository) ListProducts(ctx context.Context, jurisdiction string) ([]domain.Product, error) {
	// Jurisdiction scoping for products is best-effort until products carry a
	// seller link; today it is a no-op filter that returns the full catalogue.
	_ = jurisdiction
	var products []domain.Product
	if err := r.db.WithContext(ctx).Order("created_at DESC").Find(&products).Error; err != nil {
		return nil, err
	}
	return products, nil
}

func (r *gormRepository) DeleteProduct(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&domain.Product{}, id).Error
}

func (r *gormRepository) ListOrders(ctx context.Context) ([]domain.Order, error) {
	var orders []domain.Order
	if err := r.db.WithContext(ctx).Preload("Items").Order("created_at DESC").Limit(200).Find(&orders).Error; err != nil {
		return nil, err
	}
	return orders, nil
}

func (r *gormRepository) ListBookings(ctx context.Context) ([]domain.Booking, error) {
	var bookings []domain.Booking
	if err := r.db.WithContext(ctx).Preload("Artisan").Preload("Buyer").Order("created_at DESC").Limit(200).Find(&bookings).Error; err != nil {
		return nil, err
	}
	return bookings, nil
}

// ListApplications returns unapproved, active sellers and artisans, oldest first.
func (r *gormRepository) ListApplications(ctx context.Context) ([]Application, error) {
	var users []domain.User
	if err := r.db.WithContext(ctx).
		Where("role IN ? AND verified = ? AND status <> ?", []string{"seller", "artisan"}, false, "suspended").
		Order("created_at ASC").Limit(200).Find(&users).Error; err != nil {
		return nil, err
	}
	if len(users) == 0 {
		return []Application{}, nil
	}
	ids := make([]string, len(users))
	for i, u := range users {
		ids[i] = u.ID
	}
	var artisans []domain.Artisan
	if err := r.db.WithContext(ctx).Where("user_id IN ?", ids).Find(&artisans).Error; err != nil {
		return nil, err
	}
	byUser := make(map[string]*domain.Artisan, len(artisans))
	for i := range artisans {
		byUser[artisans[i].UserID] = &artisans[i]
	}
	type count struct {
		SellerID string
		N        int64
	}
	var counts []count
	if err := r.db.WithContext(ctx).Model(&domain.Product{}).Select("seller_id, COUNT(*) AS n").
		Where("seller_id IN ?", ids).Group("seller_id").Scan(&counts).Error; err != nil {
		return nil, err
	}
	bySeller := make(map[string]int64, len(counts))
	for _, c := range counts {
		bySeller[c.SellerID] = c.N
	}
	out := make([]Application, len(users))
	for i, u := range users {
		out[i] = Application{User: u, Artisan: byUser[u.ID], Products: bySeller[u.ID]}
	}
	return out, nil
}
