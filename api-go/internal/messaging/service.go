// Package messaging handles direct messages between users.
// Postgres is the source of truth. SSE (Server-Sent Events) delivers new
// messages in realtime without the 30-second WebSocket timeout on Render's
// free plan. Clients reconnect on disconnect and poll for missed messages.
package messaging

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

var (
	ErrNotParticipant = errors.New("not a participant in this conversation")
	ErrMessageTooLong = errors.New("message must be 2000 characters or fewer")
	ErrEmptyMessage   = errors.New("message cannot be empty")
)

const maxMessageRunes = 2000

// Service handles the full messaging lifecycle.
type Service struct {
	db     *gorm.DB
	broker *Broker
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db, broker: newBroker()}
}

// Broker is an in-process SSE fan-out. It holds one channel per connected
// user. When a message is sent, the broker pushes the conversation ID to all
// of the recipient's open SSE connections.
type Broker struct {
	mu      sync.RWMutex
	clients map[string][]chan string // userID → list of SSE channels
}

func newBroker() *Broker {
	return &Broker{clients: make(map[string][]chan string)}
}

func (b *Broker) Subscribe(userID string) chan string {
	ch := make(chan string, 8)
	b.mu.Lock()
	b.clients[userID] = append(b.clients[userID], ch)
	b.mu.Unlock()
	return ch
}

func (b *Broker) Unsubscribe(userID string, ch chan string) {
	b.mu.Lock()
	defer b.mu.Unlock()
	list := b.clients[userID]
	for i, c := range list {
		if c == ch {
			b.clients[userID] = append(list[:i], list[i+1:]...)
			break
		}
	}
	if len(b.clients[userID]) == 0 {
		delete(b.clients, userID)
	}
}

func (b *Broker) Notify(userID, convID string) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.clients[userID] {
		select {
		case ch <- convID:
		default: // drop if the channel is full; client will catch up on reconnect
		}
	}
}

// GetOrCreateConversation returns the conversation between two users,
// creating it if it does not exist.
func (s *Service) GetOrCreateConversation(ctx context.Context, userA, userB string) (*domain.Conversation, error) {
	id := domain.ConvID(userA, userB)
	var conv domain.Conversation
	err := s.db.WithContext(ctx).First(&conv, "id = ?", id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		conv = domain.Conversation{ID: id, UserA: min(userA, userB), UserB: max(userA, userB), LastAt: time.Now()}
		if err := s.db.WithContext(ctx).Create(&conv).Error; err != nil {
			// Race: another goroutine created it first.
			if strings.Contains(strings.ToLower(err.Error()), "unique") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
				s.db.WithContext(ctx).First(&conv, "id = ?", id)
				return &conv, nil
			}
			return nil, err
		}
		return &conv, nil
	}
	return &conv, err
}

// Send stores a message and notifies the recipient via SSE.
func (s *Service) Send(ctx context.Context, senderID, recipientID, body string) (*domain.Message, error) {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil, ErrEmptyMessage
	}
	if utf8.RuneCountInString(body) > maxMessageRunes {
		return nil, ErrMessageTooLong
	}
	conv, err := s.GetOrCreateConversation(ctx, senderID, recipientID)
	if err != nil {
		return nil, err
	}
	msg := &domain.Message{ConversationID: conv.ID, SenderID: senderID, Body: body}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(msg).Error; err != nil {
			return err
		}
		return tx.Model(&domain.Conversation{}).Where("id = ?", conv.ID).
			Update("last_at", time.Now()).Error
	})
	if err != nil {
		return nil, err
	}
	// Notify recipient in realtime (non-blocking).
	s.broker.Notify(recipientID, conv.ID)
	return msg, nil
}

// ListConversations returns the caller's inbox, newest first.
func (s *Service) ListConversations(ctx context.Context, userID string) ([]domain.Conversation, error) {
	var list []domain.Conversation
	if err := s.db.WithContext(ctx).
		Where("user_a = ? OR user_b = ?", userID, userID).
		Order("last_at DESC").Limit(50).Find(&list).Error; err != nil {
		return nil, err
	}
	return list, nil
}

// ListMessages returns messages in a conversation, newest first, with pagination.
func (s *Service) ListMessages(ctx context.Context, userID, convID string, limit, before int) ([]domain.Message, error) {
	var conv domain.Conversation
	if err := s.db.WithContext(ctx).First(&conv, "id = ?", convID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotParticipant
		}
		return nil, err
	}
	if conv.UserA != userID && conv.UserB != userID {
		return nil, ErrNotParticipant
	}
	if limit <= 0 || limit > 50 {
		limit = 30
	}
	q := s.db.WithContext(ctx).Where("conversation_id = ?", convID)
	if before > 0 {
		q = q.Where("id < ?", before)
	}
	var msgs []domain.Message
	if err := q.Order("id DESC").Limit(limit).Find(&msgs).Error; err != nil {
		return nil, err
	}
	return msgs, nil
}

// MarkRead marks all messages in a conversation as read by the caller.
func (s *Service) MarkRead(ctx context.Context, userID, convID string) error {
	now := time.Now()
	return s.db.WithContext(ctx).Model(&domain.Message{}).
		Where("conversation_id = ? AND sender_id != ? AND read_at IS NULL", convID, userID).
		Update("read_at", now).Error
}

// Subscribe returns an SSE channel for the caller and a cleanup function.
func (s *Service) Subscribe(userID string) (chan string, func()) {
	ch := s.broker.Subscribe(userID)
	return ch, func() { s.broker.Unsubscribe(userID, ch) }
}

func min(a, b string) string {
	if a < b {
		return a
	}
	return b
}

func max(a, b string) string {
	if a > b {
		return a
	}
	return b
}
