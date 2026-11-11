package media

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	_ "image/png" // registers the PNG decoder for image.DecodeConfig
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/disintegration/imaging"
)

const (
	maxUploadBytes = 10 << 20   // 10 MiB raw input limit
	maxOutputBytes = 1 << 20    // 1 MiB: the compressed result never exceeds this
	maxDimension   = 2048       // longest edge after resizing
	maxPixels      = 25_000_000 // refuse pictures over 25 megapixels before decoding: decoding needs ~4 bytes a pixel, and more than one copy
	jpegQuality    = 82         // first quality tried
	minJPEGQuality = 46         // lowest quality tried before shrinking the picture instead
)

var (
	ErrUnsupportedFormat = errors.New("only JPEG and PNG images are accepted")
	ErrFileTooLarge      = errors.New("image must be under 10 MB")
	ErrImageTooLarge     = errors.New("image dimensions are too large")
	ErrCannotShrink      = errors.New("this image could not be made small enough")
)

// CompressResult holds the compressed bytes and their MIME type.
type CompressResult struct {
	Data        []byte
	ContentType string
}

// Compress reads a JPEG or PNG (at most maxUploadBytes), turns it upright using
// its rotation tag, puts transparent PNGs on a white background, resizes it so
// the longest edge is at most maxDimension, and re-encodes it as a JPEG of at
// most maxOutputBytes. The declared content type is only a first filter: the
// bytes themselves must really be a JPEG or PNG, and the picture's pixel size is
// checked before it is decoded so a tiny file cannot demand gigabytes of memory.
func Compress(r io.Reader, contentType string) (*CompressResult, error) {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	if !strings.Contains(ct, "jpeg") && !strings.Contains(ct, "jpg") && !strings.Contains(ct, "png") {
		return nil, ErrUnsupportedFormat
	}

	raw, err := io.ReadAll(io.LimitReader(r, maxUploadBytes+1))
	if err != nil {
		return nil, err
	}
	if len(raw) > maxUploadBytes {
		return nil, ErrFileTooLarge
	}

	cfg, format, err := image.DecodeConfig(bytes.NewReader(raw))
	if err != nil || (format != "jpeg" && format != "png") {
		return nil, ErrUnsupportedFormat
	}
	if int64(cfg.Width)*int64(cfg.Height) > maxPixels {
		return nil, ErrImageTooLarge
	}

	img, err := imaging.Decode(bytes.NewReader(raw), imaging.AutoOrientation(true))
	if err != nil {
		return nil, ErrUnsupportedFormat
	}
	if format == "png" {
		// JPEG has no transparency; without this, transparent areas turn black.
		b := img.Bounds()
		img = imaging.OverlayCenter(imaging.New(b.Dx(), b.Dy(), color.White), img, 1.0)
	}
	if b := img.Bounds(); b.Dx() > maxDimension || b.Dy() > maxDimension {
		if b.Dx() >= b.Dy() {
			img = imaging.Resize(img, maxDimension, 0, imaging.Lanczos)
		} else {
			img = imaging.Resize(img, 0, maxDimension, imaging.Lanczos)
		}
	}

	// Try lower qualities first; if the picture is still too big (noisy photos),
	// make it 20% smaller and try again.
	for range 6 {
		for q := jpegQuality; q >= minJPEGQuality; q -= 12 {
			var buf bytes.Buffer
			if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: q}); err != nil {
				return nil, err
			}
			if buf.Len() <= maxOutputBytes {
				return &CompressResult{Data: buf.Bytes(), ContentType: "image/jpeg"}, nil
			}
		}
		img = imaging.Resize(img, img.Bounds().Dx()*4/5, 0, imaging.Lanczos)
	}
	return nil, ErrCannotShrink
}

// CompressFromMultipart compresses an uploaded form file. The type is detected
// from the file's own first bytes, not from what the browser claimed.
func CompressFromMultipart(fh *multipart.FileHeader) (*CompressResult, error) {
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()

	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	ct := http.DetectContentType(head[:n])
	return Compress(io.MultiReader(bytes.NewReader(head[:n]), f), ct)
}
