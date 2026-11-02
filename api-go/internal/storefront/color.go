package storefront

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var hexRegex = regexp.MustCompile(`^#?([0-9a-fA-F]{6})$`)

// ThemeVariants holds the 5 derived theme variants and their contrast foregrounds.
type ThemeVariants struct {
	True  VariantConfig `json:"true"`
	Soft  VariantConfig `json:"soft"`
	Deep  VariantConfig `json:"deep"`
	Muted VariantConfig `json:"muted"`
	Vivid VariantConfig `json:"vivid"`
}

type VariantConfig struct {
	AccentHex   string  `json:"accent_hex"`
	OnAccentHex string  `json:"on_accent_hex"`
	Contrast    float64 `json:"contrast"`
	PassesAA    bool    `json:"passes_aa"`
}

// NormalizeHex ensures the hex string is formatted as #RRGGBB in upper case.
func NormalizeHex(hex string) (string, error) {
	hex = strings.TrimSpace(hex)
	if !strings.HasPrefix(hex, "#") {
		hex = "#" + hex
	}
	matches := hexRegex.FindStringSubmatch(hex)
	if len(matches) < 2 {
		return "", fmt.Errorf("invalid hex color format: %s", hex)
	}
	return strings.ToUpper(hex), nil
}

// HexToRGB parses #RRGGBB into red, green, blue values in [0, 255].
func HexToRGB(hex string) (r, g, b uint8, err error) {
	clean, err := NormalizeHex(hex)
	if err != nil {
		return 0, 0, 0, err
	}
	val, err := strconv.ParseUint(clean[1:], 16, 32)
	if err != nil {
		return 0, 0, 0, err
	}
	r = uint8((val >> 16) & 0xFF)
	g = uint8((val >> 8) & 0xFF)
	b = uint8(val & 0xFF)
	return r, g, b, nil
}

// RGBToHex formats r, g, b into #RRGGBB.
func RGBToHex(r, g, b uint8) string {
	return fmt.Sprintf("#%02X%02X%02X", r, g, b)
}

// RGBToHSL converts RGB [0, 255] to HSL [h: 0-360, s: 0-1, l: 0-1].
func RGBToHSL(r, g, b uint8) (h, s, l float64) {
	rf := float64(r) / 255.0
	gf := float64(g) / 255.0
	bf := float64(b) / 255.0

	max := math.Max(rf, math.Max(gf, bf))
	min := math.Min(rf, math.Min(gf, bf))
	delta := max - min

	l = (max + min) / 2.0

	if delta == 0 {
		h = 0
		s = 0
	} else {
		if l < 0.5 {
			s = delta / (max + min)
		} else {
			s = delta / (2.0 - max - min)
		}

		switch max {
		case rf:
			h = (gf - bf) / delta
			if gf < bf {
				h += 6.0
			}
		case gf:
			h = (bf-rf)/delta + 2.0
		case bf:
			h = (rf-gf)/delta + 4.0
		}
		h *= 60.0
	}
	return h, s, l
}

func hue2rgb(p, q, t float64) float64 {
	if t < 0 {
		t += 1.0
	}
	if t > 1 {
		t -= 1.0
	}
	if t < 1.0/6.0 {
		return p + (q-p)*6.0*t
	}
	if t < 1.0/2.0 {
		return q
	}
	if t < 2.0/3.0 {
		return p + (q-p)*(2.0/3.0-t)*6.0
	}
	return p
}

// HSLToRGB converts HSL [h: 0-360, s: 0-1, l: 0-1] to RGB [0, 255].
func HSLToRGB(h, s, l float64) (r, g, b uint8) {
	// Clamp values
	for h < 0 {
		h += 360
	}
	for h >= 360 {
		h -= 360
	}
	s = math.Max(0, math.Min(1, s))
	l = math.Max(0, math.Min(1, l))

	if s == 0 {
		val := uint8(math.Round(l * 255.0))
		return val, val, val
	}

	var q float64
	if l < 0.5 {
		q = l * (1.0 + s)
	} else {
		q = l + s - l*s
	}
	p := 2.0*l - q
	hk := h / 360.0

	r = uint8(math.Round(hue2rgb(p, q, hk+1.0/3.0) * 255.0))
	g = uint8(math.Round(hue2rgb(p, q, hk) * 255.0))
	b = uint8(math.Round(hue2rgb(p, q, hk-1.0/3.0) * 255.0))
	return r, g, b
}

// RelativeLuminance computes the relative luminance according to WCAG 2.1 specs.
func RelativeLuminance(r, g, b uint8) float64 {
	toLinear := func(c uint8) float64 {
		s := float64(c) / 255.0
		if s <= 0.03928 {
			return s / 12.92
		}
		return math.Pow((s+0.055)/1.055, 2.4)
	}
	return 0.2126*toLinear(r) + 0.7152*toLinear(g) + 0.0722*toLinear(b)
}

// ContrastRatio calculates the contrast ratio between two relative luminances.
func ContrastRatio(lum1, lum2 float64) float64 {
	lighter := math.Max(lum1, lum2)
	darker := math.Min(lum1, lum2)
	return (lighter + 0.05) / (darker + 0.05)
}

// BestForeground returns #000000 (black) or #FFFFFF (white) to maximize contrast (WCAG AA).
func BestForeground(accentHex string) (fgHex string, ratio float64, passesAA bool) {
	r, g, b, err := HexToRGB(accentHex)
	if err != nil {
		return "#000000", 21.0, true
	}
	accentLum := RelativeLuminance(r, g, b)
	whiteLum := 1.0 // RelativeLuminance(255, 255, 255) is 1.0
	blackLum := 0.0 // RelativeLuminance(0, 0, 0) is 0.0

	contrastWithWhite := ContrastRatio(whiteLum, accentLum)
	contrastWithBlack := ContrastRatio(accentLum, blackLum)

	if contrastWithWhite >= contrastWithBlack {
		return "#FFFFFF", math.Round(contrastWithWhite*100) / 100, contrastWithWhite >= 4.5
	}
	return "#000000", math.Round(contrastWithBlack*100) / 100, contrastWithBlack >= 4.5
}

// DeriveVariants computes the 5 PRD variants (True, Soft, Deep, Muted, Vivid).
func DeriveVariants(baseHex string) (*ThemeVariants, error) {
	clean, err := NormalizeHex(baseHex)
	if err != nil {
		return nil, err
	}

	r, g, b, _ := HexToRGB(clean)
	h, s, l := RGBToHSL(r, g, b)

	buildVariant := func(hMod, sMod, lMod float64) VariantConfig {
		targetH := h + hMod
		targetS := math.Max(0, math.Min(1, s+sMod))
		targetL := math.Max(0.05, math.Min(0.95, l+lMod))

		varR, varG, varB := HSLToRGB(targetH, targetS, targetL)
		hex := RGBToHex(varR, varG, varB)
		fg, ratio, passes := BestForeground(hex)

		return VariantConfig{
			AccentHex:   hex,
			OnAccentHex: fg,
			Contrast:    ratio,
			PassesAA:    passes,
		}
	}

	// 1. True: Exact colour, no modification
	trueVar := buildVariant(0, 0, 0)
	trueVar.AccentHex = clean // Ensure exact preservation

	// 2. Soft: +28% lightness, -15% saturation
	softVar := buildVariant(0, -0.15, 0.28)

	// 3. Deep: -18% lightness, +8% saturation
	deepVar := buildVariant(0, 0.08, -0.18)

	// 4. Muted: -45% saturation
	mutedVar := buildVariant(0, -0.45, 0)

	// 5. Vivid: +30% saturation
	vividVar := buildVariant(0, 0.30, 0)

	return &ThemeVariants{
		True:  trueVar,
		Soft:  softVar,
		Deep:  deepVar,
		Muted: mutedVar,
		Vivid: vividVar,
	}, nil
}
