package escrow

import (
	"context"
	crand "crypto/rand"
	"encoding/base32"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

// AutoReleaseWindow is how long after funding an escrow auto-releases if the
// buyer never confirms (a sweeper, run by a cron, calls SweepAutoReleases).
const AutoReleaseWindow = 72 * time.Hour

type Service struct {
	repo     Repository
	rails    *Registry
	notifier Notifier
	logger   *slog.Logger
}

func NewService(repo Repository, rails *Registry, notifier Notifier, logger *slog.Logger) *Service {
	return &Service{repo: repo, rails: rails, notifier: notifier, logger: logger}
}

// newID returns an unguessable escrow id (~80 bits of entropy) so ids cannot be
// enumerated or predicted — important because the id is the handle used to
// fund/release/dispute the escrow.
func newID() string {
	var b [10]byte
	if _, err := crand.Read(b[:]); err != nil {
		panic("escrow: secure random source unavailable: " + err.Error())
	}
	return "ESC-" + strings.ToUpper(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b[:]))
}

// CreateInput is the shared creation payload.
type CreateInput struct {
	Kind         string
	Reference    string
	BuyerID      string // empty for off-platform link buyers
	BuyerPhone   string
	BuyerName    string
	PayeeID      string
	Title        string
	Amount       int64
	FeeBps       int
	Rail         string
	DeliveryCity string
	ServiceType  string
	Note         string
}

// Create records a new pending escrow and notifies the buyer how to fund it.
func (s *Service) Create(ctx context.Context, in CreateInput) (*domain.Escrow, error) {
	if in.Amount <= 0 || in.PayeeID == "" {
		return nil, fmt.Errorf("amount and payee are required")
	}
	if in.BuyerID == "" && in.BuyerPhone == "" {
		return nil, fmt.Errorf("a buyer account or phone number is required")
	}
	fee := in.FeeBps
	if fee == 0 {
		fee = domain.DefaultFeeBps
	}
	rail := in.Rail
	if rail == "" {
		rail = domain.RailWallet
	}
	e := &domain.Escrow{
		ID:             newID(),
		Kind:           in.Kind,
		Reference:      in.Reference,
		BuyerID:        in.BuyerID,
		BuyerPhone:     in.BuyerPhone,
		BuyerName:      in.BuyerName,
		PayeeID:        in.PayeeID,
		Title:          in.Title,
		Amount:         in.Amount,
		FeeBps:         fee,
		State:          domain.EscrowPending,
		SettlementRail: rail,
		DeliveryCity:   in.DeliveryCity,
		ServiceType:    in.ServiceType,
		Note:           in.Note,
	}
	if err := s.repo.Create(ctx, e); err != nil {
		return nil, err
	}
	s.notify(ctx, e, EventCreated)
	return e, nil
}

// Fund moves the buyer's money into custody and flips the escrow to funded.
// For wallet escrows this debits the buyer; for cNGN it is confirmed on-chain.
func (s *Service) Fund(ctx context.Context, id string) (*domain.Escrow, error) {
	var funded *domain.Escrow
	err := s.repo.DB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		e, err := s.lockedGet(tx, id)
		if err != nil {
			return err
		}
		if e.State != domain.EscrowPending {
			return fmt.Errorf("escrow is not awaiting funding")
		}
		if err := s.rails.For(e.SettlementRail).Hold(ctx, tx, e); err != nil {
			return err
		}
		now := time.Now()
		eligible := now.Add(AutoReleaseWindow)
		e.State = domain.EscrowFunded
		e.FundedAt = &now
		e.ReleaseEligibleAt = &eligible
		if err := tx.Save(e).Error; err != nil {
			return err
		}
		if err := s.ledger(tx, e, "fund", e.BuyerID, "escrow", e.Amount, "buyer funded escrow"); err != nil {
			return err
		}
		funded = e
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.notify(ctx, funded, EventFunded)
	return funded, nil
}

// Release pays the payee (minus fee). Callable by the buyer (delivery confirmed)
// or, via Resolve, by an admin. `actorID` must be the buyer unless admin==true.
func (s *Service) Release(ctx context.Context, id, actorID string, admin bool) (*domain.Escrow, error) {
	var released *domain.Escrow
	err := s.repo.DB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		e, err := s.lockedGet(tx, id)
		if err != nil {
			return err
		}
		if !admin && e.BuyerID != actorID {
			return fmt.Errorf("only the buyer can release these funds")
		}
		if e.State != domain.EscrowFunded && e.State != domain.EscrowDisputed {
			return fmt.Errorf("escrow is not in a releasable state")
		}
		fee, net := e.Fee()
		if err := s.rails.For(e.SettlementRail).Release(ctx, tx, e, net, fee); err != nil {
			return err
		}
		now := time.Now()
		e.State = domain.EscrowReleased
		e.ResolvedAt = &now
		if err := tx.Save(e).Error; err != nil {
			return err
		}
		if err := s.ledger(tx, e, "release", "escrow", e.PayeeID, net, "released to payee"); err != nil {
			return err
		}
		if fee > 0 {
			if err := s.ledger(tx, e, "fee", "escrow", "platform", fee, "platform fee"); err != nil {
				return err
			}
		}
		s.bumpReputation(tx, e.PayeeID)
		released = e
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.notify(ctx, released, EventReleased)
	return released, nil
}

// Refund returns funds to the buyer. Callable via Resolve (admin) or on cancel.
func (s *Service) Refund(ctx context.Context, id, actorID string, admin bool) (*domain.Escrow, error) {
	var refunded *domain.Escrow
	err := s.repo.DB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		e, err := s.lockedGet(tx, id)
		if err != nil {
			return err
		}
		// The payee may give the money back; the buyer can't take it back
		// on their own (that would remove the seller's protection) and must
		// open a dispute for an admin to resolve.
		if !admin && e.PayeeID != actorID {
			return fmt.Errorf("not authorised to refund this escrow")
		}
		if e.State != domain.EscrowFunded && e.State != domain.EscrowDisputed {
			return fmt.Errorf("escrow is not in a refundable state")
		}
		if err := s.rails.For(e.SettlementRail).Refund(ctx, tx, e); err != nil {
			return err
		}
		now := time.Now()
		e.State = domain.EscrowRefunded
		e.ResolvedAt = &now
		if err := tx.Save(e).Error; err != nil {
			return err
		}
		if err := s.ledger(tx, e, "refund", "escrow", e.BuyerID, e.Amount, "refunded to buyer"); err != nil {
			return err
		}
		if e.Kind == domain.EscrowKindOrder {
			if err := returnDeliveryFee(tx, e); err != nil {
				return err
			}
		}
		refunded = e
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.notify(ctx, refunded, EventRefunded)
	return refunded, nil
}

// Dispute flags a funded escrow for admin resolution.
func (s *Service) Dispute(ctx context.Context, id, actorID, reason string) (*domain.Escrow, error) {
	var disputed *domain.Escrow
	err := s.repo.DB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		e, err := s.lockedGet(tx, id)
		if err != nil {
			return err
		}
		if e.BuyerID != actorID && e.PayeeID != actorID {
			return fmt.Errorf("not authorised to dispute this escrow")
		}
		if e.State != domain.EscrowFunded {
			return fmt.Errorf("only funded escrows can be disputed")
		}
		e.State = domain.EscrowDisputed
		e.DisputeReason = reason
		if err := tx.Save(e).Error; err != nil {
			return err
		}
		disputed = e
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.notify(ctx, disputed, EventDisputed)
	return disputed, nil
}

// Resolve is the admin arbitration entry point: release or refund a dispute.
func (s *Service) Resolve(ctx context.Context, id, decision string) (*domain.Escrow, error) {
	switch decision {
	case "release":
		return s.Release(ctx, id, "", true)
	case "refund":
		return s.Refund(ctx, id, "", true)
	default:
		return nil, fmt.Errorf("decision must be 'release' or 'refund'")
	}
}

// SweepAutoReleases releases funded escrows whose window has elapsed. A cron job
// calls this; it returns the number released.
func (s *Service) SweepAutoReleases(ctx context.Context) (int, error) {
	var due []domain.Escrow
	if err := s.repo.DB().WithContext(ctx).
		Where("state = ? AND release_eligible_at IS NOT NULL AND release_eligible_at <= ?", domain.EscrowFunded, time.Now()).
		Find(&due).Error; err != nil {
		return 0, err
	}
	n := 0
	for i := range due {
		if _, err := s.Release(ctx, due[i].ID, "", true); err != nil {
			s.logger.Warn("auto-release failed", slog.String("escrow", due[i].ID), slog.Any("error", err))
			continue
		}
		n++
	}
	return n, nil
}

func (s *Service) List(ctx context.Context, f Filter) ([]domain.Escrow, error) {
	return s.repo.List(ctx, f)
}

func (s *Service) Get(ctx context.Context, id string) (*domain.Escrow, error) {
	return s.repo.Get(ctx, id)
}

// ── helpers ──

func (s *Service) lockedGet(tx *gorm.DB, id string) (*domain.Escrow, error) {
	var e domain.Escrow
	// SELECT ... FOR UPDATE: concurrent release/refund/dispute calls on one
	// escrow queue behind each other, so the state checks can't race.
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", id).First(&e).Error; err != nil {
		return nil, fmt.Errorf("escrow not found")
	}
	return &e, nil
}

// ledger records a money movement. It runs inside the same transaction, and
// its error must roll that transaction back so balances and ledger can't drift.
func (s *Service) ledger(tx *gorm.DB, e *domain.Escrow, typ, from, to string, amount int64, memo string) error {
	return writeLedger(tx, e.ID, typ, from, to, amount, memo)
}

// bumpReputation increments the payee's completed-escrow count (jobs_completed
// on their artisan profile, when they have one). Sellers' reputation is derived
// from order history elsewhere.
func (s *Service) bumpReputation(tx *gorm.DB, payeeID string) {
	tx.Model(&domain.Artisan{}).Where("user_id = ?", payeeID).
		Update("jobs_completed", gorm.Expr("jobs_completed + 1"))
}

func (s *Service) notify(ctx context.Context, e *domain.Escrow, event string) {
	to := e.BuyerPhone
	if to == "" {
		to = e.BuyerID
	}
	if err := s.notifier.Notify(ctx, to, event, e); err != nil {
		s.logger.Warn("notify failed", slog.String("escrow", e.ID), slog.Any("error", err))
	}
}
