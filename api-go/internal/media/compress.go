package media

import (
	"bytes"
	"errors"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"strings"

	"github.com/disintegration/imaging"
)

const (
	maxUploadBytes  = 10 << 20  // 10 MiB raw input limit
	maxOutputBytes  = 1 << 20   // 1 MiB target output
	maxDimension    = 2048      // longest edge after resize
	jpegQuality     = 82
)

var (
	ErrUnsupportedFormat = errors.New("only JPEG and PNG images are accepted")
	ErrFileTooLarge      = errors.New("image must be under 10 MB")
)

// CompressResult holds the compressed bytes and their MIME type.
type CompressResult struct {
	Data        []byte
	ContentType string
}

// Compress reads an image from r (up to maxUploadBytes), resizes it so its
// longest edge is at most maxDimension, and re-encodes it as JPEG at
// jpegQuality. PNG inputs are converted to JPEG. The result is always ≤ 1 MiB
// unless the source is already smaller, in which case it is returned as-is.
func Compress(r io.Reader, contentType string) (*CompressResult, error) {
	ct := strings.ToLower(strings.TrimSpace(contentType))
	if !strings.Contains(ct, "jpeg") && !strings.Contains(ct, "jpg") && !strings.Contains(ct, "png") {
		return nil, ErrUnsupportedFormat
	}

	limited := io.LimitReader(r, maxUploadBytes+1)
	raw, err := io.ReadAll(limited)
	if err != nil {
		return nil, err
	}
	if len(raw) > maxUploadBytes {
		return nil, ErrFileTooLarge
	}

	// Decode.
	var img image.Image
	if strings.Contains(ct, "png") {
		img, err = png.Decode(bytes.NewReader(raw))
	} else {
		img, err = jpeg.Decode(bytes.NewReader(raw))
	}
	if err != nil {
		// Try the generic decoder as a fallback.
		img, _, err = image.Decode(bytes.NewReader(raw))
		if err != nil {
			return nil, ErrUnsupportedFormat
		}
	}

	// Resize if needed (Lanczos for quality).
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	if w > maxDimension || h > maxDimension {
		if w >= h {
			img = imaging.Resize(img, maxDimension, 0, imaging.Lanczos)
		} else {
			img = imaging.Resize(img, 0, maxDimension, imaging.Lanczos)
		}
	}

	// Encode as JPEG.
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: jpegQuality}); err != nil {
		return nil, err
	}
	return &CompressResult{Data: buf.Bytes(), ContentType: "image/jpeg"}, nil
}

// CompressFromMultipart extracts the first image file from a multipart form,
// compresses it, and returns the result ready to forward to Cloudflare Images.
func CompressFromMultipart(fh *multipart.FileHeader) (*CompressResult, error) {
	f, err := fh.Open()
	if err != nil {
		return nil, err
	}
	defer f.Close()

	// Detect content type from the first 512 bytes.
	head := make([]byte, 512)
	n, _ := f.Read(head)
	ct := http.DetectContentType(head[:n])
	// Seek back to start (multipart.File implements io.Seeker).
	if s, ok := f.(io.Seeker); ok {
		_, _ = s.Seek(0, io.SeekStart)
	} else {
		// Reconstruct reader from head + rest.
		return Compress(io.MultiReader(bytes.NewReader(head[:n]), f), ct)
	}
	return Compress(f, ct)
}
