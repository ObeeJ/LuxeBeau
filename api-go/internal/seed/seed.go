// Package seed loads LuxeBeau's catalogue into the database on first boot.
// It is idempotent: if products already exist it returns immediately, so it is
// safe to call on every startup. All people, studios and figures are fictional.
package seed

import (
	"log/slog"
	"os"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// naira converts a Naira amount to the Kobo integer the schema stores.
func naira(n int64) int64 { return n * 100 }

// Run seeds catalogue data if the products table is empty.
func Run(db *gorm.DB, logger *slog.Logger) error {
	var count int64
	if err := db.Model(&domain.Product{}).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		logger.Info("Seed skipped: catalogue already populated", slog.Int64("products", count))
		return nil
	}

	logger.Info("Seeding catalogue…")

	pw, err := demoPasswordHash(logger)
	if err != nil {
		return err
	}

	// ── Demo accounts (password from SEED_DEMO_PASSWORD) ─────────
	// Marked email-verified so local sign-in works without an email server.
	demoUsers := []domain.User{
		{ID: "00000000-0000-0000-0000-000000000001", Name: "Ada Demo", Email: "buyer@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08030000001", Role: "buyer"},
		{ID: "00000000-0000-0000-0000-000000000002", Name: "Adunni Organics", Email: "seller@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08030000002", Role: "seller", Verified: true},
		{ID: "00000000-0000-0000-0000-000000000003", Name: "LuxeBeau Admin", Email: "admin@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08030000003", Role: "admin"},
	}

	products := []domain.Product{
		{Slug: "ose-dudu-honey-cleansing-bar", Name: "Ọsẹ Dúdú Honey Cleansing Bar", Brand: "Adunni Organics", Price: naira(8500), Category: "Skincare", Stock: 120, Rating: 4.9, ReviewsCount: 412, Badge: "Bestseller", Blurb: "Raw African black soap whipped with Ijebu wild honey and shea.", Details: domain.StringArray{"Cold-processed in small batches in Ibadan", "Balances oily and combination skin without stripping", "Free of sulphates, parabens and synthetic fragrance"}, BgColor: "#3b2456", FgColor: "#6d3fb8"},
		{Slug: "chebe-velvet-hair-butter", Name: "Chebé Velvet Hair Butter", Brand: "Zaria Roots", Price: naira(12000), Category: "Haircare", Stock: 80, Rating: 4.8, ReviewsCount: 367, Badge: "Editor's pick", Blurb: "Chadian chebé powder folded into unrefined Kebbi shea for 4C retention.", Details: domain.StringArray{"Seals moisture for protective styles and knotless braids", "Softens without buildup, wash-day friendly", "100% plant-derived, NAFDAC registered"}, BgColor: "#4a2c6e", FgColor: "#8254d6"},
		{Slug: "owambe-velvet-matte-lipstick", Name: "Owambe Velvet Matte, Aṣọ Ebí Plum", Brand: "Ilé Beauty", Price: naira(9800), Category: "Makeup", Stock: 200, Rating: 4.7, ReviewsCount: 289, Blurb: "A 12-hour transfer-proof plum built for long Lagos celebrations.", Details: domain.StringArray{"Pigment tested across deep and tan undertones", "Vitamin E core keeps lips supple under matte finish", "Survives jollof, small chops and the dance floor"}, BgColor: "#5b2a52", FgColor: "#9b4d8f"},
		{Slug: "sahel-amber-oud-parfum", Name: "Sahel Amber Oud Parfum", Brand: "Maison Kano", Price: naira(38000), Category: "Fragrance", Stock: 40, Rating: 4.9, ReviewsCount: 158, Badge: "Limited", Blurb: "Smoky oud, ambergris and frankincense, a northern evening in a bottle.", Details: domain.StringArray{"Extrait de parfum, 18% concentration", "8 to 10 hour longevity in humid climates", "Unisex profile, hand-filled 50ml flacon"}, BgColor: "#4d3415", FgColor: "#b8924e"},
		{Slug: "hibiscus-glow-toner", Name: "Hibiscus Glow Toning Essence", Brand: "Adunni Organics", Price: naira(11500), Category: "Skincare", Stock: 95, Rating: 4.6, ReviewsCount: 233, Blurb: "Zobo-petal AHAs gently resurface for an even, lit-from-within glow.", Details: domain.StringArray{"Fades post-acne marks on melanin-rich skin", "pH-balanced at 4.2, no sting, no tightness", "Pairs with SPF; not photo-sensitising at 4% AHA"}, BgColor: "#5e2440", FgColor: "#c05a85"},
		{Slug: "shea-silk-body-creme", Name: "Shea Silk Body Crème", Brand: "Zaria Roots", Price: naira(9000), Category: "Body", Stock: 150, Rating: 4.8, ReviewsCount: 501, Badge: "Bestseller", Blurb: "Triple-whipped Kebbi shea with baobab oil, harmattan armour.", Details: domain.StringArray{"72-hour barrier hydration, zero greasy film", "Scented with a soft lavender-iroko accord", "Family-safe from 3 years and up"}, BgColor: "#2f2a4d", FgColor: "#7a6fb8"},
	}

	// ── Artisans (each backed by a user account) ────────────────
	type artisanSeed struct {
		user    domain.User
		artisan domain.Artisan
	}
	artisanSeeds := []artisanSeed{
		{
			user: domain.User{ID: "10000000-0000-0000-0000-000000000001", Name: "Amaka Eze", Email: "amaka@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08031000001", Role: "artisan", Verified: true},
			artisan: domain.Artisan{UserID: "10000000-0000-0000-0000-000000000001", Slug: "amaka-eze", ServiceMode: "both", Specialty: "Braids & Protective Styling", Craft: "Braids & Protective Styling", Studio: "The Braid Atelier", PriceFrom: naira(25000), Location: "Lekki Phase 1, Lagos", City: "Lagos", Area: "Lekki Phase 1", Experience: "10 years", Rating: 4.9, JobsCompleted: 1240, Verified: true, Available: true, BgColor: "#3b2456", FgColor: "#8254d6", Bio: "Ten years perfecting tension-free knotless braids and bohemian twists. Amaka's chair has a six-week waitlist in bridal season, book early.", Services: domain.ServiceList{
				{Name: "Knotless Braids (Mid-back)", DurationMins: 300, Price: naira(45000), Description: "Feather-light knotless with hot-water sealing and edge styling."},
				{Name: "Bohemian Twists", DurationMins: 360, Price: naira(55000), Description: "Goddess curls woven through medium twists, lasts 6 to 8 weeks."},
				{Name: "Cornrow Crown (All-back)", DurationMins: 120, Price: naira(25000), Description: "Clean stitch cornrows, perfect under wigs or gele."},
			}},
		},
		{
			user: domain.User{ID: "10000000-0000-0000-0000-000000000002", Name: "Tolu Bankole", Email: "tolu@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08031000002", Role: "artisan", Verified: true},
			artisan: domain.Artisan{UserID: "10000000-0000-0000-0000-000000000002", Slug: "tolu-bankole", ServiceMode: "home", Specialty: "Gele & Bridal Styling", Craft: "Gele & Bridal Styling", Studio: "Gele by Tolu", PriceFrom: naira(20000), Location: "Victoria Island, Lagos", City: "Lagos", Area: "Victoria Island", Experience: "8 years", Rating: 5.0, JobsCompleted: 860, Verified: true, Available: true, BgColor: "#4d3415", FgColor: "#d4af6a", Bio: "Celebrity gele artist, pleats so sharp they trend on their own. Tolu styles brides, mothers-of-the-day and full aṣọ ebí trains on location.", Services: domain.ServiceList{
				{Name: "Signature Bridal Gele", DurationMins: 45, Price: naira(50000), Description: "Hand-pleated auto-gele or fresh tie, photographed before you leave."},
				{Name: "Owambe Guest Gele", DurationMins: 30, Price: naira(20000), Description: "Event-ready pleats for guests and aṣọ ebí groups."},
				{Name: "Group Booking (5+ heads)", DurationMins: 180, Price: naira(90000), Description: "On-location styling for your entire table. Travel within Lagos included."},
			}},
		},
		{
			user: domain.User{ID: "10000000-0000-0000-0000-000000000003", Name: "Chiamaka Obi", Email: "chiamaka@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08031000003", Role: "artisan", Verified: true},
			artisan: domain.Artisan{UserID: "10000000-0000-0000-0000-000000000003", Slug: "chiamaka-obi", ServiceMode: "both", Specialty: "Makeup Artistry", Craft: "Makeup Artistry", Studio: "Glow Theory Studio", PriceFrom: naira(35000), Location: "Maitama, Abuja", City: "Abuja", Area: "Maitama", Experience: "7 years", Rating: 4.8, JobsCompleted: 975, Verified: true, Available: true, BgColor: "#5b2a52", FgColor: "#c05a85", Bio: "Editorial-trained MUA specialising in melanin-first colour theory. Soft glam that photographs flawlessly from civil ceremony to after-party.", Services: domain.ServiceList{
				{Name: "Bridal Soft Glam", DurationMins: 120, Price: naira(85000), Description: "Trial session included. Long-wear base built for tears of joy."},
				{Name: "Owambe Glam", DurationMins: 75, Price: naira(35000), Description: "Full beat with lashes, survives heat, sweat and second servings."},
				{Name: "Editorial / Shoot Makeup", DurationMins: 90, Price: naira(60000), Description: "Camera-calibrated looks for brands, lookbooks and content days."},
			}},
		},
		{
			user: domain.User{ID: "10000000-0000-0000-0000-000000000004", Name: "Ibrahim Suleiman", Email: "ibrahim@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08031000004", Role: "artisan", Verified: true},
			artisan: domain.Artisan{UserID: "10000000-0000-0000-0000-000000000004", Slug: "ibrahim-suleiman", ServiceMode: "studio", Specialty: "Barbering & Grooming", Craft: "Barbering & Grooming", Studio: "Suleiman Grooming Co.", PriceFrom: naira(8000), Location: "Wuse 2, Abuja", City: "Abuja", Area: "Wuse 2", Experience: "12 years", Rating: 4.9, JobsCompleted: 2100, Verified: true, Available: true, BgColor: "#1f3a4d", FgColor: "#4a8db8", Bio: "Precision fades, beard sculpting and royal hot-towel treatments. Ibrahim's lounge is where Abuja's boardrooms come to look the part.", Services: domain.ServiceList{
				{Name: "Executive Fade + Beard Sculpt", DurationMins: 60, Price: naira(15000), Description: "Skin fade, beard line-up, hot towel and scalp massage."},
				{Name: "Classic Cut", DurationMins: 40, Price: naira(8000), Description: "Sharp, clean cut with enhancements on request."},
				{Name: "Groom's Day Package", DurationMins: 120, Price: naira(40000), Description: "Cut, facial, manicure and steam, walk in calm, walk out king."},
			}},
		},
		{
			user: domain.User{ID: "10000000-0000-0000-0000-000000000005", Name: "Yemisi Adeleke", Email: "yemisi@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08031000005", Role: "artisan", Verified: true},
			artisan: domain.Artisan{UserID: "10000000-0000-0000-0000-000000000005", Slug: "yemisi-adeleke", ServiceMode: "studio", Specialty: "Nail Artistry", Craft: "Nail Artistry", Studio: "Nail Architect", PriceFrom: naira(12000), Location: "GRA Phase 2, Port Harcourt", City: "Port Harcourt", Area: "GRA Phase 2", Experience: "6 years", Rating: 4.7, JobsCompleted: 690, Verified: true, Available: true, BgColor: "#2f2a4d", FgColor: "#9b74e8", Bio: "Sculpted gel-x, chrome french and hand-painted Ankara-inspired nail art. Hygiene-first studio with hospital-grade sterilisation.", Services: domain.ServiceList{
				{Name: "Gel-X Full Set", DurationMins: 120, Price: naira(28000), Description: "Sculpted extensions with two-tone art included."},
				{Name: "Ankara Art Set", DurationMins: 150, Price: naira(35000), Description: "Hand-painted patterns inspired by your own fabric, bring a swatch."},
				{Name: "Classic Gel Manicure", DurationMins: 60, Price: naira(12000), Description: "Cuticle care, shaping and a 3-week gloss."},
			}},
		},
		{
			user: domain.User{ID: "10000000-0000-0000-0000-000000000006", Name: "Ngozi Okafor", Email: "ngozi@luxebeau.ng", PasswordHash: pw, EmailVerified: true, Phone: "08031000006", Role: "artisan", Verified: true},
			artisan: domain.Artisan{UserID: "10000000-0000-0000-0000-000000000006", Slug: "ngozi-okafor", ServiceMode: "studio", Specialty: "Esthetics & Skin Therapy", Craft: "Esthetics & Skin Therapy", Studio: "Derma Haven", PriceFrom: naira(30000), Location: "Ikeja GRA, Lagos", City: "Lagos", Area: "Ikeja GRA", Experience: "9 years", Rating: 4.8, JobsCompleted: 540, Verified: true, Available: true, BgColor: "#1f4d3a", FgColor: "#4ab88a", Bio: "Licensed esthetician treating hyperpigmentation, texture and acne on deep skin tones, no bleaching, ever. Consultation-led care plans.", Services: domain.ServiceList{
				{Name: "Signature Glow Facial", DurationMins: 90, Price: naira(45000), Description: "Enzyme resurfacing, LED therapy and lymphatic massage."},
				{Name: "Hyperpigmentation Consult + Peel", DurationMins: 75, Price: naira(55000), Description: "Melanin-safe chemical peel with a 6-week home protocol."},
				{Name: "Back Facial", DurationMins: 60, Price: naira(30000), Description: "Deep-cleansing treatment for event-ready skin."},
			}},
		},
	}

	// All seeded products belong to the demo seller account so the seller
	// dashboard has real inventory to manage out of the box.
	const demoSellerID = "00000000-0000-0000-0000-000000000002"
	for i := range products {
		products[i].SellerID = demoSellerID
	}

	return db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&demoUsers).Error; err != nil {
			return err
		}
		for _, u := range demoUsers {
			if err := tx.Create(&domain.Wallet{UserID: u.ID}).Error; err != nil {
				return err
			}
		}
		if err := tx.Create(&products).Error; err != nil {
			return err
		}

		// Demo artisans open Monday to Saturday, 09:00 to 18:00, in one-hour
		// slots; bookable times are generated on demand from these hours.
		hours := domain.WeeklyHours{}
		for wd := 1; wd <= 6; wd++ {
			hours = append(hours, domain.DayHours{Weekday: wd, Start: "09:00", End: "18:00"})
		}

		for i := range artisanSeeds {
			if err := tx.Create(&artisanSeeds[i].user).Error; err != nil {
				return err
			}
			if err := tx.Create(&domain.Wallet{UserID: artisanSeeds[i].user.ID}).Error; err != nil {
				return err
			}
			artisanSeeds[i].artisan.WeeklyHours = hours
			artisanSeeds[i].artisan.SlotMinutes = 60
			if err := tx.Create(&artisanSeeds[i].artisan).Error; err != nil {
				return err
			}
		}

		logger.Info("Seed complete", slog.Int("products", len(products)), slog.Int("artisans", len(artisanSeeds)))
		return nil
	})
}

// MinDemoPasswordLen is the shortest SEED_DEMO_PASSWORD accepted.
const MinDemoPasswordLen = 12

// legacyPassword is the shared password older builds gave every demo account.
const legacyPassword = "password123"

// demoUserIDs are the fixed IDs of every account this package or the old
// cmd/api seeder ever created.
var demoUserIDs = []string{
	"00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003",
	"10000000-0000-0000-0000-000000000001", "10000000-0000-0000-0000-000000000002", "10000000-0000-0000-0000-000000000003",
	"10000000-0000-0000-0000-000000000004", "10000000-0000-0000-0000-000000000005", "10000000-0000-0000-0000-000000000006",
	"b7c84439-d3e9-4e78-9e58-f542c332ea71", "b7c84439-d3e9-4e78-9e58-f542c332ea72", "b7c84439-d3e9-4e78-9e58-f542c332ea73",
	"b7c84439-d3e9-4e78-9e58-f542c332ea74", "b7c84439-d3e9-4e78-9e58-f542c332ea75", "b7c84439-d3e9-4e78-9e58-f542c332ea76",
}

// demoPasswordHash hashes SEED_DEMO_PASSWORD for the demo accounts. When it is
// unset the accounts get no password, so nobody can sign in to them with one
// (auth.Login rejects an empty hash). The password itself is never logged.
func demoPasswordHash(logger *slog.Logger) (string, error) {
	pw := os.Getenv("SEED_DEMO_PASSWORD")
	if pw == "" {
		logger.Info("Demo accounts have no password; set SEED_DEMO_PASSWORD to sign in to them")
		return "", nil
	}
	if len(pw) < MinDemoPasswordLen || pw == legacyPassword {
		logger.Warn("SEED_DEMO_PASSWORD ignored: use at least 12 characters; demo accounts have no password")
		return "", nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), 12)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

// RetireDefaultPassword replaces the old shared demo password on any demo
// account that still has it, with SEED_DEMO_PASSWORD's hash or no password.
// Accounts whose password was changed are left alone. Safe on every startup.
func RetireDefaultPassword(db *gorm.DB, logger *slog.Logger) error {
	var users []domain.User
	if err := db.Select("id", "password_hash").Where("id IN ? AND password_hash <> ?", demoUserIDs, "").Find(&users).Error; err != nil {
		return err
	}
	var stale []string
	for _, u := range users {
		if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(legacyPassword)) == nil {
			stale = append(stale, u.ID)
		}
	}
	if len(stale) == 0 {
		return nil
	}
	hash, err := demoPasswordHash(logger)
	if err != nil {
		return err
	}
	if err := db.Model(&domain.User{}).Where("id IN ?", stale).Update("password_hash", hash).Error; err != nil {
		return err
	}
	logger.Warn("Replaced the old shared demo password", slog.Int("accounts", len(stale)))
	return nil
}
