package mail

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func fakeBrevo(t *testing.T, status int, calls *atomic.Int32, got *map[string]any, hdr *http.Header) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/v3/smtp/email" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		*hdr = r.Header.Clone()
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, got)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(`{"messageId":"<x@brevo>","message":"details that must not leak"}`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestBrevoSender_PostsTheMessageOverHTTPS(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	srv := fakeBrevo(t, 201, &calls, &got, &hdr)
	s := BrevoSender{APIKey: "key-123", BaseURL: srv.URL}

	err := s.Send(context.Background(), "Luxebeau <hello@example.com>", Message{
		To: "Ada Obi <ada@test.ng>", Subject: "Your code", HTML: "<p>123456</p>", Text: "123456"})
	if err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want 1", calls.Load())
	}
	if hdr.Get("api-key") != "key-123" || !strings.HasPrefix(hdr.Get("Content-Type"), "application/json") {
		t.Errorf("headers = %v; want the api-key header and a JSON body", hdr)
	}
	sender, _ := got["sender"].(map[string]any)
	if sender["email"] != "hello@example.com" || sender["name"] != "Luxebeau" {
		t.Errorf("sender = %v", sender)
	}
	to, _ := got["to"].([]any)
	if len(to) != 1 || to[0].(map[string]any)["email"] != "ada@test.ng" {
		t.Errorf("to = %v", to)
	}
	if got["subject"] != "Your code" || got["htmlContent"] != "<p>123456</p>" || got["textContent"] != "123456" {
		t.Errorf("content = %v", got)
	}
}

func TestBrevoSender_FailuresAreErrorsThatDoNotLeakSecrets(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	srv := fakeBrevo(t, 401, &calls, &got, &hdr)
	s := BrevoSender{APIKey: "super-secret-key", BaseURL: srv.URL}
	err := s.Send(context.Background(), "Luxebeau <hello@example.com>", Message{To: "ada@test.ng", Subject: "x", HTML: "x", Text: "x"})
	if err == nil {
		t.Fatal("a 401 from the provider must be an error, not a silent success")
	}
	if strings.Contains(err.Error(), "super-secret-key") || strings.Contains(err.Error(), "must not leak") {
		t.Errorf("error leaks provider details or the key: %v", err)
	}
	if !strings.Contains(err.Error(), "401") {
		t.Errorf("error should say the status so it can be diagnosed: %v", err)
	}
}

func TestBrevoSender_RefusesBadInputWithoutCallingTheProvider(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	srv := fakeBrevo(t, 201, &calls, &got, &hdr)
	s := BrevoSender{APIKey: "k", BaseURL: srv.URL}
	for name, m := range map[string]Message{
		"not an address":   {To: "not-an-address", Subject: "x"},
		"header injection": {To: "ada@test.ng", Subject: "hi\r\nBcc: evil@example.com"},
		"injection in to":  {To: "ada@test.ng\r\nBcc: evil@example.com", Subject: "x"},
	} {
		if err := s.Send(context.Background(), "Luxebeau <hello@example.com>", m); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
	if err := s.Send(context.Background(), "not a sender", Message{To: "ada@test.ng", Subject: "x"}); err == nil {
		t.Error("an invalid sender address must be refused")
	}
	if calls.Load() != 0 {
		t.Errorf("provider was called %d times for input that should be refused", calls.Load())
	}
}

func TestNew_ApiKeyBeatsSMTPSoItWorksWhereSMTPPortsAreBlocked(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	m := New(Config{From: "Luxebeau <hello@example.com>", BrevoAPIKey: "k", SMTPHost: "smtp.gmail.com", SMTPPort: 465}, logger)
	if _, ok := m.sender.(BrevoSender); !ok {
		t.Errorf("sender is %T, want BrevoSender when an API key is set", m.sender)
	}
	m = New(Config{SMTPHost: "smtp.gmail.com", SMTPPort: 465}, logger)
	if _, ok := m.sender.(SMTPSender); !ok {
		t.Errorf("sender is %T, want SMTPSender when only SMTP is set", m.sender)
	}
}
