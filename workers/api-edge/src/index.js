// luxebeau-api-edge: serves public catalogue reads (products, artisans, reviews,
// ad pricing) from Cloudflare's nearest location. Workers Caching (see
// wrangler.jsonc) stores each answer, so most requests are answered without this
// code running and without waking the API on Render.
import { isCacheable, upstreamHeaders, responseHeaders } from "./route.js";

const ORIGIN = "https://luxebeau-api.onrender.com";

const preflight = () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Accept",
      "Access-Control-Max-Age": "86400",
    },
  });

const refuse = (status, message) =>
  new Response(JSON.stringify({ success: false, error: { code: "EDGE_REFUSED", message } }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" },
  });

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return preflight();
    if (!isCacheable(request.method, url.pathname)) return refuse(404, "not served from the edge");

    let upstream;
    try {
      upstream = await fetch(ORIGIN + url.pathname + url.search, {
        method: request.method,
        headers: upstreamHeaders(request.headers),
      });
    } catch {
      return refuse(502, "the API could not be reached");
    }
    const headers = responseHeaders(upstream.headers);
    // Only good answers are kept; an error must never be served from cache.
    if (upstream.status !== 200) headers.set("Cache-Control", "no-store");
    return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
  },
};
