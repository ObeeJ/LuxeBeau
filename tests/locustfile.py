"""
LuxeBeau API Load Test
Run: locust -f tests/locustfile.py --host http://localhost:8090/api/v1
UI:  http://localhost:8089  -> set users=500, ramp=50, start
"""
import os, random, string, threading, uuid
from datetime import date, timedelta

import httpx
from faker import Faker
from locust import HttpUser, TaskSet, between, events, task

fake = Faker("en_NG")

CSRF = {"X-LuxeBeau-Client": "locust"}

_lock = threading.Lock()
_buyer_tokens:   list[dict] = []
_seller_tokens:  list[dict] = []
_artisan_tokens: list[dict] = []
_admin_tokens:   list[dict] = []
_product_ids:    list[int]  = [1, 2, 3, 4, 5, 6]
_artisan_ids:    list[int]  = [1, 2, 3, 4, 6]
_order_ids:      list[str]  = []
_booking_ids:    list[str]  = []
_inf_pkg_ids:    list[int]  = []
_slugs:          list[str]  = []

ARTISAN_SERVICES = {
    1: "Knotless Braids (Mid-back)",
    2: "Bridal Gele (Ipele)",
    3: "Full Glam Makeup",
    4: "Fade & Shape-Up",
    6: "HydraFacial",
}
CITIES  = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano"]
STATES  = ["Lagos", "FCT", "Rivers", "Oyo", "Kano"]
MAX     = 500


def _pick(pool):
    with _lock:
        return random.choice(pool) if pool else None

def _push(pool, item):
    with _lock:
        if len(pool) < MAX:
            pool.append(item)

def _email():  return f"lb_{uuid.uuid4().hex[:8]}@test.ng"
def _phone():  return "080" + "".join(random.choices(string.digits, k=8))
def _slug(p):  return f"{p}-{uuid.uuid4().hex[:7]}"


# ── Guest (public endpoints, no auth) ────────────────────────────────────────

class GuestUser(HttpUser):
    weight = 40
    wait_time = between(0.5, 2)

    @task(5)
    def list_products(self):
        self.client.get(f"/products?page={random.randint(1,3)}&limit=20", name="/products")

    @task(3)
    def get_product(self):
        pid = _pick(_product_ids)
        if pid:
            self.client.get(f"/products/{pid}", name="/products/:id")

    @task(3)
    def list_artisans(self):
        self.client.get(f"/artisans?location={random.choice(CITIES)}", name="/artisans")

    @task(2)
    def get_artisan(self):
        aid = _pick(_artisan_ids)
        if aid:
            self.client.get(f"/artisans/{aid}", name="/artisans/:id")

    @task(2)
    def artisan_availability(self):
        aid = _pick(_artisan_ids)
        if aid:
            svc = ARTISAN_SERVICES[aid]
            self.client.get(
                f"/artisans/{aid}/availability?service={svc}&days=14",
                name="/artisans/:id/availability",
            )

    @task(1)
    def storefront(self):
        slug = _pick(_slugs)
        if slug:
            self.client.get(f"/storefront/{slug}", name="/storefront/:slug")
            self.client.get(f"/storefront/{slug}/products", name="/storefront/:slug/products")

    @task(1)
    def healthz(self):
        self.client.get("/../../healthz", name="/healthz", allow_redirects=False)


# ── Buyer ─────────────────────────────────────────────────────────────────────

class BuyerUser(HttpUser):
    weight = 30
    wait_time = between(1, 3)

    def on_start(self):
        creds = _pick(_buyer_tokens)
        if not creds:
            return
        self.client.headers.update({**CSRF, "Authorization": f"Bearer {creds['token']}"})

    @task(4)
    def browse(self):
        self.client.get("/products?limit=20", name="/products")

    @task(3)
    def my_orders(self):
        self.client.get("/me/orders", name="/me/orders")

    @task(3)
    def wallet(self):
        self.client.get("/wallets/me", name="/wallets/me")

    @task(2)
    def place_order(self):
        pid = _pick(_product_ids)
        if not pid:
            return
        i = random.randint(0, len(CITIES)-1)
        r = self.client.post("/orders", json={
            "items": [{"product_id": pid, "qty": random.randint(1, 3)}],
            "address": "12 Balogun Street",
            "city": CITIES[i], "state": STATES[i],
            "phone": _phone(),
            "pay_method": random.choice(["card", "transfer", "wallet"]),
        }, name="/orders [POST]", headers=CSRF)
        if r.status_code == 201:
            oid = r.json().get("data", {}).get("order", {}).get("id")
            if oid:
                _push(_order_ids, oid)

    @task(2)
    def my_bookings(self):
        self.client.get("/me/bookings", name="/me/bookings")

    @task(1)
    def create_booking(self):
        aid = _pick(_artisan_ids)
        if not aid:
            return
        d = (date.today() + timedelta(days=random.randint(3, 14))).isoformat()
        r = self.client.post("/bookings", json={
            "artisan_id": aid,
            "service_name": ARTISAN_SERVICES[aid],
            "date": d,
            "slot_time": random.choice(["09:00", "11:00", "13:00", "15:00"]),
            "service_type": "studio",
            "address": "",
        }, name="/bookings [POST]", headers=CSRF)
        if r.status_code == 201:
            bid = r.json().get("data", {}).get("booking", {}).get("id")
            if bid:
                _push(_booking_ids, bid)

    @task(1)
    def me(self):
        self.client.get("/auth/me", name="/auth/me")


# ── Seller ────────────────────────────────────────────────────────────────────

class SellerUser(HttpUser):
    weight = 15
    wait_time = between(1, 4)

    def on_start(self):
        creds = _pick(_seller_tokens)
        if not creds:
            return
        self.client.headers.update({**CSRF, "Authorization": f"Bearer {creds['token']}"})

    @task(4)
    def my_products(self):
        self.client.get("/me/products", name="/me/products")

    @task(3)
    def my_sales(self):
        self.client.get("/me/sales", name="/me/sales")

    @task(2)
    def wallet(self):
        self.client.get("/wallets/me", name="/wallets/me")

    @task(2)
    def delivery_zones(self):
        self.client.get("/me/delivery-zones", name="/me/delivery-zones")

    @task(2)
    def influencer_packages(self):
        self.client.get("/me/influencer-packages", name="/me/influencer-packages")

    @task(1)
    def create_influencer_pkg(self):
        slug = _slug("inf")
        r = self.client.post("/me/influencer-packages", json={
            "slug": slug,
            "influencer_name": fake.name(),
            "influencer_email": _email(),
            "influencer_phone": _phone(),
            "influencer_handle": f"@{slug}",
            "scope": "Promote products on Instagram and TikTok for 30 days with weekly posts",
            "agreement": "Commission paid monthly. No exclusivity.",
            "commission_bps": random.randint(200, 1500),
            "bank_code": "058",
            "account_number": "".join(random.choices(string.digits, k=10)),
            "account_name": fake.name(),
        }, name="/me/influencer-packages [POST]", headers=CSRF)
        if r.status_code == 201:
            pid = r.json().get("data", {}).get("package", {}).get("id")
            if pid:
                _push(_inf_pkg_ids, pid)

    @task(1)
    def set_slug(self):
        slug = _slug("store")
        r = self.client.put("/me/storefront-slug", json={"slug": slug},
                            name="/me/storefront-slug", headers=CSRF)
        if r.status_code == 200:
            _push(_slugs, slug)

    @task(1)
    def withdrawals(self):
        self.client.get("/me/wallet/withdrawals", name="/me/wallet/withdrawals")


# ── Artisan ───────────────────────────────────────────────────────────────────

class ArtisanUser(HttpUser):
    weight = 10
    wait_time = between(1, 4)

    def on_start(self):
        creds = _pick(_artisan_tokens)
        if not creds:
            return
        self.client.headers.update({**CSRF, "Authorization": f"Bearer {creds['token']}"})

    @task(4)
    def my_profile(self):
        self.client.get("/me/artisan", name="/me/artisan")

    @task(3)
    def my_bookings(self):
        self.client.get("/me/bookings", name="/me/bookings")

    @task(2)
    def schedule(self):
        self.client.get("/me/artisan/schedule", name="/me/artisan/schedule")

    @task(2)
    def slots(self):
        self.client.get("/me/artisan/slots", name="/me/artisan/slots")

    @task(1)
    def wallet(self):
        self.client.get("/wallets/me", name="/wallets/me")

    @task(1)
    def confirm_booking(self):
        bid = _pick(_booking_ids)
        if bid:
            self.client.patch(f"/bookings/{bid}/confirm",
                              name="/bookings/:id/confirm", headers=CSRF)


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminUser(HttpUser):
    weight = 5
    wait_time = between(2, 6)

    def on_start(self):
        creds = _pick(_admin_tokens)
        if not creds:
            return
        self.client.headers.update({**CSRF, "Authorization": f"Bearer {creds['token']}"})

    @task(3)
    def users(self):
        self.client.get("/admin/users?limit=50", name="/admin/users")

    @task(3)
    def orders(self):
        self.client.get("/admin/orders", name="/admin/orders")

    @task(2)
    def bookings(self):
        self.client.get("/admin/bookings", name="/admin/bookings")

    @task(2)
    def escrows(self):
        self.client.get("/admin/escrows", name="/admin/escrows")

    @task(1)
    def commissions(self):
        self.client.get("/admin/influencer-commissions", name="/admin/influencer-commissions")


# ── Seed tokens before ramp ───────────────────────────────────────────────────

@events.test_start.add_listener
def seed_pools(environment, **kwargs):
    base = environment.host
    pw = os.getenv("SEED_DEMO_PASSWORD", "")
    if not pw:
        print("\n[seed] No SEED_DEMO_PASSWORD — only GuestUser tasks will run (public endpoints).")
        print("[seed] Set SEED_DEMO_PASSWORD in your shell to enable buyer/seller/artisan/admin tasks.\n")
        return

    for email, pool, role in [
        ("buyer@luxebeau.ng",   _buyer_tokens,   "buyer"),
        ("seller@luxebeau.ng",  _seller_tokens,  "seller"),
        ("amaka@luxebeau.ng",   _artisan_tokens, "artisan"),
        ("admin@luxebeau.ng",   _admin_tokens,   "admin"),
    ]:
        try:
            r = httpx.post(f"{base}/auth/login",
                           json={"email": email, "password": pw},
                           headers={"X-LuxeBeau-Client": "locust-seed"},
                           timeout=10)
            if r.status_code == 200:
                token = r.cookies.get("lb_at")
                uid   = r.json().get("data", {}).get("user", {}).get("id", "")
                if token:
                    pool.append({"token": token, "user_id": uid})
                    print(f"[seed] {role:8s} ok")
                else:
                    print(f"[seed] {role:8s} login ok but no lb_at cookie — set COOKIE_SECURE=false in .env")
            else:
                print(f"[seed] {role:8s} failed {r.status_code}: {r.text[:100]}")
        except Exception as e:
            print(f"[seed] {role:8s} error: {e}")


@events.test_stop.add_listener
def summary(environment, **kwargs):
    t = environment.stats.total
    print(f"\n{'='*55}")
    print(f"  Requests : {t.num_requests:>10,}")
    print(f"  Failures : {t.num_failures:>10,}  ({100*t.fail_ratio:.1f}%)")
    print(f"  Median   : {t.median_response_time:>10} ms")
    print(f"  p95      : {t.get_response_time_percentile(0.95):>10} ms")
    print(f"  p99      : {t.get_response_time_percentile(0.99):>10} ms")
    print(f"  RPS      : {t.current_rps:>10.1f}")
    print(f"{'='*55}\n")
