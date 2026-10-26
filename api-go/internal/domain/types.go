package domain

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
)

// JSON-backed column types. They serialize to a TEXT/JSONB column so the same
// models run on SQLite (unit tests) and PostgreSQL (production) unchanged.

// StringArray is a list of short strings persisted as a JSON array.
type StringArray []string

func (a StringArray) Value() (driver.Value, error) {
	if a == nil {
		return "[]", nil
	}
	b, err := json.Marshal(a)
	return string(b), err
}

func (a *StringArray) Scan(src any) error {
	if src == nil {
		*a = StringArray{}
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, a)
	case string:
		return json.Unmarshal([]byte(v), a)
	default:
		return fmt.Errorf("unsupported type for StringArray: %T", src)
	}
}

// ArtisanService is a single bookable service offered by an artisan.
type ArtisanService struct {
	Name         string `json:"name"`
	DurationMins int    `json:"duration_mins"`
	Price        int64  `json:"price"` // stored in Kobo
	Description  string `json:"description"`
}

// ServiceList persists a slice of ArtisanService as a JSON array.
type ServiceList []ArtisanService

func (s ServiceList) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *ServiceList) Scan(src any) error {
	if src == nil {
		*s = ServiceList{}
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	default:
		return errors.New("unsupported type for ServiceList")
	}
}

// DayHours is one weekday's opening window. Weekday follows time.Weekday
// (0 = Sunday); Start and End are "HH:MM" in Africa/Lagos time.
type DayHours struct {
	Weekday int    `json:"weekday"`
	Start   string `json:"start"`
	End     string `json:"end"`
}

// WeeklyHours persists an artisan's opening hours as a JSON array.
type WeeklyHours []DayHours

func (w WeeklyHours) Value() (driver.Value, error) {
	if w == nil {
		return "[]", nil
	}
	b, err := json.Marshal(w)
	return string(b), err
}

func (w *WeeklyHours) Scan(src any) error {
	if src == nil {
		*w = WeeklyHours{}
		return nil
	}
	switch v := src.(type) {
	case []byte:
		return json.Unmarshal(v, w)
	case string:
		return json.Unmarshal([]byte(v), w)
	default:
		return errors.New("unsupported type for WeeklyHours")
	}
}
