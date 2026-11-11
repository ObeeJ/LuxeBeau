package media

import (
	"bytes"
	"encoding/json"
	"image"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

type cfCapture struct {
	slotsHeld   int // how many compression slots were taken while Cloudflare was receiving the file
	uploads     int
	bytes       []byte
	contentType string
}

// fakeCloudflare stands in for the Cloudflare Images API: one endpoint hands out
// an upload URL, the other receives the file.
func fakeCloudflare(t *testing.T, failUpload bool) (*Images, *cfCapture) {
	t.Helper()
	cap := &cfCapture{}
	mux := http.NewServeMux()
	var srv *httptest.Server
	mux.HandleFunc("/accounts/acct/images/v2/direct_upload", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true, "result": map[string]string{"id": "img123", "uploadURL": srv.URL + "/upload/one-time"}})
	})
	mux.HandleFunc("/upload/one-time", func(w http.ResponseWriter, r *http.Request) {
		if failUpload {
			http.Error(w, "boom", http.StatusInternalServerError)
			return
		}
		f, hdr, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "no file", http.StatusBadRequest)
			return
		}
		cap.uploads++
		cap.slotsHeld = len(compressSlots)
		cap.bytes, _ = io.ReadAll(f)
		cap.contentType = hdr.Header.Get("Content-Type")
		_ = json.NewEncoder(w).Encode(map[string]any{"success": true})
	})
	srv = httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	img := New(Config{AccountID: "acct", APIToken: "tok", AccountHash: "hash"})
	img.baseURL = srv.URL
	img.client = srv.Client()
	return img, cap
}

func avatarRequest(t *testing.T, h gin.HandlerFunc, field, contentType string, data []byte) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	if field != "" {
		hdr := textproto.MIMEHeader{}
		hdr.Set("Content-Disposition", `form-data; name="`+field+`"; filename="photo"`)
		hdr.Set("Content-Type", contentType)
		part, _ := mw.CreatePart(hdr)
		part.Write(data)
	}
	mw.Close()
	r := gin.New()
	r.POST("/avatar", func(c *gin.Context) { c.Set("userID", "user-1") }, h)
	req := httptest.NewRequest(http.MethodPost, "/avatar", &body)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func TestAvatarUpload_CompressesThenStoresAndReturnsTheDeliveryURL(t *testing.T) {
	imgs, cap := fakeCloudflare(t, false)
	w := avatarRequest(t, imgs.AvatarUploadHandler(quiet()), "avatar", "image/jpeg", makeJPEG(2200, 1500))
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var out struct {
		Data struct {
			Upload struct {
				ImageURL string `json:"image_url"`
			} `json:"upload"`
		} `json:"data"`
	}
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	if out.Data.Upload.ImageURL != "https://imagedelivery.net/hash/img123/public" {
		t.Errorf("image_url = %q", out.Data.Upload.ImageURL)
	}
	if cap.slotsHeld != 0 || len(compressSlots) != 0 {
		t.Errorf("compression slots held during the cloudflare upload: %d, after: %d; a slot is only for compressing and must be released before the slow network upload", cap.slotsHeld, len(compressSlots))
	}
	if cap.uploads != 1 || cap.contentType != "image/jpeg" {
		t.Fatalf("cloudflare got %d uploads, content type %q", cap.uploads, cap.contentType)
	}
	if len(cap.bytes) > maxOutputBytes {
		t.Errorf("sent %d bytes to cloudflare; it must be compressed to at most %d", len(cap.bytes), maxOutputBytes)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(cap.bytes))
	if err != nil || cfg.Width > maxDimension || cfg.Height > maxDimension {
		t.Errorf("uploaded image %v err %v; want a valid image within %d px", cfg, err, maxDimension)
	}
}

func TestAvatarUpload_RefusesBadRequestsWithoutCallingCloudflare(t *testing.T) {
	imgs, cap := fakeCloudflare(t, false)
	h := imgs.AvatarUploadHandler(quiet())
	if w := avatarRequest(t, h, "", "", nil); w.Code != 400 {
		t.Errorf("no file: status %d, want 400", w.Code)
	}
	if w := avatarRequest(t, h, "avatar", "text/plain", []byte("not an image")); w.Code != 400 {
		t.Errorf("not an image: status %d, want 400", w.Code)
	}
	if w := avatarRequest(t, h, "avatar", "image/jpeg", bytes.Repeat([]byte("x"), maxUploadBytes+2<<20)); w.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("huge file: status %d, want 413", w.Code)
	}
	if cap.uploads != 0 {
		t.Errorf("cloudflare was called %d times for requests that should be refused", cap.uploads)
	}
}

func TestAvatarUpload_NotConfiguredAndProviderFailure(t *testing.T) {
	notConfigured := New(Config{})
	if w := avatarRequest(t, notConfigured.AvatarUploadHandler(quiet()), "avatar", "image/jpeg", makeJPEG(50, 50)); w.Code != 503 {
		t.Errorf("not configured: status %d, want 503", w.Code)
	}
	imgs, _ := fakeCloudflare(t, true)
	w := avatarRequest(t, imgs.AvatarUploadHandler(quiet()), "avatar", "image/jpeg", makeJPEG(50, 50))
	if w.Code != 502 || strings.Contains(w.Body.String(), "boom") {
		t.Errorf("provider failure: status %d body %s; want 502 without leaking the provider's message", w.Code, w.Body.String())
	}
}

// Compressing a photo needs a lot of memory, so only a couple may run at once.
// Extra requests are told to try again instead of piling up.
func TestAvatarUpload_OnlyAFewPhotosAreProcessedAtOnce(t *testing.T) {
	imgs, got := fakeCloudflare(t, false)
	for range cap(compressSlots) { // occupy every slot, as if that many uploads were in progress
		compressSlots <- struct{}{}
	}
	defer func() {
		for range cap(compressSlots) {
			<-compressSlots
		}
	}()
	w := avatarRequest(t, imgs.AvatarUploadHandler(quiet()), "avatar", "image/jpeg", makeJPEG(50, 50))
	if w.Code != http.StatusServiceUnavailable || got.uploads != 0 {
		t.Errorf("status %d, uploads %d; want 503 and nothing sent to cloudflare while all slots are busy", w.Code, got.uploads)
	}
}
