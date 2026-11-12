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
	"strings"
	"time"
)

// BrevoSender delivers mail through Brevo's HTTPS API (port 443). Many hosts,
// including Render's free plan, block the SMTP ports (25, 465, 587), so SMTP
// silently times out there; an HTTPS API is not affected. The sender address
// only needs to be verified in Brevo (a domain is not required).
type BrevoSender struct {
	APIKey  string
	BaseURL string       // defaults to https://api.brevo.com; tests point it at a fake
	Client  *http.Client // optional
}

var defaultMailClient = &http.Client{Timeout: 15 * time.Second}

type brevoAddress struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email"`
}

type brevoPayload struct {
	Sender      brevoAddress   `json:"sender"`
	To          []brevoAddress `json:"to"`
	Subject     string         `json:"subject"`
	HTMLContent string         `json:"htmlContent"`
	TextContent string         `json:"textContent"`
}

func (b BrevoSender) Send(ctx context.Context, from string, m Message) error {
	for _, v := range []string{from, m.To, m.Subject} {
		if strings.ContainsAny(v, "\r\n") {
			return errors.New("invalid header value")
		}
	}
	fromAddr, err := mail.ParseAddress(from)
	if err != nil {
		return fmt.Errorf("invalid sender: %w", err)
	}
	toAddr, err := mail.ParseAddress(m.To)
	if err != nil {
		return fmt.Errorf("invalid recipient: %w", err)
	}
	body, err := json.Marshal(brevoPayload{
		Sender:      brevoAddress{Name: fromAddr.Name, Email: fromAddr.Address},
		To:          []brevoAddress{{Name: toAddr.Name, Email: toAddr.Address}},
		Subject:     m.Subject,
		HTMLContent: m.HTML,
		TextContent: m.Text,
	})
	if err != nil {
		return err
	}
	base := strings.TrimRight(b.BaseURL, "/")
	if base == "" {
		base = "https://api.brevo.com"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v3/smtp/email", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("api-key", b.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	client := b.Client
	if client == nil {
		client = defaultMailClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("brevo: request failed: %w", err)
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode/100 != 2 {
		// Only the status is reported: the response can echo request details.
		return fmt.Errorf("brevo: send failed (status %d)", resp.StatusCode)
	}
	return nil
}
