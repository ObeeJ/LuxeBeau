# luxebeau-api-edge

A tiny Cloudflare Worker that serves the API's public catalogue reads from the
Cloudflare location nearest the visitor, so most requests never wake the API on
Render (whose free plan is slow and sleeps).

- Serves only: `/api/v1/products[/:id]`, `/api/v1/artisans[/:id]`,
  `/api/v1/reviews`, `/api/v1/featured-ads/pricing`. Everything else is 404.
- Forwards no cookies, no Authorization and no custom headers to the API, and
  strips cookies from the answer, so one person's answer can never be cached and
  shown to another.
- Workers Caching (`"cache": {"enabled": true}` in `wrangler.jsonc`) keeps each
  answer for 5 minutes, then serves it for up to an hour while refreshing in the
  background (`Cache-Control: s-maxage=300, stale-while-revalidate=3600`). Errors are never kept.
- Left out on purpose: `/featured-ads/active` (counts a view per call) and
  `/storefronts/:handle` (depends on the signed-in owner).

The web app uses it when `NEXT_PUBLIC_EDGE_API_URL` is set at build time
(`web/.env.production`), and falls back to the API directly if the edge fails.

    npm test            # route rules
    npx wrangler deploy

If `wrangler deploy` fails with `fetch failed` (a machine with no IPv6 route
makes Node's default connection racing time out), use:

    NODE_OPTIONS="--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=5000" npx wrangler deploy
