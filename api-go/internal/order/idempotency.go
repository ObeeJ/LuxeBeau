package order

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

const (
	idemOperation = "create_order"
	// idemTTL is how long a finished answer is replayed for.
	idemTTL = 24 * time.Hour
	// idemStaleClaim is how long a claim with no answer is trusted. Past this the
	// request that made it is assumed to have crashed, and the key can be reused.
	idemStaleClaim = 2 * time.Minute
)

type idemOutcome int

const (
	idemClaimed     idemOutcome = iota // we own the key: go ahead and create the order
	idemReplay                         // an earlier request already finished: send its answer
	idemBusy                           // an earlier request is still working: ask the client to wait
	idemUnavailable                    // the key store failed: do not risk a duplicate
)

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "duplicate") || strings.Contains(msg, "23505")
}

// claimIdempotency takes ownership of (key, buyer, operation) BEFORE anything is
// created. The database's unique index decides who wins when two requests with
// the same key arrive together, so only one of them ever reaches CreateCheckout.
// It returns the claim's id (to finish or release it), or the stored answer to
// replay.
func (h *OrderHandler) claimIdempotency(ctx context.Context, key, buyerID string) (idemOutcome, uint, *domain.IdempotencyRecord) {
	for range 2 {
		rec := &domain.IdempotencyRecord{Key: key, UserID: buyerID, Operation: idemOperation, ExpiresAt: time.Now().Add(idemTTL)}
		err := h.db.WithContext(ctx).Create(rec).Error
		if err == nil {
			return idemClaimed, rec.ID, nil
		}
		if !isUniqueViolation(err) {
			h.logger.Error("idempotency claim failed", slog.String("key", key), slog.Any("error", err))
			return idemUnavailable, 0, nil
		}
		var existing domain.IdempotencyRecord
		err = h.db.WithContext(ctx).
			Where("key = ? AND user_id = ? AND operation = ?", key, buyerID, idemOperation).
			First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			continue // it was released between our two queries: try to claim again
		}
		if err != nil {
			h.logger.Error("idempotency lookup failed", slog.String("key", key), slog.Any("error", err))
			return idemUnavailable, 0, nil
		}
		now := time.Now()
		if existing.StatusCode != 0 && existing.ExpiresAt.After(now) {
			return idemReplay, 0, &existing
		}
		if existing.StatusCode == 0 && now.Sub(existing.CreatedAt) < idemStaleClaim {
			return idemBusy, 0, nil
		}
		// Expired answer, or a claim abandoned by a crashed request: clear it and
		// try once more. Matching on status_code too means we never delete a claim
		// that finished in the meantime.
		h.db.WithContext(ctx).
			Where("id = ? AND status_code = ?", existing.ID, existing.StatusCode).
			Delete(&domain.IdempotencyRecord{})
	}
	return idemBusy, 0, nil
}

// detached keeps a request's values but not its cancellation: the bookkeeping
// after an order must still happen if the buyer's connection has dropped, or a
// retry minutes later would create a second order.
func detached(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
}

// finishIdempotency stores the order's answer against the claim so retries replay it.
func (h *OrderHandler) finishIdempotency(ctx context.Context, claimID uint, responseJSON string) {
	ctx, cancel := detached(ctx)
	defer cancel()
	err := h.db.WithContext(ctx).Model(&domain.IdempotencyRecord{}).Where("id = ?", claimID).
		Updates(map[string]any{"response_json": responseJSON, "status_code": http.StatusCreated}).Error
	if err != nil {
		h.logger.Error("idempotency result store failed", slog.Uint64("claim", uint64(claimID)), slog.Any("error", err))
	}
}

// releaseIdempotency frees the key after a failed order so the buyer can retry.
func (h *OrderHandler) releaseIdempotency(ctx context.Context, claimID uint) {
	ctx, cancel := detached(ctx)
	defer cancel()
	if err := h.db.WithContext(ctx).Delete(&domain.IdempotencyRecord{}, claimID).Error; err != nil {
		h.logger.Error("idempotency release failed", slog.Uint64("claim", uint64(claimID)), slog.Any("error", err))
	}
}
