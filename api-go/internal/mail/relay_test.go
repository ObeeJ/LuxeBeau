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

func fakeRelay(t *testing.T, status int, calls *atomic.Int32, got *map[string]any, hdr *http.Header) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/send" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		*hdr = r.Header.Clone()
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, got)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(`{"ok":false,"error":"details that must not leak"}`))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestRelaySender_PostsTheMessageWithTheSharedSecret(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	srv := fakeRelay(t, 200, &calls, &got, &hdr)
	s := RelaySender{URL: srv.URL, Secret: "relay-secret"}

	err := s.Send(context.Background(), "Luxebeau <owner@gmail.com>", Message{
		To: "Ada Obi <ada@test.ng>", Subject: "Your code", HTML: "<p>123456</p>", Text: "123456"})
	if err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatalf("calls = %d, want 1", calls.Load())
	}
	if hdr.Get("Authorization") != "Bearer relay-secret" || !strings.HasPrefix(hdr.Get("Content-Type"), "application/json") {
		t.Errorf("headers = %v", hdr)
	}
	if got["from"] != "Luxebeau <owner@gmail.com>" || got["to"] != "Ada Obi <ada@test.ng>" ||
		got["subject"] != "Your code" || got["html"] != "<p>123456</p>" || got["text"] != "123456" {
		t.Errorf("payload = %v", got)
	}
}

func TestRelaySender_FailuresAreErrorsThatDoNotLeakSecrets(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	for _, status := range []int{401, 502, 503} {
		srv := fakeRelay(t, status, &calls, &got, &hdr)
		s := RelaySender{URL: srv.URL, Secret: "super-secret"}
		err := s.Send(context.Background(), "Luxebeau <owner@gmail.com>", Message{To: "ada@test.ng", Subject: "x", HTML: "x", Text: "x"})
		if err == nil {
			t.Fatalf("status %d must be an error, not a silent success", status)
		}
		if strings.Contains(err.Error(), "super-secret") || strings.Contains(err.Error(), "must not leak") {
			t.Errorf("error leaks the secret or relay details: %v", err)
		}
	}
}

func TestRelaySender_RefusesBadInputWithoutCallingTheRelay(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	srv := fakeRelay(t, 200, &calls, &got, &hdr)
	s := RelaySender{URL: srv.URL, Secret: "k"}
	for name, m := range map[string]Message{
		"not an address":   {To: "nope", Subject: "x"},
		"header injection": {To: "ada@test.ng", Subject: "hi\r\nBcc: evil@example.com"},
	} {
		if err := s.Send(context.Background(), "Luxebeau <owner@gmail.com>", m); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
	if calls.Load() != 0 {
		t.Errorf("relay called %d times for refused input", calls.Load())
	}
}

func TestNew_RelayBeatsBrevoAndSMTPButNotCloudflare(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	cfg := Config{RelayURL: "https://relay.example.workers.dev", RelaySecret: "s", BrevoAPIKey: "k", SMTPHost: "smtp.gmail.com"}
	if _, ok := New(cfg, logger).sender.(RelaySender); !ok {
		t.Error("the relay should win over Brevo and SMTP")
	}
	cfg.CloudflareAccountID, cfg.CloudflareEmailToken = "a", "t"
	if _, ok := New(cfg, logger).sender.(CloudflareSender); !ok {
		t.Error("Cloudflare Email Service should still win over the relay")
	}
	// A URL without a secret is unusable: fall through.
	half := Config{RelayURL: "https://relay.example.workers.dev", SMTPHost: "smtp.gmail.com"}
	if _, ok := New(half, logger).sender.(SMTPSender); !ok {
		t.Error("an incomplete relay config must not be selected")
	}
}
