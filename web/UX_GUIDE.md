# LuxeBeau UX & Design System Guide

The approved LuxeBeau design system: a vibrant, light, unisex beauty marketplace for Nigeria.
Driven by shared tokens, Geist typography, the Pair brand identity, and secure escrow guarantees.

## 1. Visual Language & Tokens

All colour, depth, and font tokens are defined in [app/globals.css](app/globals.css) under Tailwind v4 `@theme inline`. No component should hardcode raw hex values.

| Token | Value / Class | Use |
| --- | --- | --- |
| Primary Brand | `#8A1FC7` (`bg-brand`, `text-brand`) | Primary buttons, active tabs, wordmark, focal accents |
| Brand Deep | `#6F16A3` (`bg-brand-deep`, `text-brand-deep`) | Hover/pressed states, deep tone badges |
| Brand Wash | `#F3E6FB` (`bg-brand-wash`, `text-brand-deep`) | Soft badge backgrounds, callouts, scan button |
| Glow Shadow | `rgba(138,31,199,.38)` (`shadow-glow`) | Elevated purple controls |
| Ink | `#000000` (`text-ink`, `bg-ink`) | Headlines, primary text, dark action buttons |
| Canvas | `#FAFAFA` (`bg-canvas`) | Page background |
| Surface | `#FFFFFF` (`bg-surface`) | Cards, modals, side dock, top bar |
| Hairline | `#EBEBEB` (`border-hairline`) | Subtle dividers and card borders |
| Muted | `#6B6B6B` (`text-muted`) | Secondary metadata, placeholders, subtitles |

### Texture
- **Global Grain Overlay**: An SVG `feTurbulence` filter (baseFrequency .85, 7% opacity, `mix-blend-mode: multiply`) applied globally on `body::after`. Non-interactive (`pointer-events: none`).

### Typography
- **Single Typeface**: `Geist` via `next/font/google` in [app/layout.tsx](app/layout.tsx).
- **Headlines (`.t-hero`, `.t-display`)**: Font weight 800, tight tracking (`-0.045em`).
- **Wordmark (`LuxeBeauWordmark`)**: Weight 900, lowercase "luxebeau", tracking `-0.065em`.
- **Body & Subtitles**: 14px to 16px, weight 400 to 500.

## 2. Brand Identity: The "Pair" Logo

- **Symbol (`LuxeBeauMark`)**: Two interlinked rings representing her + him (unisex beauty). The second ring has a `60%` stroke opacity (`stroke-opacity="0.6"`).
- **Favicon & App Icon**: High-contrast, bold stroke SVG variant rendered via `app/icon.svg` and `app/apple-icon.tsx`.

## 3. Motion System

Measured timings and curves standardized in [lib/motion.ts](lib/motion.ts):

- **Curves**:
  - `EASE.out`: `[0.22, 1, 0.36, 1]` for entrances.
  - `EASE.spring`: `[0.34, 1.56, 0.64, 1]` for cart bounces and heart pops.
  - `EASE.std`: `[0.2, 0, 0, 1]` for continuous flows.
- **Micro-interactions**:
  - Press feedback: `active:scale-[.96] active:opacity-60` over 150ms (`.lb-press`).
  - Staggered entrances: `<Cascade index={i} />` rises 8px with a 45ms step.
  - Cart counter: Numbers slide up into place (`.lb-num-in`) with a spring bounce on the cart icon.
- **Accessibility**: All animations automatically collapse or freeze when `prefers-reduced-motion: reduce` is enabled.

## 4. Components & Layout Architecture

1. **Shell ([components/site/shell.tsx](components/site/shell.tsx))**:
   - Desktop: Left floating vertical dock with 46px pill buttons and purple Pair logo tile.
   - Mobile: Persistent top bar and bottom tab bar with safe-area padding.
2. **Catalog ([components/site/catalog.tsx](components/site/catalog.tsx))**:
   - `ProductCard`: Clamped 2-line title, naira formatting, favourite toggle, and 1.6s "✓ Added" confirm state.
   - `ProductRail`: Horizontal scroll snapping with hover navigation arrows.
   - `SearchBar`: Centred pill input featuring the interactive `Scan` barcode affordance.
3. **Escrow Guarantee**:
   - Visual step strip (`EscrowStrip`) and escrow trust callouts across product detail, hero phone mockup, and checkout bag summary.
4. **Internal Component Gallery**:
   - Available at `/design-system` (marked `noindex`) for reviewing all live primitives and states.

## 5. Accessibility & Contrast Verification

- **Color Contrast**:
  - White on `#8A1FC7`: **6.77:1** (exceeds WCAG AAA requirements for large text and AA for normal text).
  - `#8A1FC7` on White: **6.77:1** (exceeds WCAG AA).
- **Touch Targets**: Minimum 44px on mobile buttons and inputs.
- **Keyboard Navigation**: Clear brand purple outline (`outline-brand`) on `:focus-visible`.
