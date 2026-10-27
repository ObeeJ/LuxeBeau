// Package jobs runs LuxeBeau's recurring background work, such as releasing
// escrow that has passed its window. Every task must be safe to run on several
// instances at once and to run again straight after a crash: tasks claim their
// work with conditional database updates, never with in-memory state.
package jobs

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// Task is one unit of recurring work. Run returns how many items it handled.
type Task struct {
	Name string
	Run  func(ctx context.Context) (int, error)
}

// taskTimeout bounds one run so a stuck query can't block the others.
const taskTimeout = 2 * time.Minute

// Run executes every task once straight away and then every interval, until
// ctx is cancelled. A failing or panicking task is logged and never stops the
// loop or the other tasks.
func Run(ctx context.Context, every time.Duration, logger *slog.Logger, tasks ...Task) {
	runAll(ctx, logger, tasks)
	ticker := time.NewTicker(every)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			runAll(ctx, logger, tasks)
		}
	}
}

func runAll(ctx context.Context, logger *slog.Logger, tasks []Task) {
	for _, t := range tasks {
		if ctx.Err() != nil {
			return
		}
		runOne(ctx, logger, t)
	}
}

func runOne(ctx context.Context, logger *slog.Logger, t Task) {
	defer func() {
		if r := recover(); r != nil {
			logger.Error("background task panicked", slog.String("task", t.Name), slog.String("panic", fmt.Sprint(r)))
		}
	}()
	runCtx, cancel := context.WithTimeout(ctx, taskTimeout)
	defer cancel()
	n, err := t.Run(runCtx)
	switch {
	case err != nil:
		logger.Error("background task failed", slog.String("task", t.Name), slog.Any("error", err))
	case n > 0:
		logger.Info("background task finished", slog.String("task", t.Name), slog.Int("handled", n))
	}
}
