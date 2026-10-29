package order

import (
	"context"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

type mockOrderRepo struct {
	db *gorm.DB
}

func (m *mockOrderRepo) CreateOrder(ctx context.Context, order *domain.Order) error {
	return m.db.Create(order).Error
}

func (m *mockOrderRepo) GetOrderByID(ctx context.Context, id string) (*domain.Order, error) {
	var order domain.Order
	err := m.db.First(&order, "id = ?", id).Error
	return &order, err
}

func (m *mockOrderRepo) ListOrdersByBuyer(ctx context.Context, buyerID string) ([]domain.Order, error) {
	var orders []domain.Order
	err := m.db.Where("buyer_id = ?", buyerID).Find(&orders).Error
	return orders, err
}

func (m *mockOrderRepo) UpdatePaymentStatus(ctx context.Context, id string, status string) error {
	return m.db.Model(&domain.Order{}).Where("id = ?", id).Update("payment_status", status).Error
}

func (m *mockOrderRepo) UpdateShippingStatus(ctx context.Context, id string, status string) error {
	return m.db.Model(&domain.Order{}).Where("id = ?", id).Update("shipping_status", status).Error
}

type mockProductRepo struct {
	db *gorm.DB
}

func (m *mockProductRepo) Create(ctx context.Context, prod *domain.Product) error {
	return m.db.Create(prod).Error
}

func (m *mockProductRepo) GetByID(ctx context.Context, id uint) (*domain.Product, error) {
	var prod domain.Product
	err := m.db.First(&prod, id).Error
	return &prod, err
}

func (m *mockProductRepo) List(ctx context.Context, category string, search string, limit, offset int) ([]domain.Product, error) {
	var prods []domain.Product
	err := m.db.Find(&prods).Error
	return prods, err
}

func (m *mockProductRepo) Update(ctx context.Context, prod *domain.Product) error {
	return m.db.Save(prod).Error
}

func (m *mockProductRepo) UpdateStock(ctx context.Context, id uint, change int) error {
	return m.db.Model(&domain.Product{}).Where("id = ?", id).Update("stock", gorm.Expr("stock + ?", change)).Error
}

func TestConcurrentCheckouts(t *testing.T) {
	// Initialize in-memory SQLite db for transaction testing
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect to testing database: %v", err)
	}
	// SQLite locks whole tables, so concurrent writers can fail with
	// "table is locked" before the stock check even runs. One connection
	// serialises them, which still proves only one buyer gets the last unit.
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1)

	// Auto migrate entities
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Wallet{},
		&domain.Product{},
		&domain.Order{},
		&domain.OrderItem{},
		&domain.Escrow{},
		&domain.LedgerEntry{},
	)
	if err != nil {
		t.Fatalf("failed to migrate models: %v", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))

	productRepo := &mockProductRepo{db: db}
	orderRepo := &mockOrderRepo{db: db}
	service := NewOrderService(orderRepo, productRepo, db, logger)

	// Seed buyer's wallet with enough balance
	wallet := &domain.Wallet{
		UserID:  "buyer-uuid-test",
		Balance: 10000000, // ₦100,000 in Kobo
	}
	if err := db.Create(wallet).Error; err != nil {
		t.Fatalf("failed to seed test wallet: %v", err)
	}

	// Seed an approved seller and a product with exactly 1 stock
	seller := &domain.User{ID: "seller-approved", Name: "Seller", Email: "seller@test.ng", Role: "seller", Verified: true}
	if err := db.Create(seller).Error; err != nil {
		t.Fatalf("failed to seed seller: %v", err)
	}
	prod := &domain.Product{
		SellerID: seller.ID,
		Name:     "Luxe Facial Serum",
		Brand:    "LuxeBeau",
		Price:    1500000, // ₦15,000
		Stock:    1,
	}
	if err := db.Create(prod).Error; err != nil {
		t.Fatalf("failed to seed test product: %v", err)
	}

	// Launch 10 concurrent requests to purchase the last unit
	var wg sync.WaitGroup
	var successfulOrders int32
	var failedOrders int32

	reqItems := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{
		{ProductID: prod.ID, Qty: 1},
	}

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(buyerID string) {
			defer wg.Done()
			_, checkoutErr := service.CreateCheckout(
				context.Background(),
				buyerID,
				reqItems,
				"123 Luxury Way", "Lagos", "Lagos", "+234800000000",
				"wallet",
			)
			if checkoutErr == nil {
				atomic.AddInt32(&successfulOrders, 1)
			} else {
				atomic.AddInt32(&failedOrders, 1)
			}
		}("buyer-uuid-test")
	}

	wg.Wait()

	if successfulOrders != 1 {
		t.Errorf("expected exactly 1 successful order under race condition, got %d", successfulOrders)
	}
	if failedOrders != 9 {
		t.Errorf("expected exactly 9 failed order attempts, got %d", failedOrders)
	}

	// Double-check stock value is 0
	var finalProd domain.Product
	if err := db.First(&finalProd, prod.ID).Error; err != nil {
		t.Fatalf("failed to query product: %v", err)
	}
	if finalProd.Stock != 0 {
		t.Errorf("expected final product stock to be 0, got %d", finalProd.Stock)
	}
}

func TestCheckout_RejectsUnapprovedSellersAndBadQuantities(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:checkout_rules?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Wallet{}, &domain.Product{}, &domain.Order{}, &domain.OrderItem{}, &domain.Escrow{}, &domain.LedgerEntry{}, &domain.InfluencerReferral{}, &domain.InfluencerCommission{}, &domain.InfluencerPackage{}); err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	service := NewOrderService(&mockOrderRepo{db: db}, &mockProductRepo{db: db}, db, logger)
	ctx := context.Background()

	db.Create(&domain.User{ID: "pending-seller", Name: "P", Email: "p@test.ng", Role: "seller"})
	db.Create(&domain.User{ID: "ok-seller", Name: "O", Email: "o@test.ng", Role: "seller", Verified: true})
	hidden := &domain.Product{SellerID: "pending-seller", Name: "Hidden", Brand: "B", Price: 100000, Stock: 10}
	live := &domain.Product{SellerID: "ok-seller", Name: "Live", Brand: "B", Price: 100000, Stock: 10}
	db.Create(hidden)
	db.Create(live)
	db.Create(&domain.Wallet{UserID: "buyer", Balance: 500000})

	type line = struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}
	checkout := func(items ...line) error {
		_, err := service.CreateCheckout(ctx, "buyer", items, "1 Road", "Lagos", "Lagos", "0800", "wallet")
		return err
	}

	if err := checkout(line{hidden.ID, 1}); err == nil {
		t.Error("bought a product from an unapproved seller")
	}
	for _, qty := range []int{0, -5, 101} {
		if err := checkout(line{live.ID, qty}); err == nil {
			t.Errorf("checkout accepted qty %d", qty)
		}
	}
	var w domain.Wallet
	db.First(&w, "user_id = ?", "buyer")
	var p domain.Product
	db.First(&p, live.ID)
	if w.Balance != 500000 || p.Stock != 10 {
		t.Errorf("rejected checkouts changed wallet (%d) or stock (%d)", w.Balance, p.Stock)
	}
	if err := checkout(line{live.ID, 2}); err != nil {
		t.Errorf("valid checkout: %v", err)
	}
}
