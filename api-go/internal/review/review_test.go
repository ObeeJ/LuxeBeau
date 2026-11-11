package review

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

const (
	buyer    = "00000000-0000-0000-0000-0000000000b1"
	buyer2   = "00000000-0000-0000-0000-0000000000b2"
	seller   = "00000000-0000-0000-0000-0000000000a1"
	artisanU = "00000000-0000-0000-0000-0000000000c1"
)

var dbN atomic.Int64

// world builds a small marketplace: a product bought by `buyer` whose payout was
// released, a product whose escrow is still held, and a completed booking.
func world(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	name := "file:review-" + strings.ReplaceAll(t.Name(), "/", "_") + "-" + time.Now().Format("150405.000000") + string(rune('a'+dbN.Add(1)%26)) + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(name), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Product{}, &domain.Artisan{}, &domain.Order{}, &domain.OrderItem{}, &domain.Escrow{}, &domain.Booking{}, &domain.Review{}); err != nil {
		t.Fatal(err)
	}
	for _, u := range []domain.User{
		{ID: buyer, Name: "Ada Obi", Email: "ada@test.ng"},
		{ID: buyer2, Name: "Tunde", Email: "tunde@test.ng"},
		{ID: seller, Name: "Adunni Organics", Email: "seller@test.ng"},
		{ID: artisanU, Name: "Amaka Eze", Email: "amaka@test.ng"},
	} {
		db.Create(&u)
	}
	db.Create(&domain.Product{ID: 1, SellerID: seller, Name: "Black soap", Brand: "A", Price: 850_000, Category: "Skincare", Stock: 5})
	db.Create(&domain.Product{ID: 2, SellerID: seller, Name: "Shea butter", Brand: "A", Price: 900_000, Category: "Body", Stock: 5})
	db.Create(&domain.Artisan{ID: 1, UserID: artisanU, Specialty: "Braids", PriceFrom: 500_000, Location: "Lagos"})

	// Order 1: product 1, payout released. Order 2: product 2, payout still held.
	for i, st := range []string{domain.EscrowReleased, domain.EscrowFunded} {
		id := []string{"LB-1", "LB-2"}[i]
		db.Omit("Buyer").Create(&domain.Order{ID: id, BuyerID: buyer, PaymentStatus: "paid", Subtotal: 1, Total: 1})
		db.Omit("Product").Create(&domain.OrderItem{OrderID: id, ProductID: uint(i + 1), Qty: 1, Price: 1})
		db.Create(&domain.Escrow{ID: "ESC-" + id, Kind: domain.EscrowKindOrder, Reference: id, BuyerID: buyer, PayeeID: seller, Amount: 1, State: st})
	}
	db.Omit("Buyer", "Artisan").Create(&domain.Booking{ID: "BK-1", BuyerID: buyer, ArtisanID: 1, ServiceName: "Knotless braids",
		BookingDate: time.Now(), BookingTime: "10:00", ServiceType: "studio", Amount: 1, Status: domain.BookingCompleted})
	return NewService(db, slog.New(slog.NewTextHandler(io.Discard, nil))), db
}

func product(t *testing.T, db *gorm.DB, id uint) domain.Product {
	t.Helper()
	var p domain.Product
	if err := db.First(&p, id).Error; err != nil {
		t.Fatal(err)
	}
	return p
}

func TestCreate_AVerifiedBuyerCanReviewAProductAfterThePayoutIsReleased(t *testing.T) {
	s, db := world(t)
	r, err := s.Create(context.Background(), buyer, CreateInput{TargetType: "product", TargetID: "1", Rating: 5, Body: "  Lovely, my skin feels soft.  "})
	if err != nil {
		t.Fatal(err)
	}
	if r.Body != "Lovely, my skin feels soft." || r.Rating != 5 || r.Status != "visible" {
		t.Errorf("stored review = %+v", r)
	}
	p := product(t, db, 1)
	if p.Rating != 5.0 || p.ReviewsCount != 1 {
		t.Errorf("product rating/count = %v/%d, want 5.0/1 (from the real review, not the seeded number)", p.Rating, p.ReviewsCount)
	}
}

func TestCreate_NotEligibleUnlessTheyReallyBoughtAndReceivedIt(t *testing.T) {
	s, db := world(t)
	ctx := context.Background()
	cases := map[string]struct {
		who string
		in  CreateInput
	}{
		"someone who never bought it":          {buyer2, CreateInput{TargetType: "product", TargetID: "1", Rating: 5}},
		"payout still held (not yet released)": {buyer, CreateInput{TargetType: "product", TargetID: "2", Rating: 5}},
		"a product that does not exist":        {buyer, CreateInput{TargetType: "product", TargetID: "99", Rating: 5}},
		"an artisan they never booked":         {buyer2, CreateInput{TargetType: "artisan", TargetID: "1", Rating: 5}},
	}
	for name, c := range cases {
		if _, err := s.Create(ctx, c.who, c.in); !errors.Is(err, ErrNotEligible) {
			t.Errorf("%s: err = %v, want ErrNotEligible", name, err)
		}
	}
	// A refunded or disputed payout is not a good purchase either.
	for _, st := range []string{domain.EscrowRefunded, domain.EscrowDisputed} {
		db.Model(&domain.Escrow{}).Where("id = ?", "ESC-LB-1").Update("state", st)
		if _, err := s.Create(ctx, buyer, CreateInput{TargetType: "product", TargetID: "1", Rating: 5}); !errors.Is(err, ErrNotEligible) {
			t.Errorf("escrow %s: err = %v, want ErrNotEligible", st, err)
		}
	}
	// A booking that was not completed (confirmed, cancelled, no-show) does not count.
	for _, st := range []string{domain.BookingConfirmed, domain.BookingPending, "cancelled", domain.BookingNoShow} {
		db.Model(&domain.Booking{}).Where("id = ?", "BK-1").Update("status", st)
		if _, err := s.Create(ctx, buyer, CreateInput{TargetType: "artisan", TargetID: "1", Rating: 5}); !errors.Is(err, ErrNotEligible) {
			t.Errorf("booking %s: err = %v, want ErrNotEligible", st, err)
		}
	}
}

func TestCreate_NobodyReviewsTheirOwnListing(t *testing.T) {
	s, db := world(t)
	// The seller bought their own product and the payout "released" to themselves.
	db.Omit("Buyer").Create(&domain.Order{ID: "LB-9", BuyerID: seller, PaymentStatus: "paid", Subtotal: 1, Total: 1})
	db.Omit("Product").Create(&domain.OrderItem{OrderID: "LB-9", ProductID: 1, Qty: 1, Price: 1})
	db.Create(&domain.Escrow{ID: "ESC-LB-9", Kind: domain.EscrowKindOrder, Reference: "LB-9", BuyerID: seller, PayeeID: seller, Amount: 1, State: domain.EscrowReleased})
	if _, err := s.Create(context.Background(), seller, CreateInput{TargetType: "product", TargetID: "1", Rating: 5}); !errors.Is(err, ErrNotEligible) {
		t.Errorf("a seller reviewing their own product: err = %v, want ErrNotEligible", err)
	}
	// Same for an artisan booking themselves.
	db.Omit("Buyer", "Artisan").Create(&domain.Booking{ID: "BK-9", BuyerID: artisanU, ArtisanID: 1, ServiceName: "x", BookingDate: time.Now(),
		BookingTime: "10:00", ServiceType: "studio", Amount: 1, Status: domain.BookingCompleted})
	if _, err := s.Create(context.Background(), artisanU, CreateInput{TargetType: "artisan", TargetID: "1", Rating: 5}); !errors.Is(err, ErrNotEligible) {
		t.Errorf("an artisan reviewing themselves: err = %v, want ErrNotEligible", err)
	}
}

func TestCreate_AnArtisanReviewAfterACompletedBooking(t *testing.T) {
	s, db := world(t)
	if _, err := s.Create(context.Background(), buyer, CreateInput{TargetType: "artisan", TargetID: "1", Rating: 4, Body: "Neat work"}); err != nil {
		t.Fatal(err)
	}
	var a domain.Artisan
	db.First(&a, 1)
	if a.Rating != 4.0 || a.ReviewsCount != 1 {
		t.Errorf("artisan rating/count = %v/%d, want 4.0/1", a.Rating, a.ReviewsCount)
	}
}

func TestCreate_OnlyOneReviewPerBuyerPerListing(t *testing.T) {
	s, db := world(t)
	ctx := context.Background()
	in := CreateInput{TargetType: "product", TargetID: "1", Rating: 5}
	if _, err := s.Create(ctx, buyer, in); err != nil {
		t.Fatal(err)
	}
	in.Rating = 1
	if _, err := s.Create(ctx, buyer, in); !errors.Is(err, ErrAlreadyReviewed) {
		t.Fatalf("second review: err = %v, want ErrAlreadyReviewed", err)
	}
	var n int64
	db.Model(&domain.Review{}).Count(&n)
	if n != 1 || product(t, db, 1).Rating != 5.0 {
		t.Errorf("reviews = %d, rating = %v; the second attempt must change nothing", n, product(t, db, 1).Rating)
	}
}

func TestCreate_RejectsBadInput(t *testing.T) {
	s, _ := world(t)
	ctx := context.Background()
	long := strings.Repeat("a", 501)
	for name, in := range map[string]CreateInput{
		"rating 0":        {TargetType: "product", TargetID: "1", Rating: 0},
		"rating 6":        {TargetType: "product", TargetID: "1", Rating: 6},
		"negative rating": {TargetType: "product", TargetID: "1", Rating: -1},
		"text too long":   {TargetType: "product", TargetID: "1", Rating: 5, Body: long},
		"unknown type":    {TargetType: "storefront", TargetID: "1", Rating: 5},
		"no target":       {TargetType: "product", TargetID: "", Rating: 5},
	} {
		if _, err := s.Create(ctx, buyer, in); !errors.Is(err, ErrInvalidReview) {
			t.Errorf("%s: err = %v, want ErrInvalidReview", name, err)
		}
	}
	// Exactly 500 characters is fine, and so is no text at all.
	if _, err := s.Create(ctx, buyer, CreateInput{TargetType: "product", TargetID: "1", Rating: 5, Body: strings.Repeat("a", 500)}); err != nil {
		t.Errorf("500 characters should be allowed: %v", err)
	}
}

func addReleasedOrder(db *gorm.DB, orderID, who string, productID uint) {
	db.Omit("Buyer").Create(&domain.Order{ID: orderID, BuyerID: who, PaymentStatus: "paid", Subtotal: 1, Total: 1})
	db.Omit("Product").Create(&domain.OrderItem{OrderID: orderID, ProductID: productID, Qty: 1, Price: 1})
	db.Create(&domain.Escrow{ID: "ESC-" + orderID, Kind: domain.EscrowKindOrder, Reference: orderID, BuyerID: who, PayeeID: seller, Amount: 1, State: domain.EscrowReleased})
}

func TestAggregates_FollowTheVisibleReviewsOnly(t *testing.T) {
	s, db := world(t)
	ctx := context.Background()
	addReleasedOrder(db, "LB-3", buyer2, 1)

	r1, _ := s.Create(ctx, buyer, CreateInput{TargetType: "product", TargetID: "1", Rating: 5})
	s.Create(ctx, buyer2, CreateInput{TargetType: "product", TargetID: "1", Rating: 4})
	if p := product(t, db, 1); p.Rating != 4.5 || p.ReviewsCount != 2 {
		t.Fatalf("after two reviews: %v/%d, want 4.5/2", p.Rating, p.ReviewsCount)
	}
	if err := s.SetStatus(ctx, r1.ID, "hidden"); err != nil {
		t.Fatal(err)
	}
	if p := product(t, db, 1); p.Rating != 4.0 || p.ReviewsCount != 1 {
		t.Errorf("after hiding the 5-star: %v/%d, want 4.0/1", p.Rating, p.ReviewsCount)
	}
	if err := s.SetStatus(ctx, r1.ID, "visible"); err != nil {
		t.Fatal(err)
	}
	if p := product(t, db, 1); p.Rating != 4.5 || p.ReviewsCount != 2 {
		t.Errorf("after restoring it: %v/%d, want 4.5/2", p.Rating, p.ReviewsCount)
	}
	if err := s.SetStatus(ctx, r1.ID, "banana"); !errors.Is(err, ErrInvalidReview) {
		t.Errorf("a bad status: err = %v, want ErrInvalidReview", err)
	}
	if err := s.SetStatus(ctx, 9999, "hidden"); !errors.Is(err, ErrNotFound) {
		t.Errorf("a missing review: err = %v, want ErrNotFound", err)
	}
}

func TestList_ShowsVisibleReviewsNewestFirstWithAPrivateAuthorName(t *testing.T) {
	s, db := world(t)
	ctx := context.Background()
	addReleasedOrder(db, "LB-3", buyer2, 1)
	first, _ := s.Create(ctx, buyer, CreateInput{TargetType: "product", TargetID: "1", Rating: 5, Body: "first"})
	db.Model(&domain.Review{}).Where("id = ?", first.ID).Update("created_at", time.Now().Add(-time.Hour))
	s.Create(ctx, buyer2, CreateInput{TargetType: "product", TargetID: "1", Rating: 3, Body: "second"})

	page, err := s.List(ctx, "product", "1", 10, 0)
	if err != nil {
		t.Fatal(err)
	}
	if page.Count != 2 || page.Average != 4.0 || len(page.Reviews) != 2 {
		t.Fatalf("page = %+v", page)
	}
	if page.Reviews[0].Text != "second" || page.Reviews[1].Text != "first" {
		t.Errorf("order = %q, %q, want newest first", page.Reviews[0].Text, page.Reviews[1].Text)
	}
	if page.Reviews[1].Author != "Ada O." || page.Reviews[0].Author != "Tunde" {
		t.Errorf("authors = %q, %q, want a first name and last initial only", page.Reviews[1].Author, page.Reviews[0].Author)
	}
	if !page.Reviews[0].VerifiedBuyer || page.Reviews[0].Item != "Black soap" {
		t.Errorf("review = %+v, want verified with the product name", page.Reviews[0])
	}
	// Hidden reviews are gone from the public list and the count.
	s.SetStatus(ctx, first.ID, "hidden")
	page, _ = s.List(ctx, "product", "1", 10, 0)
	if page.Count != 1 || len(page.Reviews) != 1 || page.Reviews[0].Text != "second" {
		t.Errorf("after hiding: %+v", page)
	}
	// Paging.
	page, _ = s.List(ctx, "product", "1", 1, 1)
	if len(page.Reviews) != 0 || page.Count != 1 {
		t.Errorf("page 2: %+v", page)
	}
	// An unknown type is an error, not an empty success.
	if _, err := s.List(ctx, "storefront", "1", 10, 0); !errors.Is(err, ErrInvalidReview) {
		t.Errorf("err = %v, want ErrInvalidReview", err)
	}
}

func TestReviewable_ListsWhatThisBuyerCanReviewNow(t *testing.T) {
	s, _ := world(t)
	ctx := context.Background()
	got, err := s.Reviewable(ctx, buyer)
	if err != nil {
		t.Fatal(err)
	}
	// Product 1 (released) and the completed booking; product 2 is still held.
	if len(got) != 2 {
		t.Fatalf("reviewable = %+v, want 2 items", got)
	}
	var sawProduct, sawArtisan bool
	for _, r := range got {
		switch r.TargetType {
		case "product":
			sawProduct = r.TargetID == "1" && r.Name == "Black soap"
		case "artisan":
			sawArtisan = r.TargetID == "1" && r.Name == "Knotless braids"
		}
	}
	if !sawProduct || !sawArtisan {
		t.Errorf("reviewable = %+v", got)
	}
	s.Create(ctx, buyer, CreateInput{TargetType: "product", TargetID: "1", Rating: 5})
	s.Create(ctx, buyer, CreateInput{TargetType: "artisan", TargetID: "1", Rating: 5})
	if got, _ := s.Reviewable(ctx, buyer); len(got) != 0 {
		t.Errorf("after reviewing both: %+v, want none", got)
	}
	if got, _ := s.Reviewable(ctx, buyer2); len(got) != 0 {
		t.Errorf("a stranger has nothing to review: %+v", got)
	}
}

func TestAdminList_FiltersByStatus(t *testing.T) {
	s, _ := world(t)
	ctx := context.Background()
	r, _ := s.Create(ctx, buyer, CreateInput{TargetType: "product", TargetID: "1", Rating: 2, Body: "meh"})
	all, total, err := s.AdminList(ctx, "", 20, 0)
	if err != nil || total != 1 || len(all) != 1 || all[0].TargetName != "Black soap" || all[0].Status != "visible" {
		t.Fatalf("all = %+v total %d err %v", all, total, err)
	}
	s.SetStatus(ctx, r.ID, "hidden")
	if hidden, n, _ := s.AdminList(ctx, "hidden", 20, 0); n != 1 || len(hidden) != 1 {
		t.Errorf("hidden = %+v", hidden)
	}
	if visible, n, _ := s.AdminList(ctx, "visible", 20, 0); n != 0 || len(visible) != 0 {
		t.Errorf("visible = %+v", visible)
	}
}
