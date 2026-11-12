// Pure helpers for the API edge cache. No imports, so they run under plain
// `node --test`. The Worker only ever answers public catalogue reads, and never
// forwards anything that identifies a person, so one person's answer can never
// be cached and shown to another.

// Public, identical-for-everyone reads only. Deliberately NOT here:
//  - /featured-ads/active   counts an ad view on every call
//  - /storefronts/:handle   its answer depends on the signed-in owner
//  - anything under /auth, /me, /admin, /orders
const CACHEABLE = [
  /^\/api\/v1\/products(\/[A-Za-z0-9_-]+)?$/,
  /^\/api\/v1\/artisans(\/[A-Za-z0-9_-]+)?$/,
  /^\/api\/v1\/reviews$/,
  /^\/api\/v1\/featured-ads\/pricing$/,
];

export function isCacheable(method, pathname) {
  if (method !== "GET" && method !== "HEAD") return false;
  return CACHEABLE.some((re) => re.test(pathname));
}

// How long the edge may serve an answer, then keep serving it while it refreshes
// in the background. Browsers keep it briefly too.
export const CACHE_CONTROL = "public, max-age=15, s-maxage=60, stale-while-revalidate=300";

/** Only `Accept` goes upstream: no cookies, no Authorization, no custom headers. */
export function upstreamHeaders(incoming) {
  return new Headers({ Accept: incoming.get("accept") || "application/json" });
}

/** Builds the response headers from scratch so nothing personal or unsafe leaks through. */
export function responseHeaders(upstream) {
  const h = new Headers();
  const type = upstream.get("content-type");
  if (type) h.set("Content-Type", type);
  h.set("Cache-Control", CACHE_CONTROL);
  // These reads carry no credentials, so any website may read them.
  h.set("Access-Control-Allow-Origin", "*");
  h.set("X-Edge", "luxebeau-api-edge");
  return h;
}
