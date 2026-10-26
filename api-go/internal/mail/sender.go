// Package mail delivers transactional email (verification codes, order and
// booking notifications). Production sends through any authenticated SMTP
// server (Cloudflare Email Service exposes one); development can write each
// message to a local directory instead. Message contents, including codes,
// are never written to logs.
package mail

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Message is a fully rendered email.
type Message struct {
	To      string
	Subject string
	HTML    string
	Text    string
}

// Sender transports a rendered message.
type Sender interface {
	Send(ctx context.Context, from string, m Message) error
}

var ErrNotConfigured = errors.New("email delivery is not configured")

// disabledSender fails closed so a missing configuration is visible instead
// of silently dropping verification codes.
type disabledSender struct{}

func (disabledSender) Send(context.Context, string, Message) error { return ErrNotConfigured }

// SMTPSender submits mail over implicit TLS (port 465) or STARTTLS (587),
// refusing to send credentials over an unencrypted connection.
type SMTPSender struct {
	Host     string
	Port     int
	Username string
	Password string
}

func (s SMTPSender) Send(ctx context.Context, from string, m Message) error {
	raw, err := build(from, m)
	if err != nil {
		return err
	}
	addr := net.JoinHostPort(s.Host, strconv.Itoa(s.Port))
	tlsCfg := &tls.Config{ServerName: s.Host, MinVersion: tls.VersionTLS12}
	dialer := &net.Dialer{Timeout: 10 * time.Second}

	var conn net.Conn
	if s.Port == 465 {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, tlsCfg)
	} else {
		conn, err = dialer.DialContext(ctx, "tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("smtp dial: %w", err)
	}
	deadline, ok := ctx.Deadline()
	if !ok {
		deadline = time.Now().Add(30 * time.Second)
	}
	_ = conn.SetDeadline(deadline)

	c, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		conn.Close()
		return fmt.Errorf("smtp client: %w", err)
	}
	defer c.Close()

	if s.Port != 465 {
		if ok, _ := c.Extension("STARTTLS"); !ok {
			return errors.New("smtp server does not offer STARTTLS")
		}
		if err := c.StartTLS(tlsCfg); err != nil {
			return fmt.Errorf("smtp starttls: %w", err)
		}
	}
	if s.Username != "" {
		if err := c.Auth(smtp.PlainAuth("", s.Username, s.Password, s.Host)); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	fromAddr, _ := mail.ParseAddress(from)
	if err := c.Mail(fromAddr.Address); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := c.Rcpt(m.To); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}
	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write(raw); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp send: %w", err)
	}
	return c.Quit()
}

// FileSender writes each message as an .eml and an .html file. For local
// development only; enabled by MAIL_DEV_DIR.
type FileSender struct{ Dir string }

var unsafeName = regexp.MustCompile(`[^a-zA-Z0-9]+`)

func (f FileSender) Send(_ context.Context, from string, m Message) error {
	raw, err := build(from, m)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(f.Dir, 0o700); err != nil {
		return err
	}
	base := fmt.Sprintf("%s-%s-%s", time.Now().Format("20060102-150405.000"), unsafeName.ReplaceAllString(m.To, "_"), unsafeName.ReplaceAllString(m.Subject, "_"))
	if err := os.WriteFile(filepath.Join(f.Dir, base+".eml"), raw, 0o600); err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(f.Dir, base+".html"), []byte(m.HTML), 0o600)
}

// build renders an RFC 5322 multipart/alternative message. Header values are
// checked for CR/LF so user input cannot inject headers.
func build(from string, m Message) ([]byte, error) {
	for _, v := range []string{from, m.To, m.Subject} {
		if strings.ContainsAny(v, "\r\n") {
			return nil, errors.New("invalid header value")
		}
	}
	if _, err := mail.ParseAddress(m.To); err != nil {
		return nil, fmt.Errorf("invalid recipient: %w", err)
	}
	fromAddr, err := mail.ParseAddress(from)
	if err != nil {
		return nil, fmt.Errorf("invalid sender: %w", err)
	}

	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	for _, part := range []struct{ ctype, content string }{
		{"text/plain; charset=UTF-8", m.Text},
		{"text/html; charset=UTF-8", m.HTML},
	} {
		h := textproto.MIMEHeader{}
		h.Set("Content-Type", part.ctype)
		h.Set("Content-Transfer-Encoding", "quoted-printable")
		pw, err := mw.CreatePart(h)
		if err != nil {
			return nil, err
		}
		qp := quotedprintable.NewWriter(pw)
		if _, err := qp.Write([]byte(part.content)); err != nil {
			return nil, err
		}
		qp.Close()
	}
	mw.Close()

	id := make([]byte, 12)
	_, _ = rand.Read(id)
	domain := fromAddr.Address[strings.LastIndex(fromAddr.Address, "@")+1:]

	var out bytes.Buffer
	fmt.Fprintf(&out, "From: %s\r\n", fromAddr.String())
	fmt.Fprintf(&out, "To: %s\r\n", m.To)
	fmt.Fprintf(&out, "Subject: %s\r\n", mime.QEncoding.Encode("UTF-8", m.Subject))
	fmt.Fprintf(&out, "Date: %s\r\n", time.Now().UTC().Format(time.RFC1123Z))
	fmt.Fprintf(&out, "Message-ID: <%s@%s>\r\n", hex.EncodeToString(id), domain)
	out.WriteString("MIME-Version: 1.0\r\n")
	fmt.Fprintf(&out, "Content-Type: multipart/alternative; boundary=%q\r\n\r\n", mw.Boundary())
	out.Write(body.Bytes())
	return out.Bytes(), nil
}
