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
)

// CloudflareSender delivers mail through Cloudflare Email Service's REST API
// (HTTPS), which works on hosts that block SMTP ports. The sending domain must
// use Cloudflare DNS and be onboarded under Email Service > Email Sending, and
// the API token needs the "Email Sending: Edit" permission.
type CloudflareSender struct {
	AccountID string
	APIToken  string
	BaseURL   string       // defaults to https://api.cloudflare.com/client/v4; tests use a fake
	Client    *http.Client // optional
}

type cfAddress struct {
	Email string `json:"email"`
	Name  string `json:"name,omitempty"`
}

type cfPayload struct {
	From    cfAddress `json:"from"`
	To      cfAddress `json:"to"`
	Subject string    `json:"subject"`
	HTML    string    `json:"html"`
	Text    string    `json:"text"`
}

func (c CloudflareSender) Send(ctx context.Context, from string, m Message) error {
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
	body, err := json.Marshal(cfPayload{
		From:    cfAddress{Email: fromAddr.Address, Name: fromAddr.Name},
		To:      cfAddress{Email: toAddr.Address, Name: toAddr.Name},
		Subject: m.Subject, HTML: m.HTML, Text: m.Text,
	})
	if err != nil {
		return err
	}
	base := strings.TrimRight(c.BaseURL, "/")
	if base == "" {
		base = "https://api.cloudflare.com/client/v4"
	}
	url := fmt.Sprintf("%s/accounts/%s/email/sending/send", base, c.AccountID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIToken)
	req.Header.Set("Content-Type", "application/json")
	client := c.Client
	if client == nil {
		client = defaultMailClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("cloudflare email: request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	var out struct {
		Success bool `json:"success"`
	}
	// Only the status is reported: the response can echo request details.
	if resp.StatusCode/100 != 2 || json.Unmarshal(raw, &out) != nil || !out.Success {
		return fmt.Errorf("cloudflare email: send failed (status %d)", resp.StatusCode)
	}
	return nil
}
