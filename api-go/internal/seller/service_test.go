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
	if err := db.AutoMigrate(&domain.Product{}, &domain.Order{}, &domain.OrderItem{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	db.Exec("DELETE FROM products")
	db.Exec("DELETE FROM orders")
	db.Exec("DELETE FROM order_items")
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
