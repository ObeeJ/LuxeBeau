// Package influencer manages the affiliate/influencer program.
// Business owners create packages for influencers; each package generates a
// unique tracking link. When a buyer arrives via that link and purchases,
// a commission is created and held until the escrow releases.
package influencer

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"luxebeau/internal/domain"
)

var (
	ErrPackageNotFound  = errors.New("influencer package not found")
	ErrSlugTaken        = errors.New("that link name is already used by another package for this business")
	ErrSlugInvalid      = errors.New("link name may only contain lowercase letters, numbers and hyphens")
	ErrCommissionTooHigh = errors.New("commission cannot exceed 50% of your net payout")
	ErrNotOwner         = errors.New("not your package")

	slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$`)
)

const maxCommissionBps = 5000 // 50%

type Service struct {
	db     *gorm.DB
	logger *slog.Logger
}

func NewService(db *gorm.DB, logger *slog.Logger) *Service {
	return &Service{db: db, logger: logger}
}

// PackageInput is what a business owner submits to create or update a package.
type PackageInput struct {
	Slug             string
	InfluencerName   string
	InfluencerEmail  string
	InfluencerPhone  string
	InfluencerHandle string
	Scope            string
	Agreement        string
	CommissionBps    int
	BankCode         string
	AccountNumber    string
	AccountName      string
	StartsAt         *time.Time
	EndsAt           *time.Time
}

func (s *Service) validate(in PackageInput) error {
	slug := strings.ToLower(strings.TrimSpace(in.Slug))
	if !slugRe.MatchString(slug) {
		return ErrSlugInvalid
	}
	if in.InfluencerName == "" || in.Scope == "" {
		return fmt.Errorf("influencer name and scope are required")
	}
	if in.CommissionBps <= 0 || in.CommissionBps > maxCommissionBps {
		return ErrCommissionTooHigh
	}
	return nil
}

// Create makes a new influencer package for a business owner.
func (s *Service) Create(ctx context.Context, ownerID string, in PackageInput) (*domain.InfluencerPackage, error) {
	if err := s.validate(in); err != nil {
		return nil, err
	}
	slug := strings.ToLower(strings.TrimSpace(in.Slug))
	pkg := &domain.InfluencerPackage{
		OwnerID:          ownerID,
		Slug:             slug,
		InfluencerName:   strings.TrimSpace(in.InfluencerName),
		InfluencerEmail:  strings.TrimSpace(in.InfluencerEmail),
		InfluencerPhone:  strings.TrimSpace(in.InfluencerPhone),
		InfluencerHandle: strings.TrimSpace(in.InfluencerHandle),
		Scope:            strings.TrimSpace(in.Scope),
		Agreement:        strings.TrimSpace(in.Agreement),
		CommissionBps:    in.CommissionBps,
		BankCode:         strings.TrimSpace(in.BankCode),
		AccountNumber:    strings.TrimSpace(in.AccountNumber),
		AccountName:      strings.TrimSpace(in.AccountName),
		StartsAt:         in.StartsAt,
		EndsAt:           in.EndsAt,
		State:            domain.InfluencerPackageActive,
	}
	if err := s.db.WithContext(ctx).Create(pkg).Error; err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return nil, ErrSlugTaken
		}
		return nil, err
	}
	return pkg, nil
}

// Update applies editable fields to an existing package. Slug is immutable
// after creation (links are already shared).
func (s *Service) Update(ctx context.Context, ownerID string, id uint, in PackageInput) (*domain.InfluencerPackage, error) {
	pkg, err := s.ownerGet(ctx, ownerID, id)
	if err != nil {
		return nil, err
	}
	if in.CommissionBps <= 0 || in.CommissionBps > maxCommissionBps {
		return nil, ErrCommissionTooHigh
	}
	updates := map[string]any{
		"influencer_name":   strings.TrimSpace(in.InfluencerName),
		"influencer_email":  strings.TrimSpace(in.InfluencerEmail),
		"influencer_phone":  strings.TrimSpace(in.InfluencerPhone),
		"influencer_handle": strings.TrimSpace(in.InfluencerHandle),
		"scope":             strings.TrimSpace(in.Scope),
		"agreement":         strings.TrimSpace(in.Agreement),
		"commission_bps":    in.CommissionBps,
		"bank_code":         strings.TrimSpace(in.BankCode),
		"account_number":    strings.TrimSpace(in.AccountNumber),
		"account_name":      strings.TrimSpace(in.AccountName),
		"starts_at":         in.StartsAt,
		"ends_at":           in.EndsAt,
	}
	if err := s.db.WithContext(ctx).Model(pkg).Updates(updates).Error; err != nil {
		return nil, err
	}
	return pkg, nil
}

// SetState lets an owner pause, resume or cancel a package.
func (s *Service) SetState(ctx context.Context, ownerID string, id uint, state string) error {
	switch state {
	case domain.InfluencerPackageActive, domain.InfluencerPackagePaused, domain.InfluencerPackageCancelled:
	default:
		return fmt.Errorf("invalid state")
	}
	pkg, err := s.ownerGet(ctx, ownerID, id)
	if err != nil {
		return err
	}
	return s.db.WithContext(ctx).Model(pkg).Update("state", state).Error
}

// List returns all packages for a business owner, with summary stats.
func (s *Service) List(ctx context.Context, ownerID string) ([]domain.InfluencerPackage, error) {
	var pkgs []domain.InfluencerPackage
	if err := s.db.WithContext(ctx).
		Where("owner_id = ?", ownerID).
		Order("created_at DESC").
		Find(&pkgs).Error; err != nil {
		return nil, err
	}
	s.attachStats(ctx, pkgs)
	return pkgs, nil
}

// Get returns one package with stats. Owners see full details; the public
// endpoint (for the influencer's link page) strips bank details.
func (s *Service) Get(ctx context.Context, id uint) (*domain.InfluencerPackage, error) {
	var pkg domain.InfluencerPackage
	if err := s.db.WithContext(ctx).First(&pkg, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPackageNotFound
		}
		return nil, err
	}
	s.attachStats(ctx, []domain.InfluencerPackage{pkg})
	return &pkg, nil
}

// GetByOwnerSlug resolves a storefront slug + influencer slug to a package.
// This is what the tracking link hits: /ref/{owner-slug}/{influencer-slug}
func (s *Service) GetByOwnerSlug(ctx context.Context, ownerSlug, influencerSlug string) (*domain.InfluencerPackage, error) {
	var owner domain.User
	if err := s.db.WithContext(ctx).Select("id").
		Where("storefront_slug = ? AND verified = ? AND status = ?", ownerSlug, true, "active").
		First(&owner).Error; err != nil {
		return nil, ErrPackageNotFound
	}
	var pkg domain.InfluencerPackage
	if err := s.db.WithContext(ctx).
		Where("owner_id = ? AND slug = ? AND state = ?", owner.ID, influencerSlug, domain.InfluencerPackageActive).
		First(&pkg).Error; err != nil {
		return nil, ErrPackageNotFound
	}
	// Expire check.
	now := time.Now()
	if pkg.EndsAt != nil && pkg.EndsAt.Before(now) {
		s.db.WithContext(ctx).Model(&pkg).Update("state", domain.InfluencerPackageExpired)
		return nil, ErrPackageNotFound
	}
	if pkg.StartsAt != nil && pkg.StartsAt.After(now) {
		return nil, ErrPackageNotFound
	}
	return &pkg, nil
}

// ── Attribution ──────────────────────────────────────────────────────────────

// TrackClick records a referral click and returns the token to set in a cookie.
// If the buyer is already logged in, their ID is attached immediately.
func (s *Service) TrackClick(ctx context.Context, packageID uint, buyerID, existingToken string) (string, error) {
	token := existingToken
	if token == "" {
		b := make([]byte, 16)
		if _, err := rand.Read(b); err != nil {
			return "", err
		}
		token = hex.EncodeToString(b)
	}
	ref := &domain.InfluencerReferral{
		PackageID: packageID,
		BuyerID:   buyerID,
		Token:     token,
		ClickedAt: time.Now(),
		ExpiresAt: time.Now().AddDate(0, 0, domain.AttributionWindowDays),
	}
	// ON CONFLICT DO NOTHING: a second click from the same token on the same
	// package doesn't reset the attribution window.
	s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(ref)
	return token, nil
}

// AttributeOrder links a buyer's order to the most recent valid referral.
// Called inside the checkout transaction. Returns nil if no referral applies.
func AttributeOrder(tx *gorm.DB, buyerID, token, orderID string) (*domain.InfluencerReferral, error) {
	if buyerID == "" && token == "" {
		return nil, nil
	}
	var ref domain.InfluencerReferral
	q := tx.Where("converted = ? AND expires_at > ?", false, time.Now())
	if buyerID != "" {
		q = q.Where("buyer_id = ? OR token = ?", buyerID, token)
	} else {
		q = q.Where("token = ?", token)
	}
	if err := q.Order("clicked_at DESC").First(&ref).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	// Mark converted and attach the order.
	if err := tx.Model(&ref).Updates(map[string]any{
		"converted": true, "order_id": orderID, "buyer_id": buyerID,
	}).Error; err != nil {
		return nil, err
	}
	return &ref, nil
}

// ── Commission lifecycle ─────────────────────────────────────────────────────

// CreateCommission records the commission owed when an order's escrow is funded.
// It runs inside the same transaction as HoldOrder so commission and escrow are
// always in sync. If there is no referral for this order it is a no-op.
func CreateCommission(tx *gorm.DB, orderID, escrowID string, sellerShare int64, feeBps int) error {
	var ref domain.InfluencerReferral
	if err := tx.Where("order_id = ? AND converted = ?", orderID, true).
		First(&ref).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || isTableMissing(err) {
			return nil
		}
		return err
	}
	var pkg domain.InfluencerPackage
	if err := tx.First(&pkg, ref.PackageID).Error; err != nil {
		return nil // package deleted; skip silently
	}
	if pkg.State != domain.InfluencerPackageActive {
		return nil
	}

	platformFee := sellerShare * int64(feeBps) / 10000
	sellerNet := sellerShare - platformFee
	commissionAmount := sellerNet * int64(pkg.CommissionBps) / 10000

	c := &domain.InfluencerCommission{
		PackageID:        pkg.ID,
		ReferralID:       ref.ID,
		OrderID:          orderID,
		EscrowID:         escrowID,
		OrderAmount:      sellerShare,
		PlatformFee:      platformFee,
		SellerNet:        sellerNet,
		CommissionAmount: commissionAmount,
		State:            domain.CommissionPending,
	}
	return tx.Create(c).Error
}

// EarnCommissions marks commissions earned when an escrow releases.
// Called inside the Release transaction. Non-fatal if the table doesn't exist
// (test environments that don't migrate influencer tables).
func EarnCommissions(tx *gorm.DB, escrowID string) error {
	err := tx.Model(&domain.InfluencerCommission{}).
		Where("escrow_id = ? AND state = ?", escrowID, domain.CommissionPending).
		Update("state", domain.CommissionEarned).Error
	if err != nil && isTableMissing(err) {
		return nil
	}
	return err
}

// CancelCommissions voids commissions when an escrow is refunded.
// Called inside the Refund transaction.
func CancelCommissions(tx *gorm.DB, escrowID string) error {
	err := tx.Model(&domain.InfluencerCommission{}).
		Where("escrow_id = ? AND state = ?", escrowID, domain.CommissionPending).
		Update("state", domain.CommissionCancelled).Error
	if err != nil && isTableMissing(err) {
		return nil
	}
	return err
}

func isTableMissing(err error) bool {
	if err == nil {
		return false
	}
	s := err.Error()
	return strings.Contains(s, "no such table") || strings.Contains(s, "does not exist")
}

// PayOutEarned initiates Paystack transfers for all earned commissions.
// Called by the background job. Returns the number of commissions paid.
func (s *Service) PayOutEarned(ctx context.Context) (int, error) {
	var earned []domain.InfluencerCommission
	if err := s.db.WithContext(ctx).
		Where("state = ?", domain.CommissionEarned).
		Limit(200).Find(&earned).Error; err != nil {
		return 0, err
	}

	// Load packages for all earned commissions.
	pkgIDs := make([]uint, 0, len(earned))
	for _, c := range earned {
		pkgIDs = append(pkgIDs, c.PackageID)
	}
	var pkgs []domain.InfluencerPackage
	if err := s.db.WithContext(ctx).Where("id IN ?", pkgIDs).Find(&pkgs).Error; err != nil {
		return 0, err
	}
	pkgMap := make(map[uint]domain.InfluencerPackage, len(pkgs))
	for _, p := range pkgs {
		pkgMap[p.ID] = p
	}

	// Group by package to batch into one transfer per influencer per run.
	type batch struct {
		pkg   domain.InfluencerPackage
		total int64
		ids   []uint
	}
	byPkg := map[uint]*batch{}
	for _, c := range earned {
		pkg, ok := pkgMap[c.PackageID]
		if !ok {
			continue
		}
		if _, ok := byPkg[c.PackageID]; !ok {
			byPkg[c.PackageID] = &batch{pkg: pkg}
		}
		byPkg[c.PackageID].total += c.CommissionAmount
		byPkg[c.PackageID].ids = append(byPkg[c.PackageID].ids, c.ID)
	}

	n := 0
	for _, b := range byPkg {
		if b.pkg.BankCode == "" || b.pkg.AccountNumber == "" {
			s.logger.Warn("influencer package has no bank details; skipping payout",
				slog.Uint64("package", uint64(b.pkg.ID)))
			continue
		}
		// Create a withdrawal row for the influencer (reuses the withdrawal pipeline).
		w := &domain.Withdrawal{
			UserID:         b.pkg.OwnerID, // platform pays on behalf of owner
			Amount:         b.total,
			BankCode:       b.pkg.BankCode,
			AccountNumber:  b.pkg.AccountNumber,
			AccountName:    b.pkg.AccountName,
			IdempotencyKey: fmt.Sprintf("inf-%d-%d", b.pkg.ID, time.Now().Unix()),
			State:          domain.WithdrawalPending,
		}
		err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			if err := tx.Create(w).Error; err != nil {
				return err
			}
			return tx.Model(&domain.InfluencerCommission{}).
				Where("id IN ?", b.ids).
				Updates(map[string]any{
					"state":         domain.CommissionPaid,
					"withdrawal_id": w.ID,
				}).Error
		})
		if err != nil {
			s.logger.Error("influencer payout failed", slog.Uint64("package", uint64(b.pkg.ID)), slog.Any("error", err))
			continue
		}
		n += len(b.ids)
	}
	return n, nil
}

// ── helpers ──────────────────────────────────────────────────────────────────

func (s *Service) ownerGet(ctx context.Context, ownerID string, id uint) (*domain.InfluencerPackage, error) {
	var pkg domain.InfluencerPackage
	if err := s.db.WithContext(ctx).First(&pkg, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPackageNotFound
		}
		return nil, err
	}
	if pkg.OwnerID != ownerID {
		return nil, ErrNotOwner
	}
	return &pkg, nil
}

func (s *Service) attachStats(ctx context.Context, pkgs []domain.InfluencerPackage) {
	if len(pkgs) == 0 {
		return
	}
	ids := make([]uint, len(pkgs))
	idx := make(map[uint]int, len(pkgs))
	for i, p := range pkgs {
		ids[i] = p.ID
		idx[p.ID] = i
	}
	type row struct {
		PackageID uint
		State     string
		Total     int64
		Count     int
	}
	var rows []row
	s.db.WithContext(ctx).Model(&domain.InfluencerCommission{}).
		Select("package_id, state, COALESCE(SUM(commission_amount),0) AS total, COUNT(*) AS count").
		Where("package_id IN ?", ids).
		Group("package_id, state").Scan(&rows)
	for _, r := range rows {
		i, ok := idx[r.PackageID]
		if !ok {
			continue
		}
		switch r.State {
		case domain.CommissionPending:
			pkgs[i].TotalPending += r.Total
		case domain.CommissionEarned:
			pkgs[i].TotalEarned += r.Total
		case domain.CommissionPaid:
			pkgs[i].TotalPaid += r.Total
			pkgs[i].ConversionCount += r.Count
		}
	}
}
