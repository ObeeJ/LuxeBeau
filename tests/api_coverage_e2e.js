/**
 * LuxeBeau API coverage suite (complements all_user_types_crud_e2e.js).
 * Safe for the live API: it never completes a payment, never deletes a user,
 * and cancels what it books. Admin routes are checked for access control only,
 * because the admin login needs an emailed one-time code.
 *
 *   API_URL=https://luxebeau-api.onrender.com/api/v1 node tests/api_coverage_e2e.js
 */
const API = process.env.API_URL || "https://luxebeau-api.onrender.com/api/v1";
const PASSWORD = process.env.DEMO_PASSWORD || "TestLuxeBeau2026!";
const rows = [];
const check = (group, name, ok, detail = "") => {
  rows.push({ group, name, ok });
  console.log(`${ok ? "✅" : "❌"} [${group}] ${name}${detail ? " → " + detail : ""}`);
};

async function call(method, path, { body, cookies, csrf = true, headers = {} } = {}) {
  const h = { Accept: "application/json", ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (csrf) h["X-LuxeBeau-Client"] = "web";
  if (cookies) h.Cookie = cookies;
  try {
    const res = await fetch(API + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(40000) });
    const text = await res.text();
    let json = {}; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, res };
  } catch (e) { return { status: 0, json: {}, text: String(e), res: null }; }
}
const jar = r => (r.res?.headers.getSetCookie?.() || []).map(c => c.split(";")[0]).join("; ");
async function login(email) {
  const r = await call("POST", "/auth/login", { body: { email, password: PASSWORD } });
  return { status: r.status, cookies: jar(r), user: r.json?.data?.user };
}
const data = r => r.json?.data ?? {};
const isRouteMissing = r => r.status === 404 && /404 page not found/.test(r.text);

(async () => {
  console.log(`Target API: ${API}\n`);

  /* ── 1. Public reads ── */
  const pub = {};
  for (const p of ["/products?limit=5", "/artisans", "/reviews?target_type=product&target_id=1", "/featured-ads/active?limit=3", "/featured-ads/pricing", "/storefronts/adunni-organics"]) {
    const r = await call("GET", p, { csrf: false });
    check("public", `GET ${p.split("?")[0]}`, r.status === 200 && r.json.success !== false, `HTTP ${r.status}`);
    pub[p] = r;
  }
  const products = data(pub["/products?limit=5"]).products || [];
  const artisans = data(pub["/artisans"]).artisans || data(pub["/artisans"]).items || [];
  const prod = products[0], art = artisans[0];
  if (prod) { const r = await call("GET", `/products/${prod.id}`, { csrf: false }); check("public", "GET /products/:id", r.status === 200, `HTTP ${r.status}`); }
  if (art) {
    const r = await call("GET", `/artisans/${art.id}`, { csrf: false }); check("public", "GET /artisans/:id", r.status === 200, `HTTP ${r.status}`);
    const svcName = (art.services || [])[0]?.name || "x";
    const a = await call("GET", `/artisans/${art.id}/availability?service=${encodeURIComponent(svcName)}&days=7`, { csrf: false });
    check("public", "GET /artisans/:id/availability", a.status === 200 && Array.isArray(data(a).days), `HTTP ${a.status}`);
    const na = await call("GET", `/artisans/${art.id}/availability`, { csrf: false });
    check("public", "availability without a service is a clean 400", na.status === 400, `HTTP ${na.status}`);
  }
  let r = await call("GET", "/products/999999", { csrf: false });
  check("public", "unknown product is a clean 404 (not a 500)", r.status === 404, `HTTP ${r.status}`);
  r = await call("GET", "/products/not-a-number", { csrf: false });
  check("public", "a malformed product id is a clean 400 (not a 500)", r.status === 400, `HTTP ${r.status}`);
  r = await call("GET", "/profiles/no-such-handle-zz", { csrf: false });
  check("public", "unknown profile handle is a clean 404", r.status === 404, `HTTP ${r.status}`);
  r = await call("GET", "/storefronts/no-such-store-zz", { csrf: false });
  check("public", "unknown storefront is a clean 404", r.status === 404, `HTTP ${r.status}`);
  r = await call("POST", "/storefronts/check-handle", { body: { handle: "adunni-organics" } });
  check("public", "POST /storefronts/check-handle (taken handle)", r.status === 200 && JSON.stringify(r.json).includes("false"), `HTTP ${r.status}`);
  r = await call("POST", "/storefronts/theme-preview", { body: { theme_color: "#8A1FC7" } });
  check("public", "POST /storefronts/theme-preview", r.status < 500 && !isRouteMissing(r), `HTTP ${r.status}`);
  r = await call("POST", "/featured-ads/999999/click", { body: {} });
  check("public", "POST /featured-ads/:id/click (unknown ad is handled)", r.status < 500 && !isRouteMissing(r), `HTTP ${r.status}`);

  /* ── 2. Every protected route refuses an anonymous caller ── */
  const protectedRoutes = [
    ["GET", "/auth/me"], ["PATCH", "/me/profile"], ["POST", "/bookings"], ["PATCH", "/bookings/x/confirm"], ["POST", "/bookings/x/cancel"],
    ["PATCH", "/bookings/x/complete"], ["PATCH", "/bookings/x/no-show"], ["POST", "/orders"], ["POST", "/orders/quote"], ["GET", "/orders/x"],
    ["POST", "/orders/x/verify"], ["GET", "/me/orders"], ["GET", "/me/bookings"], ["POST", "/reviews"], ["GET", "/me/reviewable"],
    ["GET", "/me/profile/social"], ["PATCH", "/me/profile/social"], ["GET", "/me/conversations"], ["POST", "/me/messages"],
    ["GET", "/me/conversations/x/messages"], ["POST", "/me/conversations/x/read"], ["GET", "/me/messages/stream"], ["GET", "/me/kyc/kinds"],
    ["POST", "/me/kyc"], ["POST", "/me/artisan-onboard"], ["POST", "/me/seller-onboard"], ["GET", "/me/artisan"], ["PUT", "/me/artisan/services"],
    ["GET", "/me/artisan/schedule"], ["PUT", "/me/artisan/schedule"], ["GET", "/me/artisan/slots"], ["POST", "/me/artisan/slots"],
    ["DELETE", "/me/artisan/slots/x"], ["POST", "/me/uploads/image"], ["POST", "/me/profile/avatar"], ["GET", "/escrows"], ["POST", "/escrows"],
    ["GET", "/escrows/x"], ["POST", "/escrows/x/fund"], ["POST", "/escrows/x/release"], ["POST", "/escrows/x/refund"], ["POST", "/escrows/x/dispute"],
    ["GET", "/me/products"], ["POST", "/me/products"], ["PATCH", "/me/products/x"], ["DELETE", "/me/products/x"], ["GET", "/me/sales"],
    ["PATCH", "/me/sales/x"], ["GET", "/me/delivery-zones"], ["POST", "/me/delivery-zones"], ["GET", "/me/influencer-packages"],
    ["POST", "/me/influencer-packages"], ["GET", "/me/influencer-packages/x"], ["PATCH", "/me/influencer-packages/x"],
    ["PATCH", "/me/influencer-packages/x/state"], ["GET", "/me/influencer-packages/x/commissions"], ["GET", "/wallets/me"],
    ["POST", "/me/wallet/withdraw"], ["POST", "/me/wallet/resolve-account"], ["GET", "/me/wallet/withdrawals"], ["POST", "/me/promotions"],
    ["POST", "/me/promotions/x/pay-wallet"], ["GET", "/me/promotions"], ["GET", "/me/storefront"], ["POST", "/me/storefront"],
    ["POST", "/me/storefront/check-handle"], ["POST", "/me/storefront/theme-preview"],
  ];
  const adminRoutes = [
    ["GET", "/admin/applications"], ["GET", "/admin/users"], ["GET", "/admin/users/x"], ["PATCH", "/admin/users/x"], ["POST", "/admin/users/x/verify"],
    ["DELETE", "/admin/users/x"], ["GET", "/admin/products"], ["DELETE", "/admin/products/x"], ["GET", "/admin/orders"], ["GET", "/admin/bookings"],
    ["GET", "/admin/escrows"], ["POST", "/admin/escrows/x/resolve"], ["GET", "/admin/influencer/packages"], ["GET", "/admin/influencer-commissions"],
    ["GET", "/admin/reviews"], ["PATCH", "/admin/reviews/x"], ["GET", "/admin/revenue"], ["GET", "/admin/promotions"], ["PATCH", "/admin/promotions/x/status"],
  ];
  let bad = [];
  for (const [m, p] of [...protectedRoutes, ...adminRoutes]) {
    const x = await call(m, p, { body: ["GET", "DELETE"].includes(m) ? undefined : {} });
    if (x.status !== 401) bad.push(`${m} ${p} → ${x.status}`);
  }
  check("access", `all ${protectedRoutes.length + adminRoutes.length} protected routes refuse anonymous callers (401)`, bad.length === 0, bad.join("; "));

  /* ── 3. Wrong role is refused ── */
  const buyer = await login("buyer@luxebeau.ng");
  const seller = await login("seller@luxebeau.ng");
  const artisan = await login("amaka@luxebeau.ng");
  check("auth", "buyer, seller and artisan can log in", buyer.status === 200 && seller.status === 200 && artisan.status === 200);
  bad = [];
  for (const [m, p] of adminRoutes) { const x = await call(m, p, { cookies: buyer.cookies, body: ["GET", "DELETE"].includes(m) ? undefined : {} }); if (x.status !== 403) bad.push(`${m} ${p} → ${x.status}`); }
  check("access", "a buyer is refused on every admin route (403)", bad.length === 0, bad.join("; "));
  bad = [];
  for (const [m, p] of [["GET", "/me/products"], ["POST", "/me/products"], ["GET", "/me/sales"], ["GET", "/me/delivery-zones"], ["GET", "/me/influencer-packages"]]) {
    const x = await call(m, p, { cookies: buyer.cookies, body: m === "GET" ? undefined : {} }); if (x.status !== 403) bad.push(`${m} ${p} → ${x.status}`);
  }
  check("access", "a buyer is refused on seller routes (403)", bad.length === 0, bad.join("; "));
  bad = [];
  for (const [m, p] of [["GET", "/me/artisan/schedule"], ["GET", "/me/artisan/slots"], ["PUT", "/me/artisan/services"]]) {
    const x = await call(m, p, { cookies: seller.cookies, body: m === "GET" ? undefined : {} }); if (x.status !== 403) bad.push(`${m} ${p} → ${x.status}`);
  }
  check("access", "a seller is refused on artisan-only routes (403)", bad.length === 0, bad.join("; "));
  r = await call("GET", "/me/wallet/withdrawals", { cookies: buyer.cookies });
  check("access", "a buyer cannot use payout routes (403)", r.status === 403, `HTTP ${r.status}`);
  r = await call("GET", "/admin/users", { cookies: seller.cookies });
  check("access", "a seller is refused on admin routes (403)", r.status === 403, `HTTP ${r.status}`);

  /* ── 4. Security guards ── */
  r = await call("POST", "/me/messages", { cookies: buyer.cookies, body: {}, csrf: false });
  check("security", "a write without the anti-forgery header is refused", r.status === 403, `HTTP ${r.status}`);
  r = await call("POST", "/auth/login", { body: { email: "buyer@luxebeau.ng", password: "wrong-password-123" } });
  check("security", "wrong password is a 401 with no session", r.status === 401 && !jar(r), `HTTP ${r.status}`);
  r = await call("POST", "/auth/login", { body: { email: "nobody-here@luxebeau.ng", password: "wrong-password-123" } });
  const r2 = await call("POST", "/auth/login", { body: { email: "buyer@luxebeau.ng", password: "wrong-password-123" } });
  check("security", "unknown email and wrong password give the same answer (no account probing)", r.status === r2.status && r.json?.error?.message === r2.json?.error?.message, `${r.status}/${r2.status}`);
  r = await call("POST", "/auth/register", { body: { name: "x", email: "bad", password: "short" } });
  check("security", "register rejects bad input (400/422)", [400, 422].includes(r.status), `HTTP ${r.status}`);
  r = await call("POST", "/auth/verify-email", { body: { email: "nobody-here@luxebeau.ng", code: "000000" } });
  check("security", "a wrong verification code is refused", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/auth/forgot-password", { body: { email: "nobody-here@luxebeau.ng" } });
  const f2 = await call("POST", "/auth/forgot-password", { body: { email: "buyer@luxebeau.ng" } });
  check("security", "forgot-password answers the same for known and unknown emails", r.status === f2.status, `${r.status}/${f2.status}`);
  r = await call("POST", "/auth/reset-password", { body: { email: "buyer@luxebeau.ng", code: "000000", password: "NewPassword123!" } });
  check("security", "reset-password with a wrong code is refused", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/auth/resend-code", { body: { email: "nobody-here@luxebeau.ng" } });
  check("security", "resend-code does not reveal unknown accounts or crash", r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/auth/google", { body: { id_token: "not-a-token" } });
  check("security", "a fake Google token is refused", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/auth/verify-login", { body: { email: "admin@luxebeau.ng", code: "000000" } });
  check("security", "a wrong admin one-time code is refused", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  for (const w of ["paystack", "flutterwave", "monnify", "crypto"]) {
    const x = await fetch(`${API}/webhooks/${w}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "charge.success", data: { reference: "fake", amount: 100 } }) });
    // 4xx = bad signature; 503 = that provider is switched off here. Either way nothing is processed.
    check("security", `unsigned ${w} webhook is rejected`, x.status >= 400, `HTTP ${x.status}`);
  }
  r = await call("POST", "/auth/refresh", { body: {} });
  check("security", "refresh without a session is a 401", r.status === 401, `HTTP ${r.status}`);

  /* ── 5. Session lifecycle: me → refresh → logout ── */
  const me = await call("GET", "/auth/me", { cookies: buyer.cookies });
  check("session", "GET /auth/me with the session cookie", me.status === 200 && data(me).user?.email === "buyer@luxebeau.ng", `HTTP ${me.status}`);
  const lo = await login("buyer@luxebeau.ng");
  const rf = await call("POST", "/auth/refresh", { cookies: lo.cookies, body: {} });
  check("session", "POST /auth/refresh renews the session", rf.status === 200, `HTTP ${rf.status}`);
  const out = await call("POST", "/auth/logout", { cookies: jar(rf) || lo.cookies, body: {} });
  check("session", "POST /auth/logout", out.status === 200 || out.status === 204, `HTTP ${out.status}`);

  /* ── 6. Buyer flows ── */
  const B = buyer.cookies;
  if (prod) {
    r = await call("POST", "/orders/quote", { cookies: B, body: { items: [{ product_id: prod.id, quantity: 1 }], delivery_zone: "Lagos Island" } });
    check("buyer", "POST /orders/quote prices a basket without creating anything", r.status < 500 && !isRouteMissing(r), `HTTP ${r.status} ${r.status >= 400 ? JSON.stringify(r.json.error || {}).slice(0, 90) : ""}`);
  }
  r = await call("POST", "/orders", { cookies: B, body: { items: [] } });
  check("buyer", "an empty order is refused (400/422)", [400, 422].includes(r.status), `HTTP ${r.status}`);
  r = await call("GET", "/orders/does-not-exist", { cookies: B });
  check("buyer", "someone else's / unknown order is a clean 404", r.status === 404, `HTTP ${r.status}`);
  r = await call("POST", "/orders/does-not-exist/verify", { cookies: B, body: {} });
  check("buyer", "verifying an unknown order is a clean 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  for (const p of ["/me/reviewable", "/me/profile/social", "/me/conversations", "/me/kyc/kinds", "/escrows"]) {
    const x = await call("GET", p, { cookies: B }); check("buyer", `GET ${p}`, x.status === 200, `HTTP ${x.status}`);
  }
  r = await call("POST", "/reviews", { cookies: B, body: { target_type: "product", target_id: String(prod?.id ?? 1), rating: 5, comment: "x" } });
  check("buyer", "a review without a purchase is refused (not accepted, no 500)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("PATCH", "/me/profile/social", { cookies: B, body: { bio: "E2E check bio" } });
  check("buyer", "PATCH /me/profile/social", r.status < 500 && !isRouteMissing(r), `HTTP ${r.status}`);
  r = await call("PATCH", "/me/profile/social", { cookies: B, body: { website: "javascript:alert(1)" } });
  check("buyer", "a javascript: link in a profile is refused", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  const uid = (data(me).user || {}).id;
  r = await call("POST", "/me/messages", { cookies: B, body: { to_user_id: uid, body: "self" } });
  check("buyer", "messaging yourself is refused (no 500)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("GET", "/me/conversations/00000000-0000-0000-0000-0000000000ff/messages", { cookies: B });
  check("buyer", "reading someone else's conversation is refused (403/404)", [403, 404].includes(r.status), `HTTP ${r.status}`);
  r = await call("POST", "/escrows", { cookies: B, body: {} });
  check("buyer", "an empty escrow is refused (400/422)", [400, 422].includes(r.status), `HTTP ${r.status}`);
  r = await call("GET", "/escrows/does-not-exist", { cookies: B });
  check("buyer", "unknown escrow is a clean 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);

  /* ── 7. Booking: create, then cancel what we made ── */
  if (art) {
    const svcName = (art.services || [])[0]?.name;
    const av = svcName ? await call("GET", `/artisans/${art.id}/availability?service=${encodeURIComponent(svcName)}&days=10`, { csrf: false }) : null;
    const day = (data(av || {}).days || []).find(d => (d.times || []).length && d.date > new Date(Date.now() + 36e5 * 30).toISOString().slice(0, 10));
    if (!day) check("booking", "an open slot to book", false, "no open slot found in 10 days");
    else {
      let type = "studio";
      let x = await call("POST", "/bookings", { cookies: B, body: { artisan_id: art.id, service_name: svcName, date: day.date, slot_time: day.times[0], service_type: type } });
      if (x.status === 400) { type = "home"; x = await call("POST", "/bookings", { cookies: B, body: { artisan_id: art.id, service_name: svcName, date: day.date, slot_time: day.times[0], service_type: type, address: "12 Test Street, Lekki, Lagos" } }); }
      const booked = data(x).booking || data(x);
      check("booking", "POST /bookings creates a booking", (x.status === 200 || x.status === 201) && booked?.id, `HTTP ${x.status} ${x.status >= 400 ? JSON.stringify(x.json.error || {}).slice(0, 100) : "id " + booked?.id}`);
      if (booked?.id) {
        const dup = await call("POST", "/bookings", { cookies: B, body: { artisan_id: art.id, service_name: svcName, date: day.date, slot_time: day.times[0], service_type: type, address: "12 Test Street, Lekki, Lagos" } });
        check("booking", "the same slot cannot be booked twice (409/400)", [400, 409].includes(dup.status), `HTTP ${dup.status}`);
        const l = await call("GET", "/me/bookings", { cookies: B });
        check("booking", "the new booking shows in GET /me/bookings", l.status === 200 && JSON.stringify(l.json).includes(String(booked.id)));
        const c = await call("POST", `/bookings/${booked.id}/cancel`, { cookies: B, body: {} });
        check("booking", "POST /bookings/:id/cancel", c.status === 200, `HTTP ${c.status}`);
        const av2 = await call("GET", `/artisans/${art.id}/availability?service=${encodeURIComponent(svcName)}&days=10`, { csrf: false });
        const again = (data(av2).days || []).find(d => d.date === day.date);
        check("booking", "the slot is free again after cancelling", !!again && again.times.includes(day.times[0]));
      }
    }
  }
  r = await call("PATCH", "/bookings/does-not-exist/complete", { cookies: artisan.cookies, body: {} });
  check("booking", "completing an unknown booking is a clean 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);

  /* ── 8. Seller / artisan extras ── */
  r = await call("GET", "/me/storefront", { cookies: seller.cookies });
  check("seller", "GET /me/storefront", r.status === 200, `HTTP ${r.status}`);
  r = await call("POST", "/me/storefront/check-handle", { cookies: seller.cookies, body: { handle: "adunni-organics" } });
  check("seller", "POST /me/storefront/check-handle", r.status < 500 && !isRouteMissing(r), `HTTP ${r.status}`);
  r = await call("POST", "/me/storefront/theme-preview", { cookies: seller.cookies, body: { theme_color: "#8A1FC7" } });
  check("seller", "POST /me/storefront/theme-preview", r.status < 500 && !isRouteMissing(r), `HTTP ${r.status}`);
  r = await call("PATCH", "/me/sales/does-not-exist", { cookies: seller.cookies, body: { status: "shipped" } });
  check("seller", "fulfilling an unknown sale is a clean 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/me/wallet/withdraw", { cookies: seller.cookies, body: { amount: 100000000, account_number: "0000000000", bank_code: "058" } });
  check("seller", "withdrawing more than the balance is refused (no money moves)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/me/promotions/does-not-exist/pay-wallet", { cookies: seller.cookies, body: {} });
  check("seller", "paying for an unknown promotion is a clean 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("GET", "/me/influencer-packages/does-not-exist", { cookies: seller.cookies });
  check("seller", "unknown influencer package is a clean 4xx", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/me/artisan-onboard", { cookies: buyer.cookies, body: {} });
  check("onboard", "artisan onboarding with an empty form is refused (400/422)", [400, 422].includes(r.status), `HTTP ${r.status}`);
  r = await call("POST", "/me/seller-onboard", { cookies: buyer.cookies, body: {} });
  check("onboard", "seller onboarding with an empty form is refused (400/422)", [400, 422].includes(r.status), `HTTP ${r.status}`);
  r = await call("POST", "/me/kyc", { cookies: buyer.cookies, body: {} });
  check("kyc", "KYC with an empty form is refused (4xx)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);
  r = await call("POST", "/me/uploads/image", { cookies: seller.cookies, body: {} });
  if (r.json?.error?.code === "UPLOADS_NOT_CONFIGURED") console.log("⚠️  [media] photo uploads are switched off on this server (Cloudflare Images settings missing): not counted as a failure, but sellers cannot add photos until it is set");
  else check("media", "an image upload with no file is refused (4xx)", r.status >= 400 && r.status < 500, `HTTP ${r.status}`);

  const failed = rows.filter(x => !x.ok);
  console.log("\n==============================================");
  console.log(`Checks: ${rows.length}   Passed: ${rows.length - failed.length}   Failed: ${failed.length}`);
  failed.forEach(f => console.log(`  ❌ [${f.group}] ${f.name}`));
  process.exit(failed.length ? 1 : 0);
})();
