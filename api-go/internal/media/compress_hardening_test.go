package media

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"math/rand"
	"testing"
)

// A small file can still describe a gigantic picture (a "decompression bomb").
// The size must be checked before the picture is decoded into memory.
func TestCompress_RefusesAnImageWithTooManyPixels(t *testing.T) {
	// A tiny, valid-looking PNG header that claims 8000 x 6000 pixels (48 megapixels).
	// Only the header is needed: the size must be refused before any decoding.
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], 8000)
	binary.BigEndian.PutUint32(ihdr[4:], 6000)
	ihdr[8], ihdr[9] = 8, 0 // 8-bit greyscale
	chunk := func(kind string, data []byte) []byte {
		out := make([]byte, 0, 12+len(data))
		out = binary.BigEndian.AppendUint32(out, uint32(len(data)))
		out = append(out, kind...)
		out = append(out, data...)
		return binary.BigEndian.AppendUint32(out, crc32.ChecksumIEEE(append([]byte(kind), data...)))
	}
	file := append([]byte("\x89PNG\r\n\x1a\n"), chunk("IHDR", ihdr)...)
	file = append(file, chunk("IEND", nil)...)
	if _, err := Compress(bytes.NewReader(file), "image/png"); !errors.Is(err, ErrImageTooLarge) {
		t.Errorf("err = %v, want ErrImageTooLarge (a %d byte file asked for 48 megapixels)", err, len(file))
	}
}

// JPEG has no transparency: transparent areas used to turn black.
func TestCompress_TransparentPNGBecomesWhiteNotBlack(t *testing.T) {
	img := image.NewNRGBA(image.Rect(0, 0, 40, 40)) // fully transparent
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	res, err := Compress(&buf, "image/png")
	if err != nil {
		t.Fatal(err)
	}
	out, err := jpeg.Decode(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatal(err)
	}
	r, g, b, _ := out.At(20, 20).RGBA()
	if r>>8 < 240 || g>>8 < 240 || b>>8 < 240 {
		t.Errorf("transparent pixel became (%d,%d,%d), want near white", r>>8, g>>8, b>>8)
	}
}

// Phones store photos sideways and add a rotation tag. The result must be upright.
func TestCompress_HonoursPhotoRotation(t *testing.T) {
	src := makeJPEG(100, 50) // landscape pixels
	// Insert an EXIF block saying "rotate 90 degrees" (orientation 6) after the JPEG start marker.
	exif := []byte{
		0xFF, 0xE1, 0x00, 0x22, 'E', 'x', 'i', 'f', 0, 0,
		'M', 'M', 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08,
		0x00, 0x01, 0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
	}
	data := append(append(append([]byte{}, src[:2]...), exif...), src[2:]...)
	res, err := Compress(bytes.NewReader(data), "image/jpeg")
	if err != nil {
		t.Fatal(err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(res.Data))
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Width != 50 || cfg.Height != 100 {
		t.Errorf("output is %dx%d, want 50x100 (turned upright)", cfg.Width, cfg.Height)
	}
}

// The promise is a result of at most 1 MiB, even for a noisy photo that does not
// compress well.
func TestCompress_OutputNeverExceedsTheSizeLimit(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	img := image.NewRGBA(image.Rect(0, 0, 1100, 1100))
	rng.Read(img.Pix)
	for i := 3; i < len(img.Pix); i += 4 {
		img.Pix[i] = 255
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatal(err)
	}
	if buf.Len() > maxUploadBytes {
		t.Skipf("noise image is %d bytes, over the upload limit", buf.Len())
	}
	res, err := Compress(&buf, "image/jpeg")
	if err != nil {
		t.Fatal(err)
	}
	if len(res.Data) > maxOutputBytes {
		t.Errorf("output is %d bytes, want at most %d", len(res.Data), maxOutputBytes)
	}
	if _, err := jpeg.Decode(bytes.NewReader(res.Data)); err != nil {
		t.Errorf("output is not a valid JPEG: %v", err)
	}
}

// The declared type is not trusted: the bytes must really be a JPEG or PNG.
func TestCompress_ChecksTheRealFormat(t *testing.T) {
	pal := image.NewPaletted(image.Rect(0, 0, 10, 10), color.Palette{color.Black, color.White})
	var g bytes.Buffer
	_ = gif.Encode(&g, pal, nil)
	if _, err := Compress(&g, "image/png"); !errors.Is(err, ErrUnsupportedFormat) {
		t.Errorf("a GIF labelled as PNG: err = %v, want ErrUnsupportedFormat", err)
	}
	if _, err := Compress(bytes.NewReader([]byte("definitely not an image")), "image/jpeg"); !errors.Is(err, ErrUnsupportedFormat) {
		t.Errorf("garbage labelled as JPEG: err = %v, want ErrUnsupportedFormat", err)
	}
}
