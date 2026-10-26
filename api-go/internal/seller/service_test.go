package seller

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func newTestService(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Product{}, &domain.Order{}, &domain.OrderItem{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	db.Exec("DELETE FROM products")
	db.Exec("DELETE FROM orders")
	db.Exec("DELETE FROM order_items")
	db.Exec("DELETE FROM users")
	return NewService(NewGormRepository(db), slog.New(slog.NewTextHandler(io.Discard, nil))), db
}

const sellerA = "00000000-0000-0000-0000-0000000000aa"
const sellerB = "00000000-0000-0000-0000-0000000000bb"

func TestCreateProduct_StampsSellerAndSlug(t *testing.T) {
	s, _ := newTestService(t)
	p, err := s.CreateProduct(context.Background(), sellerA, &domain.Product{Name: "Glow Serum", Brand: "Adunni", Price: 500000, Category: "Skincare"})
	if err != nil {
		t.Fatal(err)
	}
	if p.SellerID != sellerA || p.Slug != "glow-serum" {
		t.Fatalf("unexpected product: seller=%q slug=%q", p.SellerID, p.Slug)
	}
}

func TestCreateProduct_RejectsInvalid(t *testing.T) {
	s, _ := newTestService(t)
	if _, err := s.CreateProduct(context.Background(), sellerA, &domain.Product{Name: "", Brand: "x", Price: 0}); err == nil {
		t.Fatal("expected validation error")
	}
}

func TestListProducts_ScopedToSeller(t *testing.T) {
	s, _ := newTestService(t)
	ctx := context.Background()
	_, _ = s.CreateProduct(ctx, sellerA, &domain.Product{Name: "A1", Brand: "b", Price: 1000, Category: "Body"})
	_, _ = s.CreateProduct(ctx, sellerB, &domain.Product{Name: "B1", Brand: "b", Price: 1000, Category: "Body"})

	got, err := s.ListProducts(ctx, sellerA)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Name != "A1" {
		t.Fatalf("expected only seller A's product, got %+v", got)
	}
}

func TestUpdateAndDelete_EnforceOwnership(t *testing.T) {
	s, _ := newTestService(t)
	ctx := context.Background()
	p, _ := s.CreateProduct(ctx, sellerA, &domain.Product{Name: "Owned", Brand: "b", Price: 1000, Category: "Body"})

	// Seller B cannot update or delete seller A's product.
	if _, err := s.UpdateProduct(ctx, sellerB, p.ID, &domain.Product{Name: "Hijack", Brand: "b", Price: 1000, Category: "Body"}); err == nil {
		t.Fatal("expected ownership error on update")
	}
	if err := s.DeleteProduct(ctx, sellerB, p.ID); err == nil {
		t.Fatal("expected ownership error on delete")
	}
	// Owner can update.
	updated, err := s.UpdateProduct(ctx, sellerA, p.ID, &domain.Product{Name: "Renamed", Brand: "b", Price: 2000, Category: "Body", Stock: 7})
	if err != nil {
		t.Fatal(err)
	}
	if updated.Name != "Renamed" || updated.Price != 2000 || updated.Stock != 7 {
		t.Fatalf("update did not apply: %+v", updated)
	}
	if err := s.DeleteProduct(ctx, sellerA, p.ID); err != nil {
		t.Fatalf("owner delete failed: %v", err)
	}
}

func TestListSales_OnlyOrdersWithSellerProducts(t *testing.T) {
	s, db := newTestService(t)
	ctx := context.Background()
	pa, _ := s.CreateProduct(ctx, sellerA, &domain.Product{Name: "A", Brand: "b", Price: 1000, Category: "Body"})
	pb, _ := s.CreateProduct(ctx, sellerB, &domain.Product{Name: "B", Brand: "b", Price: 1000, Category: "Body"})

	// Order 1 contains seller A's product; order 2 only seller B's.
	db.Create(&domain.Order{ID: "LB-1", BuyerID: "buyer", Subtotal: 1000, Total: 1000, PaymentMethod: "card", Address: "x", City: "Lagos", State: "Lagos", Phone: "0800"})
	db.Create(&domain.OrderItem{OrderID: "LB-1", ProductID: pa.ID, Qty: 1, Price: 1000})
	db.Create(&domain.Order{ID: "LB-2", BuyerID: "buyer", Subtotal: 1000, Total: 1000, PaymentMethod: "card", Address: "x", City: "Lagos", State: "Lagos", Phone: "0800"})
	db.Create(&domain.OrderItem{OrderID: "LB-2", ProductID: pb.ID, Qty: 1, Price: 1000})

	sales, err := s.ListSales(ctx, sellerA)
	if err != nil {
		t.Fatal(err)
	}
	if len(sales) != 1 || sales[0].ID != "LB-1" {
		t.Fatalf("expected only LB-1, got %+v", sales)
	}
}

func TestListSales_OwnItemsOnlyAndAddressAfterPayment(t *testing.T) {
	s, db := newTestService(t)
	ctx := context.Background()
	pa, _ := s.CreateProduct(ctx, sellerA, &domain.Product{Name: "A", Brand: "b", Price: 1000, Category: "Body"})
	pb, _ := s.CreateProduct(ctx, sellerB, &domain.Product{Name: "B", Brand: "b", Price: 5000, Category: "Body"})
	db.Create(&domain.User{ID: "buyer", Name: "Ada Buyer", Email: "ada@test.ng", Phone: "0800"})
	db.Create(&domain.Order{ID: "LB-M", BuyerID: "buyer", Subtotal: 7000, Total: 8500, DeliveryFee: 1500, PaymentMethod: "card", PaymentStatus: "pending", Address: "1 Road", City: "Lagos", State: "Lagos", Phone: "0800"})
	db.Create(&domain.OrderItem{OrderID: "LB-M", ProductID: pa.ID, Qty: 2, Price: 1000})
	db.Create(&domain.OrderItem{OrderID: "LB-M", ProductID: pb.ID, Qty: 1, Price: 5000})

	sales, _ := s.ListSales(ctx, sellerA)
	if len(sales) != 1 || len(sales[0].Items) != 1 || sales[0].Items[0].ProductID != pa.ID {
		t.Fatalf("seller A sees other sellers' items: %+v", sales)
	}
	o := sales[0]
	if o.Total != 2000 || o.Subtotal != 2000 {
		t.Errorf("seller total = %d, want their share 2000", o.Total)
	}
	if o.Address != "" || o.Phone != "" {
		t.Error("delivery details shown before payment")
	}
	if o.Buyer.Name != "Ada Buyer" || o.Buyer.Email != "" {
		t.Errorf("buyer = %+v, want name only", o.Buyer)
	}
	db.Model(&domain.Order{}).Where("id = ?", "LB-M").Update("payment_status", "paid")
	sales, _ = s.ListSales(ctx, sellerA)
	if sales[0].Address != "1 Road" || sales[0].Phone != "0800" {
		t.Error("delivery details missing after payment")
	}
}

func TestFulfil_OwnItemsForwardOnlyAndOverallStatus(t *testing.T) {
	s, db := newTestService(t)
	ctx := context.Background()
	pa, _ := s.CreateProduct(ctx, sellerA, &domain.Product{Name: "Soap", Brand: "b", Price: 1000, Category: "Body"})
	pb, _ := s.CreateProduct(ctx, sellerB, &domain.Product{Name: "Oil", Brand: "b", Price: 1000, Category: "Body"})
	db.Create(&domain.User{ID: "buyer", Name: "Ada Buyer", Email: "ada@test.ng"})
	db.Create(&domain.Order{ID: "LB-F", BuyerID: "buyer", Subtotal: 2000, Total: 2000, PaymentMethod: "card", PaymentStatus: "pending", Address: "x", City: "Lagos", State: "Lagos", Phone: "0800"})
	db.Create(&domain.OrderItem{OrderID: "LB-F", ProductID: pa.ID, Qty: 1, Price: 1000})
	db.Create(&domain.OrderItem{OrderID: "LB-F", ProductID: pb.ID, Qty: 1, Price: 1000})

	if _, err := s.Fulfil(ctx, sellerA, "LB-F", "shipped", ""); err != ErrNotPaid {
		t.Fatalf("unpaid order: got %v", err)
	}
	db.Model(&domain.Order{}).Where("id = ?", "LB-F").Update("payment_status", "paid")

	if _, err := s.Fulfil(ctx, "someone-else", "LB-F", "shipped", ""); err != ErrSaleNotFound {
		t.Errorf("seller with no items in the order: got %v", err)
	}
	if _, err := s.Fulfil(ctx, sellerA, "LB-F", "pending", ""); err != ErrInvalidStage {
		t.Errorf("moving to pending: got %v", err)
	}
	f, err := s.Fulfil(ctx, sellerA, "LB-F", "shipped", "GIG 12345")
	if err != nil {
		t.Fatal(err)
	}
	if !f.Notify || f.BuyerMail != "ada@test.ng" || len(f.Items) != 1 || f.Items[0] != "Soap" {
		t.Errorf("fulfilment result = %+v", f)
	}
	// Seller B hasn't shipped, so the order as a whole is still pending.
	if f.Order.ShippingStatus != "pending" {
		t.Errorf("order status = %s, want pending (slowest item)", f.Order.ShippingStatus)
	}
	var items []domain.OrderItem
	db.Where("order_id = ?", "LB-F").Order("product_id").Find(&items)
	if items[0].FulfillmentStatus != "shipped" || items[0].TrackingNote != "GIG 12345" || items[0].ShippedAt == nil {
		t.Errorf("seller A item = %+v", items[0])
	}
	if items[1].FulfillmentStatus != "pending" {
		t.Errorf("seller A changed seller B's item to %s", items[1].FulfillmentStatus)
	}
	if _, err := s.Fulfil(ctx, sellerA, "LB-F", "processing", ""); err != ErrBackwards {
		t.Errorf("moving back to processing: got %v", err)
	}
	// Same stage again only updates the note and sends no email.
	if f, err := s.Fulfil(ctx, sellerA, "LB-F", "shipped", "GIG 999"); err != nil || f.Notify {
		t.Errorf("repeat shipped: notify=%v err=%v", f != nil && f.Notify, err)
	}

	db.Where("order_id = ?", "LB-F").Order("product_id").Find(&items)
	if items[0].TrackingNote != "GIG 999" {
		t.Errorf("tracking note = %q, want the updated note", items[0].TrackingNote)
	}

	if _, err := s.Fulfil(ctx, sellerB, "LB-F", "delivered", ""); err != nil {
		t.Fatal(err)
	}
	if f, _ := s.Fulfil(ctx, sellerA, "LB-F", "delivered", ""); f.Order.ShippingStatus != "delivered" {
		t.Errorf("all items delivered but order is %s", f.Order.ShippingStatus)
	}
	db.Where("order_id = ?", "LB-F").Order("product_id").Find(&items)
	if items[1].ShippedAt == nil || items[1].DeliveredAt == nil {
		t.Error("jumping straight to delivered should stamp shipped_at too")
	}
	if items[0].TrackingNote != "GIG 999" {
		t.Errorf("delivering without a note erased the tracking note: %q", items[0].TrackingNote)
	}
}
