package main

import (
	"log/slog"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"luxebeau/internal/domain"
)

func seedDatabase(db *gorm.DB, logger *slog.Logger) {
	var artisanCount int64
	db.Model(&domain.Artisan{}).Count(&artisanCount)
	if artisanCount > 0 {
		logger.Info("Database already seeded with artisans")
		return
	}

	logger.Info("Seeding database with default mock data...")

	// 1. Create a default hashed password for simplicity
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("password123"), 12)
	if err != nil {
		logger.Error("Failed to hash default password", slog.Any("error", err))
		return
	}

	// 2. Mock Artisan users
	artisanUsers := []struct {
		ID    string
		Name  string
		Email string
		Phone string
	}{
		{"b7c84439-d3e9-4e78-9e58-f542c332ea71", "Amaka Eze", "amaka@luxebeau.com", "08031234561"},
		{"b7c84439-d3e9-4e78-9e58-f542c332ea72", "Tolu Bankole", "tolu@luxebeau.com", "08031234562"},
		{"b7c84439-d3e9-4e78-9e58-f542c332ea73", "Chiamaka Obi", "chiamaka@luxebeau.com", "08031234563"},
		{"b7c84439-d3e9-4e78-9e58-f542c332ea74", "Ibrahim Suleiman", "ibrahim@luxebeau.com", "08031234564"},
		{"b7c84439-d3e9-4e78-9e58-f542c332ea75", "Yemisi Adeleke", "yemisi@luxebeau.com", "08031234565"},
		{"b7c84439-d3e9-4e78-9e58-f542c332ea76", "Ngozi Okafor", "ngozi@luxebeau.com", "08031234566"},
	}

	for _, u := range artisanUsers {
		user := domain.User{
			ID:           u.ID,
			Name:         u.Name,
			Email:        u.Email,
			PasswordHash: string(hashedPassword),
			Phone:        u.Phone,
			Role:         "artisan",
		}
		if err := db.FirstOrCreate(&user, domain.User{Email: u.Email}).Error; err != nil {
			logger.Error("Failed to seed user", slog.String("email", u.Email), slog.Any("error", err))
			return
		}
		
		// Create wallet for artisan
		wallet := domain.Wallet{
			UserID:  user.ID,
			Balance: 0,
		}
		db.FirstOrCreate(&wallet, domain.Wallet{UserID: user.ID})
	}

	// 3. Mock Artisans
	artisans := []struct {
		ID         uint
		UserID     string
		Specialty  string
		PriceFrom  int64
		Location   string
		Experience string
		Available  bool
		BgColor    string
		Bio        string
	}{
		{1, "b7c84439-d3e9-4e78-9e58-f542c332ea71", "Braids & Protective Styling", 2500000, "Lagos", "10 years", true, "#3b2456", "Ten years perfecting tension-free knotless braids and bohemian twists. Amaka's chair has a six-week waitlist in bridal season, book early."},
		{2, "b7c84439-d3e9-4e78-9e58-f542c332ea72", "Gele & Bridal Styling", 2000000, "Lagos", "8 years", true, "#4d3415", "Celebrity gele artist, pleats so sharp they trend on their own. Tolu styles brides, mothers-of-the-day and full aṣọ ebí trains on location."},
		{3, "b7c84439-d3e9-4e78-9e58-f542c332ea73", "Makeup Artistry", 3500000, "Abuja", "5 years", true, "#5b2a52", "Editorial-trained MUA specialising in melanin-first colour theory. Soft glam that photographs flawlessly from civil ceremony to after-party."},
		{4, "b7c84439-d3e9-4e78-9e58-f542c332ea74", "Barbering & Grooming", 800000, "Abuja", "7 years", true, "#1f3a4d", "Precision fades, beard sculpting and royal hot-towel treatments. Ibrahim's lounge is where Abuja's boardrooms come to look the part."},
		{5, "b7c84439-d3e9-4e78-9e58-f542c332ea75", "Nail Artistry", 1200000, "Port Harcourt", "4 years", true, "#2f2a4d", "Sculpted gel-x, chrome french and hand-painted Ankara-inspired nail art. Hygiene-first studio with hospital-grade sterilisation."},
		{6, "b7c84439-d3e9-4e78-9e58-f542c332ea76", "Esthetics & Skin Therapy", 3000000, "Lagos", "6 years", true, "#1f4d3a", "Licensed esthetician treating hyperpigmentation, texture and acne on deep skin tones, no bleaching, ever. Consultation-led care plans."},
	}

	for _, a := range artisans {
		artisan := domain.Artisan{
			ID:            a.ID,
			UserID:        a.UserID,
			Specialty:     a.Specialty,
			PriceFrom:     a.PriceFrom,
			Location:      a.Location,
			Experience:    a.Experience,
			JobsCompleted: 150,
			Available:     a.Available,
			BgColor:       a.BgColor,
			Bio:           a.Bio,
		}
		if err := db.FirstOrCreate(&artisan, domain.Artisan{ID: a.ID}).Error; err != nil {
			logger.Error("Failed to seed artisan", slog.Uint64("id", uint64(a.ID)), slog.Any("error", err))
			return
		}
	}

	// 4. Seeding booking slots for the next 30 days
	timeSlots := []string{"9:00 AM", "11:00 AM", "1:00 PM", "3:00 PM", "5:00 PM"}
	startDate := time.Now().Truncate(24 * time.Hour)

	for _, artisan := range artisans {
		for d := -1; d < 30; d++ { // seed from yesterday just in case of timezone variations
			slotDate := startDate.AddDate(0, 0, d)
			for _, slotTime := range timeSlots {
				slot := domain.BookingSlot{
					ArtisanID: artisan.ID,
					SlotDate:  slotDate,
					SlotTime:  slotTime,
					Reserved:  false,
				}
				var existing domain.BookingSlot
				err := db.Where("artisan_id = ? AND slot_date = ? AND slot_time = ?", artisan.ID, slotDate, slotTime).First(&existing).Error
				if err != nil && err == gorm.ErrRecordNotFound {
					if err := db.Create(&slot).Error; err != nil {
						logger.Warn("Failed to create booking slot", slog.Uint64("artisan", uint64(artisan.ID)), slog.Any("date", slotDate), slog.String("time", slotTime), slog.Any("error", err))
					}
				}
			}
		}
	}

	// 5. Seed products matching the frontend list
	products := []struct {
		ID          uint
		Name        string
		Brand       string
		Price       int64
		Category    string
		Badge       string
		BgColor     string
		Rating      float64
		Reviews     int
	}{
		{2, "Ọsẹ Dúdú Honey Cleansing Bar", "Adunni Organics", 850000, "Skincare", "Bestseller", "#3b2456", 4.9, 412},
		{3, "Chebé Velvet Hair Butter", "Zaria Roots", 1200000, "Haircare", "Editor's pick", "#4a2c6e", 4.8, 367},
		{4, "Owambe Velvet Matte, Aṣọ Ebí Plum", "Ilé Beauty", 980000, "Makeup", "", "#5b2a52", 4.7, 289},
		{5, "Sahel Amber Oud Parfum", "Maison Kano", 3800000, "Fragrance", "Limited", "#4d3415", 4.9, 158},
		{6, "Hibiscus Glow Toning Essence", "Adunni Organics", 1150000, "Skincare", "", "#5e2440", 4.6, 233},
		{7, "Shea Silk Body Crème", "Zaria Roots", 900000, "Body", "Bestseller", "#2f2a4d", 4.8, 501},
	}

	for _, p := range products {
		prod := domain.Product{
			ID:           p.ID,
			Name:         p.Name,
			Brand:        p.Brand,
			Price:        p.Price,
			Category:     p.Category,
			Stock:        100,
			Rating:       p.Rating,
			ReviewsCount: p.Reviews,
			Badge:        p.Badge,
			BgColor:      p.BgColor,
		}
		db.FirstOrCreate(&prod, domain.Product{ID: p.ID})
	}

	logger.Info("Database seeded successfully!")
}
