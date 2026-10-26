package media

import "testing"

func TestValidURL(t *testing.T) {
	img := New(Config{AccountHash: "abc123"})
	ok := []string{"", "https://imagedelivery.net/abc123/2cdc28f0-017a/public"}
	bad := []string{
		"https://imagedelivery.net/other/2cdc28f0/public",
		"http://imagedelivery.net/abc123/x/public",
		"https://evil.example/abc123/x/public",
		"https://imagedelivery.net/abc123/x/public?track=1",
		"https://imagedelivery.net/abc123/x/y/public",
		"javascript:alert(1)",
	}
	for _, u := range ok {
		if !img.ValidURL(u) {
			t.Errorf("rejected %q", u)
		}
	}
	for _, u := range bad {
		if img.ValidURL(u) {
			t.Errorf("accepted %q", u)
		}
	}
	if New(Config{}).ValidURL("https://imagedelivery.net/abc123/x/public") {
		t.Error("unconfigured account accepted an image URL")
	}
}
