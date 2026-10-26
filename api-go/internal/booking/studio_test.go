package booking

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"testing"

	"luxebeau/internal/domain"
	"luxebeau/internal/schedule"
)

func TestValidServices(t *testing.T) {
	list, err := validServices([]ServiceInput{{Name: "  Knotless braids ", DurationMins: 240, Price: 45000}})
	if err != nil || list[0].Name != "Knotless braids" || list[0].Price != 4500000 {
		t.Fatalf("valid service: %+v, %v (want trimmed name, price in kobo)", list, err)
	}
	many := make([]ServiceInput, maxServices+1)
	for i := range many {
		many[i] = ServiceInput{Name: strings.Repeat("x", i+1), DurationMins: 60, Price: 1}
	}
	bad := map[string][]ServiceInput{
		"empty list":       nil,
		"too many":         many,
		"blank name":       {{Name: " ", DurationMins: 60, Price: 1}},
		"duplicate name":   {{Name: "Trim", DurationMins: 60, Price: 1}, {Name: "trim", DurationMins: 30, Price: 1}},
		"zero price":       {{Name: "Trim", DurationMins: 60, Price: 0}},
		"negative price":   {{Name: "Trim", DurationMins: 60, Price: -5}},
		"odd duration":     {{Name: "Trim", DurationMins: 50, Price: 1}},
		"too long":         {{Name: "Trim", DurationMins: 735, Price: 1}},
		"long description": {{Name: "Trim", DurationMins: 60, Price: 1, Description: strings.Repeat("d", 301)}},
	}
	for name, in := range bad {
		if _, err := validServices(in); !errors.Is(err, ErrInvalidServices) {
			t.Errorf("%s: got %v, want ErrInvalidServices", name, err)
		}
	}
}

func TestStudio_ScheduleAndServicesOwnProfileOnly(t *testing.T) {
	db, service := newTestService(t, "studio")
	studio := NewStudio(db, slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx := context.Background()
	a := seedArtisan(t, db, "studio@luxe.com", domain.ServiceBoth, true)

	if _, err := studio.SetServices(ctx, "someone-else", []ServiceInput{{Name: "X", DurationMins: 60, Price: 1}}); !errors.Is(err, ErrNoProfile) {
		t.Errorf("non-artisan edited services: %v", err)
	}
	if _, err := studio.SetServices(ctx, a.UserID, []ServiceInput{
		{Name: "Silk press", DurationMins: 90, Price: 30000},
		{Name: "Wash", DurationMins: 30, Price: 8000},
	}); err != nil {
		t.Fatal(err)
	}
	var saved domain.Artisan
	db.First(&saved, a.ID)
	if len(saved.Services) != 2 || saved.PriceFrom != 800000 {
		t.Errorf("services = %d, price_from = %d; want 2 and the cheapest (800000)", len(saved.Services), saved.PriceFrom)
	}

	// Book once, then a slot-length change must be refused; hours may change.
	if _, err := service.BookService(ctx, "buyer", a.ID, "Wash", tomorrow(), "10:00", "studio", ""); err != nil {
		t.Fatal(err)
	}
	hours := domain.WeeklyHours{{Weekday: 1, Start: "10:00", End: "16:00"}}
	if err := studio.SetSchedule(ctx, a.UserID, ScheduleInput{WeeklyHours: hours, SlotMinutes: 30}); !errors.Is(err, ErrSlotLengthLocked) {
		t.Errorf("slot length change with upcoming bookings: got %v", err)
	}
	if err := studio.SetSchedule(ctx, a.UserID, ScheduleInput{WeeklyHours: hours, SlotMinutes: 60, DaysOff: []string{"bad"}}); !errors.Is(err, schedule.ErrInvalidHours) {
		t.Errorf("bad day off accepted: %v", err)
	}
	if err := studio.SetSchedule(ctx, a.UserID, ScheduleInput{WeeklyHours: hours, SlotMinutes: 60}); err != nil {
		t.Fatalf("hours change: %v", err)
	}
	var booked int64
	db.Model(&domain.BookingSlot{}).Where("artisan_id = ? AND reserved = ?", a.ID, true).Count(&booked)
	if booked != 1 {
		t.Errorf("schedule change dropped the booked slot (reserved = %d)", booked)
	}
}
