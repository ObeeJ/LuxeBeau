// Package media issues one-time Cloudflare Images upload URLs and validates
// image links. Browsers upload directly to Cloudflare, so the API never
// handles file bytes; the API only stores delivery URLs from this account.
package media

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/response"
)

var ErrNotConfigured = errors.New("image uploads are not configured")

type Config struct {
	AccountID   string // Cloudflare account id
	APIToken    string // token with Cloudflare Images: Edit
	AccountHash string // imagedelivery.net account hash
	Variant     string // delivery variant name, default "public"
}

type Images struct {
	cfg     Config
	client  *http.Client
	baseURL string
}

func New(cfg Config) *Images {
	if cfg.Variant == "" {
		cfg.Variant = "public"
	}
	return &Images{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second}, baseURL: "https://api.cloudflare.com/client/v4"}
}

func (i *Images) Enabled() bool {
	return i.cfg.AccountID != "" && i.cfg.APIToken != "" && i.cfg.AccountHash != ""
}

// deliveryPrefix is the only URL prefix stored image links may use.
func (i *Images) deliveryPrefix() string {
	return "https://imagedelivery.net/" + i.cfg.AccountHash + "/"
}

// ValidURL accepts an empty value (no image) or a delivery URL from this
// account, so sellers cannot point product images at arbitrary hosts.
func (i *Images) ValidURL(u string) bool {
	if u == "" {
		return true
	}
	if i.cfg.AccountHash == "" || len(u) > 500 {
		return false
	}
	rest, ok := strings.CutPrefix(u, i.deliveryPrefix())
	if !ok {
		return false
	}
	parts := strings.Split(rest, "/")
	return len(parts) == 2 && parts[0] != "" && parts[1] != "" && !strings.ContainsAny(rest, "?#\\ ")
}

type Upload struct {
	UploadURL string `json:"upload_url"`
	ImageURL  string `json:"image_url"`
}

// DirectUpload asks Cloudflare for a single-use upload URL tied to an image
// id, recording the uploader in the image metadata.
func (i *Images) DirectUpload(ctx context.Context, uploaderID string) (*Upload, error) {
	if !i.Enabled() {
		return nil, ErrNotConfigured
	}
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	_ = w.WriteField("requireSignedURLs", "false")
	meta, _ := json.Marshal(map[string]string{"uploader": uploaderID})
	_ = w.WriteField("metadata", string(meta))
	_ = w.WriteField("expiry", time.Now().Add(30*time.Minute).UTC().Format(time.RFC3339))
	w.Close()

	url := fmt.Sprintf("%s/accounts/%s/images/v2/direct_upload", i.baseURL, i.cfg.AccountID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, &body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+i.cfg.APIToken)
	req.Header.Set("Content-Type", w.FormDataContentType())

	resp, err := i.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("cloudflare images: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	var out struct {
		Success bool `json:"success"`
		Result  struct {
			ID        string `json:"id"`
			UploadURL string `json:"uploadURL"`
		} `json:"result"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || !out.Success || out.Result.ID == "" {
		return nil, fmt.Errorf("cloudflare images: upload url request failed (status %d)", resp.StatusCode)
	}
	return &Upload{
		UploadURL: out.Result.UploadURL,
		ImageURL:  i.deliveryPrefix() + out.Result.ID + "/" + i.cfg.Variant,
	}, nil
}

// UploadHandler issues a direct-upload URL to a signed-in partner.
func (i *Images) UploadHandler(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		up, err := i.DirectUpload(c.Request.Context(), c.GetString("userID"))
		if errors.Is(err, ErrNotConfigured) {
			response.Fail(c, http.StatusServiceUnavailable, "UPLOADS_NOT_CONFIGURED", "Photo uploads are not available yet.")
			return
		}
		if err != nil {
			logger.Error("image upload url failed", slog.Any("error", err))
			response.InternalError(c, "We couldn't start the upload. Please try again.")
			return
		}
		response.OK(c, gin.H{"upload": up})
	}
}
