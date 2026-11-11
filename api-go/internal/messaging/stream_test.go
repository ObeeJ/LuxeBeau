package messaging

import (
	"bufio"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// The live feed must outlive the server's write timeout. Production sets a 30s
// WriteTimeout; here it is 300ms so the test is quick. Without clearing the
// deadline for this one connection the server would cut the stream at 300ms.
func TestStream_StaysOpenPastTheServerWriteTimeout(t *testing.T) {
	gin.SetMode(gin.TestMode)
	old := heartbeatEvery
	heartbeatEvery = 60 * time.Millisecond
	defer func() { heartbeatEvery = old }()

	s, _ := newSvc(t)
	h := NewHandler(s, slog.New(slog.NewTextHandler(io.Discard, nil)))
	r := gin.New()
	r.GET("/stream", func(c *gin.Context) { c.Set("userID", bayo) }, h.Stream)

	ts := httptest.NewUnstartedServer(r)
	ts.Config.WriteTimeout = 300 * time.Millisecond
	ts.Start()
	defer ts.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL+"/stream", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if ct := resp.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
		t.Fatalf("content type %q", ct)
	}

	lines := make(chan string, 256)
	go func() {
		sc := bufio.NewScanner(resp.Body)
		for sc.Scan() {
			lines <- sc.Text()
		}
		close(lines)
	}()

	// Stay connected for well over the 300ms write timeout, counting heartbeats.
	heartbeats := 0
	until := time.After(900 * time.Millisecond)
wait:
	for {
		select {
		case l, ok := <-lines:
			if !ok {
				t.Fatalf("the stream was closed by the server after %d heartbeats; the write timeout cut it off", heartbeats)
			}
			if strings.Contains(l, "heartbeat") {
				heartbeats++
			}
		case <-until:
			break wait
		}
	}
	if heartbeats < 5 {
		t.Errorf("only %d heartbeats in 900ms; the connection should stay alive", heartbeats)
	}

	// A message sent now, long after the write timeout, must still arrive.
	if _, err := s.Send(context.Background(), ada, bayo, "are you there?"); err != nil {
		t.Fatal(err)
	}
	gotData := false
	limit := time.After(time.Second)
	for !gotData {
		select {
		case l, ok := <-lines:
			if !ok {
				t.Fatal("the stream closed before the message arrived")
			}
			gotData = strings.HasPrefix(l, "data: ")
		case <-limit:
			t.Fatal("the message sent after the write timeout never arrived on the stream")
		}
	}
}
