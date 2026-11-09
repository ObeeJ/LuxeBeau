#!/usr/bin/env python3
"""LuxeBeau end-to-end flow test: walks the backend the way the web app does.

Standard library only. Two modes:

  Read-only (safe against production; creates nothing):
      python3 tests/e2e_flow.py --base https://luxebeau-api.onrender.com --readonly

  Full flow (needs a DISPOSABLE backend: it registers users and places orders):
      python3 tests/e2e_flow.py --base http://localhost:8097 \
          --mail-dir /path/to/MAIL_DEV_DIR \
          --seller-password "$SEED_DEMO_PASSWORD" \
          --paystack-secret "$PAYSTACK_SECRET_KEY" \
          [--audit-bin ./walletaudit --database-url postgres://...]

Every step prints PASS or FAIL with the real status code. Exit code is 1 if
anything failed, so it can gate a deploy.
"""
import argparse
import glob
import hashlib
import hmac
import http.cookiejar
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid

RESULTS = []


def check(name, ok, detail=""):
    RESULTS.append((name, bool(ok)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"   [{detail}]" if detail else ""))
    return bool(ok)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


class Client:
    """One browser: its own cookie jar, and the CSRF header the web app sends."""

    def __init__(self, base, csrf=True, origin="http://localhost:3000"):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar), NoRedirect()
        )
        self.csrf = csrf
        self.origin = origin

    def call(self, method, path, body=None, headers=None, raw=None, timeout=90):
        url = path if path.startswith("http") else self.base + path
        if "/auth/" in path and method == "POST":
            time.sleep(1.2)  # the API rate-limits sign-in routes (~1/sec); pace like a person
        data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
        h = {"Origin": self.origin}
        if data is not None:
            h["Content-Type"] = "application/json"
        if self.csrf:
            h["X-LuxeBeau-Client"] = "web"
        h.update(headers or {})
        req = urllib.request.Request(url, data=data, method=method, headers=h)
        try:
            with self.opener.open(req, timeout=timeout) as r:
                status, text, hdrs = r.status, r.read().decode("utf-8", "replace"), r.headers
        except urllib.error.HTTPError as e:
            status, text, hdrs = e.code, e.read().decode("utf-8", "replace"), e.headers
        except (urllib.error.URLError, ConnectionError, BrokenPipeError) as e:
            # The server hung up mid-request (it can refuse a huge body before
            # we finish sending it). Report as status 0 instead of crashing.
            return 0, {"_error": str(e)}, {}
        try:
            js = json.loads(text) if text else {}
        except ValueError:
            js = {"_raw": text[:200]}
        return status, js, hdrs

    def cookie_names(self):
        return sorted(c.name for c in self.jar)


def data(js):
    return js.get("data", js) if isinstance(js, dict) else js


def first_list(d, *keys):
    """The API wraps lists ({"products": [...]}); accept either shape."""
    if isinstance(d, list):
        return d
    for k in keys:
        if isinstance(d, dict) and isinstance(d.get(k), list):
            return d[k]
    if isinstance(d, dict):
        for v in d.values():
            if isinstance(v, list):
                return v
    return []


def otp_from_mail(mail_dir, to_email, since, wait=15):
    """Local backends write mail to files instead of sending it."""
    deadline = time.time() + wait
    while time.time() < deadline:
        for f in sorted(glob.glob(os.path.join(mail_dir, "*.eml")), key=os.path.getmtime, reverse=True):
            if os.path.getmtime(f) < since - 1:
                continue
            body = open(f, errors="replace").read()
            if to_email.lower() in body.lower():
                # Filename is "<timestamp>-<email>-<code>_is_your_...": take the
                # code, not the 6-digit chunk of the timestamp.
                m = re.search(r"-(\d{6})_is_your", os.path.basename(f)) or re.search(r"(?<!\d)(\d{6})(?!\d)", body)
                if m:
                    return m.group(1)
        time.sleep(0.5)
    return None


def section(title):
    print(f"\n== {title}")


# ---------------------------------------------------------------- read-only


def public_checks(base, origin):
    section("1. Backend is up (what the keep-awake worker pings)")
    c = Client(base, origin=origin)
    t = time.time()
    s, js, _ = c.call("GET", "/healthz", timeout=120)
    check("GET /healthz is 200", s == 200 and js.get("status") == "ok", f"{s} in {time.time()-t:.1f}s")
    s, js, _ = c.call("GET", "/readyz")
    check("GET /readyz is 200 (database reachable)", s == 200 and js.get("status") == "ready", str(s))

    section("2. Browsing, as an anonymous visitor (home, shop, services)")
    s, js, _ = c.call("GET", "/api/v1/products")
    products = first_list(data(js), "products", "items")
    check("GET /products returns a catalogue", s == 200 and len(products) > 0, f"{s}, {len(products)} items")
    if products:
        pid = products[0].get("id")
        s, js, _ = c.call("GET", f"/api/v1/products/{pid}")
        check("GET /products/:id returns the product", s == 200, str(s))
    s, js, _ = c.call("GET", "/api/v1/artisans")
    check("GET /artisans returns 200", s == 200, f"{s}, {len(first_list(data(js), 'artisans'))} artisans")
    s, js, _ = c.call("GET", "/api/v1/featured-ads/active")
    check("GET /featured-ads/active returns 200", s == 200, str(s))
    s, js, _ = c.call("GET", "/api/v1/products/99999999")
    check("Unknown product is 404, not a crash", s == 404, str(s))

    section("3. Browser safety rules (the web app relies on these)")
    s, js, _ = Client(base, csrf=False, origin=origin).call(
        "POST", "/api/v1/auth/login", {"email": "a@b.co", "password": "x"}
    )
    check("POST without the X-LuxeBeau-Client header is refused", s in (400, 401, 403), str(s))
    s, js, h = c.call(
        "OPTIONS", "/api/v1/products",
        headers={"Access-Control-Request-Method": "GET", "Origin": origin},
    )
    allow = h.get("Access-Control-Allow-Origin") or ""
    check("CORS preflight from the web origin is allowed", s in (200, 204) and allow in (origin, "*"), f"{s} allow={allow!r}")
    s, js, h = c.call("GET", "/api/v1/products", headers={"Origin": "https://evil.example"})
    check("CORS does not allow an unknown origin", (h.get("Access-Control-Allow-Origin") or "") not in ("https://evil.example", "*"), str(h.get("Access-Control-Allow-Origin")))
    s, js, _ = c.call("POST", "/api/v1/auth/login", raw=b'{"email":"' + b"a" * 2_000_000 + b'"}')
    check("A 2 MB request body is refused (413, or the server hangs up first)", s in (413, 0),
          "413 Payload Too Large" if s == 413 else "connection closed before the upload finished" if s == 0 else str(s))
    s, js, _ = c.call("POST", "/api/v1/auth/login", {"email": "nobody@example.com", "password": "wrong-password"})
    check("Wrong login is 401, not 500", s == 401, str(s))
    s, js, _ = c.call("GET", "/api/v1/me/orders")
    check("Orders without a session are 401", s == 401, str(s))
    s, js, _ = c.call("GET", "/api/v1/auth/me")
    check("Profile without a session is 401", s == 401, str(s))
    s, js, _ = c.call("POST", "/api/v1/orders/quote", {"items": [{"product_id": 1, "qty": 1}], "city": "Lagos", "pay_method": "card"})
    check("A price quote needs a session", s == 401, str(s))
    s, js, _ = c.call("GET", "/api/v1/admin/revenue")
    check("Admin revenue without a session is 401", s == 401, str(s))
    s, js, _ = c.call("POST", "/api/v1/webhooks/paystack", raw=b'{"event":"charge.success","data":{"reference":"LB-FAKE","status":"success","amount":1}}',
                      headers={"x-paystack-signature": "0" * 128})
    check("A payment webhook with a bad signature is refused", s in (401, 403, 503), str(s))


# ---------------------------------------------------------------- full flow


def full_flow(a):
    base, origin = a.base, a.origin
    section("4. Sign up like a new customer (register, email code, login)")
    buyer = Client(base, origin=origin)
    email = f"e2e-{uuid.uuid4().hex[:10]}@example.com"
    password = "E2e-" + uuid.uuid4().hex[:12]
    t0 = time.time()
    s, js, _ = buyer.call("POST", "/api/v1/auth/register", {"name": "E2E Buyer", "email": email, "password": password, "phone": "08000000000"})
    check("Register is accepted", s in (200, 201), f"{s} {js.get('error', '')}")
    s2, js2, _ = buyer.call("POST", "/api/v1/auth/register", {"name": "E2E Buyer", "email": email, "password": password})
    check("Registering the same email again is a clear conflict, not a crash", s2 in (200, 400, 409), str(s2))
    s, js, _ = buyer.call("POST", "/api/v1/auth/login", {"email": email, "password": password})
    check("Login is refused until the email is verified", s in (401, 403), str(s))
    code = otp_from_mail(a.mail_dir, email, t0)
    check("Verification code arrived in the mailbox", code is not None, f"code={'found' if code else 'missing'}")
    if not code:
        return None
    s, js, _ = buyer.call("POST", "/api/v1/auth/verify-email", {"email": email, "code": "000000" if code != "000000" else "111111"})
    check("A wrong code is rejected", s in (400, 401, 422), str(s))
    s, js, _ = buyer.call("POST", "/api/v1/auth/verify-email", {"email": email, "code": code})
    check("The right code verifies the email", s == 200, f"{s} {js.get('error', '')}")
    s, js, _ = buyer.call("POST", "/api/v1/auth/login", {"email": email, "password": password})
    check("Login now works", s == 200, str(s))
    check("Session cookies were set", len(buyer.cookie_names()) >= 1, ",".join(buyer.cookie_names()))
    s, js, _ = buyer.call("GET", "/api/v1/auth/me")
    me = data(js)
    me = me.get("user", me) if isinstance(me, dict) else {}
    check("GET /auth/me returns this user", s == 200 and me.get("email") == email, str(s))

    section("5. Shop and check out (cart to order)")
    s, js, _ = buyer.call("GET", "/api/v1/products")
    products = [p for p in first_list(data(js), "products", "items") if p.get("stock", 0) > 0 and p.get("seller_id")]
    if not check("A purchasable product exists", bool(products)):
        return None
    prod = products[0]
    body = {"items": [{"product_id": prod["id"], "qty": 1}], "address": "12 Admiralty Way", "city": "Lekki", "state": "Lagos", "phone": "08000000000", "pay_method": "card"}
    s, js, _ = buyer.call("POST", "/api/v1/orders", {**body, "items": [{"product_id": prod["id"], "qty": 0}]})
    check("A quantity of 0 is rejected", s in (400, 422), str(s))
    s, js, _ = buyer.call("POST", "/api/v1/orders", body)
    order = (data(js) or {}).get("order", {}) if s in (200, 201) else {}
    check("Order is created and awaits payment", s in (200, 201) and order.get("payment_status") == "pending", f"{s} status={order.get('payment_status')}")
    oid = order.get("id")
    if not oid:
        return None
    total = order.get("total", 0)
    check("Order total is positive and includes the items", total >= prod["price"], f"total={total} price={prod['price']}")

    # The fee rule: the buyer pays the platform fee on top (3.5% / 3% / 2.5% of
    # the goods by tier), the seller keeps their own delivery fee, and a card
    # payment also carries the gateway's processing fee.
    def expected_platform_fee(goods):
        bps = 350 if goods <= 1_000_000 else 300 if goods <= 5_000_000 else 250
        return (goods * bps + 5000) // 10000

    subtotal, delivery = order.get("subtotal", 0), order.get("delivery_fee", 0)
    fee, processing = order.get("platform_fee", -1), order.get("processing_fee", -1)
    check("The platform fee follows the tier rule", fee == expected_platform_fee(subtotal), f"goods {subtotal} -> fee {fee}")
    check("A card order carries a processing fee", processing > 0, str(processing))
    check("Total = goods + delivery + platform fee + processing fee", total == subtotal + delivery + fee + processing,
          f"{subtotal}+{delivery}+{fee}+{processing} vs {total}")
    s, js, _ = buyer.call("POST", "/api/v1/orders/quote", {"items": body["items"], "city": body["city"], "pay_method": "card"})
    quote = (data(js) or {}).get("quote", {})
    check("The quote shown before paying matches the real charge", s == 200 and quote.get("total") == total and quote.get("platform_fee") == fee,
          f"{s} quote total {quote.get('total')} vs {total}")
    s, js, _ = buyer.call("POST", "/api/v1/orders/quote", {"items": body["items"], "city": body["city"], "pay_method": "wallet"})
    wq = (data(js) or {}).get("quote", {})
    check("A wallet payment carries no processing fee", s == 200 and wq.get("processing_fee") == 0, str(wq.get("processing_fee")))
    s, js, _ = buyer.call("POST", "/api/v1/orders/quote", {"items": [{"product_id": prod["id"], "qty": 0}], "city": "Lagos", "pay_method": "card"})
    check("Quoting a bad quantity is rejected", s in (400, 422), str(s))

    section("6. Pay (Paystack tells the backend by webhook)")
    payload = json.dumps({"event": "charge.success", "data": {"reference": oid, "status": "success", "amount": total, "currency": "NGN"}}).encode()
    good = hmac.new(a.paystack_secret.encode(), payload, hashlib.sha512).hexdigest()
    anon = Client(base, csrf=False, origin=origin)
    s, js, _ = anon.call("POST", "/api/v1/webhooks/paystack", raw=payload, headers={"x-paystack-signature": "f" * 128})
    check("Forged webhook is refused", s in (401, 403), str(s))
    s, js, _ = buyer.call("GET", f"/api/v1/orders/{oid}")
    check("...and the order is still unpaid", (data(js) or {}).get("order", data(js)).get("payment_status") == "pending", str(s))
    s, js, _ = anon.call("POST", "/api/v1/webhooks/paystack", raw=payload, headers={"x-paystack-signature": good})
    check("Genuine webhook is accepted", s == 200, f"{s} {js}")
    s, js, _ = buyer.call("GET", f"/api/v1/orders/{oid}")
    o = (data(js) or {}).get("order", data(js))
    check("Order is now paid", o.get("payment_status") == "paid", str(o.get("payment_status")))

    def my_escrows():
        _, j, _ = buyer.call("GET", "/api/v1/escrows")
        return [e for e in first_list(data(j), "escrows") if e.get("reference") == oid]

    held = my_escrows()
    check("Money is held in escrow for the seller", len(held) >= 1 and all(e.get("state") == "funded" for e in held), f"{len(held)} escrows {[e.get('state') for e in held]}")
    check("The seller's escrow holds goods + their delivery, never the fees",
          len(held) >= 1 and sum(e.get("amount", 0) for e in held) == subtotal + delivery,
          f"held {sum(e.get('amount', 0) for e in held)} vs goods+delivery {subtotal + delivery}")
    s, js, _ = anon.call("POST", "/api/v1/webhooks/paystack", raw=payload, headers={"x-paystack-signature": good})
    check("The same webhook delivered twice is harmless", s == 200, str(s))
    again = my_escrows()
    check("...and creates no second escrow", len(again) == len(held), f"{len(held)} -> {len(again)}")

    section("7. Seller fulfils, buyer confirms, money is released")
    seller = Client(base, origin=origin)
    s, js, _ = seller.call("POST", "/api/v1/auth/login", {"email": "seller@luxebeau.ng", "password": a.seller_password})
    if check("Seller logs in", s == 200, str(s)):
        s, js, _ = seller.call("PATCH", f"/api/v1/me/sales/{oid}", {"status": "delivered"})
        s_ok = s in (200, 204)
        check("Seller marks the order delivered", s_ok, f"{s} {js.get('error', '')}")
    for e in my_escrows():
        s, js, _ = buyer.call("POST", f"/api/v1/escrows/{e['id']}/release")
        check(f"Buyer releases escrow {e['id']}", s == 200, f"{s} {js.get('error', '')}")
    states = [e.get("state") for e in my_escrows()]
    check("Escrow is released", bool(states) and all(x == "released" for x in states), str(states))
    s, js, _ = buyer.call("POST", f"/api/v1/escrows/{held[0]['id']}/release") if held else (0, {}, None)
    check("Releasing twice is refused, never paid twice", s in (400, 409, 422), str(s))
    other = Client(base, origin=origin)
    s, js, _ = other.call("GET", f"/api/v1/orders/{oid}")
    check("Another visitor cannot read this order", s in (401, 403, 404), str(s))

    section("7b. Featured ads (create, pay by wallet and by Paystack)")

    def new_ad(client, plan="7_days"):
        return client.call("POST", "/api/v1/me/promotions", {
            "type": "storefront", "target_id": "adunni-organics", "title": "E2E ad",
            "image_url": "https://example.com/a.jpg", "plan": plan})

    def active_ids():
        _, j, _ = anon.call("GET", "/api/v1/featured-ads/active")
        return {x.get("id") for x in first_list(data(j), "ads", "items")}

    def seller_balance():
        _, j, _ = seller.call("GET", "/api/v1/wallets/me")
        return (data(j).get("wallet") or {}).get("balance")

    def hook(ref, amount):
        body = json.dumps({"event": "charge.success", "data": {"reference": ref, "status": "success", "amount": amount, "currency": "NGN"}}).encode()
        sig = hmac.new(a.paystack_secret.encode(), body, hashlib.sha512).hexdigest()
        s_, j_, _ = anon.call("POST", "/api/v1/webhooks/paystack", raw=body, headers={"x-paystack-signature": sig})
        return s_, (data(j_) or {}).get("outcome")

    s, js, _ = new_ad(buyer)
    check("A plain buyer cannot create an ad", s in (401, 403), str(s))
    s, js, _ = new_ad(seller)
    ad1 = (data(js) or {}).get("ad", {}) if s in (200, 201) else {}
    check("A seller's new ad starts unpaid (pending)", s in (200, 201) and ad1.get("status") == "pending", f"{s} {ad1.get('status')}")
    if ad1.get("id"):
        check("An unpaid ad is not shown to the public", ad1["id"] not in active_ids())
        before = seller_balance()
        s, js, _ = seller.call("POST", f"/api/v1/me/promotions/{ad1['id']}/pay-wallet")
        check("Paying from the wallet works", s == 200, f"{s} {js.get('error', '')}")
        check("...and the ad goes live", ad1["id"] in active_ids())
        after = seller_balance()
        check("The wallet was charged the plan price once", before is not None and after is not None and before - after == 500000, f"{before} -> {after}")
        s, js, _ = seller.call("POST", f"/api/v1/me/promotions/{ad1['id']}/pay-wallet")
        again = seller_balance()
        check("Paying the same ad twice is harmless (no second charge)", s == 200 and again == after, f"{s} balance {after} -> {again}")
        s, js, _ = buyer.call("POST", f"/api/v1/me/promotions/{ad1['id']}/pay-wallet")
        check("Another user cannot pay for or touch this ad", s in (403, 404), str(s))

    s, js, _ = new_ad(seller, "annual")
    big = (data(js) or {}).get("ad", {}) if s in (200, 201) else {}
    if big.get("id"):
        s, js, _ = seller.call("POST", f"/api/v1/me/promotions/{big['id']}/pay-wallet")
        check("Not enough money in the wallet is a clear 402", s == 402, str(s))
        s, outcome = hook(big["id"], 1)
        check("A Paystack payment of the wrong amount is not accepted", s == 200 and outcome == "amount_invalid", f"{s} {outcome}")
        check("...and the ad stays unpaid", big["id"] not in active_ids())

    s, js, _ = new_ad(seller)
    card = (data(js) or {}).get("ad", {}) if s in (200, 201) else {}
    if card.get("id"):
        s, outcome = hook(card["id"], 500000)
        check("A genuine Paystack payment pays the ad", s == 200 and outcome == "paid", f"{s} {outcome}")
        check("...and the ad goes live", card["id"] in active_ids())
        s, outcome = hook(card["id"], 500000)
        check("The same Paystack payment delivered twice is ignored", s == 200 and outcome == "ignored", f"{s} {outcome}")
    # Browser-style request (carries the CSRF header), unlike the webhook client.
    s, js, _ = Client(base, origin=origin).call("POST", f"/api/v1/featured-ads/{ad1.get('id', 'x')}/click")
    check("A visitor can register a click on a live ad", s in (200, 204), str(s))

    section("7c. Admin revenue (admin signs in with the emailed code)")
    s, js, _ = buyer.call("GET", "/api/v1/admin/revenue")
    check("A buyer cannot see revenue", s in (401, 403), str(s))
    admin = Client(base, origin=origin)
    t_admin = time.time()
    s, js, _ = admin.call("POST", "/api/v1/auth/login", {"email": "admin@luxebeau.ng", "password": a.seller_password})
    check("Admin login asks for the emailed code", s in (200, 401, 403) and "SECOND_FACTOR_REQUIRED" in json.dumps(js), f"{s}")
    code = otp_from_mail(a.mail_dir, "admin@luxebeau.ng", t_admin)
    if code:
        s, js, _ = admin.call("POST", "/api/v1/auth/verify-login", {"email": "admin@luxebeau.ng", "code": code})
        check("Admin signs in with the code", s == 200, str(s))
        today = time.strftime("%Y-%m-%d", time.gmtime(time.time() + 3600))  # Lagos date
        s, js, _ = admin.call("GET", f"/api/v1/admin/revenue?from={today}&to={today}&group=day")
        rev = data(js) if s == 200 else {}
        tot = (rev or {}).get("totals", {})
        check("Revenue loads for admin", s == 200 and bool(tot), str(s))
        check("Revenue includes this order's platform fee", tot.get("platform_fees", 0) >= fee, f"{tot.get('platform_fees')} vs {fee}")
        check("Revenue includes the two paid ads", tot.get("ad_revenue", 0) >= 1_000_000, str(tot.get("ad_revenue")))
        check("Net = fees + ads - refunded fees", tot.get("net") == tot.get("platform_fees", 0) + tot.get("ad_revenue", 0) - tot.get("fee_refunds", 0), str(tot.get("net")))
        check("The gateway's processing fee is not counted as revenue", tot.get("processing_fees_collected", 0) >= processing and tot.get("net") == tot.get("platform_fees", 0) + tot.get("ad_revenue", 0) - tot.get("fee_refunds", 0))
        check("No escrow is out of balance", ((rev or {}).get("health") or {}).get("unbalanced_escrows") == 0)
        check("The daily series adds up to the total", sum(p.get("net", 0) for p in (rev or {}).get("series", [])) == tot.get("net"))
        s, js, _ = admin.call("GET", "/api/v1/admin/revenue?from=2026-12-01&to=2026-11-01")
        check("A backwards date range is a clear 400", s == 400, str(s))

    section("8. Sign out")
    s, js, _ = buyer.call("POST", "/api/v1/auth/logout")
    check("Logout succeeds", s in (200, 204), str(s))
    s, js, _ = buyer.call("GET", "/api/v1/auth/me")
    check("The session no longer works", s == 401, str(s))

    if a.audit_bin and a.database_url:
        section("9. Books balance (ledger audit over everything above)")
        out = subprocess.run([a.audit_bin], env={**os.environ, "DATABASE_URL": a.database_url}, capture_output=True, text=True, timeout=120)
        print("      " + out.stdout.strip().replace("\n", "\n      "))
        check("Every escrow balances", re.search(r"escrows checked, 0 do not balance", out.stdout) is not None)
        check("No wallet holds unexplained money", re.search(r"0 with a difference", out.stdout) is not None)
    return oid


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", required=True, help="backend root, e.g. http://localhost:8097")
    ap.add_argument("--origin", default="http://localhost:3000", help="the web app origin to send")
    ap.add_argument("--readonly", action="store_true", help="only safe GET checks; creates nothing")
    ap.add_argument("--mail-dir", help="MAIL_DEV_DIR of the local backend (to read sign-up codes)")
    ap.add_argument("--seller-password", default=os.environ.get("SEED_DEMO_PASSWORD", ""))
    ap.add_argument("--paystack-secret", default=os.environ.get("PAYSTACK_SECRET_KEY", ""))
    ap.add_argument("--audit-bin")
    ap.add_argument("--database-url")
    a = ap.parse_args()

    public_checks(a.base, a.origin)
    if not a.readonly:
        missing = [n for n, v in (("--mail-dir", a.mail_dir), ("--seller-password", a.seller_password), ("--paystack-secret", a.paystack_secret)) if not v]
        if missing:
            sys.exit(f"full flow needs {', '.join(missing)} (or use --readonly)")
        full_flow(a)

    failed = [n for n, ok in RESULTS if not ok]
    print(f"\n{len(RESULTS) - len(failed)} passed, {len(failed)} failed")
    for n in failed:
        print(f"  FAILED: {n}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
