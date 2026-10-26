package mail

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"
)

type memSender struct{ msgs []Message }

func (m *memSender) Send(_ context.Context, _ string, msg Message) error {
	m.msgs = append(m.msgs, msg)
	return nil
}

func TestTemplatesRender(t *testing.T) {
	s := &memSender{}
	m := NewWithSender(s, "LuxeBeau <hello@luxebeau.ng>", "https://luxebeau.ng", slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx := context.Background()

	if err := m.SendVerificationCode(ctx, "ada@example.com", "Ada Obi", "042917"); err != nil {
		t.Fatal(err)
	}
	if err := m.OrderPlaced(ctx, "ada@example.com", "Ada", OrderEmail{OrderID: "LB-12345", PaymentStatus: "paid", Items: []OrderLine{{Name: "Shea <Crème>", Brand: "Zaria", Qty: 2, Total: "₦18,000"}}, Subtotal: "₦18,000", Delivery: "Free", Total: "₦18,000", Address: "1 Lekki"}); err != nil {
		t.Fatal(err)
	}
	b := BookingEmail{BookingID: "BK-1", Service: "Gele", Artisan: "Tolu", Client: "Ada", When: "Mon", Where: "Home", Price: "from ₦20,000"}
	for _, f := range []func(context.Context, string, string, BookingEmail) error{m.BookingRequested, m.NewBookingForArtisan, m.BookingConfirmed} {
		if err := f(ctx, "ada@example.com", "Ada", b); err != nil {
			t.Fatal(err)
		}
	}
	if len(s.msgs) != 5 {
		t.Fatalf("sent %d messages", len(s.msgs))
	}
	code := s.msgs[0]
	if !strings.Contains(code.HTML, "042917") || !strings.Contains(code.Text, "042917") || !strings.Contains(code.Subject, "042917") {
		t.Error("verification code missing from message")
	}
	// User-controlled text is escaped in HTML.
	if strings.Contains(s.msgs[1].HTML, "<Crème>") || !strings.Contains(s.msgs[1].HTML, "&lt;Crème&gt;") {
		t.Error("product name not HTML-escaped")
	}
}

func TestBuildRejectsHeaderInjection(t *testing.T) {
	if _, err := build("LuxeBeau <a@b.co>", Message{To: "x@y.co\r\nBcc: evil@z.co", Subject: "hi"}); err == nil {
		t.Error("CRLF in recipient accepted")
	}
	if _, err := build("LuxeBeau <a@b.co>", Message{To: "x@y.co", Subject: "hi\nBcc: evil@z.co"}); err == nil {
		t.Error("CRLF in subject accepted")
	}
	raw, err := build("LuxeBeau <a@b.co>", Message{To: "x@y.co", Subject: "Hello ₦", HTML: "<p>hi</p>", Text: "hi"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), "multipart/alternative") || !strings.Contains(string(raw), "=?UTF-8?q?") {
		t.Error("message not multipart or subject not encoded")
	}
}

func TestDisabledSenderFailsClosed(t *testing.T) {
	m := New(Config{}, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err := m.SendVerificationCode(context.Background(), "a@b.co", "A", "123456"); err == nil {
		t.Error("unconfigured mailer reported success")
	}
}
