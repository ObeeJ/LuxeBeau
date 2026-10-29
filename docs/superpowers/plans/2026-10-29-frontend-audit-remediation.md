# Frontend audit: remediation plan

Audit date 2026-10-29. Method: type check, Jest, lint, then a live run against the Go API (public catalogue, sign-up with emailed code, session cookies, refresh, order, booking, double-booking, role guard, wallet payment, sign-out) and headless-browser screenshots of the running site.

## What works (verified)

- Type check, lint and all 50 Jest tests pass.
- Public catalogue and artisans load; search; CORS for the web origin; CSRF header enforced.
- Sign-up, emailed code, HttpOnly session cookies, token refresh, sign-out.
- Order creation (in-stock item), my orders, bookings, double-booking refused, buyer blocked from admin routes.
- Every query hook is used by a page.

## Findings, most serious first

| # | Finding | Impact |
|---|---------|--------|
| 1 | **No way to pay.** Card, transfer and USSD orders are created `pending`. The backend marks them paid only when a provider webhook arrives (`order/service.go` ConfirmPayment), no route starts a payment, and the web app opens no provider checkout. | A buyer can never complete a purchase. |
| 2 | **Wallet pay always fails** (balance 0): there is no top-up route or screen. | Wallet option is unusable. |
| 3 | **Misleading copy.** After a pending order the cart page says the money is "held safe in escrow". | Buyer believes they paid. |
| 4 | **Stock errors surface as a conflict** with raw server wording (for example "insufficient stock for X (available: 0)"). | Confusing; map to a friendly message and disable Add when stock is 0 (partly done). |
| 5 | **No frontend for backend features:** withdrawals (`/me/wallet/withdraw`, `/me/wallet/withdrawals`), delivery zones, storefront slug and public storefront pages, influencer packages and referral tracking, order detail (`/orders/:id`). | Sellers and artisans cannot cash out or manage delivery; features unreachable. |
| 6 | **Dev mail only to a folder** (no SMTP configured), so sign-up codes cannot reach real users until SMTP is set. | Blocks real sign-ups in any non-local environment. |
| 7 | **Seller dashboard and artisan dashboard not exercised end to end** (no seeded password; demo accounts have none). | Unverified. |
| 8 | **Unused weight:** the `three`, `@react-three/*`, `@paper-design/shaders-react`, `simplex-noise` and `react-icons` packages are installed but never imported (slow installs). | Install time and attack surface. |
| 9 | **Another tool edits `web/` while we work** (`.amazonq/`), overwriting design files. | Design drift. |

## Plan

1. **Payments (blocks everything).** Add `POST /api/v1/orders/:id/pay` that calls the provider's initialise endpoint (Paystack first) and returns the checkout URL; the web app redirects to it and, on return, polls `GET /orders/:id` until `paid`. Tests: initialise returns a URL for a pending order, refuses an already paid order, refuses another user's order. Cart copy: "Awaiting payment" until paid.
2. **Wallet top-up.** `POST /api/v1/wallets/me/fund` (same provider flow, credited by webhook) plus an "Add money" panel in the dashboard.
3. **Friendly errors.** Map `CONFLICT` stock and slot messages to plain copy in `lib/errors.ts`; add tests.
4. **Wire missing features,** one task each, each with a page, a query hook and tests: withdrawals, delivery zones, storefront slug and public storefront, order detail, influencer links.
5. **SMTP.** Document `SMTP_*` and `MAIL_DEV_DIR` in `web/README.md` and the `api-go` docs; fail loudly in production when unset.
6. **Seed a password** for local demo accounts (`SEED_DEMO_PASSWORD`, 12+ characters) and add Playwright journeys for buyer, seller, artisan and admin.
7. **Remove unused dependencies** (item 8) and re-run install and build.
8. **Guard the design:** review `git diff 3c77aa2 -- web ':!web/public/images'` on every change; branch protection so only reviewed changes reach `redesign/design-system`.

## Done in this session (design side)

Approved design restored and rebuilt to the home mockup; ink and shadows converted to dark purple; purple grain; photos compressed (53 MB to 0.8 MB) and applied by category; hero photo slider; animated buttons, icons, logo, wordmark and favicon; footer frameless; mobile escrow strip.
