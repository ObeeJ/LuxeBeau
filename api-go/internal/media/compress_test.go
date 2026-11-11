package media

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"strings"
	"testing"
)

func makeJPEG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95})
	return buf.Bytes()
}

func makePNG(w, h int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}

func TestCompress_JPEG_SmallImage_PassesThrough(t *testing.T) {
	data := makeJPEG(100, 100)
	res, err := Compress(bytes.NewReader(data), "image/jpeg")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ContentType != "image/jpeg" {
		t.Errorf("content type = %q, want image/jpeg", res.ContentType)
	}
	if len(res.Data) == 0 {
		t.Error("output is empty")
	}
}

func TestCompress_PNG_ConvertedToJPEG(t *testing.T) {
	data := makePNG(200, 200)
	res, err := Compress(bytes.NewReader(data), "image/png")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ContentType != "image/jpeg" {
		t.Errorf("PNG should be converted to JPEG, got %q", res.ContentType)
	}
}

func TestCompress_LargeImage_Resized(t *testing.T) {
	// 3000×3000 should be resized to 2048 on the longest edge.
	data := makeJPEG(2200, 2200)
	res, err := Compress(bytes.NewReader(data), "image/jpeg")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	img, _, err := image.Decode(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatalf("output is not a valid image: %v", err)
	}
	b := img.Bounds()
	if b.Dx() > maxDimension || b.Dy() > maxDimension {
		t.Errorf("output dimensions %dx%d exceed maxDimension %d", b.Dx(), b.Dy(), maxDimension)
	}
}

func TestCompress_UnsupportedFormat_Error(t *testing.T) {
	_, err := Compress(strings.NewReader("not an image"), "image/gif")
	if err != ErrUnsupportedFormat {
		t.Errorf("err = %v, want ErrUnsupportedFormat", err)
	}
}

func TestCompress_TooLarge_Error(t *testing.T) {
	// Simulate a reader that returns more than maxUploadBytes.
	big := bytes.Repeat([]byte("x"), maxUploadBytes+2)
	_, err := Compress(bytes.NewReader(big), "image/jpeg")
	if err != ErrFileTooLarge {
		t.Errorf("err = %v, want ErrFileTooLarge", err)
	}
}
