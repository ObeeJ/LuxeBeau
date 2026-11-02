package storefront

import (
	"errors"
	"regexp"
	"strings"
)

var (
	// HandleRegex enforces 3-50 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens.
	handleRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$`)

	ErrInvalidHandleFormat = errors.New("handle must be 3-50 lowercase alphanumeric characters and hyphens, without leading or trailing hyphens")
	ErrHandleReserved      = errors.New("this handle is reserved by the platform")
	ErrHandleUnavailable   = errors.New("this handle is currently in use or quarantined")
	ErrHandleChangedRecent = errors.New("a handle can only be changed once every 90 days")
	ErrStorefrontNotLive   = errors.New("this storefront is not currently live")
	ErrUnverifiedMerchant  = errors.New("verified merchant or artisan status is required to publish a storefront or claim a handle")
	ErrInvalidTemplate     = errors.New("invalid storefront template selected")
	ErrStudioArtisanOnly   = errors.New("the studio template is reserved exclusively for artisans")
	ErrNoProductsOrServices = errors.New("cannot go live without at least one published product or bookable service")
	ErrBioTooLong          = errors.New("bio must not exceed 280 characters")
)

// DefaultReservedHandles contains baseline system routes and namespaces reserved by default.
var DefaultReservedHandles = []string{
	"admin", "api", "app", "www", "mail", "shop", "store", "luxebeau",
	"support", "help", "blog", "about", "careers", "press", "legal",
	"terms", "privacy", "dashboard", "artisan", "seller", "buyer",
	"platform", "s", "auth", "login", "signup", "checkout", "cart",
	"orders", "wallet", "escrow", "kyc", "webhook", "webhooks",
}

// NormalizeHandle cleans and lowercases the handle.
func NormalizeHandle(h string) string {
	return strings.ToLower(strings.TrimSpace(h))
}

// ValidateHandleFormat validates the format according to PRD section 6.1.
func ValidateHandleFormat(h string) error {
	norm := NormalizeHandle(h)
	if !handleRegex.MatchString(norm) {
		return ErrInvalidHandleFormat
	}
	return nil
}
