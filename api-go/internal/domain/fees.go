package domain

import "encoding/json"

// Pricing rules for what a buyer pays on top of the goods.
//
//   - The platform fee is LuxeBeau's own revenue. The buyer pays it, on top of
//     the price; the seller receives the full price and the full delivery fee.
//     The tier is chosen by the whole order's item subtotal (not per band), and
//     delivery is not part of the base: it belongs to the seller.
//   - The processing fee is what the payment gateway charges. The buyer pays it
//     too, so it is grossed up: whatever the gateway keeps, we still end up with
//     exactly the goods, delivery and platform fee. Wallet payments have none.
//
// All amounts are kobo.

const (
	// Platform fee in basis points (100 = 1%).
	PlatformFeeBpsLow  = 350 // subtotal up to and including N10,000
	PlatformFeeBpsMid  = 300 // up to and including N50,000
	PlatformFeeBpsHigh = 250 // above N50,000

	platformTierLowMax int64 = 1_000_000 // N10,000
	platformTierMidMax int64 = 5_000_000 // N50,000
)

// PlatformFeeBps returns the platform fee rate for an order's item subtotal.
// The upper edge of each band belongs to that band: exactly N10,000 is 3.5% and
// exactly N50,000 is 3%.
func PlatformFeeBps(subtotal int64) int {
	switch {
	case subtotal <= platformTierLowMax:
		return PlatformFeeBpsLow
	case subtotal <= platformTierMidMax:
		return PlatformFeeBpsMid
	default:
		return PlatformFeeBpsHigh
	}
}

// PlatformFee is the platform fee on an order's item subtotal, rounded half up
// to a whole kobo.
func PlatformFee(subtotal int64) int64 {
	return (subtotal*int64(PlatformFeeBps(subtotal)) + 5000) / 10000
}

// Gateway (Paystack) pricing as published: 1.5%, plus a flat N100 on charges of
// N2,500 or more, capped at N2,000. Verify against the current Paystack price
// list before relying on these.
const (
	gatewayPercentBps int64 = 150
	gatewayFlatKobo   int64 = 10_000
	gatewayFlatFrom   int64 = 250_000
	gatewayCapKobo    int64 = 200_000
)

// gatewayCut is what the gateway keeps from a charge (rounded up, so we are
// never short).
func gatewayCut(charged int64) int64 {
	cut := (charged*gatewayPercentBps + 9999) / 10000
	if charged >= gatewayFlatFrom {
		cut += gatewayFlatKobo
	}
	if cut > gatewayCapKobo {
		cut = gatewayCapKobo
	}
	return cut
}

// ProcessingFee is the amount to add to base so that, after the gateway takes
// its cut of the whole charge, exactly base is left.
func ProcessingFee(base int64) int64 {
	if base <= 0 {
		return 0
	}
	charged := base
	for i := 0; i < 20; i++ {
		next := base + gatewayCut(charged)
		if next == charged {
			break
		}
		charged = next
	}
	// The cut jumps at the flat-fee threshold; never settle on a charge that
	// leaves less than base.
	for charged-gatewayCut(charged) < base {
		charged++
	}
	return charged - base
}

// ChargesProcessingFee reports whether a payment method goes through the card
// gateway and so carries a processing fee. Wallet payments do not.
func ChargesProcessingFee(payMethod string) bool {
	switch payMethod {
	case "card", "transfer", "ussd":
		return true
	}
	return false
}

// OrderPrice is everything the buyer pays for an order.
type OrderPrice struct {
	Subtotal      int64 `json:"subtotal"`       // the goods, to the sellers
	DeliveryFee   int64 `json:"delivery_fee"`   // set by the sellers, to the sellers
	PlatformFee   int64 `json:"platform_fee"`   // LuxeBeau's revenue
	ProcessingFee int64 `json:"processing_fee"` // the gateway's cut, paid by the buyer
	Total         int64 `json:"total"`
}

// DeliveryBySeller returns each seller's share of the order's delivery fee, or
// nil for an order placed before sellers kept their own delivery fee.
func (o *Order) DeliveryBySeller() map[string]int64 {
	if o.DeliverySplit == "" {
		return nil
	}
	var m map[string]int64
	if err := json.Unmarshal([]byte(o.DeliverySplit), &m); err != nil {
		return nil
	}
	return m
}

// SetDeliveryBySeller records each seller's share of the delivery fee.
func (o *Order) SetDeliveryBySeller(m map[string]int64) {
	b, _ := json.Marshal(m)
	o.DeliverySplit = string(b)
}

// PriceOrder works out what a buyer pays for goods worth subtotal with the
// sellers' delivery fees already added up.
func PriceOrder(subtotal, delivery int64, viaGateway bool) OrderPrice {
	p := OrderPrice{Subtotal: subtotal, DeliveryFee: delivery, PlatformFee: PlatformFee(subtotal)}
	base := subtotal + delivery + p.PlatformFee
	if viaGateway {
		p.ProcessingFee = ProcessingFee(base)
	}
	p.Total = base + p.ProcessingFee
	return p
}
