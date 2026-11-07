# LuxeBeau handoff roadmap (2026-11-06)

For an AI coding agent picking this up cold. Read this file first, then `2026-10-29-profiles-messaging-infra.md` (profiles, messaging, media, deployment design). Two older plans in this folder cover the web design (`2026-10-29-design-system-redesign.md`) and frontend fixes (`2026-10-29-frontend-audit-remediation.md`); read them before touching the web UI, because their status was not re-checked here (UNVERIFIED). Facts below were verified in the code on 2026-11-06; anything marked UNVERIFIED was not.

## 0. The project in one paragraph

LuxeBeau is a Nigerian marketplace: sellers list products, artisans offer bookable services, buyers pay into escrow and release on delivery. Go (Gin + GORM) API in `api-go/`, Next.js web app in `web/`, Cloudflare Worker in `workers/keep-awake/`, Python end-to-end test in `tests/e2e_flow.py`. Production: API on Render (`luxebeau-api.onrender.com`, free plan, kept awake by the Worker), database on Supabase (Postgres via the PgBouncer pooler, simple protocol), web on Cloudflare (domain `myluxebeau.com` per `render.yaml`), media bucket `luxebeau-media` on R2 (empty). Money is in kobo (int64). Escrow states: pending, funded, released, refunded, disputed.

## 1. Rules for the agent (from the owner)

- Plain language in anything addressed to the owner. Say what happened, what changed, what it means.
- Write the failing test first, then the code. Show real command output as evidence; say plainly what was not verified.
- After every change do a PR-style review of your own diff (bugs, gaps, missing tests, security) and report what it found.
- Commit only your own files with explicit paths (never `git add -A`; the owner often has unrelated staged files). No AI attribution lines in commits, PRs or comments.
- Never print, log or commit secrets. Put them in the Render dashboard or `wrangler secret put`. The repo is PUBLIC.
- Money, auth and schema changes are Critical: transaction boundaries, idempotency, ownership checks, tests, and ask the owner before changing a money table.
- Do not push to `main` or deploy without being told to. The owner pushes.
- Never guess at or reset a database password. Use a throwaway Postgres for tests (recipe in section 12).
- Before any destructive command (delete, kill, reset), state what it touches and how to undo it; prefer disposable resources you created yourself.

## 2. Current state (verified)

Done and pushed or committed locally (check `git log origin/main..main`):
- Request body cap 1 MiB (`api-go/internal/middleware/bodylimit.go`) and `/readyz` that pings the database (`cmd/api/main.go`).
- Ledger guards: positive amount (NOT VALID) and append-only trigger on `ledger_entries` (`internal/escrow/ledgerguard.go`), installed at startup on Postgres only.
- Escrow conservation audit (`internal/audit/escrows.go`) wired into `cmd/walletaudit`; wallet audit now maps the "platform" ledger account to `domain.PlatformWalletID`.
- Secrets removed from `render.yaml`, `api-go/wrangler.jsonc`, `api-go/worker/index.ts`; worker refuses to start without `JWT_SECRET` of 32+ chars.
- `tests/e2e_flow.py`: 15 checks read-only against production pass; 45 checks full flow on a throwaway stack pass.
- Keep-awake Worker source now calls `/readyz` (UNDEPLOYED, see section 3).

Unpushed at the time of writing: `0f2ae1f` (the e2e script and the platform-wallet audit fix); the owner already pushed the other recent commits. Confirm with `git log origin/main..main`.

Not built: the web page for buying ads (backend payment is done), tiered fee model, admin revenue view, social profile, messaging, media compressor, versioned migrations, CI/CD, web deployment automation.

Known quirks: `HEAD /healthz` returns 404 (Gin has no HEAD route); only withdrawals use an `Idempotency-Key`; the server sets 30 s read and write timeouts (search `http.Server{` in `cmd/api/main.go`). After a WebSocket upgrade (`Hijack`) Go does NOT clear those deadlines for you: the handler must clear them on the connection (`conn.SetDeadline(time.Time{})`) or the socket dies after 30 s. Test a socket idle for more than 30 s.

## 3. Workstream A: owner-only operations (do not attempt; remind the owner)

1. Rotate the Gmail app password for `ajayioba2000@gmail.com` and the Paystack test key; both were in public git history since 2026-10-31 (commit `cc2f804`). New values go only in the Render dashboard.
2. Set a fresh `JWT_SECRET` (32+ random chars) on every deployment that ever ran `api-go/worker`.
3. Push the unpushed commits; redeploy the keep-awake Worker: `cd workers/keep-awake && wrangler login && wrangler deploy`.
4. Delete Render services `akin` and `go-gin-backend` (workspace free hours are shared; an always-awake API uses about 744 of 750).
5. Restore the local dev Postgres login: `sudo -u postgres psql -c "ALTER ROLE luxebeau PASSWORD '<new>'"`.
6. Decide the Render plan: Starter (about 7 USD a month, never sleeps) vs free plus pinger.
7. Optional: rewrite git history to drop the old secrets (force-push on a public repo). Rotation makes it unnecessary.

## 4. Workstream B: tiered platform fee and buyer-paid processing fee (Critical, money path)

Owner's spec: platform fee is 3.5% for transactions up to N10,000, 3% for N10,000 to N50,000, 2.5% above N50,000. Buyers absorb the payment-method (Paystack) fee. The platform fee is LuxeBeau's own revenue.

Today: flat 1% (`domain.DefaultFeeBps = 100`, `internal/domain/escrow.go:33`), `Fee()` at line 80 computes `Amount * FeeBps / 10000`, set at `internal/escrow/order.go:79` and `internal/escrow/service.go:69`, taken from the seller's payout at release (`internal/escrow/service.go` around 150 to 172).

Ask the owner before building (open questions, recommended answers first):
- Does the tier rate apply to the whole order (recommended) or marginally per band? Today every product is N1,000 to N10,000 so it only matters later.
- Is the platform fee taken from the seller's payout (as now, recommended) or added to the buyer's bill?
- The spec overlaps at the edges: which band owns exactly N10,000 and exactly N50,000? (Recommend: N10,000 is 3.5%, N50,000 is 3%, i.e. the upper limit belongs to the lower band.)
- Is the N1,500 delivery fee platform income? Today it is written to the ledger as type `delivery` (buyer to "platform") but never credited to the platform wallet; only the fee is (`internal/escrow/settlement.go:76`).

Design notes:
- Add `domain.PlatformFeeBps(amount int64) int` with boundaries as constants; unit-test every boundary (999,999 / 1,000,000 / 1,000,001 / 5,000,000 / 5,000,001 kobo).
- Keep `Escrow.FeeBps` and store the computed rate at creation so history never changes. Existing rows keep their stored value; do not migrate them.
- Buyer processing fee: compute grossed-up (the customer's charge must also cover Paystack's cut of the fee). Paystack published pricing (verify, UNVERIFIED): 1.5% plus N100 above N2,500, cap N2,000. Put it in config, not code. Record it as its own ledger type (for example `processing`) so the conservation audit and wallet audit stay correct; for card payments its source must be the same `GatewayAccount` label the order's `fund` row uses (`internal/escrow/order.go`, about line 62), and only wallet-paid orders name the buyer, otherwise the wallet audit will show false differences. Update both audits and their tests.
- Rounding: today the fee is floored (`Amount * FeeBps / 10000`) and net is `Amount - fee`, so fee plus net always equals the amount; `audit.Escrows` depends on that. Keep integer kobo math, keep that identity, and test odd amounts (for example 1,001 kobo at 3.5%).
- Show the breakdown (items, delivery, processing fee) in checkout and on the order; update the `CheckoutRequest` response and the cart UI in `web/`.
- Acceptance: unit tests for tiers; escrow service tests for fund/release/refund with each tier; `audit.Escrows` returns no findings for tiered releases; e2e script extended with a N12,000 and a N60,000 order; refund returns the right amount (decide and document whether the processing fee is refundable).

## 5. Workstream C: admin revenue layer

Missing entirely. Admin routes exist for users, products, orders, bookings, escrows, promotions (`cmd/api/main.go` lines 416 to 431); `web/app/dashboard/admin/page.tsx` has no revenue content.

Build:
- `GET /api/v1/admin/revenue?from=&to=&group=day|week|month` (admin role only). Fee revenue from ledger rows `type = 'fee'`; delivery-fee income per the owner's decision; ad revenue from paid promotions (`AmountKobo` in the promotion table); payouts and refunds shown separately. Return kobo integers.
- Reuse the audit queries where possible; reads only, in a read-only transaction.
- Web: a Revenue section in the admin dashboard with totals, a weekly chart, top sellers, and an "unbalanced escrows" alert fed by `audit.Escrows`.
- Include VAT tracking: store whether amounts are VAT-inclusive; show net of 7.5% VAT as an informational line (owner to confirm tax treatment with an accountant).
- Acceptance: tests with seeded ledger data; role test (non-admin gets 403); e2e step that creates an order and sees revenue move by exactly the fee.

Reference economics the owner asked for (these assume ads are PAID, which is not true until section 6 is fixed; fee-only income is about N1,925 a week) (10 weekly users, N5,500 average order, two N5,000 weekly ads, 1 USD = N1,500): gross about N11,925 a week (fees N1,925 + ads N10,000); about N10,805 after 7.5% VAT and domain with free hosting; about N8,382 with the Render Starter plan. Without ads the Starter plan loses money (about N920 a week); break-even is about 15 orders a week. Assumes small-company 0% income tax, UNVERIFIED, owner to confirm.

## 6. Workstream D: ads (verify, then finish)

Backend exists (`internal/promotion`): plans N5,000 for 7 days, N15,000 for 30 days, N120,000 for a year (`internal/domain/promotion.go`); `POST/GET /me/promotions`, admin list and status update, public `GET /featured-ads/active`, `/featured-ads/pricing`, click tracking. **UPDATE 2026-11-07: the backend part of this is now fixed and tested** (commit `b04e061` plus the follow-up: ads start `pending`; wallet payment and Paystack payment both activate them; the Paystack webhook offers non-order references to the ads service; the platform credit fails loudly; errors map to clean status codes; admin cannot activate an unpaid ad; the wallet audit counts `ad` ledger rows). STILL OPEN: there is no web page for a seller to buy an ad (the Paystack popup would use the ad id as the payment reference and `amount_kobo`, like the cart does), and ads created free before the fix stay active with no payment record. The original finding is kept below for context.

**VERIFIED PROBLEM (now fixed on the backend, see update above), revenue blocker: ads were free.** `CreatePromotion` stores the ad with status `active` immediately (`internal/promotion/service.go:108`; the model default is also `active`, `internal/domain/promotion.go:56`), and the service has no payment step (no wallet debit, no Paystack, no ledger row). Any seller or artisan can run any plan for nothing, and `AmountKobo` is only a price tag. Fix first: create ads as `pending`; take payment (wallet debit with a ledger entry, or Paystack through the same webhook path as orders) and only then set `active`; record a paid flag and reference; idempotent on webhook replay; refund path for rejected ads. UNVERIFIED: whether any web page lets a seller buy an ad (none was found under `web/app`). Build it. Add e2e coverage (create, pay, admin approve, appears in active list, click counted, expires). Until this is done, any ad revenue estimate is fiction and the admin revenue page (section 5) must count only paid ads.

## 7. Workstream E: storefronts

Exists: public page `web/app/s/[handle]/page.tsx`, editor `web/components/dashboard/storefront-editor.tsx`, API `GET /storefronts/:handle`, `GET/POST /me/storefront`, handle check and theme preview, handle history and reserved handles. Go tests exist; not in the e2e script. Add e2e steps (handle check, save, public fetch, handle change redirect). Review the XSS surface of theme and bio rendering.

## 8. Workstream F: social profile and messaging (design is in `2026-10-29-profiles-messaging-infra.md`)

Not started. Build order: profile data model and API, `/u/[handle]` and `/settings/profile`, then conversations and messages tables, REST endpoints, WebSocket hub (`GET /ws`, cookie auth, same CSRF and origin checks, rate limit, block and report, `dm_policy`), inbox and thread pages, Messages item with unread badge in the dock and mobile tab bar, "Message" buttons on store, artisan and product pages. Tests first for the hub (persistence before push, reconnect with `since` cursor, auth, block, rate limit). Reuse the existing storefront `handle` rules where it makes sense; do not confuse the storefront bio with a social profile. Private messages and profiles are personal data under the Nigeria Data Protection Act (UNVERIFIED details; owner to confirm with a lawyer): decide retention and deletion (account deletion removes messages), keep message bodies out of logs, give users a way to export or delete their data, and make report-and-block work before launch.

## 9. Workstream G: media pipeline

Bucket `luxebeau-media` exists and is empty. Build per the plan: `POST /me/media` returns a one-time R2 upload URL; client uploads directly; a Queue-triggered Worker with the Images binding resizes to 1600 px WebP quality 80, strips metadata, targets under 300 KB, deletes the original, calls back to the API (signed) to mark the media ready. Images accepted up to 25 MB; videos up to 20 MB stored as is, larger rejected (transcoding needs paid Cloudflare Stream). Per-user quota 200 MB; nightly cleanup of pending rows. Note: the API currently has no upload route and the 1 MiB body cap must stay.

## 10. Workstream H: deployment and CI

- Web to Cloudflare Workers via `@opennextjs/cloudflare` and `wrangler`: config already exists (`web/wrangler.jsonc`, `web/open-next.config.ts`); whether it is deployed is UNVERIFIED. There is no `.github/workflows` yet: add GitHub Actions on push to `main` (tests then deploy) and a preview per pull request. Secrets with `gh secret set`.
- API: `render.yaml` blueprint exists (docker, `./api-go/Dockerfile`, region frankfurt, plan free; it sets NO health check path, so add `healthCheckPath: /readyz`). Secrets are `sync: false`; set them in the dashboard.
- Replace `AutoMigrate` at startup with versioned migrations (expand-and-contract) before real customers; keep `EnsureLedgerGuards` or fold it into a migration.
- Supabase: enable backups, test a restore, make sure the API role owns its tables (the ledger trigger needs it), run `ALTER TABLE ledger_entries VALIDATE CONSTRAINT ledger_entries_amount_positive;` once no old row is 0 or less.
- `HEAD /healthz` and `HEAD /readyz` should return 200.
- Alerting: the keep-awake Worker only pings; nobody is told if the API or database is down. Make it (or an uptime monitor) alert the owner after two failed pings in a row, and have it fail loudly on a non-200 from `/readyz`.
- Cloudflare Containers files exist in `api-go/` (`worker/index.ts`, `wrangler.jsonc`) as an alternative host; confirm with the owner whether they are in use before touching them.

## 11. Workstream I: remaining backend hardening (from the owner's production checklist)

In priority order: idempotency keys on order creation and escrow create/fund/release (only withdrawals have them now); request/correlation ids in logs; metrics and error tracking; account lockout already exists (5 failed logins, 15 minutes, `internal/auth/service.go:22`), so add e2e coverage for it instead of rebuilding it; cache or queue only if measurement demands it; CI running `go vet`, `go test -race`, web `tsc`/`jest`/`eslint`, and `tests/e2e_flow.py` against a throwaway stack; a runbook for incident response and restore; ADRs for the fee model and ledger design. The ledger is one from/to row per movement, balanced by construction; do not redesign it into debit/credit pairs unless the owner asks; the conservation audit is the control.

## 12. Testing: what exists and what is missing

Exists: Go unit and integration tests (`go test -race ./...`), web jest (53 tests at last count) and `tsc`/`eslint`, `tests/e2e_flow.py` (see its docstring), older JS e2e scripts in `tests/` (not run this session).
Missing: browser-level tests of the real pages (Playwright), mobile layouts, bookings and artisan flows, withdrawals, KYC, Google login, forgot/reset password, Flutterwave/Monnify/crypto webhooks, admin dashboard, ads and storefront flows, load testing.

Throwaway Postgres recipe (data in memory, nothing on disk):
`docker run -d --rm --name lb-test --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD=t -e POSTGRES_DB=t -p 127.0.0.1:55434:5432 postgres:16-alpine`, then run the API with `DATABASE_URL`, `JWT_SECRET` (random, 32+ bytes), `COOKIE_SECURE=false`, `MAIL_DEV_DIR` (sign-up codes land as `.eml` files whose names contain the code), `SEED_DEMO_PASSWORD`, `PAYSTACK_SECRET_KEY`. Stop the container when done. Guard tests need `LUXEBEAU_TEST_PG_DSN` pointing at a disposable database.

## 13. Suggested order

1. A (owner, in parallel), 2. D ads payment fix (ads are free today; revenue depends on it), 3. B fees, 4. C admin revenue (counts only paid ads and the new fee), 5. E storefront checks, 6. H deployment and CI, 7. G media, 8. F profile and messaging, 9. I hardening throughout. Keep every step small, tested and committed separately.
