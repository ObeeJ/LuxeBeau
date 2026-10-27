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

func TestCancellationEmails(t *testing.T) {
	s := &memSender{}
	m := NewWithSender(s, "LuxeBeau <hello@luxebeau.ng>", "https://luxebeau.ng", slog.New(slog.NewTextHandler(io.Discard, nil)))
	ctx := context.Background()
	b := BookingEmail{BookingID: "BK-1", Service: "Gele", Artisan: "Tolu", Client: "Ada", When: "Mon 2 Nov at 09:00", Where: "Studio",
		Price: "from ₦20,000", Policy: "Free to cancel until Sun 1 Nov, 9:00 AM. After that it counts as a late cancellation"}

	send := func(f func(context.Context, string, string, BookingEmail, CancelEmail) error, c CancelEmail) Message {
		t.Helper()
		before := len(s.msgs)
		if err := f(ctx, "x@example.com", "Ada Obi", b, c); err != nil {
			t.Fatal(err)
		}
		if len(s.msgs) != before+1 {
			t.Fatal("no message sent")
		}
		return s.msgs[len(s.msgs)-1]
	}

	for name, msg := range map[string]Message{
		"client, by artisan": send(m.BookingCancelledForClient, CancelEmail{By: "artisan", Reason: "Closed for a family event"}),
		"client, by client":  send(m.BookingCancelledForClient, CancelEmail{By: "buyer", Late: true}),
		"client, expired":    send(m.BookingCancelledForClient, CancelEmail{By: "system", Reason: "The artisan didn't answer in time"}),
		"artisan, late":      send(m.BookingCancelledForArtisan, CancelEmail{By: "buyer", Late: true}),
	} {
		if strings.Contains(msg.HTML, "Free to cancel") || strings.Contains(msg.Text, "Free to cancel") {
			t.Errorf("%s: a cancelled booking's email still shows the cancellation terms", name)
		}
	}
	if m := send(m.BookingCancelledForClient, CancelEmail{By: "artisan", Reason: "Closed for a family event"}); !strings.Contains(m.HTML, "Closed for a family event") {
		t.Error("the artisan's reason is missing from the client's email")
	}
	if m := send(m.BookingCancelledForClient, CancelEmail{By: "system", Reason: "The artisan didn't answer in time"}); strings.Contains(m.HTML, ">Reason<") {
		t.Error("the expiry email repeats its own heading as a reason")
	}
	if m := send(m.BookingCancelledForClient, CancelEmail{By: "buyer", Late: true}); !strings.Contains(m.Text, "late cancellation") {
		t.Error("a late cancellation isn't called out to the client who made it")
	}
	if m := send(m.BookingCancelledForArtisan, CancelEmail{By: "buyer", Late: true}); !strings.Contains(m.Text, "late cancellation") {
		t.Error("a late cancellation isn't called out to the artisan")
	}

	// The requested and confirmed emails do carry the terms: that is where they're agreed.
	if err := m.BookingRequested(ctx, "x@example.com", "Ada", b); err != nil {
		t.Fatal(err)
	}
	if last := s.msgs[len(s.msgs)-1]; !strings.Contains(last.HTML, "Free to cancel until Sun 1 Nov") {
		t.Error("the booking request email doesn't state the cancellation terms")
	}
}
