package mail

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"html/template"
	"log/slog"
	"strings"
	"time"
)

//go:embed templates/*.html
var templateFS embed.FS

// Config selects the transport and branding for outgoing mail.
type Config struct {
	From         string // e.g. "LuxeBeau <hello@luxebeau.ng>"
	AppURL       string // public web URL used in links
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	DevDir       string // when set and SMTP is not, messages are written here
}

// Mailer renders branded templates and hands them to a Sender.
type Mailer struct {
	sender Sender
	from   string
	appURL string
	logger *slog.Logger
	pages  map[string]*template.Template
}

func New(cfg Config, logger *slog.Logger) *Mailer {
	var sender Sender = disabledSender{}
	switch {
	case cfg.SMTPHost != "":
		port := cfg.SMTPPort
		if port == 0 {
			port = 465
		}
		sender = SMTPSender{Host: cfg.SMTPHost, Port: port, Username: cfg.SMTPUsername, Password: cfg.SMTPPassword}
	case cfg.DevDir != "":
		sender = FileSender{Dir: cfg.DevDir}
		logger.Warn("email: writing messages to a local directory (development only)")
	default:
		logger.Warn("email: no SMTP_HOST configured; verification codes cannot be delivered")
	}
	return NewWithSender(sender, cfg.From, cfg.AppURL, logger)
}

func NewWithSender(sender Sender, from, appURL string, logger *slog.Logger) *Mailer {
	if from == "" {
		from = "LuxeBeau <no-reply@luxebeau.ng>"
	}
	pages := map[string]*template.Template{}
	for _, name := range []string{"verify_code", "order_placed", "booking"} {
		pages[name] = template.Must(template.ParseFS(templateFS, "templates/layout.html", "templates/"+name+".html"))
	}
	return &Mailer{sender: sender, from: from, appURL: strings.TrimRight(appURL, "/"), logger: logger, pages: pages}
}

type page struct {
	Subject    string
	Preheader  string
	FooterNote string
	AppURL     string
	Data       any
}

// Row is one label/value line in a summary table.
type Row struct{ Label, Value string }

// Button is a call-to-action link.
type Button struct{ Label, URL string }

func (m *Mailer) send(ctx context.Context, to, name string, p page, text string) error {
	p.AppURL = m.appURL
	var html bytes.Buffer
	if err := m.pages[name].ExecuteTemplate(&html, "layout", p); err != nil {
		return fmt.Errorf("render %s: %w", name, err)
	}
	return m.sender.Send(ctx, m.from, Message{To: to, Subject: p.Subject, HTML: html.String(), Text: text})
}

// Go sends in the background so a slow mail server never delays an API
// response. Failures are logged without the message contents.
func (m *Mailer) Go(kind string, fn func(ctx context.Context) error) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := fn(ctx); err != nil {
			m.logger.Warn("email delivery failed", slog.String("kind", kind), slog.Any("error", err))
		}
	}()
}

// SendVerificationCode is synchronous: sign-up depends on it.
func (m *Mailer) SendVerificationCode(ctx context.Context, to, name, code string) error {
	text := fmt.Sprintf("Hi %s,\n\nYour LuxeBeau verification code is %s.\nIt expires in 10 minutes.\n\nIf you didn't try to sign up, ignore this email.\n", name, code)
	return m.send(ctx, to, "verify_code", page{
		Subject:    fmt.Sprintf("%s is your LuxeBeau code", code),
		Preheader:  "Enter this code to confirm your email. It expires in 10 minutes.",
		FooterNote: "You received this because someone used this address to create a LuxeBeau account.",
		Data:       map[string]string{"Name": firstName(name), "Code": code},
	}, text)
}

// OrderLine is one product in an order confirmation.
type OrderLine struct {
	Name, Brand, Total string
	Qty                int
}

type OrderEmail struct {
	OrderID       string
	PaymentStatus string
	Items         []OrderLine
	Subtotal      string
	Delivery      string
	Total         string
	PaymentMethod string
	Address       string
}

func (m *Mailer) OrderPlaced(ctx context.Context, to, name string, o OrderEmail) error {
	payment := "Pending confirmation"
	if o.PaymentStatus == "paid" {
		payment = "Paid"
	}
	data := map[string]any{
		"Name":          firstName(name),
		"OrderID":       o.OrderID,
		"PaymentStatus": o.PaymentStatus,
		"Items":         o.Items,
		"Address":       o.Address,
		"Summary": []Row{
			{"Subtotal", o.Subtotal},
			{"Delivery", o.Delivery},
			{"Total", o.Total},
			{"Payment", payment},
		},
		"Button": Button{"View your order", m.appURL + "/dashboard"},
	}
	var lines strings.Builder
	for _, it := range o.Items {
		fmt.Fprintf(&lines, "- %s (%s) x%d: %s\n", it.Name, it.Brand, it.Qty, it.Total)
	}
	text := fmt.Sprintf("Hi %s,\n\nThanks for your order %s.\n\n%s\nSubtotal: %s\nDelivery: %s\nTotal: %s\nPayment: %s\n\nDelivering to %s\n\nView your order: %s/dashboard\n",
		firstName(name), o.OrderID, lines.String(), o.Subtotal, o.Delivery, o.Total, payment, o.Address, m.appURL)
	return m.send(ctx, to, "order_placed", page{
		Subject:    fmt.Sprintf("Order %s received", o.OrderID),
		Preheader:  fmt.Sprintf("%d item(s), %s total.", len(o.Items), o.Total),
		FooterNote: "You received this because you placed an order on LuxeBeau.",
		Data:       data,
	}, text)
}

type BookingEmail struct {
	BookingID string
	Service   string
	Artisan   string
	Client    string
	When      string
	Where     string
	Price     string
}

func bookingRows(b BookingEmail, withClient bool) []Row {
	rows := []Row{{"Service", b.Service}}
	if withClient {
		rows = append(rows, Row{"Client", b.Client})
	} else {
		rows = append(rows, Row{"Artisan", b.Artisan})
	}
	return append(rows, Row{"When", b.When}, Row{"Where", b.Where}, Row{"Price", b.Price}, Row{"Reference", b.BookingID})
}

func bookingText(intro string, rows []Row, link string) string {
	var sb strings.Builder
	sb.WriteString(intro + "\n\n")
	for _, r := range rows {
		fmt.Fprintf(&sb, "%s: %s\n", r.Label, r.Value)
	}
	sb.WriteString("\n" + link + "\n")
	return sb.String()
}

// BookingRequested goes to the client after they request a slot.
func (m *Mailer) BookingRequested(ctx context.Context, to, name string, b BookingEmail) error {
	intro := fmt.Sprintf("Hi %s, your request with %s is in. We'll email you as soon as they confirm the slot.", firstName(name), b.Artisan)
	rows := bookingRows(b, false)
	return m.send(ctx, to, "booking", page{
		Subject:    fmt.Sprintf("Booking requested: %s", b.Service),
		Preheader:  fmt.Sprintf("%s with %s, %s.", b.Service, b.Artisan, b.When),
		FooterNote: "You received this because you requested a booking on LuxeBeau.",
		Data: map[string]any{"Heading": "Booking requested", "Intro": intro, "Summary": rows,
			"Note": "Nothing is charged online for bookings. You pay the artisan for the service.", "Button": Button{"View your bookings", m.appURL + "/dashboard"}},
	}, bookingText(intro, rows, m.appURL+"/dashboard"))
}

// NewBookingForArtisan tells the artisan a client requested a slot.
func (m *Mailer) NewBookingForArtisan(ctx context.Context, to, name string, b BookingEmail) error {
	intro := fmt.Sprintf("Hi %s, %s requested a booking. Confirm it from your studio so they know you're expecting them.", firstName(name), b.Client)
	rows := bookingRows(b, true)
	return m.send(ctx, to, "booking", page{
		Subject:    fmt.Sprintf("New booking request: %s", b.Service),
		Preheader:  fmt.Sprintf("%s on %s. Confirm it from your studio.", b.Client, b.When),
		FooterNote: "You received this because you're a LuxeBeau artisan.",
		Data: map[string]any{"Heading": "New booking request", "Intro": intro, "Summary": rows,
			"Button": Button{"Confirm in your studio", m.appURL + "/dashboard/artisan"}},
	}, bookingText(intro, rows, m.appURL+"/dashboard/artisan"))
}

// BookingConfirmed goes to the client when the artisan confirms.
func (m *Mailer) BookingConfirmed(ctx context.Context, to, name string, b BookingEmail) error {
	intro := fmt.Sprintf("Hi %s, %s confirmed your booking. See you there.", firstName(name), b.Artisan)
	rows := bookingRows(b, false)
	return m.send(ctx, to, "booking", page{
		Subject:    fmt.Sprintf("Confirmed: %s with %s", b.Service, b.Artisan),
		Preheader:  fmt.Sprintf("%s, %s.", b.When, b.Where),
		FooterNote: "You received this because you have a booking on LuxeBeau.",
		Data: map[string]any{"Heading": "Your booking is confirmed", "Intro": intro, "Summary": rows,
			"Button": Button{"View your bookings", m.appURL + "/dashboard"}},
	}, bookingText(intro, rows, m.appURL+"/dashboard"))
}

func firstName(name string) string {
	if f := strings.Fields(name); len(f) > 0 {
		return f[0]
	}
	return "there"
}
