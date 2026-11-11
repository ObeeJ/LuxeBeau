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
	"net/textproto"
	"net/url"

	"github.com/gin-gonic/gin"

	"luxebeau/internal/response"
)

// compressSlots limits how many photos are decoded and compressed at once.
// Each needs tens of megabytes, so on a small server a burst of uploads could
// otherwise exhaust memory.
var compressSlots = make(chan struct{}, 2)

var errBusy = errors.New("all compression slots are busy")

// compressWithSlot compresses an uploaded photo while holding one processing
// slot, and gives the slot back as soon as compression is done.
func compressWithSlot(fh *multipart.FileHeader) (*CompressResult, error) {
	select {
	case compressSlots <- struct{}{}:
		defer func() { <-compressSlots }()
	default:
		return nil, errBusy
	}
	return CompressFromMultipart(fh)
}

// UploadBytes stores already-compressed image bytes in Cloudflare Images and
// returns the delivery URL. It asks Cloudflare for a one-time upload URL, then
// sends the file to it.
func (i *Images) UploadBytes(ctx context.Context, uploaderID string, data []byte, contentType string) (string, error) {
	up, err := i.DirectUpload(ctx, uploaderID)
	if err != nil {
		return "", err
	}
	// The upload URL comes from Cloudflare's API over TLS; still refuse anything
	// that is not https so this can never be steered to a plain-http or local address.
	if u, perr := url.Parse(up.UploadURL); perr != nil || (u.Scheme != "https" && !bytes.HasPrefix([]byte(up.UploadURL), []byte(i.baseURL))) {
		return "", fmt.Errorf("cloudflare images: unexpected upload url")
	}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	hdr := textproto.MIMEHeader{}
	hdr.Set("Content-Disposition", `form-data; name="file"; filename="photo.jpg"`)
	hdr.Set("Content-Type", contentType)
	part, err := mw.CreatePart(hdr)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	mw.Close()

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, up.UploadURL, &body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", mw.FormDataContentType())
	resp, err := i.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("cloudflare images upload: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	var out struct {
		Success bool `json:"success"`
	}
	if resp.StatusCode/100 != 2 || json.Unmarshal(raw, &out) != nil || !out.Success {
		return "", fmt.Errorf("cloudflare images upload failed (status %d)", resp.StatusCode)
	}
	return up.ImageURL, nil
}

// AvatarUploadHandler takes a photo from the signed-in person, compresses it,
// stores it and returns its delivery URL. The person then saves that URL on
// their profile.
func (i *Images) AvatarUploadHandler(logger *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !i.Enabled() {
			response.Fail(c, http.StatusServiceUnavailable, "UPLOADS_NOT_CONFIGURED", "Photo uploads are not available yet.")
			return
		}
		// Receive the whole upload (size-limited) BEFORE taking a processing slot, so a
		// slow or stalled client cannot sit on a slot while it trickles its file in.
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBytes+(1<<20))
		fh, err := c.FormFile("avatar")
		if err != nil {
			var tooBig *http.MaxBytesError
			if errors.As(err, &tooBig) {
				response.Fail(c, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "That photo is too large. The limit is 10 MB.")
				return
			}
			response.BadRequest(c, "Choose a JPEG or PNG photo.")
			return
		}
		// The slot covers only the memory-heavy compression, and is released before
		// the (network-paced) upload to Cloudflare.
		res, err := compressWithSlot(fh)
		switch {
		case err == nil:
		case errors.Is(err, errBusy):
			response.Fail(c, http.StatusServiceUnavailable, "BUSY", "We're processing a lot of photos right now. Please try again in a moment.")
			return
		case errors.Is(err, ErrUnsupportedFormat):
			response.BadRequest(c, "Choose a JPEG or PNG photo.")
			return
		case errors.Is(err, ErrFileTooLarge), errors.Is(err, ErrImageTooLarge), errors.Is(err, ErrCannotShrink):
			response.Fail(c, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "That photo is too large. Try a smaller one.")
			return
		default:
			logger.Error("avatar compress failed", slog.Any("error", err))
			response.InternalError(c, "We couldn't read that photo. Please try another.")
			return
		}
		imageURL, err := i.UploadBytes(c.Request.Context(), c.GetString("userID"), res.Data, res.ContentType)
		if err != nil {
			logger.Error("avatar upload failed", slog.Any("error", err))
			response.Fail(c, http.StatusBadGateway, "UPLOAD_FAILED", "We couldn't save your photo. Please try again.")
			return
		}
		response.OK(c, gin.H{"upload": gin.H{"image_url": imageURL}})
	}
}
