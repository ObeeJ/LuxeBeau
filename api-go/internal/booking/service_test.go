package booking

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"luxebeau/internal/domain"
	"luxebeau/internal/schedule"
)

type mockBookingRepo struct {
	db *gorm.DB
}

func (m *mockBookingRepo) CreateBooking(ctx context.Context, b *domain.Booking) error {
	return m.db.Create(b).Error
}

func (m *mockBookingRepo) GetBookingByID(ctx context.Context, id string) (*domain.Booking, error) {
	var b domain.Booking
	err := m.db.First(&b, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (m *mockBookingRepo) ListBookingsByBuyer(ctx context.Context, buyerID string) ([]domain.Booking, error) {
	var bookings []domain.Booking
	err := m.db.Where("buyer_id = ?", buyerID).Find(&bookings).Error
	return bookings, err
}

func (m *mockBookingRepo) ListBookingsByArtisan(ctx context.Context, artisanID uint) ([]domain.Booking, error) {
	var bookings []domain.Booking
	err := m.db.Where("artisan_id = ?", artisanID).Find(&bookings).Error
	return bookings, err
}

func (m *mockBookingRepo) GetArtisanByID(ctx context.Context, id uint) (*domain.Artisan, error) {
	var a domain.Artisan
	err := m.db.First(&a, id).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (m *mockBookingRepo) GetArtisanByUserID(ctx context.Context, userID string) (*domain.Artisan, error) {
	var a domain.Artisan
	err := m.db.Where("user_id = ?", userID).First(&a).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil // same contract as the gorm repository
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (m *mockBookingRepo) SaveArtisan(ctx context.Context, artisan *domain.Artisan) error {
	return m.db.Save(artisan).Error
}

func (m *mockBookingRepo) GetAvailableSlots(ctx context.Context, artisanID uint, from time.Time) ([]domain.BookingSlot, error) {
	var slots []domain.BookingSlot
	err := m.db.Where("artisan_id = ? AND slot_date >= ? AND reserved = ?", artisanID, from, false).Find(&slots).Error
	return slots, err
}

func (m *mockBookingRepo) ListArtisans(ctx context.Context, specialty, location string) ([]domain.Artisan, error) {
	var artisans []domain.Artisan
	err := m.db.Where("specialty = ? AND location = ?", specialty, location).Find(&artisans).Error
	return artisans, err
}

func (m *mockBookingRepo) ReserveSlot(ctx context.Context, artisanID uint, date time.Time, slotTime string) error {
	return m.db.Model(&domain.BookingSlot{}).
		Where("artisan_id = ? AND slot_date = ? AND slot_time = ?", artisanID, date, slotTime).
		Update("reserved", true).Error
}

func (m *mockBookingRepo) UpdateBookingStatus(ctx context.Context, id string, status string) error {
	return m.db.Model(&domain.Booking{}).Where("id = ?", id).Update("status", status).Error
}

func newTestService(t *testing.T, name string) (*gorm.DB, domain.BookingService) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}
	sqlDB, _ := db.DB()
	sqlDB.SetMaxOpenConns(1) // SQLite: serialise writers instead of "table is locked"
	if err := db.AutoMigrate(&domain.User{}, &domain.Artisan{}, &domain.BookingSlot{}, &domain.Booking{}, &domain.Wallet{}, &domain.Escrow{}, &domain.LedgerEntry{}, &domain.InfluencerReferral{}, &domain.InfluencerCommission{}, &domain.InfluencerPackage{}); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	return db, NewBookingService(&mockBookingRepo{db: db}, db, logger)
}

// everyDay opens 09:00-18:00 on all seven days so tests don't depend on
// which weekday "tomorrow" is.
func everyDay() domain.WeeklyHours {
	h := domain.WeeklyHours{}
	for wd := 0; wd <= 6; wd++ {
		h = append(h, domain.DayHours{Weekday: wd, Start: "09:00", End: "18:00"})
	}
	return h
}

func seedArtisan(t *testing.T, db *gorm.DB, email, mode string, approved bool) domain.Artisan {
	t.Helper()
	user := domain.User{ID: uuid.NewString(), Name: "Artisan " + email, Email: email, Role: "artisan", Verified: approved}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	// Seed a wallet so escrow release can credit the artisan.
	db.Create(&domain.Wallet{UserID: user.ID, Balance: 0})
	a := domain.Artisan{
		UserID: user.ID, Specialty: "Hair Stylist", Location: "Lagos", PriceFrom: 1000000,
		ServiceMode: mode, Available: true, SlotMinutes: 60, WeeklyHours: everyDay(),
		Services: domain.ServiceList{
			{Name: "Trim", DurationMins: 45, Price: 1500000},
			{Name: "Full Braiding", DurationMins: 120, Price: 4500000},
		},
	}
	if err := db.Create(&a).Error; err != nil {
		t.Fatalf("seed artisan: %v", err)
	}
	return a
}

func tomorrow() time.Time { return schedule.Today().AddDate(0, 0, 1) }

const addr = "12 Admiralty Way, Lekki"

func TestBookService_MultiSlotAndDoubleBooking(t *testing.T) {
	db, service := newTestService(t, "multi_slot")
	ctx := context.Background()
	a := seedArtisan(t, db, "chidinma@luxe.com", domain.ServiceBoth, true)
	day := tomorrow()

	// A two-hour service with one-hour slots takes 10:00 and 11:00.
	b1, err := service.BookService(ctx, "buyer-123", a.ID, "Full Braiding", day, "10:00", "home", addr)
	if err != nil {
		t.Fatalf("expected successful booking, got error: %v", err)
	}
	if b1.Status != "pending" || b1.Amount != 4500000 {
		t.Errorf("booking = %s / %d, want pending / service price 4500000", b1.Status, b1.Amount)
	}
	var reserved []domain.BookingSlot
	db.Where("artisan_id = ? AND reserved = ?", a.ID, true).Order("slot_time").Find(&reserved)
	if len(reserved) != 2 || reserved[0].SlotTime != "10:00" || reserved[1].SlotTime != "11:00" || reserved[1].BookingID != b1.ID {
		t.Fatalf("reserved slots = %+v, want 10:00 and 11:00 tied to %s", reserved, b1.ID)
	}

	// Any booking overlapping 10:00-12:00 is refused and changes nothing.
	for _, start := range []string{"10:00", "11:00", "09:00"} {
		if _, err := service.BookService(ctx, "buyer-456", a.ID, "Full Braiding", day, start, "home", addr); err != ErrSlotTaken {
			t.Errorf("overlapping booking at %s: got %v, want ErrSlotTaken", start, err)
		}
	}
	var count int64
	db.Model(&domain.BookingSlot{}).Where("artisan_id = ? AND reserved = ?", a.ID, true).Count(&count)
	if count != 2 {
		t.Errorf("a refused booking reserved slots: %d reserved, want 2", count)
	}
	// The next free run is fine; the last slot of the day can't hold two hours.
	if _, err := service.BookService(ctx, "buyer-456", a.ID, "Full Braiding", day, "12:00", "home", addr); err != nil {
		t.Errorf("booking at 12:00: %v", err)
	}
	if _, err := service.BookService(ctx, "buyer-789", a.ID, "Full Braiding", day, "17:00", "home", addr); err != ErrSlotTaken {
		t.Errorf("two-hour booking at 17:00 with hours ending 18:00: got %v", err)
	}

	avail, err := service.Availability(ctx, a.ID, "Full Braiding", 2)
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range avail {
		if d.Date != day.Format("2006-01-02") {
			continue
		}
		for _, tm := range d.Times {
			if tm == "09:00" || tm == "10:00" || tm == "11:00" || tm == "12:00" || tm == "13:00" || tm == "17:00" {
				t.Errorf("availability offers %s, which overlaps a booking or runs past closing", tm)
			}
		}
	}
}

func TestBookService_ConcurrencyDoubleBooking(t *testing.T) {
	db, service := newTestService(t, "concurrency")
	a := seedArtisan(t, db, "chidinma.concurrent@luxe.com", domain.ServiceBoth, true)
	day := tomorrow()
	if err := schedule.Ensure(context.Background(), db, &a); err != nil {
		t.Fatal(err)
	}

	const goroutines = 10
	var wg sync.WaitGroup
	wg.Add(goroutines)
	successCount, failCount := 0, 0
	var mu sync.Mutex
	for i := 0; i < goroutines; i++ {
		go func(buyerID string) {
			defer wg.Done()
			_, err := service.BookService(context.Background(), buyerID, a.ID, "Trim", day, "14:00", "home", addr)
			mu.Lock()
			defer mu.Unlock()
			if err == nil {
				successCount++
			} else {
				failCount++
			}
		}(string(rune('A' + i)))
	}
	wg.Wait()

	if successCount != 1 || failCount != goroutines-1 {
		t.Errorf("successes = %d, failures = %d; want 1 and %d", successCount, failCount, goroutines-1)
	}
	var count int64
	db.Model(&domain.Booking{}).Where("artisan_id = ? AND booking_time = ?", a.ID, "14:00").Count(&count)
	if count != 1 {
		t.Errorf("expected exactly 1 booking record in db, got %d", count)
	}
}

func TestBookService_ApprovalServiceAndDateRules(t *testing.T) {
	db, service := newTestService(t, "rules")
	ctx := context.Background()
	pending := seedArtisan(t, db, "pending@luxe.com", domain.ServiceBoth, false)
	approved := seedArtisan(t, db, "approved@luxe.com", domain.ServiceBoth, true)

	if _, err := service.BookService(ctx, "b", pending.ID, "Trim", tomorrow(), "10:00", "studio", ""); err != ErrArtisanNotFound {
		t.Errorf("booking an unapproved artisan: got %v, want ErrArtisanNotFound", err)
	}
	if _, err := service.GetArtisanProfile(ctx, pending.ID); err == nil {
		t.Error("an unapproved artisan's public profile is visible")
	}
	if _, err := service.Availability(ctx, pending.ID, "Trim", 7); err != ErrArtisanNotFound {
		t.Errorf("availability for an unapproved artisan: got %v", err)
	}
	list, err := service.ListArtisans(ctx, "", "")
	if err != nil || len(list) != 1 || list[0].ID != approved.ID {
		t.Fatalf("public list = %d artisans (%v), want only the approved one", len(list), err)
	}
	if list[0].User.Email != "" || list[0].User.Phone != "" {
		t.Error("public artisan list exposes the account's email or phone")
	}
	profile, err := service.GetArtisanProfile(ctx, approved.ID)
	if err != nil || profile.User.Email != "" || profile.User.Name == "" {
		t.Errorf("public profile: err=%v email=%q name=%q; want name only", err, profile.User.Email, profile.User.Name)
	}

	if _, err := service.BookService(ctx, "b", approved.ID, "Not On Menu", tomorrow(), "10:00", "studio", ""); err != ErrServiceNotFound {
		t.Errorf("unknown service: got %v, want ErrServiceNotFound", err)
	}
	yesterday := schedule.Today().AddDate(0, 0, -1)
	if _, err := service.BookService(ctx, "b", approved.ID, "Trim", yesterday, "10:00", "studio", ""); err != ErrDateInPast {
		t.Errorf("past date: got %v, want ErrDateInPast", err)
	}
	beyond := schedule.Today().AddDate(0, 0, schedule.WindowDays+5)
	if _, err := service.BookService(ctx, "b", approved.ID, "Trim", beyond, "10:00", "studio", ""); err != ErrSlotTaken {
		t.Errorf("date beyond the booking window: got %v, want ErrSlotTaken", err)
	}
}

func TestBookService_VisitTypeAndConfirmOwnership(t *testing.T) {
	db, service := newTestService(t, "visit_rules")
	ctx := context.Background()
	studioOnly := seedArtisan(t, db, "owner@luxe.com", domain.ServiceStudio, true)
	// Seed a wallet for the test buyer so HoldBooking can debit it on confirm.
	db.Create(&domain.Wallet{UserID: "buyer-1", Balance: 10_000_000})
	day := tomorrow()

	if _, err := service.BookService(ctx, "buyer-1", studioOnly.ID, "Trim", day, "09:00", "home", addr); err != ErrVisitUnavailable {
		t.Fatalf("home visit with studio-only artisan: got %v", err)
	}
	var reserved int64
	db.Model(&domain.BookingSlot{}).Where("artisan_id = ? AND reserved = ?", studioOnly.ID, true).Count(&reserved)
	if reserved != 0 {
		t.Fatal("a rejected booking must not reserve the slot")
	}

	mobile := seedArtisan(t, db, "mobile@luxe.com", domain.ServiceHome, true)
	if _, err := service.BookService(ctx, "buyer-1", mobile.ID, "Trim", day, "11:00", "home", ""); err != ErrAddressRequired {
		t.Fatalf("home visit without address: got %v", err)
	}
	b, err := service.BookService(ctx, "buyer-1", mobile.ID, "Trim", day, "11:00", "home", "4 Bourdillon Road, Ikoyi")
	if err != nil {
		t.Fatalf("valid home booking: %v", err)
	}

	if _, err := service.ConfirmBooking(ctx, b.ID, studioOnly.UserID, false); err != ErrNotYourBooking {
		t.Fatalf("another artisan confirmed the booking: %v", err)
	}
	confirmed, err := service.ConfirmBooking(ctx, b.ID, mobile.UserID, false)
	if err != nil || confirmed.Status != "confirmed" {
		t.Fatalf("owner confirm: %v", err)
	}
}

func TestOnboarding_RoleChangeNeedsApprovalAndAdminsStay(t *testing.T) {
	db, service := newTestService(t, "onboarding")
	ctx := context.Background()

	seller := domain.User{ID: uuid.NewString(), Name: "Approved Seller", Email: "s@luxe.com", Role: "seller", Verified: true, KYCStatus: "verified"}
	admin := domain.User{ID: uuid.NewString(), Name: "Admin", Email: "a@luxe.com", Role: "admin", Verified: true}
	db.Create(&seller)
	db.Create(&admin)

	// Re-submitting the same role keeps the approval.
	if err := service.OnboardSeller(ctx, seller.ID, "RC123"); err != nil {
		t.Fatal(err)
	}
	var u domain.User
	db.First(&u, "id = ?", seller.ID)
	if !u.Verified || u.CACNumber != "RC123" {
		t.Errorf("same-role resubmission: verified=%v cac=%q", u.Verified, u.CACNumber)
	}

	// Switching to artisan goes back to the approval queue.
	profile := &domain.Artisan{Specialty: "Nails", Studio: "Nail Bar", PriceFrom: 100000, Location: "Lagos", ServiceMode: domain.ServiceStudio}
	if _, err := service.OnboardArtisan(ctx, seller.ID, profile); err != nil {
		t.Fatal(err)
	}
	u = domain.User{}
	db.First(&u, "id = ?", seller.ID)
	if u.Role != "artisan" || u.Verified || u.KYCStatus != "pending" {
		t.Errorf("seller to artisan: role=%s verified=%v kyc=%s; want artisan, unapproved, pending", u.Role, u.Verified, u.KYCStatus)
	}

	if err := service.OnboardSeller(ctx, admin.ID, "RC1"); err != ErrRoleChangeNotAllowed {
		t.Errorf("admin seller onboarding: got %v", err)
	}
	if _, err := service.OnboardArtisan(ctx, admin.ID, &domain.Artisan{Specialty: "x", Studio: "x", Location: "x", ServiceMode: domain.ServiceStudio}); err != ErrRoleChangeNotAllowed {
		t.Errorf("admin artisan onboarding: got %v", err)
	}
	var after domain.User
	db.First(&after, "id = ?", admin.ID)
	if after.Role != "admin" {
		t.Errorf("admin role changed to %s", after.Role)
	}
}
