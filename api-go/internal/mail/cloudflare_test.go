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

func fakeCloudflareMail(t *testing.T, status int, body string, calls *atomic.Int32, got *map[string]any, hdr *http.Header) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if r.URL.Path != "/client/v4/accounts/acct-1/email/sending/send" || r.Method != http.MethodPost {
			http.NotFound(w, r)
			return
		}
		*hdr = r.Header.Clone()
		b, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(b, got)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv
}

func TestCloudflareSender_PostsToTheAccountsSendEndpoint(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	srv := fakeCloudflareMail(t, 200, `{"success":true,"errors":[],"result":{"delivered":["ada@test.ng"]}}`, &calls, &got, &hdr)
	s := CloudflareSender{AccountID: "acct-1", APIToken: "cf-token", BaseURL: srv.URL + "/client/v4"}

	err := s.Send(context.Background(), "Luxebeau <hello@myluxebeau.com>", Message{
		To: "Ada Obi <ada@test.ng>", Subject: "Your code", HTML: "<p>123456</p>", Text: "123456"})
	if err != nil {
		t.Fatal(err)
	}
	if hdr.Get("Authorization") != "Bearer cf-token" || !strings.HasPrefix(hdr.Get("Content-Type"), "application/json") {
		t.Errorf("headers = %v", hdr)
	}
	from, _ := got["from"].(map[string]any)
	if from["email"] != "hello@myluxebeau.com" || from["name"] != "Luxebeau" {
		t.Errorf("from = %v", got["from"])
	}
	to, _ := got["to"].(map[string]any)
	if to["email"] != "ada@test.ng" {
		t.Errorf("to = %v", got["to"])
	}
	if got["subject"] != "Your code" || got["html"] != "<p>123456</p>" || got["text"] != "123456" {
		t.Errorf("content = %v", got)
	}
}

func TestCloudflareSender_FailuresAreErrorsWithoutLeakingSecrets(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	// HTTP 200 but success:false must still count as a failure.
	for name, tc := range map[string]struct {
		status int
		body   string
	}{
		"unauthorised":  {403, `{"success":false,"errors":[{"message":"secret detail"}]}`},
		"success false": {200, `{"success":false,"errors":[{"message":"secret detail"}]}`},
	} {
		srv := fakeCloudflareMail(t, tc.status, tc.body, &calls, &got, &hdr)
		s := CloudflareSender{AccountID: "acct-1", APIToken: "super-secret-token", BaseURL: srv.URL + "/client/v4"}
		err := s.Send(context.Background(), "Luxebeau <hello@myluxebeau.com>", Message{To: "ada@test.ng", Subject: "x", HTML: "x", Text: "x"})
		if err == nil {
			t.Errorf("%s: a failed send must be an error, not a silent success", name)
			continue
		}
		if strings.Contains(err.Error(), "super-secret-token") || strings.Contains(err.Error(), "secret detail") {
			t.Errorf("%s: error leaks the token or provider details: %v", name, err)
		}
	}
}

func TestCloudflareSender_RefusesBadInputWithoutCallingTheProvider(t *testing.T) {
	var calls atomic.Int32
	var got map[string]any
	var hdr http.Header
	srv := fakeCloudflareMail(t, 200, `{"success":true}`, &calls, &got, &hdr)
	s := CloudflareSender{AccountID: "acct-1", APIToken: "t", BaseURL: srv.URL + "/client/v4"}
	for name, m := range map[string]Message{
		"not an address":   {To: "nope", Subject: "x"},
		"header injection": {To: "ada@test.ng", Subject: "hi\r\nBcc: evil@example.com"},
	} {
		if err := s.Send(context.Background(), "Luxebeau <hello@myluxebeau.com>", m); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
	if calls.Load() != 0 {
		t.Errorf("provider called %d times for refused input", calls.Load())
	}
}

func TestNew_ProviderPriorityIsCloudflareThenBrevoThenSMTP(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	all := Config{CloudflareAccountID: "a", CloudflareEmailToken: "t", BrevoAPIKey: "k", SMTPHost: "smtp.gmail.com"}
	if _, ok := New(all, logger).sender.(CloudflareSender); !ok {
		t.Error("Cloudflare should win when configured")
	}
	all.CloudflareEmailToken = ""
	if _, ok := New(all, logger).sender.(BrevoSender); !ok {
		t.Error("Brevo should win over SMTP when Cloudflare is not configured")
	}
	// A token without an account id is not usable: fall through.
	half := Config{CloudflareEmailToken: "t", SMTPHost: "smtp.gmail.com"}
	if _, ok := New(half, logger).sender.(SMTPSender); !ok {
		t.Error("an incomplete Cloudflare config must not be selected")
	}
}
