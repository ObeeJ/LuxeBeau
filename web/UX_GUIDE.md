# LuxeBeau UX & Frontend Guide

The "Velvet Atelier" system: a dark editorial luxury marketplace for the Nigerian
beauty market. This guide is the source of truth for how the web app looks,
moves and behaves.

## 1. Design tokens

All colour, radius and font tokens live in [app/globals.css](app/globals.css)
under Tailwind v4 `@theme inline`. Never hardcode hex values in components.

| Token group | Use |
| --- | --- |
| `velvet-950 / 900 / 800 / 700` | Page canvas, raised surface, card, borders |
| `royal-600 / 500 / 400` | Brand purple, interactive, hover |
| `lavender-100 / 200 / 400` | Primary text, secondary text, muted text |
| `gold-300 / 400 / 500` | Accent text, rules and CTAs, gold on light |
| `paper-50 / 100 / ink / muted` | Light editorial break sections |

shadcn semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`,
`ring-ring`, `bg-primary`) are mapped onto these, so every shadcn component
inherits the palette automatically.

**Fonts:** Fraunces (`font-display`) for headings, Hanken Grotesk (`font-sans`)
for body. Loaded through `next/font` in [app/layout.tsx](app/layout.tsx).

## 2. Component sourcing

1. Reach for a shadcn primitive first: Button, Input, Label, Textarea, Select,
   Card, Dialog, Badge, Tabs, Skeleton, Separator. They live in
   [components/ui](components/ui).
2. Compose page sections in `components/site` and `components/dashboard`.
3. Only drop to raw markup for layout shells and the CSS art product tiles.

## 3. Motion

Framer Motion, with one shared easing curve `[0.22, 1, 0.36, 1]`.

- Page load: staggered fade and rise on hero copy.
- Scroll: use `Reveal` / `RevealGroup` from
  [components/motion/reveal.tsx](components/motion/reveal.tsx) for sections.
- Step flows (checkout, booking): `AnimatePresence` slides panels horizontally.
- Micro: nav underline uses a shared `layoutId`; cart badge pops on change.
- Respect `prefers-reduced-motion`: globals.css disables all animation when set.

Keep it to one or two animated focal points per view. Motion should explain a
change, never decorate.

## 4. State and data

| Concern | Tool | Location |
| --- | --- | --- |
| Server calls and mutations | TanStack Query | [lib/queries.ts](lib/queries.ts) |
| Auth session and cart | Zustand (persisted) | [lib/store.ts](lib/store.ts) |
| Input validation | Zod schemas | [lib/api.ts](lib/api.ts) |
| Local UI state | `useState` / `useEffect` | per component |

The fetch wrapper `apiFetch` attaches the JWT, unwraps the Go API's
`{ success, data, error }` envelope, and throws a typed `ApiError`. The base URL
comes from `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8080/api/v1`).

### Wired endpoints

| Action | Hook | Endpoint |
| --- | --- | --- |
| Sign in | `useLogin` | `POST /auth/login` |
| Register | `useRegister` | `POST /auth/register` |
| Checkout | `useCreateOrder` | `POST /orders` |
| Book artisan | `useCreateBooking` | `POST /bookings` |

When the backend is unreachable, order and booking mutations fall back to a
synthesized reference so the marketplace stays demoable. Real 4xx errors still
surface to the user.

## 5. UX rules (enforced across the app)

- **Auth gating:** checkout and booking require a signed-in user. If not signed
  in, the auth dialog opens and resumes the original action via an `onDone`
  callback. No dead ends.
- **Forms:** every field has a visible `Label`. Errors render inline below the
  field with `role="alert"`. Validation runs on submit through Zod.
- **Nigerian inputs:** phone validates the `070/080/081/090/091` formats; the
  city select carries Nigerian cities; copy references Paystack, naira and local
  context.
- **Loading:** every async button disables and shows a spinner while pending.
- **Money:** always `formatNaira` / `formatCompactNaira`. Numeric cells use
  `tabular-nums` so columns do not jitter.
- **Feedback:** confirmations and errors use the toast system, never `alert()`.

## 6. Accessibility baseline

- Colour contrast: lavender-400 holds 4.6:1 on the velvet canvas; body text uses
  lavender-100 / 200.
- Focus: a gold focus ring is defined globally for keyboard users.
- Semantics: icon-only buttons carry `aria-label`; selectors use
  `role="radiogroup"` / `aria-checked`; tables use `scope="col"`.
- Reduced motion is honoured globally.

## 7. Writing style

Plain, warm, confident. **No dashes** in copy: use commas, full stops or "to"
for ranges (for example "1 to 4 days"). Spell out numbers under ten in prose.
Keep it Nigerian and specific (owambe, gele, knotless braids, Lekki, Maitama).
