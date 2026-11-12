import test from "node:test";
import assert from "node:assert/strict";
import { isCacheable, upstreamHeaders, responseHeaders, CACHE_CONTROL } from "../src/route.js";

test("only public catalogue reads are cacheable", () => {
  for (const ok of [
    "/api/v1/products",
    "/api/v1/products/abc-123",
    "/api/v1/artisans",
    "/api/v1/artisans/7",
    "/api/v1/reviews",
    "/api/v1/featured-ads/pricing",
  ]) assert.equal(isCacheable("GET", ok), true, ok);
});

test("anything personal, private or that counts something is refused", () => {
  for (const bad of [
    "/api/v1/auth/me",
    "/api/v1/me/orders",
    "/api/v1/me/wallet/withdrawals",
    "/api/v1/admin/users",
    "/api/v1/orders/LB-1",
    "/api/v1/featured-ads/active", // counts a view per call
    "/api/v1/storefronts/ada", // depends on the signed-in owner
    "/api/v1/artisans/7/availability",
    "/api/v1/products/1/anything/else",
    "/api/v1/products/../auth/me",
    "/api/v1/productsX",
    "/healthz",
    "/",
  ]) assert.equal(isCacheable("GET", bad), false, bad);
});

test("only reads are allowed", () => {
  for (const m of ["POST", "PATCH", "PUT", "DELETE"]) assert.equal(isCacheable(m, "/api/v1/products"), false, m);
  assert.equal(isCacheable("HEAD", "/api/v1/products"), true);
  assert.equal(isCacheable("OPTIONS", "/api/v1/products"), false);
});

test("nothing that identifies a person is sent to the API, so nothing personal can be cached", () => {
  const incoming = new Headers({
    Cookie: "lb_access=secret",
    Authorization: "Bearer secret",
    "X-LuxeBeau-Client": "web",
    Accept: "application/json",
    "Accept-Encoding": "br",
    "User-Agent": "x",
    Origin: "https://luxebeau.ajayioba2000.workers.dev",
  });
  const out = upstreamHeaders(incoming);
  assert.equal(out.get("cookie"), null);
  assert.equal(out.get("authorization"), null);
  assert.equal(out.get("x-luxebeau-client"), null);
  assert.equal(out.get("origin"), null);
  assert.equal(out.get("accept"), "application/json");
});

test("the answer is cacheable at the edge and carries open CORS for credential-free reads", () => {
  const upstream = new Headers({
    "Content-Type": "application/json",
    "Set-Cookie": "lb_x=1; HttpOnly",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Origin": "https://evil.example",
    Vary: "Origin",
    "Cache-Control": "no-store",
  });
  const h = responseHeaders(upstream);
  assert.equal(h.get("set-cookie"), null, "a cookie must never be stored in a shared cache");
  assert.equal(h.get("access-control-allow-credentials"), null);
  assert.equal(h.get("access-control-allow-origin"), "*");
  assert.equal(h.get("vary"), null, "Vary: Origin would split the cache per origin");
  assert.equal(h.get("cache-control"), CACHE_CONTROL);
  assert.match(CACHE_CONTROL, /s-maxage=\d+/);
  assert.match(CACHE_CONTROL, /stale-while-revalidate=\d+/);
  assert.equal(h.get("content-type"), "application/json");
});
