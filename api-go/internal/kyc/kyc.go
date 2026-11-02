// Package kyc isolates identity verification behind a Provider interface so
// the rest of the app never depends on any single vendor. Providers are routed
// by the user's country code (ISO 3166-1 alpha-2).
//
// Tier map:
//   NG          → Prembly (NIN / BVN)
//   GH,KE,ZA,EG → Smile Identity (national ID / passport)
//   GB,US,CA,AU → Stripe Identity (passport / driving licence liveness)
//   *           → Manual review (admin uploads document)
//
// SECURITY: raw document numbers are never persisted. Only the resulting
// status and provider name are stored on the user record.
package kyc

import (
	"context"
	"log/slog"
	"strings"

	"gorm.io/gorm"

	"luxebeau/internal/domain"
)

// Kind is the document type the user is submitting.
type Kind string

const (
	NIN      Kind = "nin"       // Nigeria National ID Number
	BVN      Kind = "bvn"       // Nigeria Bank Verification Number
	NationalID Kind = "national_id" // Generic national ID (non-NG)
	Passport Kind = "passport"  // International passport
)

// Result is the normalised outcome of a verification attempt.
type Result struct {
	Status    string `json:"status"`              // verified, pending, failed
	Reference string `json:"reference,omitempty"` // provider's own reference
	Provider  string `json:"provider"`
}

// Provider abstracts an identity vendor.
type Provider interface {
	Verify(ctx context.Context, kind Kind, value string) (Result, error)
	Name() string
	// SupportedKinds returns the document types this provider accepts.
	SupportedKinds() []Kind
}

// ── Prembly (Nigeria: NIN / BVN) ─────────────────────────────────────────────

type PremblyProvider struct {
	apiKey string
	appID  string
	logger *slog.Logger
}

func NewPremblyProvider(apiKey, appID string, logger *slog.Logger) *PremblyProvider {
	return &PremblyProvider{apiKey: apiKey, appID: appID, logger: logger}
}

func (p *PremblyProvider) Name() string { return "prembly" }
func (p *PremblyProvider) SupportedKinds() []Kind { return []Kind{NIN, BVN} }

func (p *PremblyProvider) Verify(ctx context.Context, kind Kind, value string) (Result, error) {
	if p.apiKey == "" {
		p.logger.Info("KYC stub: no Prembly key, queuing for manual review", slog.String("kind", string(kind)))
		return Result{Status: "pending", Provider: p.Name()}, nil
	}
	// TODO: POST https://api.prembly.com/identitypass/verification/{nin|bvn}
	//   headers: x-api-key, app-id; body: {number: value}
	p.logger.Info("KYC verify via Prembly", slog.String("kind", string(kind)))
	return Result{Status: "pending", Provider: p.Name()}, nil
}

// ── Smile Identity (Ghana, Kenya, South Africa, Egypt + 30 more African countries) ──

type SmileProvider struct {
	apiKey    string
	partnerId string
	logger    *slog.Logger
}

func NewSmileProvider(apiKey, partnerId string, logger *slog.Logger) *SmileProvider {
	return &SmileProvider{apiKey: apiKey, partnerId: partnerId, logger: logger}
}

func (p *SmileProvider) Name() string { return "smile" }
func (p *SmileProvider) SupportedKinds() []Kind { return []Kind{NationalID, Passport} }

func (p *SmileProvider) Verify(ctx context.Context, kind Kind, value string) (Result, error) {
	if p.apiKey == "" {
		p.logger.Info("KYC stub: no Smile Identity key, queuing for manual review", slog.String("kind", string(kind)))
		return Result{Status: "pending", Provider: p.Name()}, nil
	}
	// TODO: Smile Identity Web API v2 — ID verification endpoint
	//   POST https://testapi.smileidentity.com/v1/id_verification
	p.logger.Info("KYC verify via Smile Identity", slog.String("kind", string(kind)))
	return Result{Status: "pending", Provider: p.Name()}, nil
}

// ── Stripe Identity (UK, US, CA, AU — passport / driving licence liveness) ───

type StripeProvider struct {
	secretKey string
	logger    *slog.Logger
}

func NewStripeProvider(secretKey string, logger *slog.Logger) *StripeProvider {
	return &StripeProvider{secretKey: secretKey, logger: logger}
}

func (p *StripeProvider) Name() string { return "stripe" }
func (p *StripeProvider) SupportedKinds() []Kind { return []Kind{Passport, NationalID} }

func (p *StripeProvider) Verify(ctx context.Context, kind Kind, value string) (Result, error) {
	if p.secretKey == "" {
		p.logger.Info("KYC stub: no Stripe key, queuing for manual review", slog.String("kind", string(kind)))
		return Result{Status: "pending", Provider: p.Name()}, nil
	}
	// TODO: Stripe Identity — create VerificationSession, return client_secret
	//   to the frontend for the Stripe.js modal, then webhook confirms result.
	p.logger.Info("KYC verify via Stripe Identity", slog.String("kind", string(kind)))
	return Result{Status: "pending", Provider: p.Name()}, nil
}

// ── Manual review (fallback for all other countries) ─────────────────────────

type ManualProvider struct {
	logger *slog.Logger
}

func NewManualProvider(logger *slog.Logger) *ManualProvider {
	return &ManualProvider{logger: logger}
}

func (p *ManualProvider) Name() string { return "manual" }
func (p *ManualProvider) SupportedKinds() []Kind { return []Kind{Passport, NationalID} }

func (p *ManualProvider) Verify(ctx context.Context, kind Kind, value string) (Result, error) {
	p.logger.Info("KYC queued for manual review", slog.String("kind", string(kind)))
	// Manual review: admin will verify via the admin console and mark verified.
	return Result{Status: "pending", Provider: p.Name()}, nil
}

// ── Router ────────────────────────────────────────────────────────────────────

// smileCountries are African markets covered by Smile Identity.
var smileCountries = map[string]bool{
	"GH": true, "KE": true, "ZA": true, "EG": true,
	"TZ": true, "UG": true, "RW": true, "ET": true,
	"CI": true, "SN": true, "CM": true,
}

// stripeCountries are Western markets where Stripe Identity is available.
var stripeCountries = map[string]bool{
	"GB": true, "US": true, "CA": true, "AU": true,
	"DE": true, "FR": true, "NL": true, "IE": true,
}

// ProviderRouter selects the right provider for a given country code.
type ProviderRouter struct {
	prembly *PremblyProvider
	smile   *SmileProvider
	stripe  *StripeProvider
	manual  *ManualProvider
}

func NewProviderRouter(prembly *PremblyProvider, smile *SmileProvider, stripe *StripeProvider, manual *ManualProvider) *ProviderRouter {
	return &ProviderRouter{prembly: prembly, smile: smile, stripe: stripe, manual: manual}
}

func (r *ProviderRouter) For(countryCode string) Provider {
	cc := strings.ToUpper(strings.TrimSpace(countryCode))
	switch {
	case cc == "NG":
		return r.prembly
	case smileCountries[cc]:
		return r.smile
	case stripeCountries[cc]:
		return r.stripe
	default:
		return r.manual
	}
}

// KindsFor returns the document types accepted for a given country.
func (r *ProviderRouter) KindsFor(countryCode string) []Kind {
	return r.For(countryCode).SupportedKinds()
}

// ── Service ───────────────────────────────────────────────────────────────────

type Service struct {
	router *ProviderRouter
	db     *gorm.DB
	logger *slog.Logger
}

func NewService(router *ProviderRouter, db *gorm.DB, logger *slog.Logger) *Service {
	return &Service{router: router, db: db, logger: logger}
}

func (s *Service) Submit(ctx context.Context, userID, countryCode string, kind Kind, value string) (Result, error) {
	value = strings.TrimSpace(value)
	provider := s.router.For(countryCode)

	s.setStatus(ctx, userID, "pending", provider.Name())

	res, err := provider.Verify(ctx, kind, value)
	if err != nil {
		s.setStatus(ctx, userID, "failed", provider.Name())
		return Result{Status: "failed", Provider: provider.Name()}, err
	}
	s.setStatus(ctx, userID, res.Status, provider.Name())
	return res, nil
}

// KindsFor exposes the accepted document types for a country to the handler.
func (s *Service) KindsFor(countryCode string) []Kind {
	return s.router.KindsFor(countryCode)
}

func (s *Service) setStatus(ctx context.Context, userID, status, providerName string) {
	updates := map[string]any{"kyc_status": status, "kyc_provider": providerName}
	if err := s.db.WithContext(ctx).Model(&domain.User{}).
		Where("id = ?", userID).Updates(updates).Error; err != nil {
		s.logger.Warn("failed to update kyc status", slog.String("user", userID), slog.Any("error", err))
	}
}
