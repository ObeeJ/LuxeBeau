# Profiles, messaging, media and deployment: product and engineering plan

Decided with the owner on 2026-10-29: database on **Supabase**, images and media on **Cloudflare R2**, deployment with **Wrangler**, a **.com** domain, push to `main` deploys.

## 1. Deployment (build first: nothing else matters if it is not live)

| Piece | Where | Notes |
|---|---|---|
| Web (Next.js) | Cloudflare Workers via `@opennextjs/cloudflare`, deployed with `wrangler` | GitHub Actions: push to `main` runs tests, then `wrangler deploy`. Preview URL on every pull request. |
| API (Go) | Render web service (Docker, `api-go/Dockerfile`), blueprint `render.yaml`, health check `/healthz` | Auto-deploys from `main`. WebSocket works on Render. |
| Database | Supabase Postgres, connect through the pooler (IPv4) | `DATABASE_URL` is a Render secret. Migrations run on API start (already how the API works). |
| Cache | Render Key Value (free tier, no persistence) | Rate limits and presence only; never the source of truth. |
| Media | R2 bucket `luxebeau-media`, served through a Worker on `media.<domain>.com` | Replaces Cloudflare Images (paid). |
| Media compressor | Cloudflare Worker with the Images binding, triggered by a Queue | See section 4. |
| Keep-awake | Cloudflare Worker with a Cron Trigger every 10 minutes calling `GET <api>/healthz` | Render free web services sleep after 15 minutes idle. 750 free hours a month covers one always-on service. |
| Domain | `.com` bought through Cloudflare Registrar (about 10 USD a year; the owner must purchase it) | Until then: `*.workers.dev` and the Render URL. |

Needed from the owner: `wrangler login` (or `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`), a Supabase project connection string, a Render API key, the domain name. None of these go into chat or git; they live in Render env vars and GitHub Actions secrets (set with `gh secret set`).

Fallbacks if Render misbehaves: Fly.io (free allowance, WebSockets fine) or Koyeb (free instance). Do not use Render's free Postgres for real data: it expires after 30 days.

Free-tier risks to accept knowingly: cold start of about 50 seconds if the pinger fails, no Redis persistence, Supabase pauses a free project after a week of no activity (the keep-awake ping also hits the database through `/healthz`).

## 2. Profiles (like a social profile, built for a marketplace)

**Pages**
- `/u/[handle]` public profile: cover photo, avatar, name, `@handle`, bio, city, member since. Tabs: Posts (media gallery), Reviews written, and for business owners Shop or Services. Buttons: **Message**, Share, Report.
- `/settings/profile` edit: avatar and cover upload (cropped, compressed), name, handle (unique, 3 to 20 characters), bio (160 characters), city, links, privacy (who can message me).
- Business owners: their existing store page `/store/[slug]` and artisan page become a tab of the same profile, so there is one place per person.

**Data**
- `profiles(user_id PK, handle UNIQUE, display_name, bio, city, avatar_key, cover_key, links jsonb, dm_policy enum(everyone, customers, nobody), created_at)`
- `media(id, owner_id, key, kind, bytes, width, height, status enum(pending, ready, rejected), created_at)`

**API**
`GET /profiles/:handle`, `GET /me/profile`, `PUT /me/profile`, `GET /profiles/:handle/media`.

## 3. Messaging (simple, safe, fast)

**Navigation (the UX that makes it discoverable)**
- A **Messages** item in the desktop dock and the mobile tab bar with an unread count badge (same badge style as the bag).
- A **Message** button on every store page, artisan page, product page (to the seller) and public profile.
- After an order or booking, a "Message the seller / artisan" link on the order row.
- Avatar menu (top right on mobile, dock on desktop): Profile, Messages, Settings, Sign out.

**Pages**
- `/messages` inbox: conversation list (avatar, name, last message, time, unread dot), search, and an empty state that explains how to start.
- `/messages/[id]` thread: bubbles, date separators, sent and read ticks, a composer with attach button, and a header with the person's profile link, Block and Report.
- Mobile: inbox and thread are separate full screens with a back arrow; desktop: two panes.

**Behaviour**
- One-to-one conversations only in v1. Text up to 2,000 characters, plus one media file per message.
- Live delivery over WebSocket; if the socket drops, the client reconnects with backoff and fetches missed messages by `since` cursor. Everything is stored in Postgres first, then pushed.
- Delivery states: sent, delivered, read. Typing indicator is optional and last.
- Safety: block, report, per-user rate limit (for example 30 messages a minute), no link previews, `dm_policy` respected (default `customers`: a business owner can only be messaged first by someone with an order or booking, or by anyone if they choose `everyone`).

**Data**
- `conversations(id, user_a, user_b, last_message_at, UNIQUE(user_a, user_b))` (user ids stored in sorted order)
- `messages(id, conversation_id, sender_id, body, media_id nullable, created_at, delivered_at, read_at)`
- `blocks(blocker_id, blocked_id)`, `reports(id, reporter_id, target_type, target_id, reason, created_at)`

**API**
`GET /conversations`, `POST /conversations` (by handle), `GET /conversations/:id/messages?before=`, `POST /conversations/:id/messages`, `POST /conversations/:id/read`, `POST /blocks`, `POST /reports`, `GET /ws` (WebSocket upgrade, cookie auth, same CSRF origin check).

**WebSocket protocol (JSON frames)**
Server to client: `message.new`, `message.read`, `typing`. Client to server: `message.send` (also available over HTTP), `message.read`, `typing`. One in-memory hub per API instance (Render runs one instance); if we ever scale out, fan out through Redis pub/sub.

## 4. Media: small uploads, big files compressed by a worker

1. Client asks `POST /me/media` with type and size. The API checks the limits (images up to 25 MB accepted, videos up to 50 MB) and returns a one-time R2 upload URL plus a `media_id` with status `pending`.
2. Client uploads straight to R2 (the API never carries the bytes).
3. R2 notifies a Queue; the **compressor Worker** processes it:
   - Images: resize so the longest side is 1600 px, convert to WebP at quality 80, strip metadata, target under 300 KB; store as the final object and delete the original.
   - Videos: free tiers cannot transcode. v1 rule: videos up to 20 MB are stored as they are; larger ones are rejected with a clear message ("trim or compress under 20 MB"). Real transcoding needs Cloudflare Stream (paid) and is a later decision.
4. Worker calls the API (signed callback) to mark the media `ready` with its final size; only then can a message or profile use it.
5. Storage guard: per-user quota (for example 200 MB), a nightly cleanup of `pending` rows older than a day.

## 5. Build order

1. Commit infra files (`render.yaml`, `wrangler` config for web, keep-awake Worker, `.github/workflows`) and go live on `*.workers.dev` + Render + Supabase.
2. Media pipeline (it is a dependency of avatars and messages).
3. Profiles (backend, then pages), including `/settings/profile`.
4. Messaging backend with tests (hub, persistence, auth, rate limit, block), then inbox and thread pages, then the Messages nav item with badge.
5. Custom `.com` domain, then a final review pass.

## 6. Acceptance checks

- Two browsers signed in as different users exchange messages in under a second and see read ticks.
- A dropped connection recovers without losing or duplicating a message.
- A blocked user cannot send; a report is stored.
- A 12 MB photo ends up under 300 KB and the original is gone.
- A push to `main` produces a new live web build and an API deploy with no manual steps; the health pinger keeps the API responding in under 2 seconds.
