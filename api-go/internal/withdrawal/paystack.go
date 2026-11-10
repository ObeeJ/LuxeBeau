package withdrawal

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// paystackClient talks to Paystack's Transfers API. With no key it reports
// itself as not configured; it never pretends a transfer happened.
type paystackClient struct {
	secret  string
	baseURL string
	http    *http.Client
}

func newPaystackClient(secret, baseURL string) *paystackClient {
	if baseURL == "" {
		baseURL = "https://api.paystack.co"
	}
	return &paystackClient{
		secret:  secret,
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 15 * time.Second},
	}
}

func (p *paystackClient) Configured() bool { return p.secret != "" }

// apiError is Paystack saying no (status false), with its own message.
type apiError struct {
	msg  string
	code int
}

func (e *apiError) Error() string { return fmt.Sprintf("paystack: %s (HTTP %d)", e.msg, e.code) }

func (p *paystackClient) call(ctx context.Context, method, path string, body, data any) error {
	var rd io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		rd = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(ctx, method, p.baseURL+path, rd)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+p.secret)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.http.Do(req)
	if err != nil {
		return fmt.Errorf("paystack %s: %w", path, err)
	}
	defer resp.Body.Close()

	var out struct {
		Status  bool            `json:"status"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&out); err != nil {
		return fmt.Errorf("paystack %s: unreadable response (HTTP %d)", path, resp.StatusCode)
	}
	if !out.Status {
		return &apiError{msg: out.Message, code: resp.StatusCode}
	}
	if data != nil {
		return json.Unmarshal(out.Data, data)
	}
	return nil
}

func (p *paystackClient) ResolveAccount(ctx context.Context, accountNumber, bankCode string) (string, error) {
	q := url.Values{"account_number": {accountNumber}, "bank_code": {bankCode}}
	var data struct {
		AccountName string `json:"account_name"`
	}
	if err := p.call(ctx, http.MethodGet, "/bank/resolve?"+q.Encode(), nil, &data); err != nil {
		var ae *apiError
		// Only "bad request / not found / unprocessable" mean the account is not
		// there; a 401 or 403 is our own key being wrong, not the seller's mistake.
		if errors.As(err, &ae) && (ae.code == 400 || ae.code == 404 || ae.code == 422) {
			return "", fmt.Errorf("%w: %s", ErrAccountNotFound, ae.msg)
		}
		return "", err
	}
	if strings.TrimSpace(data.AccountName) == "" {
		return "", ErrAccountNotFound
	}
	return data.AccountName, nil
}

func (p *paystackClient) CreateRecipient(ctx context.Context, name, accountNumber, bankCode string) (string, error) {
	var data struct {
		RecipientCode string `json:"recipient_code"`
	}
	err := p.call(ctx, http.MethodPost, "/transferrecipient", map[string]any{
		"type": "nuban", "name": name, "account_number": accountNumber,
		"bank_code": bankCode, "currency": "NGN",
	}, &data)
	if err != nil {
		return "", err
	}
	if data.RecipientCode == "" {
		return "", fmt.Errorf("paystack: no recipient code returned")
	}
	return data.RecipientCode, nil
}

// VerifyTransfer asks Paystack whether it holds a transfer with this reference
// and what state it is in. A 404 means it does not (found=false).
func (p *paystackClient) VerifyTransfer(ctx context.Context, reference string) (string, bool, error) {
	var data struct {
		Status string `json:"status"`
	}
	err := p.call(ctx, http.MethodGet, "/transfer/verify/"+url.PathEscape(reference), nil, &data)
	if err != nil {
		var ae *apiError
		if errors.As(err, &ae) && ae.code == 404 {
			return "", false, nil
		}
		return "", false, err
	}
	return data.Status, true, nil
}

func (p *paystackClient) Transfer(ctx context.Context, amount int64, recipientCode, reference, reason string) (string, error) {
	var data struct {
		TransferCode string `json:"transfer_code"`
	}
	err := p.call(ctx, http.MethodPost, "/transfer", map[string]any{
		"source": "balance", "amount": amount, "recipient": recipientCode,
		"reason": reason, "reference": reference,
	}, &data)
	if err != nil {
		return "", err
	}
	return data.TransferCode, nil
}
