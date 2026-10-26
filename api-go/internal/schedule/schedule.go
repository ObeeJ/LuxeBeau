// Package schedule turns an artisan's weekly hours into bookable slots and
// answers availability. Slots are start times of SlotMinutes each; a service
// longer than one slot reserves consecutive slots. Weekly slots are generated
// lazily for a rolling window, so no background job is needed. All calendar
// maths uses Africa/Lagos time; dates are stored as UTC midnight.
package schedule

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
	_ "time/tzdata" // Africa/Lagos even on minimal container images

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

const (
	// WindowDays is how far ahead weekly slots are generated.
	WindowDays = 42
	// LeadTime is the minimum notice for a same-day booking.
	LeadTime = time.Hour
)

var (
	ErrSlotTaken    = errors.New("slot is no longer available")
	ErrInvalidHours = errors.New("invalid opening hours")
	ErrInvalidSlot  = errors.New("invalid slot")

	lagos = mustLocation("Africa/Lagos")
	// now is replaceable in tests.
	now = time.Now
)

func mustLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// Today returns the current Lagos calendar date as UTC midnight, matching how
// slot dates are stored.
func Today() time.Time {
	return dateOf(now().In(lagos))
}

func dateOf(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// ParseDate parses YYYY-MM-DD into the stored date form.
func ParseDate(s string) (time.Time, error) {
	return time.Parse("2006-01-02", s)
}

func parseClock(s string) (int, error) {
	parts := strings.Split(s, ":")
	if len(parts) != 2 || len(parts[0]) != 2 || len(parts[1]) != 2 {
		return 0, ErrInvalidSlot
	}
	h, err1 := strconv.Atoi(parts[0])
	m, err2 := strconv.Atoi(parts[1])
	if err1 != nil || err2 != nil || h < 0 || h > 23 || m < 0 || m > 59 {
		return 0, ErrInvalidSlot
	}
	return h*60 + m, nil
}

func clock(mins int) string {
	return fmt.Sprintf("%02d:%02d", mins/60, mins%60)
}

// StartTimes lists slot start times inside [start, end) for a slot length.
func StartTimes(start, end string, slotMinutes int) ([]string, error) {
	s, err := parseClock(start)
	if err != nil {
		return nil, err
	}
	e, err := parseClock(end)
	if err != nil {
		return nil, err
	}
	if e <= s || slotMinutes <= 0 {
		return nil, ErrInvalidHours
	}
	var out []string
	for t := s; t+slotMinutes <= e; t += slotMinutes {
		out = append(out, clock(t))
	}
	return out, nil
}

// ValidateHours checks weekly hours, slot length and days off.
func ValidateHours(hours domain.WeeklyHours, slotMinutes int, daysOff []string) error {
	switch slotMinutes {
	case 15, 30, 45, 60, 90, 120:
	default:
		return fmt.Errorf("%w: slot length must be 15, 30, 45, 60, 90 or 120 minutes", ErrInvalidHours)
	}
	seen := map[int]bool{}
	for _, h := range hours {
		if h.Weekday < 0 || h.Weekday > 6 || seen[h.Weekday] {
			return fmt.Errorf("%w: each weekday may appear once", ErrInvalidHours)
		}
		seen[h.Weekday] = true
		times, err := StartTimes(h.Start, h.End, slotMinutes)
		if err != nil || len(times) == 0 {
			return fmt.Errorf("%w: %s must close after it opens, with room for one slot", ErrInvalidHours, time.Weekday(h.Weekday))
		}
	}
	if len(daysOff) > 120 {
		return fmt.Errorf("%w: too many days off", ErrInvalidHours)
	}
	for _, d := range daysOff {
		if _, err := ParseDate(d); err != nil {
			return fmt.Errorf("%w: day off %q is not a date", ErrInvalidHours, d)
		}
	}
	return nil
}

func isDayOff(a *domain.Artisan, d time.Time) bool {
	key := d.Format("2006-01-02")
	for _, off := range a.DaysOff {
		if off == key {
			return true
		}
	}
	return false
}

func slotMinutes(a *domain.Artisan) int {
	if a.SlotMinutes > 0 {
		return a.SlotMinutes
	}
	return 60
}

// Ensure generates weekly slots up to the end of the rolling window. It is
// idempotent and safe to run concurrently (existing slots are left as is).
func Ensure(ctx context.Context, db *gorm.DB, a *domain.Artisan) error {
	today := Today()
	last := today.AddDate(0, 0, WindowDays-1)
	from := today
	if a.SlotsThrough != nil && !a.SlotsThrough.Before(today) {
		from = dateOf(*a.SlotsThrough).AddDate(0, 0, 1)
	}
	if from.After(last) {
		return nil
	}

	byDay := map[time.Weekday][]string{}
	for _, h := range a.WeeklyHours {
		times, err := StartTimes(h.Start, h.End, slotMinutes(a))
		if err == nil {
			byDay[time.Weekday(h.Weekday)] = times
		}
	}

	var slots []domain.BookingSlot
	for d := from; !d.After(last); d = d.AddDate(0, 0, 1) {
		if isDayOff(a, d) {
			continue
		}
		for _, t := range byDay[d.Weekday()] {
			slots = append(slots, domain.BookingSlot{ArtisanID: a.ID, SlotDate: d, SlotTime: t, Source: domain.SlotWeekly})
		}
	}
	return db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(slots) > 0 {
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).CreateInBatches(slots, 200).Error; err != nil {
				return err
			}
		}
		a.SlotsThrough = &last
		return tx.Model(&domain.Artisan{}).Where("id = ?", a.ID).Update("slots_through", last).Error
	})
}

// Rebuild regenerates future weekly slots after hours or days off change.
// Reserved slots are never touched; free slots on days off are removed.
func Rebuild(ctx context.Context, db *gorm.DB, a *domain.Artisan) error {
	today := Today()
	err := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("artisan_id = ? AND slot_date >= ? AND reserved = ? AND source = ?", a.ID, today, false, domain.SlotWeekly).
			Delete(&domain.BookingSlot{}).Error; err != nil {
			return err
		}
		if len(a.DaysOff) > 0 {
			var offDates []time.Time
			for _, d := range a.DaysOff {
				if t, err := ParseDate(d); err == nil && !t.Before(today) {
					offDates = append(offDates, t)
				}
			}
			if len(offDates) > 0 {
				if err := tx.Where("artisan_id = ? AND slot_date IN ? AND reserved = ?", a.ID, offDates, false).
					Delete(&domain.BookingSlot{}).Error; err != nil {
					return err
				}
			}
		}
		return tx.Model(&domain.Artisan{}).Where("id = ?", a.ID).Update("slots_through", nil).Error
	})
	if err != nil {
		return err
	}
	a.SlotsThrough = nil
	return Ensure(ctx, db, a)
}

// required lists the consecutive slot times a booking starting at start needs.
func required(start string, durationMins, slotMins int) ([]string, error) {
	s, err := parseClock(start)
	if err != nil {
		return nil, err
	}
	n := 1
	if durationMins > slotMins {
		n = (durationMins + slotMins - 1) / slotMins
	}
	out := make([]string, n)
	for i := range out {
		t := s + i*slotMins
		if t >= 24*60 {
			return nil, ErrSlotTaken
		}
		out[i] = clock(t)
	}
	return out, nil
}

func startsInFuture(date time.Time, start string) bool {
	mins, err := parseClock(start)
	if err != nil {
		return false
	}
	at := time.Date(date.Year(), date.Month(), date.Day(), mins/60, mins%60, 0, 0, lagos)
	return at.After(now().Add(LeadTime))
}

// Availability lists start times where a service of durationMins fits in
// consecutive free slots, for the next `days` days.
func Availability(ctx context.Context, db *gorm.DB, a *domain.Artisan, durationMins, days int) ([]domain.AvailableDay, error) {
	if err := Ensure(ctx, db, a); err != nil {
		return nil, err
	}
	if days <= 0 || days > WindowDays {
		days = WindowDays
	}
	today := Today()
	var free []domain.BookingSlot
	if err := db.WithContext(ctx).
		Where("artisan_id = ? AND reserved = ? AND slot_date >= ? AND slot_date < ?", a.ID, false, today, today.AddDate(0, 0, days)).
		Order("slot_date, slot_time").Find(&free).Error; err != nil {
		return nil, err
	}

	byDate := map[string]map[string]bool{}
	var order []string
	for _, s := range free {
		key := s.SlotDate.UTC().Format("2006-01-02")
		if byDate[key] == nil {
			byDate[key] = map[string]bool{}
			order = append(order, key)
		}
		byDate[key][s.SlotTime] = true
	}

	out := []domain.AvailableDay{}
	for _, key := range order {
		date, _ := ParseDate(key)
		var times []string
		for t := range byDate[key] {
			if !startsInFuture(date, t) {
				continue
			}
			need, err := required(t, durationMins, slotMinutes(a))
			if err != nil {
				continue
			}
			fits := true
			for _, n := range need {
				if !byDate[key][n] {
					fits = false
					break
				}
			}
			if fits {
				times = append(times, t)
			}
		}
		if len(times) > 0 {
			sort.Strings(times)
			out = append(out, domain.AvailableDay{Date: key, Times: times})
		}
	}
	return out, nil
}

// Reserve atomically marks every slot a booking needs as taken. Run it in the
// booking's transaction; any shortfall returns ErrSlotTaken so the caller
// rolls back.
func Reserve(tx *gorm.DB, a *domain.Artisan, date time.Time, start string, durationMins int, bookingID string) error {
	if !startsInFuture(date, start) {
		return ErrSlotTaken
	}
	need, err := required(start, durationMins, slotMinutes(a))
	if err != nil {
		return err
	}
	res := tx.Model(&domain.BookingSlot{}).
		Where("artisan_id = ? AND slot_date = ? AND slot_time IN ? AND reserved = ?", a.ID, date, need, false).
		Updates(map[string]any{"reserved": true, "booking_id": bookingID})
	if res.Error != nil {
		return res.Error
	}
	if int(res.RowsAffected) != len(need) {
		return ErrSlotTaken
	}
	return nil
}

// AddManual opens a one-off slot outside weekly hours.
func AddManual(ctx context.Context, db *gorm.DB, a *domain.Artisan, date time.Time, start string) (*domain.BookingSlot, error) {
	if _, err := parseClock(start); err != nil {
		return nil, err
	}
	today := Today()
	if date.Before(today) || date.After(today.AddDate(0, 0, 365)) || !startsInFuture(date, start) {
		return nil, ErrInvalidSlot
	}
	slot := &domain.BookingSlot{ArtisanID: a.ID, SlotDate: date, SlotTime: start, Source: domain.SlotManual}
	res := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(slot)
	if res.Error != nil {
		return nil, res.Error
	}
	if res.RowsAffected == 0 {
		return nil, fmt.Errorf("%w: that time is already open", ErrInvalidSlot)
	}
	return slot, nil
}

// RemoveFree deletes one of the artisan's free future slots.
func RemoveFree(ctx context.Context, db *gorm.DB, a *domain.Artisan, slotID uint) error {
	res := db.WithContext(ctx).
		Where("id = ? AND artisan_id = ? AND reserved = ? AND slot_date >= ?", slotID, a.ID, false, Today()).
		Delete(&domain.BookingSlot{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrInvalidSlot
	}
	return nil
}

// Upcoming lists the artisan's own slots (free and booked) for the studio.
func Upcoming(ctx context.Context, db *gorm.DB, a *domain.Artisan, days int) ([]domain.BookingSlot, error) {
	if err := Ensure(ctx, db, a); err != nil {
		return nil, err
	}
	today := Today()
	var slots []domain.BookingSlot
	err := db.WithContext(ctx).
		Where("artisan_id = ? AND slot_date >= ? AND slot_date < ?", a.ID, today, today.AddDate(0, 0, days)).
		Order("slot_date, slot_time").Find(&slots).Error
	if err != nil {
		return nil, err
	}
	// Hide today's times that have already started; booked ones stay visible.
	cutoff := now()
	out := slots[:0]
	for _, sl := range slots {
		mins, perr := parseClock(sl.SlotTime)
		d := sl.SlotDate.UTC()
		start := time.Date(d.Year(), d.Month(), d.Day(), mins/60, mins%60, 0, 0, lagos)
		if perr == nil && !sl.Reserved && !start.After(cutoff) {
			continue
		}
		out = append(out, sl)
	}
	return out, nil
}
