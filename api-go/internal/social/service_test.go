package social

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"luxebeau/internal/domain"
)

const (
	ada  = "00000000-0000-0000-0000-0000000000a1"
	bayo = "00000000-0000-0000-0000-0000000000a2"
)

// openTestDB is an in-memory SQLite by default. With TEST_PG_DSN set it uses a
// real PostgreSQL instead (tables are dropped first), so the partial unique index
// on handles is checked on the production database engine.
func openTestDB(t *testing.T, sqliteName string) *gorm.DB {
	t.Helper()
	if dsn := os.Getenv("TEST_PG_DSN"); dsn != "" {
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard})
		if err != nil {
			t.Fatal(err)
		}
		_ = db.Migrator().DropTable(&domain.UserProfile{}, &domain.Review{}, &domain.Booking{}, &domain.Artisan{}, &domain.OrderItem{}, &domain.Order{}, &domain.Escrow{}, &domain.Product{}, &domain.User{})
		return db
	}
	db, err := gorm.Open(sqlite.Open(sqliteName), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func newSvc(t *testing.T) (*Service, *gorm.DB) {
	t.Helper()
	name := "file:social_" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db := openTestDB(t, name)
	if err := db.AutoMigrate(&domain.User{}, &domain.UserProfile{}, &domain.Review{}, &domain.Order{}, &domain.Booking{}); err != nil {
		t.Fatal(err)
	}
	db.Create(&domain.User{ID: ada, Name: "Ada Obi", Email: "ada@test.ng", Role: "buyer"})
	db.Create(&domain.User{ID: bayo, Name: "Bayo K", Email: "bayo@test.ng", Role: "buyer"})
	return NewService(db), db
}

// Two people who save a bio but have not picked a handle must both succeed.
func TestUpsert_ManyPeopleCanHaveNoHandle(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	if _, err := s.Upsert(ctx, ada, UpdateInput{Bio: "hello"}); err != nil {
		t.Fatalf("first user: %v", err)
	}
	if _, err := s.Upsert(ctx, bayo, UpdateInput{Bio: "hi there"}); err != nil {
		t.Fatalf("second user with no handle: %v (an empty handle is not a taken handle)", err)
	}
	// Saving again, and clearing a handle, also work.
	if _, err := s.Upsert(ctx, ada, UpdateInput{Bio: "updated", SocialHandle: "ada_o"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Upsert(ctx, ada, UpdateInput{Bio: "no handle now"}); err != nil {
		t.Fatalf("clearing a handle: %v", err)
	}
}

func TestUpsert_HandlesAreUniqueIgnoringCase(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	if _, err := s.Upsert(ctx, ada, UpdateInput{SocialHandle: "Ada_O"}); err != nil {
		t.Fatal(err)
	}
	p, _ := s.GetByUserID(ctx, ada)
	if p == nil || p.SocialHandle != "ada_o" {
		t.Fatalf("handle stored as %+v, want lowercase ada_o", p)
	}
	if _, err := s.Upsert(ctx, bayo, UpdateInput{SocialHandle: "ADA_O"}); !errors.Is(err, ErrHandleTaken) {
		t.Errorf("err = %v, want ErrHandleTaken", err)
	}
	// Keeping your own handle is not a clash.
	if _, err := s.Upsert(ctx, ada, UpdateInput{SocialHandle: "ada_o", Bio: "same handle"}); err != nil {
		t.Errorf("re-saving your own handle: %v", err)
	}
}

func TestUpsert_RejectsBadInput(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	for name, in := range map[string]UpdateInput{
		"handle too short":   {SocialHandle: "ab"},
		"handle with spaces": {SocialHandle: "a b c"},
		"handle with symbol": {SocialHandle: "ada!"},
	} {
		if _, err := s.Upsert(ctx, ada, in); !errors.Is(err, ErrHandleInvalid) {
			t.Errorf("%s: err = %v, want ErrHandleInvalid", name, err)
		}
	}
	if _, err := s.Upsert(ctx, ada, UpdateInput{Bio: strings.Repeat("a", 301)}); err == nil {
		t.Error("a 301-character bio must be rejected")
	}
	// Links must be https: a javascript: or data: link is an attack, not a website.
	for name, in := range map[string]UpdateInput{
		"javascript website": {Website: "javascript:alert(1)"},
		"data website":       {Website: "data:text/html,<script>alert(1)</script>"},
		"http website":       {Website: "http://example.com"},
		"javascript avatar":  {AvatarURL: "javascript:alert(1)"},
		"relative avatar":    {AvatarURL: "/etc/passwd"},
		"website too long":   {Website: "https://example.com/" + strings.Repeat("a", 200)},
	} {
		if _, err := s.Upsert(ctx, ada, in); !errors.Is(err, ErrURLInvalid) {
			t.Errorf("%s: err = %v, want ErrURLInvalid", name, err)
		}
	}
	if _, err := s.Upsert(ctx, ada, UpdateInput{Website: "https://ada.example.com/shop", AvatarURL: "https://imagedelivery.net/x/y/public"}); err != nil {
		t.Errorf("valid https links should be accepted: %v", err)
	}
}

// A public page must not reveal what someone has bought or booked.
func TestGetPublic_DoesNotExposePrivateActivity(t *testing.T) {
	s, db := newSvc(t)
	ctx := context.Background()
	if _, err := s.Upsert(ctx, ada, UpdateInput{SocialHandle: "ada_o", Bio: "skincare fan"}); err != nil {
		t.Fatal(err)
	}
	db.Omit("Buyer").Create(&domain.Order{ID: "LB-1", BuyerID: ada, Subtotal: 1, Total: 1})
	db.Omit("Buyer", "Artisan").Create(&domain.Booking{ID: "BK-1", BuyerID: ada, ArtisanID: 1, ServiceName: "x", BookingDate: time.Now(), BookingTime: "10:00", ServiceType: "studio", Amount: 1})
	db.Create(&domain.Review{ReviewerID: ada, TargetType: "product", TargetID: "1", Rating: 5, Status: "visible"})
	db.Create(&domain.Review{ReviewerID: ada, TargetType: "product", TargetID: "2", Rating: 1, Status: "hidden"})

	p, err := s.GetPublic(ctx, "Ada_O")
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(p)
	out := string(raw)
	for _, banned := range []string{"orders", "bookings", "email", "phone"} {
		if strings.Contains(out, `"`+banned+`"`) {
			t.Errorf("public profile exposes %q: %s", banned, out)
		}
	}
	if p.Stats.Reviews != 1 {
		t.Errorf("reviews = %d, want 1 (only the visible review counts)", p.Stats.Reviews)
	}
	if p.Name != "Ada Obi" || p.Bio != "skincare fan" || p.SocialHandle != "ada_o" {
		t.Errorf("profile = %+v", p)
	}
}

func TestGetPublic_FindsByHandleOrUserIDAndReportsMissing(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	s.Upsert(ctx, ada, UpdateInput{SocialHandle: "ada_o"})
	if p, err := s.GetPublic(ctx, "ada_o"); err != nil || p.UserID != ada {
		t.Errorf("by handle: %+v, %v", p, err)
	}
	if p, err := s.GetPublic(ctx, ada); err != nil || p.UserID != ada {
		t.Errorf("by user id: %+v, %v", p, err)
	}
	if _, err := s.GetPublic(ctx, "nobody_here"); !errors.Is(err, ErrNotFound) {
		t.Errorf("err = %v, want ErrNotFound", err)
	}
}
