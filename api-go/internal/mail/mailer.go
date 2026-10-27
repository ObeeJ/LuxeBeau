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
		Data: map[string]string{"Name": firstName(name), "Code": code, "Heading": "Confirm your email",
			"Intro":    "enter this code on LuxeBeau to finish setting up your account.",
			"Footnote": "The code expires in 10 minutes. If you didn't try to sign up, you can ignore this email; no account is active until the code is entered."},
	}, text)
}

// SendLoginCode is the second step of an admin sign-in. Synchronous: the
// sign-in can't finish without it.
func (m *Mailer) SendLoginCode(ctx context.Context, to, name, code string) error {
	text := fmt.Sprintf("Hi %s,\n\nYour LuxeBeau admin sign-in code is %s.\nIt expires in 10 minutes.\n\nIf this wasn't you, someone has your password: change it now.\n", firstName(name), code)
	return m.send(ctx, to, "verify_code", page{
		Subject:    fmt.Sprintf("%s is your LuxeBeau sign-in code", code),
		Preheader:  "Admin sign-in code. It expires in 10 minutes.",
		FooterNote: "You received this because someone signed in to a LuxeBeau admin account with this address.",
		Data: map[string]string{"Name": firstName(name), "Code": code, "Heading": "Admin sign-in",
			"Intro":    "enter this code to finish signing in to LuxeBeau admin.",
			"Footnote": "The code expires in 10 minutes. If you didn't just sign in, someone has your password: change it now and tell the team."},
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
	// Policy is the cancellation terms in words, e.g. "Free to cancel until
	// Mon 2 Nov, 9:00 AM". Shown so the terms are agreed up front.
	Policy string
}

func bookingRows(b BookingEmail, withClient bool) []Row {
	rows := []Row{{"Service", b.Service}}
	if withClient {
		rows = append(rows, Row{"Client", b.Client})
	} else {
		rows = append(rows, Row{"Artisan", b.Artisan})
	}
	rows = append(rows, Row{"When", b.When}, Row{"Where", b.Where}, Row{"Price", b.Price})
	if b.Policy != "" {
		rows = append(rows, Row{"Cancellation", b.Policy})
	}
	return append(rows, Row{"Reference", b.BookingID})
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

// notice sends a short message using the generic heading/intro/summary
// layout (templates/booking.html).
func (m *Mailer) notice(ctx context.Context, to string, p page, heading, intro string, rows []Row, note string, button Button) error {
	p.Data = map[string]any{"Heading": heading, "Intro": intro, "Summary": rows, "Note": note, "Button": button}
	link := button.URL
	if note != "" {
		link = note + "\n\n" + button.URL
	}
	return m.send(ctx, to, "booking", p, bookingText(intro, rows, link))
}

// PartnerApproved tells a seller or artisan an admin approved them.
func (m *Mailer) PartnerApproved(ctx context.Context, to, name, role string) error {
	what, link := "your products are now live in the shop", m.appURL+"/dashboard/seller"
	if role == "artisan" {
		what, link = "your profile is now live and clients can book you", m.appURL+"/dashboard/artisan"
	}
	intro := fmt.Sprintf("Hi %s, you're approved: %s.", firstName(name), what)
	return m.notice(ctx, to, page{
		Subject:    "You're approved on LuxeBeau",
		Preheader:  "Your partner account is live.",
		FooterNote: "You received this because you applied to sell or work on LuxeBeau.",
	}, "You're approved", intro, nil, "", Button{"Open your studio", link})
}

// FulfilmentEmail describes a seller's progress on part of an order.
type FulfilmentEmail struct {
	OrderID string
	Stage   string // shipped or delivered
	Seller  string
	Items   []string
	Note    string
	// ReleaseBy is the date the seller is paid if the buyer does nothing.
	// Set only when the items were marked delivered.
	ReleaseBy string
}

// OrderProgress tells the buyer some of their items shipped or arrived.
func (m *Mailer) OrderProgress(ctx context.Context, to, name string, f FulfilmentEmail) error {
	heading, subject, intro := "On its way", "Order %s has shipped", "Hi %s, %s has sent your items."
	if f.Stage == "delivered" {
		heading, subject, intro = "Delivered", "Order %s was delivered", "Hi %s, %s marked your items as delivered."
	}
	rows := []Row{{"Order", f.OrderID}, {"Items", strings.Join(f.Items, ", ")}}
	if f.Note != "" {
		rows = append(rows, Row{"Tracking", f.Note})
	}
	intro = fmt.Sprintf(intro, firstName(name), f.Seller)
	note, button := "", Button{"View your order", m.appURL + "/dashboard"}
	if f.Stage == "delivered" && f.ReleaseBy != "" {
		button.Label = "Confirm or report a problem"
		rows = append(rows, Row{"Confirm by", f.ReleaseBy})
		note = "Your payment is held until you confirm delivery. If something is wrong, report it in your account before " +
			f.ReleaseBy + ". If you do nothing, the payment goes to the seller on that date."
	}
	return m.notice(ctx, to, page{
		Subject:    fmt.Sprintf(subject, f.OrderID),
		Preheader:  strings.Join(f.Items, ", "),
		FooterNote: "You received this because you placed an order on LuxeBeau.",
	}, heading, intro, rows, note, button)
}

// CancelEmail says who cancelled a booking and why.
type CancelEmail struct {
	By     string // buyer, artisan, admin or system
	Reason string
	Late   bool // the client cancelled a confirmed booking inside the notice window
}

// cancelRows is the booking summary for a cancellation email. The cancellation
// terms are left out (they no longer apply) and so is the reason when the
// system cancelled, since the heading already says why.
func cancelRows(b BookingEmail, withClient bool, c CancelEmail) []Row {
	b.Policy = ""
	rows := bookingRows(b, withClient)
	if c.Reason != "" && c.By != "system" {
		rows = append(rows, Row{"Reason", c.Reason})
	}
	return rows
}

// BookingCancelledForClient tells the client their booking was cancelled,
// whether they did it, the artisan did, an admin did, or the request expired.
func (m *Mailer) BookingCancelledForClient(ctx context.Context, to, name string, b BookingEmail, c CancelEmail) error {
	var heading, intro, note string
	button := Button{"Find another time", m.appURL + "/services"}
	switch c.By {
	case "buyer":
		heading = "Booking cancelled"
		intro = fmt.Sprintf("Hi %s, your booking with %s is cancelled and the time is open again.", firstName(name), b.Artisan)
		button = Button{"View your bookings", m.appURL + "/dashboard"}
		if c.Late {
			note = "This was inside the artisan's cancellation notice, so it is recorded as a late cancellation. Nothing was charged."
		}
	case "artisan":
		heading = "Your booking was cancelled"
		intro = fmt.Sprintf("Hi %s, %s can't make this booking. We're sorry. Nothing was charged.", firstName(name), b.Artisan)
	case "system":
		heading = "No answer from the artisan"
		intro = fmt.Sprintf("Hi %s, %s didn't answer your request in time, so we cancelled it. Nothing was charged.", firstName(name), b.Artisan)
	default:
		heading = "Your booking was cancelled"
		intro = fmt.Sprintf("Hi %s, your booking with %s was cancelled by LuxeBeau. Nothing was charged.", firstName(name), b.Artisan)
	}
	rows := cancelRows(b, false, c)
	return m.notice(ctx, to, page{
		Subject:    fmt.Sprintf("Cancelled: %s with %s", b.Service, b.Artisan),
		Preheader:  fmt.Sprintf("%s, %s.", b.Service, b.When),
		FooterNote: "You received this because you have a booking on LuxeBeau.",
	}, heading, intro, rows, note, button)
}

// BookingCancelledForArtisan tells the artisan a booking was cancelled.
func (m *Mailer) BookingCancelledForArtisan(ctx context.Context, to, name string, b BookingEmail, c CancelEmail) error {
	intro := fmt.Sprintf("Hi %s, %s cancelled their booking. The time is open again for other clients.", firstName(name), b.Client)
	note := ""
	if c.By != "buyer" {
		intro = fmt.Sprintf("Hi %s, this booking with %s was cancelled. The time is open again for other clients.", firstName(name), b.Client)
	}
	if c.Late {
		note = "The client cancelled inside your notice window; it is recorded as a late cancellation on their account."
	}
	rows := cancelRows(b, true, c)
	return m.notice(ctx, to, page{
		Subject:    fmt.Sprintf("Cancelled: %s on %s", b.Service, b.When),
		Preheader:  fmt.Sprintf("%s cancelled. The time is open again.", b.Client),
		FooterNote: "You received this because you're a LuxeBeau artisan.",
	}, "Booking cancelled", intro, rows, note, Button{"Open your studio", m.appURL + "/dashboard/artisan"})
}

// BookingReminder reminds the client about an appointment about a day ahead,
// with the cancellation terms they agreed to.
func (m *Mailer) BookingReminder(ctx context.Context, to, name string, b BookingEmail) error {
	intro := fmt.Sprintf("Hi %s, a reminder that your appointment with %s is coming up.", firstName(name), b.Artisan)
	return m.notice(ctx, to, page{
		Subject:    fmt.Sprintf("Reminder: %s with %s, %s", b.Service, b.Artisan, b.When),
		Preheader:  fmt.Sprintf("%s, %s.", b.When, b.Where),
		FooterNote: "You received this because you have a booking on LuxeBeau.",
	}, "See you soon", intro, bookingRows(b, false), "If your plans change, please cancel in your account so the time can go to someone else.",
		Button{"Manage your booking", m.appURL + "/dashboard"})
}

func firstName(name string) string {
	if f := strings.Fields(name); len(f) > 0 {
		return f[0]
	}
	return "there"
}
