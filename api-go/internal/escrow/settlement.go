// Package escrow is LuxeBeau's held-funds engine. It holds a buyer's payment
// from funding until release (to the payee), refund (to the buyer), or an admin
// resolution. Money movement is abstracted behind Settlement so the in-app
// wallet today and a cNGN/on-chain rail tomorrow share one lifecycle.
package escrow

import (
	"context"
	"errors"
	"log/slog"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// Settlement moves real value for an escrow. Implementations must be safe to
// call inside the escrow service's DB transaction where a *gorm.DB tx is passed.
type Settlement interface {
	Name() string
	// Hold debits the buyer and moves the amount into escrow custody.
	Hold(ctx context.Context, tx *gorm.DB, e *domain.Escrow) error
	// Release pays the payee `net` and books `fee` to the platform.
	Release(ctx context.Context, tx *gorm.DB, e *domain.Escrow, net, fee int64) error
	// Refund returns the full amount to the buyer.
	Refund(ctx context.Context, tx *gorm.DB, e *domain.Escrow) error
}

// WalletSettlement is the live rail: it debits/credits the in-app wallet table.
type WalletSettlement struct{ logger *slog.Logger }

func NewWalletSettlement(logger *slog.Logger) *WalletSettlement { return &WalletSettlement{logger: logger} }

func (w *WalletSettlement) Name() string { return domain.RailWallet }

func adjust(tx *gorm.DB, userID string, delta int64) error {
	if userID == "" {
		return errors.New("wallet settlement requires an on-platform account")
	}
	res := tx.Model(&domain.Wallet{}).
		Where("user_id = ? AND balance + ? >= 0", userID, delta).
		Update("balance", gorm.Expr("balance + ?", delta))
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("insufficient wallet balance")
	}
	return nil
}

func (w *WalletSettlement) Hold(ctx context.Context, tx *gorm.DB, e *domain.Escrow) error {
	// Funds leave the buyer's wallet; custody is represented by escrow state +
	// ledger rather than a separate float account.
	return adjust(tx.WithContext(ctx), e.BuyerID, -e.Amount)
}

func (w *WalletSettlement) Release(ctx context.Context, tx *gorm.DB, e *domain.Escrow, net, fee int64) error {
	return adjust(tx.WithContext(ctx), e.PayeeID, net)
}

func (w *WalletSettlement) Refund(ctx context.Context, tx *gorm.DB, e *domain.Escrow) error {
	return adjust(tx.WithContext(ctx), e.BuyerID, e.Amount)
}

// CNGNSettlement is the future on-chain rail (cNGN on Polygon). The boundary is
// real; the calls are stubs until a licensed minting partner + node are wired.
// On-chain funding is confirmed out-of-band (bank mints cNGN into the contract),
// so Hold is a no-op here and funding is recorded by the bank/chain webhook.
type CNGNSettlement struct{ logger *slog.Logger }

func NewCNGNSettlement(logger *slog.Logger) *CNGNSettlement { return &CNGNSettlement{logger: logger} }

func (c *CNGNSettlement) Name() string { return domain.RailCNGN }

func (c *CNGNSettlement) Hold(ctx context.Context, tx *gorm.DB, e *domain.Escrow) error {
	c.logger.Info("cNGN hold (stub): awaiting on-chain confirmation", slog.String("escrow", e.ID))
	return nil
}

func (c *CNGNSettlement) Release(ctx context.Context, tx *gorm.DB, e *domain.Escrow, net, fee int64) error {
	// TODO: instruct the escrow smart contract to release `net` cNGN to the
	// payee's wallet and `fee` to the platform treasury.
	c.logger.Info("cNGN release (stub)", slog.String("escrow", e.ID), slog.Int64("net", net), slog.Int64("fee", fee))
	return nil
}

func (c *CNGNSettlement) Refund(ctx context.Context, tx *gorm.DB, e *domain.Escrow) error {
	c.logger.Info("cNGN refund (stub)", slog.String("escrow", e.ID))
	return nil
}

// Registry selects a settlement rail by name, defaulting to wallet.
type Registry struct {
	rails map[string]Settlement
}

func NewRegistry(rails ...Settlement) *Registry {
	m := make(map[string]Settlement, len(rails))
	for _, r := range rails {
		m[r.Name()] = r
	}
	return &Registry{rails: m}
}

func (r *Registry) For(rail string) Settlement {
	if s, ok := r.rails[rail]; ok {
		return s
	}
	return r.rails[domain.RailWallet]
}
