package order

import (
	"context"
	"log/slog"
	"os"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"luxebeau/internal/auth"
	"luxebeau/internal/domain"
)

type mockUserRepo struct {
	db *gorm.DB
}

func (m *mockUserRepo) Create(ctx context.Context, user *domain.User) error {
	return m.db.Create(user).Error
}

func (m *mockUserRepo) Update(ctx context.Context, user *domain.User) error {
	return m.db.Save(user).Error
}

func (m *mockUserRepo) GetByID(ctx context.Context, id string) (*domain.User, error) {
	var user domain.User
	err := m.db.First(&user, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (m *mockUserRepo) GetByEmail(ctx context.Context, email string) (*domain.User, error) {
	var user domain.User
	err := m.db.First(&user, "email = ?", email).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// noopCodes discards verification codes; this test covers payments only.
type noopCodes struct{}

func (noopCodes) SendVerificationCode(context.Context, string, string, string) error { return nil }

func TestE2EPaymentIntegration(t *testing.T) {
	// 1. Setup SQLite in-memory DB
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	// Migrate all models
	err = db.AutoMigrate(
		&domain.User{},
		&domain.Wallet{},
		&domain.Product{},
		&domain.Order{},
		&domain.OrderItem{},
		&domain.EmailOTP{},
	)
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))

	// 2. Instantiate Repositories
	userRepo := &mockUserRepo{db: db}
	walletRepo := auth.NewGormWalletRepository(db)
	productRepo := &mockProductRepo{db: db}
	orderRepo := &mockOrderRepo{db: db}

	// 3. Instantiate Services
	userService := auth.NewService(db, userRepo, walletRepo, noopCodes{}, auth.Config{JWTSecret: "testing-jwt-secret-key-0123456789abcdef"}, logger)
	orderService := NewOrderService(orderRepo, productRepo, db, logger)

	// 4. Register a new user (which automatically creates a Wallet)
	user, err := userService.Register(context.Background(), "Luxe Client", "client@luxe.com", "SecurePassword123", "+2348011112222")
	if err != nil {
		t.Fatalf("failed to register client: %v", err)
	}

	// Verify wallet is created with 0 balance
	userWallet, err := userService.GetWallet(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("failed to get user wallet: %v", err)
	}
	if userWallet.Balance != 0 {
		t.Errorf("expected new wallet balance to be 0, got %d", userWallet.Balance)
	}

	// 5. Credit Wallet with ₦50,000 (5,000,000 kobo)
	err = userService.CreditWallet(context.Background(), user.ID, 5000000)
	if err != nil {
		t.Fatalf("failed to credit wallet: %v", err)
	}

	// Verify wallet updated balance
	userWallet, _ = userService.GetWallet(context.Background(), user.ID)
	if userWallet.Balance != 5000000 {
		t.Errorf("expected wallet balance to be 5,000,000, got %d", userWallet.Balance)
	}

	// 6. Seed a Product (Luxe Facial Cleanser, price: ₦12,500 = 1,250,000 kobo, stock: 5)
	prod := &domain.Product{
		Name:  "Luxe Facial Cleanser",
		Brand: "LuxeBeau",
		Price: 1250000,
		Stock: 5,
	}
	if err := db.Create(prod).Error; err != nil {
		t.Fatalf("failed to seed product: %v", err)
	}

	// 7. Place Order using Wallet
	reqItems := []struct {
		ProductID uint `json:"product_id"`
		Qty       int  `json:"qty"`
	}{
		{ProductID: prod.ID, Qty: 2}, // Total price: ₦25,000 + ₦1,500 delivery fee = ₦26,500 (2,650,000 kobo)
	}

	order, err := orderService.CreateCheckout(
		context.Background(),
		user.ID,
		reqItems,
		"10 Lekki Phase 1", "Lagos", "Lagos", "+2348011112222",
		"wallet",
	)
	if err != nil {
		t.Fatalf("wallet checkout failed: %v", err)
	}

	// Verify order status is "paid" immediately
	if order.PaymentStatus != "paid" {
		t.Errorf("expected wallet order payment status to be 'paid', got %s", order.PaymentStatus)
	}

	// Verify wallet balance is deducted: 5,000,000 - 2,500,000 = 2,500,000
	userWallet, _ = userService.GetWallet(context.Background(), user.ID)
	if userWallet.Balance != 2500000 {
		t.Errorf("expected remaining wallet balance to be 2,500,000, got %d", userWallet.Balance)
	}

	// Verify product stock is decremented: 5 - 2 = 3
	var updatedProd domain.Product
	db.First(&updatedProd, prod.ID)
	if updatedProd.Stock != 3 {
		t.Errorf("expected product stock to be 3, got %d", updatedProd.Stock)
	}

	// 8. Place another Order using Paystack (instant card)
	paystackOrder, err := orderService.CreateCheckout(
		context.Background(),
		user.ID,
		reqItems, // Another ₦26,500 (2,650,000 kobo)
		"10 Lekki Phase 1", "Lagos", "Lagos", "+2348011112222",
		"card",
	)
	if err != nil {
		t.Fatalf("paystack checkout failed: %v", err)
	}

	// Verify payment status is "pending"
	if paystackOrder.PaymentStatus != "pending" {
		t.Errorf("expected paystack order to be pending, got %s", paystackOrder.PaymentStatus)
	}

	// 9. Simulate Paystack Webhook Success
	err = orderService.ProcessPaystackWebhook(context.Background(), paystackOrder.ID, "success")
	if err != nil {
		t.Fatalf("failed to process webhook: %v", err)
	}

	// Verify order status updated to "paid"
	updatedOrder, _ := orderService.GetOrderDetails(context.Background(), paystackOrder.ID)
	if updatedOrder.PaymentStatus != "paid" {
		t.Errorf("expected order status to be 'paid' after webhook, got %s", updatedOrder.PaymentStatus)
	}
}
