package mail

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
)

// RelaySender delivers mail by POSTing it over HTTPS to the luxebeau-mail-relay
// Cloudflare Worker (workers/mail-relay), which sends it through Gmail's SMTP.
// It exists because hosts such as Render's free plan block outbound SMTP ports
// but allow HTTPS. The shared secret is sent as a bearer token.
type RelaySender struct {
	URL    string // the Worker's base URL, e.g. https://luxebeau-mail-relay.<account>.workers.dev
	Secret string
	Client *http.Client // optional
}

type relayPayload struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Subject string `json:"subject"`
	HTML    string `json:"html,omitempty"`
	Text    string `json:"text,omitempty"`
}

func (r RelaySender) Send(ctx context.Context, from string, m Message) error {
	for _, v := range []string{from, m.To, m.Subject} {
		if strings.ContainsAny(v, "\r\n") {
			return errors.New("invalid header value")
		}
	}
	if _, err := mail.ParseAddress(from); err != nil {
		return fmt.Errorf("invalid sender: %w", err)
	}
	if _, err := mail.ParseAddress(m.To); err != nil {
		return fmt.Errorf("invalid recipient: %w", err)
	}
	u, err := url.Parse(strings.TrimRight(r.URL, "/") + "/send")
	if err != nil || u.Host == "" {
		return errors.New("mail relay: invalid URL")
	}
	// The secret must never cross the network in clear text. Plain http is only
	// accepted for a local test server.
	if h := u.Hostname(); u.Scheme != "https" && h != "127.0.0.1" && h != "localhost" {
		return errors.New("mail relay: URL must use https")
	}
	body, err := json.Marshal(relayPayload{From: from, To: m.To, Subject: m.Subject, HTML: m.HTML, Text: m.Text})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+r.Secret)
	req.Header.Set("Content-Type", "application/json")
	client := r.Client
	if client == nil {
		client = defaultMailClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("mail relay: request failed: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode/100 != 2 {
		// Only the status is reported: the response can echo request details.
		return fmt.Errorf("mail relay: send failed (status %d)", resp.StatusCode)
	}
	return nil
}
