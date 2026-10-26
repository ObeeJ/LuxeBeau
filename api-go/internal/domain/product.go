package domain

import (
	"context"
	"time"
)

type Product struct {
	ID            uint        `gorm:"primaryKey;autoIncrement" json:"id"`
	SellerID      string      `gorm:"type:uuid;index" json:"seller_id"` // owning seller (User.ID)
	Slug          string      `gorm:"type:varchar(255);index" json:"slug"`
	Name          string      `gorm:"type:varchar(255);not null" json:"name" binding:"required"`
	Brand         string      `gorm:"type:varchar(100);not null" json:"brand" binding:"required"`
	Price         int64       `gorm:"type:bigint;not null" json:"price" binding:"required"` // Price stored in Kobo (100 kobo = ₦1)
	OriginalPrice int64       `gorm:"type:bigint" json:"original_price"`
	Category      string      `gorm:"type:varchar(50);not null" json:"category" binding:"required"`
	Stock         int         `gorm:"type:integer;default:0;not null" json:"stock"`
	Rating        float64     `gorm:"type:decimal(2,1);default:0.0" json:"rating"`
	ReviewsCount  int         `gorm:"type:integer;default:0" json:"reviews_count"`
	Badge         string      `gorm:"type:varchar(50)" json:"badge"`
	Blurb         string      `gorm:"type:text" json:"blurb"`
	Details       StringArray `gorm:"type:text" json:"details"`
	BgColor       string      `gorm:"type:varchar(10)" json:"bg_color"`
	FgColor       string      `gorm:"type:varchar(10)" json:"fg_color"`
	ImageURL      string      `gorm:"type:varchar(500)" json:"image_url"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

type ProductRepository interface {
	Create(ctx context.Context, prod *Product) error
	GetByID(ctx context.Context, id uint) (*Product, error)
	List(ctx context.Context, category string, search string, limit, offset int) ([]Product, error)
	Update(ctx context.Context, prod *Product) error
	UpdateStock(ctx context.Context, id uint, change int) error
}

type ProductService interface {
	GetProduct(ctx context.Context, id uint) (*Product, error)
	ListProducts(ctx context.Context, category string, search string, page, limit int) ([]Product, error)
	CreateProduct(ctx context.Context, prod *Product) error
}
