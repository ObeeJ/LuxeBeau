# PRD — LuxeBeau Storefronts
**Version 1.0 · Status: Draft**
**Author: Engineering · Date: 2026-11**

---

## 1. Overview

### 1.1 One-line summary
Every verified seller and artisan on LuxeBeau gets a public storefront that looks and feels like their own website — their layout, their colours, their domain — while LuxeBeau silently handles payments, escrow, KYC, delivery, and fraud underneath.

### 1.2 The problem
Today a seller's brand page at `/store/adunni-organics` is a filtered view of the LuxeBeau marketplace. It has LuxeBeau's navigation, LuxeBeau's purple, and LuxeBeau's URL. A buyer landing on it has no reason to feel like they are shopping at a specific brand. The seller has no shareable identity of their own.

### 1.3 The opportunity
Give sellers and artisans a storefront that looks like their own website. They pick a layout, set their colour, upload their logo, write a bio, and go live in under five minutes. LuxeBeau handles everything underneath. The seller gets the premium feel of owning a website without touching a server.

This is the moat. Shopify gives merchants a website but not escrow, not artisan booking, not Nigerian payment rails. LuxeBeau has all of those already. The storefront is the front door.

### 1.4 Success metrics

| Metric | Target | Timeframe |
|---|---|---|
| Verified sellers who set up a storefront | 60 % | 30 days post-launch |
| Sellers who share their storefront link | 40 % | 7 days after setup |
| New buyer registrations attributed to storefront links | Baseline → measure | 90 days |
| Storefront conversion rate vs. marketplace browse | Hypothesis: higher | 90 days |
| Custom domain adoption | 10 % of active storefronts | 90 days post v2 |

---

## 2. Users

| User | Core need |
|---|---|
| Verified seller | A shareable link that looks like their brand, not a marketplace listing |
| Artisan | A booking page that feels like their own studio website |
| Brand partner | Premium presence with custom domain, analytics, priority placement |
| Buyer | Consistent trust signals regardless of which storefront they land on |

---

## 3. Scope

### In scope — Phase 1
- Handle claim and validation
- 5 layout templates (structural, not colour)
- Colour engine: name search → family swatches → 5 derived variants
- Logo upload → dominant colour extraction
- `/s/[handle]` public storefront route
- Storefront setup form with live preview inside seller and artisan dashboards
- "Powered by LuxeBeau" footer on every storefront
- Redirect `/store/[slug]` → `/s/[handle]` when handle is set

### In scope — Phase 2
- Custom domains (`shop.adunniorganics.com` CNAME → `storefronts.luxebeau.ng`)
- DNS verification background job
- Cloudflare Worker host-header routing

### In scope — Phase 3
- Storefront analytics (views, add-to-cart rate, conversion, traffic source)
- UTM source attribution
- Analytics tab in seller and artisan dashboards

### In scope — Phase 4
- Handle squatter protection and reserved handle admin UI
- Brand partnership premium tier (custom domain + remove "Powered by" footer)
- Handle pre-reservation for known Nigerian brands

### Out of scope (all phases)
- Separate Next.js app per seller
- Per-seller auth — buyers always sign into LuxeBeau accounts
- Per-seller checkout — LuxeBeau checkout always
- Free-form CSS or HTML editing
- Separate product database per seller

---

## 4. Layout Templates

Templates are **structural arrangements** of the same data. They control how the page is laid out spatially. Colour is always the seller's own and is applied on top of whichever template they choose.

---

### Template 1 — Editorial
Full-bleed banner at the top. Logo overlaid bottom-left of the banner. Brand name large below the banner. Products in a tight editorial grid (3-col desktop, 2-col mobile). Clean, magazine feel.

Best for: makeup, fragrance, premium skincare, fashion-adjacent beauty brands.

```
┌─────────────────────────────────────────┐
│           FULL BLEED BANNER             │
│  [LOGO]  Brand Name                     │
└─────────────────────────────────────────┘
  Bio · verified badge · stats row
  ┌──────┐  ┌──────┐  ┌──────┐
  │ Prod │  │ Prod │  │ Prod │
  └──────┘  └──────┘  └──────┘
```

---

### Template 2 — Split
Left sidebar: logo, brand name, bio, stats, social links, "Powered by LuxeBeau". Right panel: scrollable product or service grid. Desktop-first feel, collapses to stacked on mobile.

Best for: artisans with many services, sellers with a strong brand story.

```
┌────────────┬────────────────────────────┐
│  [LOGO]    │  ┌────┐  ┌────┐  ┌────┐  │
│  Brand     │  │    │  │    │  │    │  │
│  Bio       │  └────┘  └────┘  └────┘  │
│  Stats     │  ┌────┐  ┌────┐  ┌────┐  │
│  Links     │  │    │  │    │  │    │  │
└────────────┴────────────────────────────┘
```

---

### Template 3 — Minimal
No banner. Logo centred at top, brand name, one-line bio, then products in a clean grid. Maximum focus on the products. Feels like a clean direct-to-consumer website.

Best for: sellers who want a stripped-back, product-first feel.

```
          [LOGO]
        Brand Name
     one-line bio · stats
  ┌──────┐  ┌──────┐  ┌──────┐
  │ Prod │  │ Prod │  │ Prod │
  └──────┘  └──────┘  └──────┘
```

---

### Template 4 — Hero
Large hero section with the brand name as a massive headline. Logo small top-left. Short tagline. One CTA button ("Shop now" or "Book now"). Products below the fold.

Best for: brand partnerships, product launches, high-energy brands.

```
┌─────────────────────────────────────────┐
│  [logo]                                 │
│                                         │
│    BRAND NAME                           │
│    Your tagline here                    │
│    [ Shop now → ]                       │
│                                         │
└─────────────────────────────────────────┘
  ┌──────┐  ┌──────┐  ┌──────┐
  │ Prod │  │ Prod │  │ Prod │
```

---

### Template 5 — Studio *(artisan-only)*
Booking-first layout. Artisan photo or banner at top. Services listed as cards with duration, price, and a "Book" CTA on each card. Availability calendar inline. Reviews section below.

Best for: artisans — braiders, MUAs, nail artists, barbers, estheticians.

```
┌─────────────────────────────────────────┐
│       ARTISAN PHOTO / BANNER            │
│  [LOGO]  Name · Specialty · Rating      │
└─────────────────────────────────────────┘
  Services
  ┌──────────────────────────────────────┐
  │  Knotless Braids · 5 hrs · ₦45,000  │
  │                          [ Book → ] │
  └──────────────────────────────────────┘
  Availability calendar → Reviews
```

Templates 1–4 are available to both sellers and artisans.
Template 5 is artisan-only.

---

## 5. Colour System

### 5.1 Three ways to set a colour

**A — Type a colour name**
The seller types a colour name ("rose gold", "forest green", "cobalt", "burnt orange"). The system maps the name to a colour family and shows 10 swatches of that family at different lightness and saturation steps — like a paint store chip display. The seller clicks one swatch. That hex becomes their base colour.

The colour name map covers approximately 60 named families spanning the full spectrum, curated for beauty and fashion relevance (skin tones, earth tones, jewel tones, neutrals, pastels).

**B — Upload logo → extract dominant colour**
After uploading their logo, a button appears: "Use colour from logo". The Go backend extracts the dominant colour from the image and returns a hex. The frontend pre-fills the colour input with that hex and shows the matching colour family swatches with the extracted colour highlighted.

**C — Paste a hex code**
For sellers who already know their brand hex. The system validates the format, maps it to the nearest colour family, and shows that family's swatches with their exact hex highlighted.

---

### 5.2 Five derived theme variants

Once the seller picks their base hex, the system derives 5 variants. The seller sees all 5 as swatches with a mini product card preview rendered in each. They pick one. That becomes their storefront accent colour.

| Variant | What it does | Good for |
|---|---|---|
| **True** | Exact colour, no modification | Brands with a precise brand colour |
| **Soft** | Lighter, more washed (+28% lightness, -15% saturation) | Skincare, wellness, soft aesthetics |
| **Deep** | Darker, richer (-18% lightness, +8% saturation) | Premium, luxury, evening beauty |
| **Muted** | Desaturated (-45% saturation) | Editorial, minimalist, sophisticated |
| **Vivid** | More saturated (+30% saturation) | High energy, social-media-ready, Gen Z |

Each variant also computes a foreground colour (black or white) by WCAG contrast ratio check, so text on the accent colour always passes AA.

---

### 5.3 How the theme is applied

The storefront page injects the seller's chosen accent and foreground as CSS custom properties on the root element server-side. Every storefront component uses these variables. The rest of the LuxeBeau design system (canvas, surface, hairline, ink) stays unchanged — only the accent colour swaps.

```
--sf-accent       seller's chosen accent hex
--sf-on-accent    foreground colour (black or white, WCAG AA)
--sf-soft         pre-computed soft variant
--sf-deep         pre-computed deep variant
```

All five derived hex values are stored in the database at save time so the page never re-derives on read.

---

## 6. Handle System

### 6.1 Format
`luxebeau.ng/s/[handle]`

- 3–50 characters
- Lowercase alphanumeric and hyphens only
- No leading or trailing hyphens
- Regex: `^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$`

### 6.2 Namespaces
Seller handles and artisan handles share one namespace. A seller and an artisan cannot both claim `glow-theory`. First verified claimant wins.

### 6.3 Reserved handles
A `reserved_handles` table (not a hardcoded list) stores handles that cannot be claimed by the public. This table is managed by admins and can be extended without a deploy.

Reserved by default: `admin`, `api`, `app`, `www`, `mail`, `shop`, `store`, `luxebeau`, `support`, `help`, `blog`, `about`, `careers`, `press`, `legal`, `terms`, `privacy`, `dashboard`, `artisan`, `seller`, `buyer`, `platform`, `s`, `auth`, `login`, `signup`, `checkout`, `cart`, `orders`, `wallet`, `escrow`.

### 6.4 Handle squatting protection
Admins can pre-reserve handles for known Nigerian brands before they register (e.g. `zaron`, `house-of-tara`, `sleek`, `black-opal`). A pre-reserved handle shows a "Claim this brand" CTA if the matching brand registers. The `reserved_handles` table has an optional `claimable_by_email` column — if set, only that email address can claim the handle.

### 6.5 Handle changes
- A handle can be changed once every 90 days.
- On change: the old handle issues a 301 redirect to the new handle for 180 days.
- After 180 days: the old handle enters a 30-day quarantine period.
- After quarantine: the old handle becomes available for anyone to claim.
- All handle history is stored in `storefront_handle_history` (owner, old handle, new handle, changed at, redirect expires at, quarantine ends at).

### 6.6 Eligibility
A handle can only be claimed by a verified seller or artisan (KYC passed and admin-approved). Unverified accounts see the setup form but cannot go live and cannot claim a handle.

---

## 7. Custom Domains (Phase 2)

### 7.1 Flow
1. Seller enters their domain in the storefront setup form: `shop.adunniorganics.com`
2. LuxeBeau shows the required DNS record: `CNAME shop.adunniorganics.com → storefronts.luxebeau.ng`
3. Seller adds the record in their DNS provider
4. LuxeBeau polls DNS every 5 minutes for up to 48 hours
5. When the CNAME resolves correctly, `domain_verified` is set to true
6. SSL is handled by Cloudflare (already proxying — zero extra work)

### 7.2 Routing
The Cloudflare Worker reads the `Host` header on every request. If the host is not `luxebeau.ng` or `www.luxebeau.ng`, it calls `/api/v1/storefronts/by-domain?host=...` to resolve the host to a storefront handle, then rewrites the request to `/s/[handle]`.

Any unrecognised host falls through to the main LuxeBeau site. No open redirect is possible.

### 7.3 Security
A custom domain is only accepted if it matches a verified `storefront.custom_domain` row. The domain must be verified before it routes traffic. Unverified domains are ignored.

---

## 8. Storefront Analytics (Phase 3)

### 8.1 Events tracked
Every storefront records these events in an append-only `storefront_events` table:

| Event | When |
|---|---|
| `view` | Storefront page loaded |
| `product_click` | Buyer taps a product card |
| `add_to_cart` | Buyer adds a product to cart from the storefront |
| `checkout_start` | Buyer begins checkout with at least one storefront product |
| `order_placed` | Order confirmed with at least one storefront product |

### 8.2 Source attribution
Traffic source is detected from UTM parameters (`?utm_source=instagram`, `?utm_source=whatsapp`, etc.) on first touch per anonymous session. Session ID is anonymous and rotated daily.

### 8.3 Dashboard display
Sellers see in their dashboard Analytics tab:
- Total views (last 7 days / 30 days)
- Add-to-cart rate (add_to_cart / view)
- Conversion rate (order_placed / view)
- Top traffic source
- Top product by clicks

---

## 9. Setup Flow

The setup is a single scrollable page with a live preview panel on the right (desktop) or a "Preview" button (mobile). Every change reflects in the preview instantly.

```
Step 1 — Handle
  luxebeau.ng/s/ [adunni-organics     ]
                 ✓ Available

Step 2 — Layout
  [Editorial] [Split] [Minimal] [Hero] [Studio*]
  *artisan only

Step 3 — Logo and banner
  [Upload logo]   [Upload banner]
  [Use colour from logo] ← appears after logo upload

Step 4 — Colour
  Search: [rose gold                  ]
  Showing: Rose Gold family
  ○ ○ ○ ● ○ ○ ○ ○ ○ ○   10 swatches
  or paste hex: [#c9956c]

  Your 5 theme variants:
  [True] [Soft] [Deep] [Muted] [Vivid]
         ↑ selected

Step 5 — Bio
  [Tell buyers what makes your brand different.  ]
  240 / 280

Step 6 — Go live
  [ ] Storefront is live
  When toggled on: shareable link + QR code + copy button
```

---

## 10. Data Model

### Storefront
```
id                  uint, primary key
owner_id            uuid, not null, unique index   — User.ID
owner_type          varchar(10)                    — "seller" | "artisan"
handle              varchar(50), not null, unique
custom_domain       varchar(253), nullable, unique
domain_verified     boolean, default false
template_id         varchar(20)                    — editorial|split|minimal|hero|studio
logo_url            varchar(500), nullable
banner_url          varchar(500), nullable
accent_hex          varchar(7)                     — chosen accent
on_accent_hex       varchar(7)                     — foreground (black or white)
soft_hex            varchar(7)                     — pre-computed soft variant
deep_hex            varchar(7)                     — pre-computed deep variant
theme_variant       varchar(10)                    — true|soft|deep|muted|vivid
bio                 varchar(280)
live                boolean, default false
total_views         bigint, default 0
created_at          timestamp
updated_at          timestamp
```

### StorefrontHandleHistory
```
id                  uint, primary key
owner_id            uuid, index
old_handle          varchar(50)
new_handle          varchar(50)
changed_at          timestamp
redirect_expires_at timestamp                      — 180 days after changed_at
quarantine_ends_at  timestamp                      — 210 days after changed_at
```

### ReservedHandle
```
handle              varchar(50), primary key
reason              varchar(100)                   — "system" | "brand" | "squatter-protection"
claimable_by_email  varchar(255), nullable         — if set, only this email can claim
created_at          timestamp
```

### StorefrontEvent (Phase 3)
```
id                  uint, primary key
storefront_id       uint, index
event_type          varchar(30)                    — view|product_click|add_to_cart|checkout_start|order_placed
product_id          uint, nullable
session_id          varchar(64)                    — anonymous, rotated daily
source              varchar(30)                    — direct|instagram|whatsapp|tiktok|other
created_at          timestamp, index
```

---

## 11. API Endpoints

```
POST   /api/v1/me/storefront                    Create or update storefront config
GET    /api/v1/me/storefront                    Get own storefront config
POST   /api/v1/me/storefront/check-handle       Validate handle availability (debounced)
POST   /api/v1/me/storefront/theme-preview      Derive 5 variants from hex (no DB write)
POST   /api/v1/me/storefront/extract-colour     Extract dominant colour from uploaded logo
DELETE /api/v1/me/storefront/domain             Remove custom domain

GET    /api/v1/storefronts/:handle              Public: resolve handle → config + products/artisan
GET    /api/v1/storefronts/by-domain            Public: resolve Host header → config (used by CF Worker)
```

---

## 12. Frontend Routes

```
/s/[handle]                   Public storefront (seller or artisan)
/s/[handle]/[productSlug]     Product detail within storefront context
/s/[handle]/book              Artisan booking within storefront context (artisan only)
```

The storefront shell replaces the LuxeBeau site nav with a minimal bar:
- Left: seller logo
- Right: cart icon
- Footer: "Powered by LuxeBeau · Secure escrow payments" (always present in Phase 1)

Cart, checkout, and escrow are unchanged underneath.

---

## 13. Phased Delivery

### Phase 1 — Core storefronts
Handle claim and validation · 5 layout templates · Colour name search and family swatches · 5 derived theme variants · Logo upload and colour extraction · `/s/[handle]` route · Storefront setup form with live preview · Redirect `/store/[slug]` → `/s/[handle]`

### Phase 2 — Custom domains
CNAME flow · DNS verification background job · Cloudflare Worker host-header routing · `domain_verified` flag

### Phase 3 — Analytics
`storefront_events` table · UTM source attribution · Analytics tab in seller and artisan dashboards

### Phase 4 — Premium and governance
Reserved handle admin UI · Brand partnership tier (custom domain + remove "Powered by" footer) · Handle pre-reservation for known brands · Squatter protection tooling

---

## 14. Open Questions

| # | Question | Recommendation |
|---|---|---|
| 1 | Template 5 (Studio) in Phase 1? It needs the booking calendar inline. | Ship templates 1–4 for both seller and artisan in Phase 1. Template 5 in Phase 1b same sprint. |
| 2 | Colour name search: 60 curated families or full CSS named colour list (~140)? | 60 curated families. Beauty and fashion relevant. Easier to maintain. |
| 3 | Logo colour extraction: Go server-side lib or client-side canvas pixel sample? | Client-side canvas. Zero new Go dependency. Works offline in preview. |
| 4 | "Powered by LuxeBeau" footer: always mandatory or removable for brand partners? | Always present Phase 1. Removable as a paid feature in Phase 4. |
| 5 | Artisan handles vs. existing artisan slug field on domain.Artisan? | Separate. Slug is internal routing. Handle is public-facing and seller-chosen. |
| 6 | Product visibility toggle (hide individual products from storefront)? | Phase 1b. Not blocking for launch. |

---

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Handle squatting before launch | Medium | High | Pre-reserve known Nigerian brand handles before feature ships |
| Custom domain SSL misconfiguration | Low | High | Cloudflare proxying handles SSL — no cert management needed |
| Colour contrast failures on seller-chosen colours | Medium | Medium | WCAG AA check on every derived variant before storing. Block variants that fail. |
| Storefront events table grows unbounded | Low | Medium | Partition by month. Archive events older than 13 months. |
| Sellers go live with no products | Medium | Low | Require at least 1 live product before the "Go live" toggle is enabled |

---

*End of PRD v1.0*
