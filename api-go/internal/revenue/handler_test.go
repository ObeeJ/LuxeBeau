package revenue

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func get(t *testing.T, query string) (int, map[string]any) {
	t.Helper()
	db := testDB(t)
	seed(db)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/admin/revenue", NewHandler(db, slog.New(slog.NewTextHandler(io.Discard, nil))).Summary)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/admin/revenue"+query, nil))
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func TestHandler_ReturnsTheContractShape(t *testing.T) {
	code, out := get(t, "?from=2026-11-01&to=2026-11-05&group=day")
	if code != http.StatusOK || out["success"] != true {
		t.Fatalf("got %d %v", code, out)
	}
	data := out["data"].(map[string]any)
	for _, k := range []string{"range", "totals", "series", "health"} {
		if _, ok := data[k]; !ok {
			t.Errorf("response is missing %q", k)
		}
	}
	totals := data["totals"].(map[string]any)
	for _, k := range []string{"platform_fees", "ad_revenue", "fee_refunds", "net", "estimated_vat", "processing_fees_collected", "orders_paid", "ads_paid"} {
		if _, ok := totals[k]; !ok {
			t.Errorf("totals is missing %q", k)
		}
	}
	if len(data["series"].([]any)) != 5 {
		t.Errorf("series = %v, want 5 days", data["series"])
	}
}

func TestHandler_DefaultsToTheLast30Days(t *testing.T) {
	code, out := get(t, "")
	if code != http.StatusOK {
		t.Fatalf("got %d %v", code, out)
	}
	if n := len(out["data"].(map[string]any)["series"].([]any)); n != 30 {
		t.Errorf("default series has %d days, want 30", n)
	}
}

func TestHandler_BadInputIsA400WithAPlainMessage(t *testing.T) {
	for _, q := range []string{"?from=2026-11-05&to=2026-11-01", "?group=decade", "?from=nope"} {
		code, out := get(t, q)
		if code != http.StatusBadRequest {
			t.Errorf("%s: got %d, want 400", q, code)
		}
		if out["success"] != false {
			t.Errorf("%s: success = %v", q, out["success"])
		}
	}
}
