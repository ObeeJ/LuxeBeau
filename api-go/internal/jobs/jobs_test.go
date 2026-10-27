package jobs

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"
)

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func TestRun_RunsImmediatelyThenOnEachTick(t *testing.T) {
	var runs atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		Run(ctx, 10*time.Millisecond, quiet(), Task{Name: "count", Run: func(context.Context) (int, error) {
			runs.Add(1)
			return 1, nil
		}})
		close(done)
	}()
	deadline := time.After(2 * time.Second)
	for runs.Load() < 3 {
		select {
		case <-deadline:
			t.Fatalf("task ran %d times, want at least 3", runs.Load())
		default:
			time.Sleep(5 * time.Millisecond)
		}
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("Run did not stop after the context was cancelled")
	}
}

func TestRun_AFailingOrPanickingTaskDoesNotStopTheOthers(t *testing.T) {
	var good atomic.Int32
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go Run(ctx, 10*time.Millisecond, quiet(),
		Task{Name: "error", Run: func(context.Context) (int, error) { return 0, errors.New("boom") }},
		Task{Name: "panic", Run: func(context.Context) (int, error) { panic("kaboom") }},
		Task{Name: "good", Run: func(context.Context) (int, error) { good.Add(1); return 0, nil }},
	)
	deadline := time.After(2 * time.Second)
	for good.Load() < 3 {
		select {
		case <-deadline:
			t.Fatalf("the healthy task ran %d times, want at least 3", good.Load())
		default:
			time.Sleep(5 * time.Millisecond)
		}
	}
}
