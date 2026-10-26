package schedule

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

func testDB(t *testing.T, name string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+name+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&domain.User{}, &domain.Artisan{}, &domain.BookingSlot{}); err != nil {
		t.Fatal(err)
	}
	return db
}

// freeze pins the clock to a Lagos time for the duration of a test.
func freeze(t *testing.T, at time.Time) {
	t.Helper()
	prev := now
	now = func() time.Time { return at }
	t.Cleanup(func() { now = prev })
}

func artisan(t *testing.T, db *gorm.DB, hours domain.WeeklyHours, daysOff ...string) *domain.Artisan {
	t.Helper()
	a := &domain.Artisan{UserID: uuid.NewString(), Specialty: "Nails", Location: "Lagos", PriceFrom: 1, SlotMinutes: 60, WeeklyHours: hours, DaysOff: daysOff}
	if err := db.Create(a).Error; err != nil {
		t.Fatal(err)
	}
	return a
}

func countSlots(db *gorm.DB, a *domain.Artisan, where string, args ...any) int64 {
	var n int64
	q := db.Model(&domain.BookingSlot{}).Where("artisan_id = ?", a.ID)
	if where != "" {
		q = q.Where(where, args...)
	}
	q.Count(&n)
	return n
}

func TestStartTimesAndValidateHours(t *testing.T) {
	got, err := StartTimes("09:00", "12:30", 60)
	if err != nil || len(got) != 3 || got[0] != "09:00" || got[2] != "11:00" {
		t.Fatalf("StartTimes = %v, %v; want 09:00 10:00 11:00", got, err)
	}
	ok := domain.WeeklyHours{{Weekday: 1, Start: "09:00", End: "17:00"}}
	if err := ValidateHours(ok, 30, []string{"2026-12-25"}); err != nil {
		t.Errorf("valid hours rejected: %v", err)
	}
	bad := []struct {
		name  string
		hours domain.WeeklyHours
		slot  int
		off   []string
	}{
		{"odd slot length", ok, 50, nil},
		{"closes before opening", domain.WeeklyHours{{Weekday: 1, Start: "17:00", End: "09:00"}}, 60, nil},
		{"window shorter than one slot", domain.WeeklyHours{{Weekday: 1, Start: "09:00", End: "09:30"}}, 60, nil},
		{"weekday twice", domain.WeeklyHours{{Weekday: 1, Start: "09:00", End: "12:00"}, {Weekday: 1, Start: "13:00", End: "17:00"}}, 60, nil},
		{"weekday out of range", domain.WeeklyHours{{Weekday: 7, Start: "09:00", End: "12:00"}}, 60, nil},
		{"malformed time", domain.WeeklyHours{{Weekday: 1, Start: "9am", End: "12:00"}}, 60, nil},
		{"malformed day off", ok, 60, []string{"25/12/2026"}},
	}
	for _, tc := range bad {
		if err := ValidateHours(tc.hours, tc.slot, tc.off); !errors.Is(err, ErrInvalidHours) {
			t.Errorf("%s: got %v, want ErrInvalidHours", tc.name, err)
		}
	}
}

func TestEnsureHonoursWeekdaysAndDaysOff(t *testing.T) {
	// Monday 26 Oct 2026, 08:00 in Lagos.
	freeze(t, time.Date(2026, 10, 26, 8, 0, 0, 0, lagos))
	db := testDB(t, "ensure")
	ctx := context.Background()
	a := artisan(t, db, domain.WeeklyHours{{Weekday: int(time.Monday), Start: "09:00", End: "12:00"}}, "2026-11-02")

	if err := Ensure(ctx, db, a); err != nil {
		t.Fatal(err)
	}
	// Six Mondays in the 42-day window, one of them a day off, 3 slots each.
	if n := countSlots(db, a, ""); n != 5*3 {
		t.Fatalf("slots = %d, want 15", n)
	}
	if n := countSlots(db, a, "slot_date = ?", time.Date(2026, 11, 2, 0, 0, 0, 0, time.UTC)); n != 0 {
		t.Errorf("day off has %d slots", n)
	}
	// Running again is a no-op.
	if err := Ensure(ctx, db, a); err != nil {
		t.Fatal(err)
	}
	if n := countSlots(db, a, ""); n != 15 {
		t.Errorf("second Ensure changed slot count to %d", n)
	}
}

func TestRebuildKeepsBookedAndManualSlots(t *testing.T) {
	freeze(t, time.Date(2026, 10, 26, 8, 0, 0, 0, lagos))
	db := testDB(t, "rebuild")
	ctx := context.Background()
	a := artisan(t, db, domain.WeeklyHours{{Weekday: int(time.Monday), Start: "09:00", End: "12:00"}})
	if err := Ensure(ctx, db, a); err != nil {
		t.Fatal(err)
	}
	today := Today()
	if err := db.Transaction(func(tx *gorm.DB) error { return Reserve(tx, a, today, "10:00", 60, "BK-1") }); err != nil {
		t.Fatal(err)
	}
	if _, err := AddManual(ctx, db, a, today.AddDate(0, 0, 1), "19:00"); err != nil {
		t.Fatal(err)
	}

	// Move to Tuesdays only and take today off.
	a.WeeklyHours = domain.WeeklyHours{{Weekday: int(time.Tuesday), Start: "14:00", End: "16:00"}}
	a.DaysOff = domain.StringArray{today.Format("2006-01-02")}
	if err := Rebuild(ctx, db, a); err != nil {
		t.Fatal(err)
	}
	if n := countSlots(db, a, "reserved = ? AND booking_id = ?", true, "BK-1"); n != 1 {
		t.Error("rebuild removed a booked slot")
	}
	if n := countSlots(db, a, "source = ?", domain.SlotManual); n != 1 {
		t.Error("rebuild removed a manual slot that isn't on a day off")
	}
	if n := countSlots(db, a, "reserved = ? AND source = ? AND slot_time < ?", false, domain.SlotWeekly, "14:00"); n != 0 {
		t.Errorf("%d old Monday slots survived the rebuild", n)
	}
	if n := countSlots(db, a, "slot_time = ?", "14:00"); n != 6 {
		t.Errorf("Tuesday 14:00 slots = %d, want 6", n)
	}
}

func TestLeadTimeAndManualSlots(t *testing.T) {
	// 10:30 in Lagos: 09:00-11:00 have passed or are inside the one-hour lead.
	freeze(t, time.Date(2026, 10, 26, 10, 30, 0, 0, lagos))
	db := testDB(t, "lead")
	ctx := context.Background()
	a := artisan(t, db, domain.WeeklyHours{{Weekday: int(time.Monday), Start: "09:00", End: "14:00"}})

	days, err := Availability(ctx, db, a, 60, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(days) != 1 || len(days[0].Times) != 2 || days[0].Times[0] != "12:00" {
		t.Fatalf("today's availability = %+v, want 12:00 and 13:00", days)
	}
	today := Today()
	if err := db.Transaction(func(tx *gorm.DB) error { return Reserve(tx, a, today, "11:00", 60, "BK-x") }); !errors.Is(err, ErrSlotTaken) {
		t.Errorf("booking inside the lead time: got %v", err)
	}

	if _, err := AddManual(ctx, db, a, today, "09:30"); !errors.Is(err, ErrInvalidSlot) {
		t.Errorf("manual slot in the past: got %v", err)
	}
	if _, err := AddManual(ctx, db, a, today, "12:00"); !errors.Is(err, ErrInvalidSlot) {
		t.Errorf("duplicate manual slot: got %v", err)
	}
	slot, err := AddManual(ctx, db, a, today, "18:00")
	if err != nil {
		t.Fatal(err)
	}
	if err := RemoveFree(ctx, db, a, slot.ID); err != nil {
		t.Errorf("remove free slot: %v", err)
	}
	if err := db.Transaction(func(tx *gorm.DB) error { return Reserve(tx, a, today, "13:00", 60, "BK-y") }); err != nil {
		t.Fatal(err)
	}
	var booked domain.BookingSlot
	db.Where("artisan_id = ? AND booking_id = ?", a.ID, "BK-y").First(&booked)
	if err := RemoveFree(ctx, db, a, booked.ID); !errors.Is(err, ErrInvalidSlot) {
		t.Errorf("removing a booked slot: got %v", err)
	}
	other := artisan(t, db, nil)
	var free domain.BookingSlot
	db.Where("artisan_id = ? AND reserved = ?", a.ID, false).First(&free)
	if err := RemoveFree(ctx, db, other, free.ID); !errors.Is(err, ErrInvalidSlot) {
		t.Errorf("removing another artisan's slot: got %v", err)
	}
}

func TestUpcomingHidesPastFreeTimes(t *testing.T) {
	freeze(t, time.Date(2026, 10, 26, 12, 30, 0, 0, lagos))
	db := testDB(t, "upcoming")
	ctx := context.Background()
	a := artisan(t, db, domain.WeeklyHours{{Weekday: int(time.Monday), Start: "09:00", End: "15:00"}})
	if err := Ensure(ctx, db, a); err != nil {
		t.Fatal(err)
	}
	db.Model(&domain.BookingSlot{}).Where("artisan_id = ? AND slot_time = ?", a.ID, "10:00").Update("reserved", true)
	slots, err := Upcoming(ctx, db, a, 1)
	if err != nil {
		t.Fatal(err)
	}
	var got []string
	for _, s := range slots {
		got = append(got, s.SlotTime)
	}
	// 10:00 is booked so it stays; free times before 12:30 are gone.
	want := []string{"10:00", "13:00", "14:00"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] || got[2] != want[2] {
		t.Errorf("today's studio times = %v, want %v", got, want)
	}
}
