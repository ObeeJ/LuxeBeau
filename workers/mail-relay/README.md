# luxebeau-mail-relay

A tiny Cloudflare Worker that lets the API send email over HTTPS. Render's free
plan blocks the SMTP ports (25, 465, 587), so the API cannot talk to Gmail
directly. Instead the API POSTs each message here, and this Worker delivers it
through Gmail's SMTP (Workers are allowed to open outbound connections on 465).
Free: Workers Free plan, Gmail account, no domain needed.

- `POST /send` with `Authorization: Bearer <RELAY_SECRET>` and JSON
  `{from, to, subject, html?, text?}`.
- `from` must be the Gmail account itself; one recipient; no line breaks in
  headers; size limits. Everything else is refused (400/401/405/413/503).
- With no secrets configured it refuses everything (503).

## Secrets (set with wrangler; never commit them)

    npx wrangler secret put SMTP_USER      # the Gmail address
    npx wrangler secret put SMTP_PASS      # a Gmail App Password
    npx wrangler secret put RELAY_SECRET   # long random string shared with the API

## API settings (Render dashboard)

    MAIL_RELAY_URL    = https://luxebeau-mail-relay.<account>.workers.dev
    MAIL_RELAY_SECRET = the same value as RELAY_SECRET

The API prefers Cloudflare Email Service when configured, then this relay, then
Brevo, then direct SMTP.

## Develop and deploy

    npm install
    npm test            # request-checking logic
    npx wrangler deploy

## Rotating a secret

Set the new value with `wrangler secret put`, then update `MAIL_RELAY_SECRET` on
Render to match. Gmail App Passwords are revoked in the Google account settings.
