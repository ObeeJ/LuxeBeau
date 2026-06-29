package escrow

import (
	"context"
	"fmt"
	"log/slog"

	"luxebeau/internal/domain"
)

// Escrow lifecycle events that trigger a notification to a party.
const (
	EventCreated    = "created"
	EventFunded     = "funded"
	EventReleased   = "released"
	EventRefunded   = "refunded"
	EventDisputed   = "disputed"
	EventActionNeed = "action_needed" // "confirm you received the item/service"
)

// Notifier delivers escrow updates to a recipient (a phone number or user id).
// LogNotifier is live; WhatsAppNotifier is the production target.
type Notifier interface {
	Notify(ctx context.Context, to string, event string, e *domain.Escrow) error
}

// LogNotifier writes the message that would be sent. It lets the whole WhatsApp
// UX run end-to-end in dev without Meta credentials.
type LogNotifier struct{ logger *slog.Logger }

func NewLogNotifier(logger *slog.Logger) *LogNotifier { return &LogNotifier{logger: logger} }

func (n *LogNotifier) Notify(ctx context.Context, to, event string, e *domain.Escrow) error {
	n.logger.Info("escrow notification",
		slog.String("to", to), slog.String("event", event),
		slog.String("escrow", e.ID), slog.String("text", message(event, e)))
	return nil
}

// WhatsAppNotifier is the production notifier (WhatsApp Business Cloud API).
// The boundary is real; the send is stubbed until a Meta token + approved
// templates exist. With no token it falls back to logging.
type WhatsAppNotifier struct {
	token      string
	phoneID    string
	fallback   Notifier
	logger     *slog.Logger
}

func NewWhatsAppNotifier(token, phoneID string, logger *slog.Logger) *WhatsAppNotifier {
	return &WhatsAppNotifier{token: token, phoneID: phoneID, fallback: NewLogNotifier(logger), logger: logger}
}

func (n *WhatsAppNotifier) Notify(ctx context.Context, to, event string, e *domain.Escrow) error {
	if n.token == "" {
		return n.fallback.Notify(ctx, to, event, e)
	}
	// TODO: POST to https://graph.facebook.com/v21.0/{phoneID}/messages with the
	// approved template for `event`, recipient `to`, and escrow params.
	n.logger.Info("whatsapp send (stub)", slog.String("to", to), slog.String("event", event), slog.String("escrow", e.ID))
	return nil
}

// message renders the human copy for an event (mirrors the WhatsApp templates).
func message(event string, e *domain.Escrow) string {
	naira := float64(e.Amount) / 100
	switch event {
	case EventCreated:
		return fmt.Sprintf("An escrow request for \"%s\" (₦%.0f) was created for you. To lock your funds safely until delivery, fund this secure escrow: %s", e.Title, naira, e.ID)
	case EventFunded:
		return fmt.Sprintf("Payment secured! ₦%.0f is locked in escrow for \"%s\". The seller has been notified to deliver.", naira, e.Title)
	case EventActionNeed:
		return fmt.Sprintf("Your delivery window for \"%s\" has arrived. Reply: 1) Received  2) Issue/Delay.", e.Title)
	case EventReleased:
		fee, net := e.Fee()
		return fmt.Sprintf("Funds released: ₦%.0f to the seller (₦%.0f platform fee). Thank you!", float64(net)/100, float64(fee)/100)
	case EventRefunded:
		return fmt.Sprintf("Your ₦%.0f for \"%s\" has been refunded in full.", naira, e.Title)
	case EventDisputed:
		return fmt.Sprintf("A dispute was opened on \"%s\" (₦%.0f). Our team will review and resolve it.", e.Title, naira)
	default:
		return "Escrow update."
	}
}
