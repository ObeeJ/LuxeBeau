package domain

import "time"

// UserProfile extends a user with public social fields.
// One row per user, created lazily on first profile save.
type UserProfile struct {
	UserID    string `gorm:"type:uuid;primaryKey" json:"user_id"`
	AvatarURL string `gorm:"type:varchar(500)" json:"avatar_url"`
	Bio       string `gorm:"type:varchar(300)" json:"bio"`
	// SocialHandle is the user's chosen @handle for their profile page.
	// Unique, lowercase, 3-30 chars, letters/numbers/underscores only.
	SocialHandle string    `gorm:"type:varchar(30);uniqueIndex" json:"social_handle"`
	Website      string    `gorm:"type:varchar(200)" json:"website"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Conversation is a thread between exactly two users.
// The canonical ID is always min(user_a, user_b) + ":" + max(user_a, user_b)
// so there is only ever one conversation per pair.
type Conversation struct {
	ID        string    `gorm:"type:varchar(80);primaryKey" json:"id"`
	UserA     string    `gorm:"type:uuid;not null;index:idx_conv_a" json:"user_a"`
	UserB     string    `gorm:"type:uuid;not null;index:idx_conv_b" json:"user_b"`
	// LastAt is denormalised for fast inbox sorting.
	LastAt    time.Time `gorm:"not null;index" json:"last_at"`
	CreatedAt time.Time `json:"created_at"`
}

// Message is one message in a conversation.
type Message struct {
	ID             uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	ConversationID string    `gorm:"type:varchar(80);not null;index" json:"conversation_id"`
	SenderID       string    `gorm:"type:uuid;not null" json:"sender_id"`
	Body           string    `gorm:"type:text;not null" json:"body"`
	// ReadAt is set when the other participant reads the message.
	ReadAt    *time.Time `json:"read_at,omitempty"`
	CreatedAt time.Time  `gorm:"index" json:"created_at"`
}

// ConvID returns the canonical conversation ID for two users.
func ConvID(a, b string) string {
	if a < b {
		return a + ":" + b
	}
	return b + ":" + a
}
