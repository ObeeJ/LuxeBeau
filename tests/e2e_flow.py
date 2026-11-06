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
