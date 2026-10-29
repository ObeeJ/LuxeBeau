package booking

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"luxebeau/internal/domain"
	"luxebeau/internal/schedule"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

// lagosDay returns the Lagos calendar date and HH:MM for a moment, in the form
// bookings store them.
func lagosDay(at time.Time) (time.Time, string) {
	l := at.In(time.FixedZone("WAT", 3600)) // Lagos is UTC+1 all year
	return time.Date(l.Year(), l.Month(), l.Day(), 0, 0, 0, 0, time.UTC), l.Format("15:04")
}

// insertBooking stores a booking directly, so a test can place it anywhere in
// time with any status and notice window.
func insertBooking(t *testing.T, db *gorm.DB, a domain.Artisan, buyer, status string, start time.Time, policy int) domain.Booking {
	t.Helper()
	date, clock := lagosDay(start)
	b := domain.Booking{
		ID: "BK-" + uuid.NewString()[:8], BuyerID: buyer, ArtisanID: a.ID, ServiceName: "Trim",
		BookingDate: date, BookingTime: clock, ServiceType: domain.ServiceStudio, Amount: 1000,
		Status: status, PolicyHours: policy,
	}
	if err := db.Create(&b).Error; err != nil {
		t.Fatal(err)
	}
	// A zero notice window can't go through Create (the column default is 24).
	db.Model(&domain.Booking{}).Where("id = ?", b.ID).Update("policy_hours", policy)
	return b
}

func seedBuyer(db *gorm.DB, name string) string {
	id := uuid.NewString()
	db.Create(&domain.User{ID: id, Name: name, Email: name + "@test.ng", Role: "buyer"})
	// Seed a wallet with enough balance for test bookings.
	db.Create(&domain.Wallet{UserID: id, Balance: 10_000_000})
	return id
}

func statusOf(db *gorm.DB, id string) domain.Booking {
	var b domain.Booking
	db.First(&b, "id = ?", id)
	return b
}

func TestCancel_FreeLateAndWhoMayCancel(t *testing.T) {
	db, svc := newTestService(t, "cancel_rules")
	ctx := context.Background()
	a := seedArtisan(t, db, "cancel@luxe.com", domain.ServiceBoth, true)
	buyer := seedBuyer(db, "ada")
	soon := schedule.Now().Add(30 * time.Hour)

	// A booking made through the service holds real slots and snapshots the policy.
	b, err := svc.BookService(ctx, buyer, a.ID, "Trim", tomorrow(), "10:00", "studio", "")
	if err != nil {
		t.Fatal(err)
	}
	if b.PolicyHours != 24 || b.ExpiresAt == nil || b.ExpiresAt.After(schedule.Now().Add(25*time.Hour)) {
		t.Fatalf("policy hours = %d, expires = %v; want 24h terms and an answer deadline within a day", b.PolicyHours, b.ExpiresAt)
	}
	// Changing the artisan's policy later doesn't change a booking already made.
	db.Model(&domain.Artisan{}).Where("id = ?", a.ID).Update("cancel_window_hours", 72)
	if got := statusOf(db, b.ID).PolicyHours; got != 24 {
		t.Fatalf("an existing booking's terms changed to %d hours", got)
	}

	// Withdrawing a request nobody agreed to yet is always free, even inside the window.
	db.Model(&domain.Booking{}).Where("id = ?", b.ID).Update("policy_hours", 720)
	got, err := svc.CancelBooking(ctx, b.ID, buyer, false, "  changed my mind  ")
	if err != nil || got.Status != domain.BookingCancelled || got.LateCancel || got.CancelledBy != "buyer" || got.CancelReason != "changed my mind" {
		t.Fatalf("cancel pending: %+v err=%v", got, err)
	}
	// ...and its slot is free to book again.
	var held int64
	db.Model(&domain.BookingSlot{}).Where("booking_id = ?", b.ID).Count(&held)
	if held != 0 {
		t.Fatalf("%d slots still held by a cancelled booking", held)
	}
	if _, err := svc.BookService(ctx, "buyer-2", a.ID, "Trim", tomorrow(), "10:00", "studio", ""); err != nil {
		t.Fatalf("the slot wasn't released: %v", err)
	}

	// Confirmed, inside the notice window: allowed, but recorded as late.
	late := insertBooking(t, db, a, buyer, domain.BookingConfirmed, soon, 720)
	got, err = svc.CancelBooking(ctx, late.ID, buyer, false, "")
	if err != nil || !got.LateCancel || got.Status != domain.BookingCancelled {
		t.Fatalf("late cancel: %+v err=%v", got, err)
	}
	// Confirmed, with enough notice: free.
	free := insertBooking(t, db, a, buyer, domain.BookingConfirmed, soon, 0)
	got, err = svc.CancelBooking(ctx, free.ID, buyer, false, "")
	if err != nil || got.LateCancel {
		t.Fatalf("free cancel: %+v err=%v", got, err)
	}

	// Who may cancel: the artisan and an admin yes (never "late"), a stranger no.
	mine := insertBooking(t, db, a, buyer, domain.BookingConfirmed, soon, 720)
	if _, err := svc.CancelBooking(ctx, mine.ID, "stranger", false, ""); !errors.Is(err, ErrBookingNotFound) {
		t.Fatalf("a stranger cancelled: %v", err)
	}
	if got, err := svc.CancelBooking(ctx, mine.ID, a.UserID, false, "Sick today"); err != nil || got.CancelledBy != "artisan" || got.LateCancel {
		t.Fatalf("artisan cancel: %+v err=%v", got, err)
	}
	other := insertBooking(t, db, a, buyer, domain.BookingConfirmed, soon, 720)
	if got, err := svc.CancelBooking(ctx, other.ID, "an-admin", true, ""); err != nil || got.CancelledBy != "admin" || got.LateCancel {
		t.Fatalf("admin cancel: %+v err=%v", got, err)
	}

	// Once is enough, and a started appointment can't be cancelled.
	if _, err := svc.CancelBooking(ctx, other.ID, buyer, false, ""); !errors.Is(err, ErrNotCancellable) {
		t.Fatalf("second cancel: %v", err)
	}
	past := insertBooking(t, db, a, buyer, domain.BookingConfirmed, schedule.Now().Add(-2*time.Hour), 24)
	if _, err := svc.CancelBooking(ctx, past.ID, buyer, false, ""); !errors.Is(err, ErrAlreadyStarted) {
		t.Fatalf("cancelling a started appointment: %v", err)
	}
}

func TestConfirm_OnlyAPendingRequest(t *testing.T) {
	db, svc := newTestService(t, "confirm_rules")
	ctx := context.Background()
	a := seedArtisan(t, db, "confirm@luxe.com", domain.ServiceBoth, true)
	buyer := seedBuyer(db, "ada")

	b, _ := svc.BookService(ctx, buyer, a.ID, "Trim", tomorrow(), "11:00", "studio", "")
	if _, err := svc.CancelBooking(ctx, b.ID, buyer, false, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ConfirmBooking(ctx, b.ID, a.UserID, false); !errors.Is(err, ErrNotPending) {
		t.Fatalf("a cancelled booking was confirmed: %v", err)
	}
	if got := statusOf(db, b.ID).Status; got != domain.BookingCancelled {
		t.Fatalf("status = %s after a refused confirm", got)
	}

	// Confirming clears the answer deadline; confirming twice is refused.
	c, _ := svc.BookService(ctx, buyer, a.ID, "Trim", tomorrow(), "13:00", "studio", "")
	if got, err := svc.ConfirmBooking(ctx, c.ID, a.UserID, false); err != nil || got.Status != domain.BookingConfirmed {
		t.Fatalf("confirm: %+v err=%v", got, err)
	}
	if statusOf(db, c.ID).ExpiresAt != nil {
		t.Error("a confirmed booking still has an answer deadline")
	}
	if _, err := svc.ConfirmBooking(ctx, c.ID, a.UserID, false); !errors.Is(err, ErrNotPending) {
		t.Fatalf("second confirm: %v", err)
	}
}

func TestExpireStale_CancelsUnansweredRequestsOnly(t *testing.T) {
	db, svc := newTestService(t, "expire_stale")
	ctx := context.Background()
	a := seedArtisan(t, db, "expire@luxe.com", domain.ServiceBoth, true)
	buyer := seedBuyer(db, "ada")
	m := NewMaintenance(db, nil, quiet)

	stale, _ := svc.BookService(ctx, buyer, a.ID, "Trim", tomorrow(), "09:00", "studio", "")
	fresh, _ := svc.BookService(ctx, buyer, a.ID, "Trim", tomorrow(), "11:00", "studio", "")
	agreed, _ := svc.BookService(ctx, buyer, a.ID, "Trim", tomorrow(), "13:00", "studio", "")
	if _, err := svc.ConfirmBooking(ctx, agreed.ID, a.UserID, false); err != nil {
		t.Fatal(err)
	}
	past := time.Now().Add(-time.Minute)
	db.Model(&domain.Booking{}).Where("id IN ?", []string{stale.ID, agreed.ID}).Update("expires_at", past)

	n, err := m.ExpireStale(ctx)
	if err != nil || n != 1 {
		t.Fatalf("expired %d, err %v; want exactly the one unanswered request", n, err)
	}
	if got := statusOf(db, stale.ID); got.Status != domain.BookingCancelled || got.CancelledBy != "system" {
		t.Fatalf("stale request: %+v", got)
	}
	if statusOf(db, fresh.ID).Status != domain.BookingPending || statusOf(db, agreed.ID).Status != domain.BookingConfirmed {
		t.Fatal("a request inside its deadline, or a confirmed booking, was cancelled")
	}
	// Requests made before deadlines existed (no expires_at) expire a day after they were made.
	oldReq := insertBooking(t, db, a, buyer, domain.BookingPending, schedule.Now().Add(48*time.Hour), 24)
	newReq := insertBooking(t, db, a, buyer, domain.BookingPending, schedule.Now().Add(48*time.Hour), 24)
	db.Model(&domain.Booking{}).Where("id = ?", oldReq.ID).Update("created_at", time.Now().Add(-26*time.Hour))
	if n, err := m.ExpireStale(ctx); err != nil || n != 1 || statusOf(db, oldReq.ID).Status != domain.BookingCancelled || statusOf(db, newReq.ID).Status != domain.BookingPending {
		t.Fatalf("legacy requests: expired %d, err %v", n, err)
	}

	// Its slot is free again, and a second run does nothing.
	if _, err := svc.BookService(ctx, "buyer-2", a.ID, "Trim", tomorrow(), "09:00", "studio", ""); err != nil {
		t.Fatalf("the expired request's slot wasn't released: %v", err)
	}
	if n, _ := m.ExpireStale(ctx); n != 0 {
		t.Fatalf("a second run expired %d more", n)
	}
}

func TestCompleteAndNoShow(t *testing.T) {
	db, svc := newTestService(t, "close_rules")
	ctx := context.Background()
	a := seedArtisan(t, db, "close@luxe.com", domain.ServiceBoth, true)
	buyer := seedBuyer(db, "ada")
	earlier := schedule.Now().Add(-3 * time.Hour)

	done := insertBooking(t, db, a, buyer, domain.BookingConfirmed, earlier, 24)
	upcoming := insertBooking(t, db, a, buyer, domain.BookingConfirmed, schedule.Now().Add(20*time.Hour), 24)
	waiting := insertBooking(t, db, a, buyer, domain.BookingPending, earlier, 24)

	if _, err := svc.CompleteBooking(ctx, done.ID, buyer, false); !errors.Is(err, ErrBookingNotFound) {
		t.Fatalf("the client completed their own booking: %v", err)
	}
	if _, err := svc.CompleteBooking(ctx, upcoming.ID, a.UserID, false); !errors.Is(err, ErrNotStartedYet) {
		t.Fatalf("completed before it started: %v", err)
	}
	if _, err := svc.CompleteBooking(ctx, waiting.ID, a.UserID, false); !errors.Is(err, ErrNotConfirmed) {
		t.Fatalf("completed an unconfirmed request: %v", err)
	}
	var before domain.Artisan
	db.First(&before, a.ID)
	if got, err := svc.CompleteBooking(ctx, done.ID, a.UserID, false); err != nil || got.Status != domain.BookingCompleted {
		t.Fatalf("complete: %+v err=%v", got, err)
	}
	var after domain.Artisan
	db.First(&after, a.ID)
	if after.JobsCompleted != before.JobsCompleted+1 {
		t.Fatalf("jobs completed %d -> %d, want one more", before.JobsCompleted, after.JobsCompleted)
	}
	if _, err := svc.CompleteBooking(ctx, done.ID, a.UserID, false); !errors.Is(err, ErrNotConfirmed) {
		t.Fatalf("completed twice: %v", err)
	}

	// A no-show needs the grace period to pass first.
	justStarted := insertBooking(t, db, a, buyer, domain.BookingConfirmed, schedule.Now().Add(-2*time.Minute), 24)
	if _, err := svc.MarkNoShow(ctx, justStarted.ID, a.UserID, false); !errors.Is(err, ErrNotStartedYet) {
		t.Fatalf("marked a no-show 2 minutes after the start: %v", err)
	}
	missed := insertBooking(t, db, a, buyer, domain.BookingConfirmed, earlier, 24)
	if got, err := svc.MarkNoShow(ctx, missed.ID, a.UserID, false); err != nil || got.Status != domain.BookingNoShow {
		t.Fatalf("no-show: %+v err=%v", got, err)
	}
}

func TestBuyerStrikes_CountLateCancelsAndNoShowsInTheLast90Days(t *testing.T) {
	db, svc := newTestService(t, "strikes")
	ctx := context.Background()
	a := seedArtisan(t, db, "strikes@luxe.com", domain.ServiceBoth, true)
	flaky := seedBuyer(db, "flaky")
	solid := seedBuyer(db, "solid")
	now := schedule.Now()

	mk := func(buyer, status string, startsIn time.Duration, mut map[string]any) {
		b := insertBooking(t, db, a, buyer, status, now.Add(startsIn), 24)
		if mut != nil {
			db.Model(&domain.Booking{}).Where("id = ?", b.ID).Updates(mut)
		}
	}
	recent := now.Add(-10 * 24 * time.Hour)
	old := now.Add(-100 * 24 * time.Hour)
	mk(flaky, domain.BookingCancelled, -240*time.Hour, map[string]any{"late_cancel": true, "cancelled_at": recent})  // counts
	mk(flaky, domain.BookingNoShow, -72*time.Hour, nil)                                                              // counts
	mk(flaky, domain.BookingCancelled, -300*time.Hour, map[string]any{"late_cancel": false, "cancelled_at": recent}) // free cancel: no
	mk(flaky, domain.BookingCancelled, -2400*time.Hour, map[string]any{"late_cancel": true, "cancelled_at": old})    // too old: no
	mk(solid, domain.BookingCompleted, -48*time.Hour, nil)
	mk(solid, domain.BookingConfirmed, 48*time.Hour, nil)
	mk(flaky, domain.BookingConfirmed, 50*time.Hour, nil) // the upcoming booking shown to the artisan

	list, err := svc.ListMyBookings(ctx, a.UserID)
	if err != nil {
		t.Fatal(err)
	}
	strikes := map[string]int{}
	for _, b := range list {
		strikes[b.BuyerID] = b.BuyerStrikes
		if b.Status == domain.BookingConfirmed && b.FreeCancelUntil == nil {
			t.Errorf("booking %s has no free-cancellation deadline", b.ID)
		}
	}
	if strikes[flaky] != 2 || strikes[solid] != 0 {
		t.Fatalf("strikes = %v, want flaky 2 and solid 0", strikes)
	}

	// The client's own list shows their deadlines but not strikes.
	mine, _ := svc.ListMyBookings(ctx, solid)
	for _, b := range mine {
		if b.BuyerStrikes != 0 {
			t.Error("a client's own list carries reliability counts")
		}
	}
}

func TestSendReminders(t *testing.T) {
	db, _ := newTestService(t, "reminders")
	ctx := context.Background()
	a := seedArtisan(t, db, "remind@luxe.com", domain.ServiceBoth, true)
	buyer := seedBuyer(db, "ada")
	m := NewMaintenance(db, nil, quiet)
	now := schedule.Now()

	insert := func(status string, startsIn, bookedAgo time.Duration) string {
		b := insertBooking(t, db, a, buyer, status, now.Add(startsIn), 24)
		db.Model(&domain.Booking{}).Where("id = ?", b.ID).Update("created_at", now.Add(-bookedAgo))
		return b.ID
	}
	due := insert(domain.BookingConfirmed, 6*time.Hour, 72*time.Hour)       // booked days ago, starts today: remind
	justBooked := insert(domain.BookingConfirmed, 6*time.Hour, time.Minute) // booked just now: no reminder needed
	later := insert(domain.BookingConfirmed, 40*time.Hour, 72*time.Hour)    // not within a day yet
	cancelled := insert(domain.BookingCancelled, 6*time.Hour, 72*time.Hour) // no longer happening
	pending := insert(domain.BookingPending, 6*time.Hour, 72*time.Hour)     // not agreed
	started := insert(domain.BookingConfirmed, -1*time.Hour, 72*time.Hour)  // already started

	n, err := m.SendReminders(ctx)
	if err != nil || n != 1 {
		t.Fatalf("reminders sent = %d, err %v; want 1", n, err)
	}
	sent := func(id string) bool { return statusOf(db, id).ReminderSentAt != nil }
	if !sent(due) {
		t.Error("the due booking wasn't marked reminded")
	}
	for name, id := range map[string]string{"later": later, "cancelled": cancelled, "pending": pending, "started": started} {
		if sent(id) {
			t.Errorf("%s booking was reminded", name)
		}
	}
	if !sent(justBooked) {
		t.Error("a booking made inside the last day should be marked so it isn't reconsidered")
	}
	if n, _ := m.SendReminders(ctx); n != 0 {
		t.Fatalf("a second run sent %d more reminders", n)
	}
}

func TestCancelWindowSetting(t *testing.T) {
	db, _ := newTestService(t, "cancel_window_setting")
	ctx := context.Background()
	a := seedArtisan(t, db, "window@luxe.com", domain.ServiceBoth, true)
	studio := NewStudio(db, quiet)

	got, err := studio.GetSchedule(ctx, a.UserID)
	if err != nil || got.CancelWindowHours == nil || *got.CancelWindowHours != 24 {
		t.Fatalf("default window: %+v err=%v", got, err)
	}
	hours := everyDay()
	set := func(w *int) error {
		return studio.SetSchedule(ctx, a.UserID, ScheduleInput{WeeklyHours: hours, SlotMinutes: 60, CancelWindowHours: w})
	}
	five := 5
	if err := set(&five); !errors.Is(err, ErrInvalidCancelWindow) {
		t.Fatalf("5 hours accepted: %v", err)
	}
	zero := 0
	if err := set(&zero); err != nil {
		t.Fatal(err)
	}
	if got, _ := studio.GetSchedule(ctx, a.UserID); *got.CancelWindowHours != 0 {
		t.Fatalf("a zero notice window (free to cancel any time) wasn't saved: %d", *got.CancelWindowHours)
	}
	if err := set(nil); err != nil { // saving hours without the field keeps it
		t.Fatal(err)
	}
	if got, _ := studio.GetSchedule(ctx, a.UserID); *got.CancelWindowHours != 0 {
		t.Fatalf("saving hours reset the notice window to %d", *got.CancelWindowHours)
	}
}

func TestPolicyText(t *testing.T) {
	date := time.Date(2026, 11, 3, 0, 0, 0, 0, time.UTC)
	free := policyText(&domain.Booking{BookingDate: date, BookingTime: "10:00", PolicyHours: 0})
	if free != "Free to cancel any time before the appointment" {
		t.Errorf("zero notice: %q", free)
	}
	got := policyText(&domain.Booking{BookingDate: date, BookingTime: "10:00", PolicyHours: 24})
	want := "Free to cancel until Mon 2 Nov, 10:00 AM. After that it counts as a late cancellation"
	if got != want {
		t.Errorf("24h notice: %q, want %q", got, want)
	}
}
