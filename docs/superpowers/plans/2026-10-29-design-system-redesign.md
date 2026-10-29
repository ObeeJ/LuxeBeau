# LuxeBeau Design System and Site-wide Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the whole `web/` app to the approved shop.com-style purple design system through shared tokens and reusable components, with a redesigned home page, new Pair logo, global grain, mobile-first layouts and a component gallery.

**Architecture:** The app is already built on a shop.com-like system (floating rail, pill controls, Tailwind v4 tokens in `app/globals.css`, shared parts in `components/site` and `components/ui`). So the redesign changes tokens first, then upgrades shared components, then pages consume them. No page may hardcode a colour or font.

**Tech Stack:** Next.js 16.4.3 (App Router), React 19, Tailwind v4 (`@theme inline`), framer-motion, TanStack Query, Zustand, Radix, Jest + Testing Library, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-29-design-system-redesign-design.md`

## Global Constraints

- Read the relevant guide in `web/node_modules/next/dist/docs/` before writing Next.js code (`web/AGENTS.md`: this Next version has breaking changes).
- Package manager is **pnpm**. Checks: `pnpm test`, `pnpm lint`, `pnpm build` (run in `web/`).
- Brand purple `#8A1FC7`, deep `#6F16A3`, wash `#F3E6FB`; `#5433EB` must not appear anywhere in `web/`.
- Font Geist via `next/font/google`. Inter, Bodoni Moda, Hanken Grotesk must not be used.
- No arches, no sparkle motif, no QR code, no app-store badges, no city list in the footer.
- Colours and fonts only through tokens in `app/globals.css`; no hex values in components.
- All motion respects `prefers-reduced-motion`; touch targets at least 44px.
- No invented figures, reviews, sellers or creators in shipped screens; show real data or an honest empty state.
- Work on branch `redesign/design-system`, never on `main`. No AI attribution in commits.
- No backend changes. Do not touch `api-go/` (it has someone else's uncommitted work).

## Review Focus

- A product with no photo, a very long name, or a price over ₦1,000,000: card must not break (Photo fallback, line clamp, `formatNaira`).
- API loading, error and empty list: every rail/section shows skeleton, an error with retry, or an honest empty state, never a blank gap.
- 320px wide phone and 200% browser zoom: no horizontal scroll, no overlapping fixed bars (top bar, tab bar, toast).
- Persisted cart/auth after reload: count badge and "Sign in" must not cause a hydration mismatch (existing `useMounted` pattern).
- `prefers-reduced-motion: reduce`: no idle bobbing, no rotating word, content still visible (never left at opacity 0).

---

### Task 0: Branch and baseline

**Files:** none changed.

- [ ] **Step 1:** `git switch -c redesign/design-system` from `main`'s current state (the working tree has unrelated `api-go` changes: do not stage them).
- [ ] **Step 2:** In `web/` run `pnpm test`, `pnpm lint`, `pnpm build`. Record pass/fail counts in the task notes. Expected: note any pre-existing failures so they are not blamed on the redesign.

### Task 1: Tokens, Geist, grain

**Files:**
- Modify: `web/app/globals.css`, `web/app/layout.tsx`
- Test: `web/app/design-tokens.test.ts`

**Interfaces:**
- Produces: Tailwind colour tokens `brand`, `brand-deep`, `brand-wash` (utilities `bg-brand`, `text-brand-deep`, …) and `--glow`; keeps existing token names `canvas`, `surface`, `ink`, `hairline`, `muted` so current pages keep working; grain overlay on `body::after`; font variable `--font-geist`.

- [ ] **Step 1: Write failing test** `design-tokens.test.ts` that reads `globals.css` and `layout.tsx` as text and asserts: contains `#8a1fc7` (case-insensitive), `#6f16a3`, `#f3e6fb`; does not contain `#5433eb`; layout imports `Geist` from `next/font/google` and does not import `Inter`; globals contains `feTurbulence` and `pointer-events: none` within the grain rule.
- [ ] **Step 2:** Run `pnpm test design-tokens` → FAIL.
- [ ] **Step 3:** Replace the palette tokens (`--color-shop-violet`, `--color-violet-wash`, glow shadow) with the brand tokens; set the page background to `#FAFAFA`; swap Inter for Geist in `layout.tsx` (weights 400, 500, 600, 700, 800, 900); add a `body::after` grain overlay (fixed, inset 0, SVG data URI feTurbulence baseFrequency .85, opacity .07, `mix-blend-mode: multiply`, `pointer-events: none`, `z-index` above content but below modals). Keep `violet` as an alias to `brand` so the 8 current `violet` usages keep compiling.
- [ ] **Step 4:** Run `pnpm test design-tokens` → PASS; `pnpm build` → succeeds.
- [ ] **Step 5:** Commit `feat(web): purple tokens, Geist font and global grain`.

### Task 2: Motion tokens

**Files:**
- Create: `web/lib/motion.ts`, `web/components/motion/cascade.tsx`
- Test: `web/lib/motion.test.ts`, `web/components/motion/cascade.test.tsx`

**Interfaces:**
- Produces: `export const EASE = { out: [0.22,1,0.36,1], spring: [0.34,1.56,0.64,1], std: [0.2,0,0,1] } as const`; `export const DURATION = { press: .15, cascade: .35, bounce: .4, stack: .52, rail: .18 } as const`; `export function usePrefersReducedMotion(): boolean`; `export function Cascade({ index?: number; children }): JSX.Element` (fades/rises 8px, `delay = index * 0.045`, renders immediately visible when reduced motion).

- [ ] **Step 1: Write failing tests:** `motion.test.ts` asserts the exact `EASE.out` and `DURATION.stack` values; `cascade.test.tsx` mocks `matchMedia` to reduce and asserts children render with no opacity-0 style.
- [ ] **Step 2:** Run → FAIL. **Step 3:** implement with framer-motion. **Step 4:** Run → PASS. **Step 5:** Commit `feat(web): shared motion tokens and Cascade`.

### Task 3: Pair logo

**Files:**
- Modify: `web/components/site/logo.tsx`
- Create: `web/app/icon.svg` (small-size bolder variant for favicon), `web/public/logo-pair.svg`
- Test: `web/components/site/logo.test.tsx`

**Interfaces:**
- Produces: `LuxeBeauMark({ size?: number; tile?: boolean })` (two rings, second at 60% opacity; `tile` draws the purple rounded tile), `LuxeBeauWordmark({ className })` (lowercase "luxebeau", weight 900), `LuxeBeauLogo({ href, className })` (mark + wordmark, link with `aria-label="LuxeBeau home"`). Existing import names are kept.

- [ ] **Step 1: Write failing test:** `LuxeBeauLogo` renders a link named "LuxeBeau home" containing an `svg` with two `circle` elements; the mark is `aria-hidden`; wordmark text is exactly `luxebeau`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** implement SVGs (viewBox 64: circles `cx=24/40 cy=32 r=13`, stroke 7.5, second `stroke-opacity .6`; favicon variant uses thicker strokes and `r=14`). **Step 4:** PASS; open `/` and confirm the tab icon is the new mark.
- [ ] **Step 5:** Commit `feat(web): Pair logo, wordmark and favicon`.

### Task 4: Core primitives

**Files:**
- Modify: `web/components/ui/button.tsx`, `badge.tsx`, `dialog.tsx`, `web/app/globals.css` (`.lb-input`)
- Test: `web/components/ui/button.test.tsx`

**Interfaces:**
- Produces: `Button` variants `default` (brand purple, white text, glow shadow), `secondary` (white, soft shadow), `dark` (ink), `outline`, `ghost`, `link`; all show press feedback (`active:scale-[.96] active:opacity-60`); size `default` is `h-11` (44px).

- [ ] **Step 1: Failing test:** `<Button>` default has class `bg-brand`; `variant="dark"` has `bg-ink`; `size="default"` has `h-11`; disabled sets `disabled` and ignores clicks.
- [ ] **Step 2-4:** FAIL → implement → PASS (existing `draw-outline-button.test.tsx` still passes).
- [ ] **Step 5:** Commit `feat(web): purple button system`.

### Task 5: App shell (rail, tab bar, top bar)

**Files:**
- Modify: `web/components/site/shell.tsx`
- Test: `web/components/site/shell.test.tsx`

**Interfaces:**
- Consumes: `LuxeBeauMark({ tile })` (Task 3), `useCart`, `useAuth`, `useAuthModal`.
- Produces: `SiteShell({ children, footer? })` and `Container` (unchanged signatures); `CountBadge` slides the number up on change.

- [ ] **Step 1: Failing tests:** desktop rail shows the logo tile link "LuxeBeau home" and nav links Home, Shop, Artisans, Bag, Account with `aria-current="page"` only on the active route (mock `usePathname`); with a mocked cart count of 3 the Bag link shows `3`, 120 shows `99+`; signed-out shows a "Sign in" button.
- [ ] **Step 2-4:** FAIL → rework `SideRail` to a purple logo tile plus a white pill dock (`rounded-full`, soft shadow) with 46px round buttons; keep the mobile top bar and 64px tab bar with safe-area padding → PASS.
- [ ] **Step 5:** Commit `feat(web): shop-style rail and mobile bars`.

### Task 6: Catalog components

**Files:**
- Modify: `web/components/site/catalog.tsx` (split into `components/site/catalog/*.tsx` only if it passes 400 lines)
- Create: `web/components/site/scan-dialog.tsx`
- Test: `web/components/site/catalog.test.tsx`

**Interfaces:**
- Consumes: `Product`, `Artisan` from `@/lib/api`, `formatNaira`, `Cascade`.
- Produces: `ProductCard({ product, onAdd })` (image, store row, title clamped to 2 lines, stars, price, heart toggle, "Add" button that turns into "✓ Added" for 1.6s); `ProductRail({ label, children })` (horizontal scroll, ‹ › arrows on hover/focus, `no-scrollbar`); `StoreCard({ name, subtitle, logoUrl?, coverUrl?, products })`; `SearchBar({ onScan? })` with a Scan button that opens `ScanDialog`; existing `Photo`, `Avatar`, `Rating`, `CategoryPill`, `SectionHeader`, `ArtisanCard` keep their props.

- [ ] **Step 1: Failing tests:** ProductCard with `stock: 0` shows "Sold out" and disables Add; clicking Add calls `onAdd` once and shows "Added"; the heart has `aria-pressed` toggling; a 120-character name does not break layout (has `line-clamp-2`); `formatNaira(1500000)` renders in the price; ProductRail arrows call `scrollBy` with a positive/negative left; SearchBar shows a "Scan" button and, when `BarcodeDetector` is missing, ScanDialog shows "Scanning isn't supported on this device" instead of throwing.
- [ ] **Step 2-4:** FAIL → implement (hover image zoom `scale-[1.04]` .15s, press feedback, cascade-in) → PASS.
- [ ] **Step 5:** Commit `feat(web): product, rail, store and search components`.

### Task 7: Home sections

**Files:**
- Create: `web/components/site/home/hero-card.tsx`, `rotating-word.tsx`, `escrow-strip.tsx`, `join-row.tsx`
- Test: `web/components/site/home/home.test.tsx`

**Interfaces:**
- Produces: `RotatingWord({ words = ["you","her","him","us"], intervalMs = 2400 })` (static first word when reduced motion); `HeroCard({ floating: Product[] })` (aspect 7:10 mobile, `md:h-[440px]`, `xl:aspect-[2.75/1] xl:max-h-[685px]`; floating products bob 4s; shows escrow phone panel; hides floating items below 4 products); `EscrowStrip()` (three steps with a moving line); `JoinRow()` (Sell, Artisan, Brand partnerships links to `/partnership/seller`, `/partnership/artisan`, and `/partnership/seller#brands`).

- [ ] **Step 1: Failing tests:** RotatingWord with fake timers advances you → her → him → us → you; under reduced motion it never changes; HeroCard has the three responsive class tokens above and one primary link "Start shopping" to `/shop`; EscrowStrip renders exactly 3 steps; JoinRow links point to the three paths.
- [ ] **Step 2-4:** FAIL → implement → PASS.
- [ ] **Step 5:** Commit `feat(web): home hero, escrow strip and join row`.

### Task 8: Home page

**Files:**
- Modify: `web/app/page.tsx`
- Test: `web/app/page.test.tsx`

**Interfaces:**
- Consumes: Tasks 5-7, `useProducts`, `useArtisans` from `@/lib/queries`.
- Produces: the Explore feed: category pills, "Top rated" and "New in" rails derived from real products, "Trending stores" from real sellers/artisans only if the data exists. Creator edits are **not** built (no public API; see Open decisions).

- [ ] **Step 1: Failing tests** (mock the query hooks): loading shows skeleton cards; error shows `LoadError` with a retry button that refetches; empty products shows an honest "No products yet" state and no rail; with 8 products the page renders a rail with 8 cards and no text matching `/Tolu|@kingsley|40,000/` (no invented content).
- [ ] **Step 2-4:** FAIL → assemble → PASS; `pnpm build` succeeds.
- [ ] **Step 5:** Commit `feat(web): redesigned home page`.

### Task 9: Footer

**Files:** Modify `web/components/site/footer.tsx`; Test `web/components/site/footer.test.tsx`.

- [ ] **Step 1: Failing test:** footer contains the wordmark, columns Learn more, Get started, Legal; does **not** contain "App Store", "Google Play", "Lagos", "Abuja" or "Port Harcourt"; copyright reads `© <year> LuxeBeau`.
- [ ] **Step 2-4:** FAIL → implement (white band, Pair mark, link columns) → PASS. **Step 5:** Commit `feat(web): new footer`.

### Task 10: Shop, product detail, bag and checkout

**Files:** Modify `web/app/shop/page.tsx`, `web/app/shop/[slug]/page.tsx`, `web/app/cart/page.tsx`; Test `web/app/cart/cart.test.tsx`.

- [ ] **Step 1: Failing tests:** an empty bag shows a "Start shopping" link; with items, "Pay" for a signed-out user calls `showAuth("signin", …)` (sign-up happens only at pay) and for a signed-in user proceeds; the escrow explanation is visible beside the pay button.
- [ ] **Step 2-4:** FAIL → restyle using Tasks 4-6 components, add Her/Him/Everyone filter chips on `/shop` (existing category data; no new API) → PASS. **Step 5:** Commit `feat(web): restyle shop, product and bag`.

### Task 11: Artisans (services) and partnership pages

**Files:** Modify `web/app/services/page.tsx`, `web/app/services/[slug]/page.tsx`, `web/app/partnership/seller/page.tsx`, `web/app/partnership/artisan/page.tsx`, `web/components/site/partner.tsx`; Test `web/components/site/partner.test.tsx`.

- [ ] **Step 1: Failing test:** partner section renders three benefit blocks and a primary call to action linking to the matching application route; brand-partnership block exists on the seller page.
- [ ] **Step 2-4:** FAIL → restyle → PASS. **Step 5:** Commit `feat(web): restyle artisans and partnership pages`.

### Task 12: Dashboards (buyer, seller, artisan, admin, escrow)

**Files:** Modify `web/components/dashboard/*.tsx`, `web/app/dashboard/**/page.tsx`; Test `web/components/dashboard/widgets.test.tsx`.

**Interfaces:** Shared dashboard widgets (`widgets.tsx`) are re-skinned once; role pages only compose them, so all four roles look identical in structure.

- [ ] **Step 1: Failing tests:** stat/summary widgets render label and value; row components (`order-row`, `sale-row`, `booking-row`) stack vertically below 640px (class `flex-col sm:flex-row`); empty list renders a friendly message.
- [ ] **Step 2-4:** FAIL → restyle widgets then pages → PASS. **Step 5:** Commit `feat(web): restyle dashboards`.

### Task 13: Component gallery

**Files:** Create `web/app/design-system/page.tsx` (with `export const metadata = { robots: { index: false } }`); Test `web/app/design-system/page.test.tsx`.

- [ ] **Step 1: Failing test:** the page renders a heading for each of: Colours, Type, Buttons, Inputs, Product card, Rail, Store card, Search + Scan, Toasts, Logo; and is marked noindex.
- [ ] **Step 2-4:** FAIL → build the gallery from the real components with sample (clearly labelled "sample") data → PASS. **Step 5:** Commit `feat(web): component gallery`.

### Task 14: Mobile, accessibility and docs QA

**Files:** Modify `web/UX_GUIDE.md` (currently describes the old "Velvet Atelier" dark theme; rewrite to this system).

- [ ] **Step 1:** Run the app and take screenshots of `/`, `/shop`, a product, `/cart`, `/services`, `/dashboard` at 360, 390, 768 and 1280px wide using the installed headless Chromium. Confirm: no horizontal scroll, fixed bars do not overlap content, grain does not block clicks.
- [ ] **Step 2:** Verify contrast: white text on `#8A1FC7` and `#8A1FC7` text on white both meet 4.5:1 (compute and record the ratios).
- [ ] **Step 3:** Keyboard pass: tab through the home page; every control shows a visible focus ring and is reachable; the Scan dialog traps focus and closes on Escape.
- [ ] **Step 4:** `pnpm test`, `pnpm lint`, `pnpm build` all pass; `rg -n '5433eb|Inter\(' web --glob '!node_modules'` returns nothing.
- [ ] **Step 5:** Rewrite `UX_GUIDE.md`; commit `docs(web): design system guide`; open a PR from `redesign/design-system`.

## Open decisions for the owner

1. **Creator edits** (the "Tolu's glow edit" cards): the backend's influencer routes are not connected to the server and have no public list. v1 leaves this section out rather than faking it.
2. **Scan:** v1 opens the camera and searches by the text or barcode it reads; reliable product matching needs barcodes stored on products (a backend job).
