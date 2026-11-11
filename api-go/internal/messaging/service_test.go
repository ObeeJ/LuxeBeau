package messaging

import (
	"context"
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
	ada   = "00000000-0000-0000-0000-0000000000a1"
	bayo  = "00000000-0000-0000-0000-0000000000a2"
	cara  = "00000000-0000-0000-0000-0000000000a3"
	ghost = "00000000-0000-0000-0000-0000000000ff" // not a registered user
)

// openTestDB is an in-memory SQLite by default. With TEST_PG_DSN set it uses a
// real PostgreSQL instead (tables are dropped first).
func openTestDB(t *testing.T, sqliteName string) *gorm.DB {
	t.Helper()
	if dsn := os.Getenv("TEST_PG_DSN"); dsn != "" {
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Discard})
		if err != nil {
			t.Fatal(err)
		}
		_ = db.Migrator().DropTable(&domain.Message{}, &domain.Conversation{}, &domain.UserProfile{}, &domain.Review{}, &domain.Booking{}, &domain.Artisan{}, &domain.OrderItem{}, &domain.Order{}, &domain.Escrow{}, &domain.Product{}, &domain.User{})
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
	name := "file:msg_" + strings.ReplaceAll(t.Name(), "/", "_") + "?mode=memory&cache=shared"
	db := openTestDB(t, name)
	if err := db.AutoMigrate(&domain.User{}, &domain.Conversation{}, &domain.Message{}); err != nil {
		t.Fatal(err)
	}
	for _, u := range []domain.User{
		{ID: ada, Name: "Ada", Email: "ada@test.ng"},
		{ID: bayo, Name: "Bayo", Email: "bayo@test.ng"},
		{ID: cara, Name: "Cara", Email: "cara@test.ng"},
	} {
		db.Create(&u)
	}
	return NewService(db), db
}

func TestSend_CreatesOneConversationPerPairAndShowsInBothInboxes(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	if _, err := s.Send(ctx, ada, bayo, "  hello  "); err != nil {
		t.Fatal(err)
	}
	m, err := s.Send(ctx, bayo, ada, "hi back")
	if err != nil {
		t.Fatal(err)
	}
	if m.ConversationID != domain.ConvID(ada, bayo) {
		t.Errorf("conversation id = %q, want the canonical id for the pair", m.ConversationID)
	}
	for _, who := range []string{ada, bayo} {
		list, err := s.ListConversations(ctx, who)
		if err != nil || len(list) != 1 {
			t.Fatalf("%s inbox = %+v, err %v; want exactly one conversation", who, list, err)
		}
	}
	if list, _ := s.ListConversations(ctx, cara); len(list) != 0 {
		t.Errorf("an outsider's inbox must be empty: %+v", list)
	}
	msgs, _ := s.ListMessages(ctx, ada, domain.ConvID(ada, bayo), 10, 0)
	if len(msgs) != 2 || msgs[1].Body != "hello" {
		t.Errorf("messages = %+v, want 2 with the first trimmed to hello (newest first)", msgs)
	}
}

func TestSend_Validation(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	if _, err := s.Send(ctx, ada, bayo, "   "); !errors.Is(err, ErrEmptyMessage) {
		t.Errorf("blank: err = %v, want ErrEmptyMessage", err)
	}
	if _, err := s.Send(ctx, ada, bayo, strings.Repeat("é", 2001)); !errors.Is(err, ErrMessageTooLong) {
		t.Errorf("2001 characters: err = %v, want ErrMessageTooLong", err)
	}
	if _, err := s.Send(ctx, ada, ada, "talking to myself"); !errors.Is(err, ErrSelfMessage) {
		t.Errorf("self: err = %v, want ErrSelfMessage", err)
	}
	if _, err := s.Send(ctx, ada, ghost, "anyone there?"); !errors.Is(err, ErrRecipientNotFound) {
		t.Errorf("unknown recipient: err = %v, want ErrRecipientNotFound", err)
	}
	var n int64
	s.db.Model(&domain.Conversation{}).Count(&n)
	if n != 0 {
		t.Errorf("conversations = %d; failed sends must not create conversations", n)
	}
	if _, err := s.Send(ctx, ada, bayo, strings.Repeat("é", 2000)); err != nil {
		t.Errorf("exactly 2000 characters should be fine: %v", err)
	}
}

func TestListMessages_OnlyParticipantsAndPaging(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	for i := 0; i < 5; i++ {
		s.Send(ctx, ada, bayo, "m"+string(rune('0'+i)))
	}
	conv := domain.ConvID(ada, bayo)
	if _, err := s.ListMessages(ctx, cara, conv, 10, 0); !errors.Is(err, ErrNotParticipant) {
		t.Errorf("outsider: err = %v, want ErrNotParticipant", err)
	}
	if _, err := s.ListMessages(ctx, ada, "no-such-conversation", 10, 0); !errors.Is(err, ErrNotParticipant) {
		t.Errorf("missing conversation: err = %v, want ErrNotParticipant", err)
	}
	page1, _ := s.ListMessages(ctx, ada, conv, 2, 0)
	if len(page1) != 2 || page1[0].Body != "m4" {
		t.Fatalf("page 1 = %+v", page1)
	}
	page2, _ := s.ListMessages(ctx, ada, conv, 2, int(page1[1].ID))
	if len(page2) != 2 || page2[0].Body != "m2" {
		t.Errorf("page 2 = %+v, want m2 then m1", page2)
	}
}

// Only the two people in a conversation may mark its messages read.
func TestMarkRead_OnlyParticipants(t *testing.T) {
	s, db := newSvc(t)
	ctx := context.Background()
	s.Send(ctx, ada, bayo, "for bayo")
	conv := domain.ConvID(ada, bayo)

	if err := s.MarkRead(ctx, cara, conv); !errors.Is(err, ErrNotParticipant) {
		t.Fatalf("outsider: err = %v, want ErrNotParticipant", err)
	}
	var unread int64
	db.Model(&domain.Message{}).Where("read_at IS NULL").Count(&unread)
	if unread != 1 {
		t.Fatalf("an outsider changed read state: %d unread, want 1", unread)
	}
	if err := s.MarkRead(ctx, ada, conv); err != nil { // the sender reading their own thread changes nothing
		t.Fatal(err)
	}
	db.Model(&domain.Message{}).Where("read_at IS NULL").Count(&unread)
	if unread != 1 {
		t.Errorf("the sender's own message must stay unread until bayo reads it: %d unread", unread)
	}
	if err := s.MarkRead(ctx, bayo, conv); err != nil {
		t.Fatal(err)
	}
	db.Model(&domain.Message{}).Where("read_at IS NULL").Count(&unread)
	if unread != 0 {
		t.Errorf("after bayo reads: %d unread, want 0", unread)
	}
	if err := s.MarkRead(ctx, bayo, "no-such-conversation"); !errors.Is(err, ErrNotParticipant) {
		t.Errorf("missing conversation: err = %v, want ErrNotParticipant", err)
	}
}

func TestBroker_OnlyTheRecipientIsNotifiedAndCleanupWorks(t *testing.T) {
	s, _ := newSvc(t)
	ctx := context.Background()
	adaCh, adaDone := s.Subscribe(ada)
	bayoCh, bayoDone := s.Subscribe(bayo)

	s.Send(ctx, ada, bayo, "ping")
	select {
	case id := <-bayoCh:
		if id != domain.ConvID(ada, bayo) {
			t.Errorf("notified with %q", id)
		}
	case <-time.After(time.Second):
		t.Fatal("the recipient was not notified")
	}
	select {
	case id := <-adaCh:
		t.Errorf("the sender must not be notified of their own message: %q", id)
	case <-time.After(50 * time.Millisecond):
	}
	adaDone()
	bayoDone()
	s.broker.mu.RLock()
	left := len(s.broker.clients)
	s.broker.mu.RUnlock()
	if left != 0 {
		t.Errorf("%d subscriber lists left after cleanup; connections would leak", left)
	}
}
