# LuxeBeau design system and site-wide redesign: design

Approved in chat by the owner on 2026-10-29 after mockups. The final mockup is `.superpowers/brainstorm/431969-1793277254/content/home-v7.html` (scratch, git-ignored; its contents are summarised here so this document stands alone).

## Intent

LuxeBeau is a Nigerian online beauty marketplace for **everyone** (unisex): skincare, hair, grooming, fragrance, makeup, plus bookable artisans. Visitors must feel it is the best choice, that their money is safe (escrow, verified sellers, never scammed), and that it is something to "rep" and belong to. They start shopping immediately with no sign-up and sign up only at payment, in one quick step. Sellers, artisans and brands must also see what they gain, including brand partnerships. The look should be recognisable, vibrant, fast, and consistent for every user type (buyer, seller, artisan, admin) and on phones.

## Goals

1. One shared design system (tokens + reusable components) that every page uses, so a change is made once.
2. Home page redesigned to the approved mockup, fed by real API data.
3. Every existing page and dashboard restyled with the same components, mobile-first.
4. New Pair logo and wordmark in the product, favicon and app icons.
5. A component gallery page so the owner can see and pick components.
6. Top-notch UX: clear states (loading, empty, error), keyboard and screen-reader support, reduced-motion respected, touch targets of at least 44px.

## Non-goals

- No backend or API changes. No new business features (the existing escrow, booking, influencer and withdrawal logic stays as is).
- No arches anywhere. No sparkle motifs. No QR codes, app-store badges or city lists in the footer.
- Not copying shop.com's name, logo or imagery. Layout language only.
- No invented statistics, reviews or sellers in shipped screens (the mockup's made-up names and numbers must not reach production).

## Visual language (exact values)

- **Layout:** logo tile top-left; floating vertical icon dock on the left (desktop) and a bottom tab bar (mobile); centred pill search with a Scan button; round-photo category pills; one wide white hero card; an "Explore" feed (creator edits, browse categories, product rails, trending store cards, a slim escrow strip, a sell/artisan/brand row); footer.
- **Colour:** purple `#8A1FC7` (primary), deep `#6F16A3` (hover/pressed), wash `#F3E6FB`, glow `rgba(138,31,199,.38)`, ink `#000000`, white `#FFFFFF`, page background `#FAFAFA`, hairline `#EBEBEB`, muted `#6B6B6B`. The old blue-violet `#5433EB` is banned (owner calls it blue).
- **Type:** Geist via `next/font/google`. Headlines weight 800, tracking -0.045em; wordmark weight 900, tracking -0.065em; body 14-16px weight 400-500.
- **Shape and depth:** pills (9999px) for controls, 24-40px radii for cards, soft shadows (`0 4px 24px rgba(0,0,0,.06)`), no arches.
- **Texture:** a fine global grain overlay (SVG feTurbulence, baseFrequency .85, ~7% opacity, `mix-blend-mode: multiply`), non-interactive (`pointer-events: none`).
- **Logo "Pair":** two interlinked rings (her + him), second ring at 60% opacity, white on a purple rounded tile; wordmark lowercase "luxebeau". Needs a bolder small-size variant for the favicon because the rings blur at 16px.
- **Motion (shop.com's measured timings):** card idle bob 4s ease-in-out alternate infinite; hover float 4.8s and 5.6s; image hover zoom .15-.3s; press feedback scale .96 and opacity .6 over .15s; cascade-in .35s `cubic-bezier(.22,1,.36,1)` from 8px below; cart bounce .4s `cubic-bezier(.34,1.56,.64,1)` to 130%; cycling image stack .52s `cubic-bezier(.2,0,0,1)`; rail slide .18s 18px; count/word slide .3-.45s; toast slide-in .3s. All respect `prefers-reduced-motion`.
- **Hero proportions (from shop.com's markup):** mobile aspect 7:10; tablet fixed 440px tall; wide screens aspect 2.75:1 capped at 685px tall.

## Brand 20% (what keeps us distinct)

Rotating headline word "Beauty is all about you / her / him / us"; Her / Him / Everyone browsing; escrow trust messaging in the hero phone and a three-step strip; sign-up-at-checkout framing; seller, artisan and brand-partnership row.

## Left to the builder

Component file layout, test details, exact responsive breakpoints beyond the hero rule, and the icon set. Open question for the owner: **Scan** (search by pointing the camera at a product). The button is in the design; making it find products needs product barcodes the backend does not store today. v1 ships the button opening a camera dialog that reads a barcode or text and searches by it; true product matching is a later backend job.
