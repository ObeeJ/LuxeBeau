package booking

import (
	"context"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"luxebeau/internal/domain"
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

func TestBookService_SuccessAndDoubleBooking(t *testing.T) {
	// 1. Setup SQLite in-memory DB
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(&domain.User{}, &domain.Artisan{}, &domain.BookingSlot{}, &domain.Booking{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	repo := &mockBookingRepo{db: db}
	service := NewBookingService(repo, db, logger)

	// 2. Seed User
	user := domain.User{
		ID:    uuid.NewString(),
		Name:  "Chidinma Obi",
		Email: "chidinma@luxe.com",
		Role:  "artisan",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}

	// 3. Seed Artisan
	artisan := domain.Artisan{
		UserID:    user.ID,
		Specialty: "Hair Stylist",
		Location:  "Lagos",
		PriceFrom: 2500000, // ₦25,000
	}
	if err := db.Create(&artisan).Error; err != nil {
		t.Fatalf("failed to seed artisan: %v", err)
	}

	slotDate := time.Now().Truncate(24 * time.Hour)
	slotTime := "10:00"

	// 4. Seed Booking Slot
	slot := domain.BookingSlot{
		ArtisanID: artisan.ID,
		SlotDate:  slotDate,
		SlotTime:  slotTime,
		Reserved:  false,
	}
	if err := db.Create(&slot).Error; err != nil {
		t.Fatalf("failed to seed slot: %v", err)
	}

	// 5. Perform successful booking
	b1, err := service.BookService(context.Background(), "buyer-123", artisan.ID, "Full Braiding", slotDate, slotTime, "home")
	if err != nil {
		t.Fatalf("expected successful booking, got error: %v", err)
	}

	if b1.Status != "pending" {
		t.Errorf("expected booking status to be pending, got %s", b1.Status)
	}

	// Verify slot is now reserved in database
	var updatedSlot domain.BookingSlot
	db.First(&updatedSlot, "artisan_id = ? AND slot_date = ? AND slot_time = ?", artisan.ID, slotDate, slotTime)
	if !updatedSlot.Reserved {
		t.Errorf("expected slot to be marked as reserved")
	}

	// 6. Try to book the exact same slot again (should fail)
	_, err = service.BookService(context.Background(), "buyer-456", artisan.ID, "Wash & Set", slotDate, slotTime, "home")
	if err == nil {
		t.Errorf("expected error when booking already reserved slot, got nil")
	} else if err.Error() != "slot is no longer available" {
		t.Errorf("expected 'slot is no longer available' error, got: %v", err)
	}
}

func TestBookService_ConcurrencyDoubleBooking(t *testing.T) {
	// 1. Setup SQLite in-memory DB
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to connect database: %v", err)
	}

	err = db.AutoMigrate(&domain.User{}, &domain.Artisan{}, &domain.BookingSlot{}, &domain.Booking{})
	if err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelError}))
	repo := &mockBookingRepo{db: db}
	service := NewBookingService(repo, db, logger)

	// 2. Seed User
	user := domain.User{
		ID:    uuid.NewString(),
		Name:  "Chidinma Obi",
		Email: "chidinma.concurrent@luxe.com",
		Role:  "artisan",
	}
	db.Create(&user)

	// 3. Seed Artisan
	artisan := domain.Artisan{
		UserID:    user.ID,
		Specialty: "Hair Stylist",
		Location:  "Lagos",
		PriceFrom: 2500000,
	}
	db.Create(&artisan)

	slotDate := time.Now().Truncate(24 * time.Hour)
	slotTime := "14:00"

	// 4. Seed Booking Slot
	slot := domain.BookingSlot{
		ArtisanID: artisan.ID,
		SlotDate:  slotDate,
		SlotTime:  slotTime,
		Reserved:  false,
	}
	db.Create(&slot)

	// 5. Concurrent booking attempts
	const goroutines = 10
	var wg sync.WaitGroup
	wg.Add(goroutines)

	successCount := 0
	failCount := 0
	var mu sync.Mutex

	for i := 0; i < goroutines; i++ {
		go func(buyerID string) {
			defer wg.Done()
			_, err := service.BookService(context.Background(), buyerID, artisan.ID, "Pedicure", slotDate, slotTime, "home")
			
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

	if successCount != 1 {
		t.Errorf("expected exactly 1 success, got %d", successCount)
	}
	if failCount != goroutines-1 {
		t.Errorf("expected %d failures, got %d", goroutines-1, failCount)
	}

	// Double check database has only 1 booking record for this slot
	var count int64
	db.Model(&domain.Booking{}).Where("artisan_id = ? AND booking_date = ? AND booking_time = ?", artisan.ID, slotDate, slotTime).Count(&count)
	if count != 1 {
		t.Errorf("expected exactly 1 booking record in db, got %d", count)
	}
}
