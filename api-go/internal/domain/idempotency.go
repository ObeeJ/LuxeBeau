package domain

import "time"

// IdempotencyRecord stores the result of a non-idempotent operation so that
// retries with the same key return the stored response without re-executing.
// The key is scoped to the user so one user cannot replay another's request.
// Records expire after 24 hours; a background sweep or Postgres TTL can clean
// them up, but stale rows are harmless.
type IdempotencyRecord struct {
	ID           uint      `gorm:"primaryKey;autoIncrement"`
	Key          string    `gorm:"type:varchar(255);not null"`
	UserID       string    `gorm:"type:uuid;not null"`
	Operation    string    `gorm:"type:varchar(60);not null"` // e.g. "create_order"
	ResponseJSON string    `gorm:"type:text;not null"`
	StatusCode   int       `gorm:"type:integer;not null"`
	ExpiresAt    time.Time `gorm:"not null;index"`
	CreatedAt    time.Time
}
