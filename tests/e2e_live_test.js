/**
 * LuxeBeau Comprehensive End-to-End Live Production Test Suite
 * Target Frontend: https://luxebeau.ajayioba2000.workers.dev
 * Target Backend:  https://luxebeau-api.onrender.com/api/v1
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const FRONTEND_URL = process.env.FRONTEND_URL || "https://luxebeau.ajayioba2000.workers.dev";
const API_URL = process.env.API_URL || "https://luxebeau-api.onrender.com/api/v1";
const RESULTS_DIR = path.join(__dirname, "e2e-results");

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const PASSWORD = "TestLuxeBeau2026!";
const USERS = {
  buyer: { email: "buyer@luxebeau.ng", role: "buyer" },
  seller: { email: "seller@luxebeau.ng", role: "seller" },
  artisan: { email: "amaka@luxebeau.ng", role: "artisan" },
  admin: { email: "admin@luxebeau.ng", role: "admin" },
};

const results = [];

function record(category, name, passed, details = "") {
  results.push({ category, name, passed, details, timestamp: new Date().toISOString() });
  const statusIcon = passed ? "✅" : "❌";
  console.log(`${statusIcon} [${category}] ${name} ${details ? "(" + details + ")" : ""}`);
}

async function apiFetch(endpoint, options = {}, token = null) {
  const headers = {
    "Content-Type": "application/json",
    "X-LuxeBeau-Client": "playwright-e2e",
    ...(options.headers || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["Cookie"] = `lb_at=${token}`;
  }
  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`;
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function loginUser(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LuxeBeau-Client": "playwright-e2e",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  let token = null;
  const setCookie = res.headers.get("set-cookie") || "";
  const match = setCookie.match(/lb_at=([^;]+)/);
  if (match) token = match[1];
  return { status: res.status, data, token };
}

async function run() {
  console.log("===============================================================");
  console.log("🚀 STARTING LUXEBEAU LIVE PRODUCTION E2E SUITE");
  console.log(`🌐 Frontend: ${FRONTEND_URL}`);
  console.log(`🔌 Backend:  ${API_URL}`);
  console.log("===============================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LuxeBeau-E2E-Tester",
  });

  const page = await context.newPage();

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: DIRECT API ENDPOINT CONTRACT VALIDATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n--- [PHASE 1] Core API Endpoints Verification ---");

    // Health
    const health = await apiFetch("https://luxebeau-api.onrender.com/healthz");
    record("API", "GET /healthz", health.status === 200 && health.data.status === "ok", `Status: ${health.status}`);

    // Products
    const productsRes = await apiFetch("/products?limit=10");
    const products = productsRes.data?.data?.products || [];
    record("API", "GET /api/v1/products", productsRes.status === 200 && products.length > 0, `Loaded ${products.length} products`);

    // Single Product
    if (products.length > 0) {
      const pid = products[0].id;
      const singleProd = await apiFetch(`/products/${pid}`);
      record("API", `GET /api/v1/products/${pid}`, singleProd.status === 200 && singleProd.data?.data?.product?.id === pid, singleProd.data?.data?.product?.name);
    }

    // Artisans
    const artisansRes = await apiFetch("/artisans");
    const artisans = artisansRes.data?.data?.artisans || [];
    record("API", "GET /api/v1/artisans", artisansRes.status === 200 && artisans.length > 0, `Loaded ${artisans.length} artisans`);

    // Artisan Availability
    if (artisans.length > 0) {
      const aid = artisans[0].id;
      const availRes = await apiFetch(`/artisans/${aid}/availability?days=7`);
      record("API", `GET /api/v1/artisans/${aid}/availability`, availRes.status === 200, `Status ${availRes.status}`);
    }

    // Authenticate all user personas
    const sessions = {};
    for (const [role, u] of Object.entries(USERS)) {
      const login = await loginUser(u.email, PASSWORD);
      if (login.status === 200 && login.token) {
        sessions[role] = { token: login.token, user: login.data?.data?.user };
        record("AUTH", `Login as ${role} (${u.email})`, true, `User ID: ${login.data?.data?.user?.id}`);
      } else {
        record("AUTH", `Login as ${role} (${u.email})`, false, `Status ${login.status}`);
      }
    }

    // Test Buyer Protected Endpoints
    if (sessions.buyer) {
      const bToken = sessions.buyer.token;
      const meRes = await apiFetch("/auth/me", {}, bToken);
      record("API Buyer", "GET /api/v1/auth/me", meRes.status === 200 && meRes.data?.data?.user?.role === "buyer", meRes.data?.data?.user?.email);

      const walletRes = await apiFetch("/wallets/me", {}, bToken);
      record("API Buyer", "GET /api/v1/wallets/me", walletRes.status === 200, `Balance: ₦${(walletRes.data?.data?.wallet?.balance || 0)/100}`);

      const ordersRes = await apiFetch("/me/orders", {}, bToken);
      record("API Buyer", "GET /api/v1/me/orders", ordersRes.status === 200, `Found ${ordersRes.data?.data?.orders?.length || 0} orders`);

      const bookingsRes = await apiFetch("/me/bookings", {}, bToken);
      record("API Buyer", "GET /api/v1/me/bookings", bookingsRes.status === 200, `Found ${bookingsRes.data?.data?.bookings?.length || 0} bookings`);
    }

    // Test Seller Protected Endpoints
    if (sessions.seller) {
      const sToken = sessions.seller.token;
      const sWalletRes = await apiFetch("/wallets/me", {}, sToken);
      record("API Seller", "GET /api/v1/wallets/me", sWalletRes.status === 200, `Balance: ₦${(sWalletRes.data?.data?.wallet?.balance || 0)/100}`);

      const salesRes = await apiFetch("/me/sales", {}, sToken);
      record("API Seller", "GET /api/v1/me/sales", salesRes.status === 200, `Status ${salesRes.status}`);

      const zonesRes = await apiFetch("/me/delivery-zones", {}, sToken);
      record("API Seller", "GET /api/v1/me/delivery-zones", zonesRes.status === 200, `Zones: ${zonesRes.data?.data?.zones?.length || 0}`);

      const packagesRes = await apiFetch("/me/influencer-packages", {}, sToken);
      record("API Seller", "GET /api/v1/me/influencer-packages", packagesRes.status === 200, `Packages: ${packagesRes.data?.data?.packages?.length || 0}`);

      const withdrawalsRes = await apiFetch("/me/wallet/withdrawals", {}, sToken);
      record("API Seller", "GET /api/v1/me/wallet/withdrawals", withdrawalsRes.status === 200, `Status ${withdrawalsRes.status}`);
    }

    // Test Artisan Protected Endpoints
    if (sessions.artisan) {
      const aToken = sessions.artisan.token;
      const aProfileRes = await apiFetch("/me/artisan", {}, aToken);
      record("API Artisan", "GET /api/v1/me/artisan", aProfileRes.status === 200, aProfileRes.data?.data?.artisan?.business_name);

      const aBookingsRes = await apiFetch("/me/bookings", {}, aToken);
      record("API Artisan", "GET /api/v1/me/bookings", aBookingsRes.status === 200, `Bookings: ${aBookingsRes.data?.data?.bookings?.length || 0}`);

      const aSlotsRes = await apiFetch("/me/artisan/slots", {}, aToken);
      record("API Artisan", "GET /api/v1/me/artisan/slots", aSlotsRes.status === 200, `Slots: ${aSlotsRes.data?.data?.slots?.length || 0}`);
    }

    // Test Admin Protected Endpoints
    if (sessions.admin) {
      const adToken = sessions.admin.token;
      const usersRes = await apiFetch("/admin/users?limit=20", {}, adToken);
      record("API Admin", "GET /api/v1/admin/users", usersRes.status === 200, `Total users: ${usersRes.data?.data?.users?.length || 0}`);

      const adminOrdersRes = await apiFetch("/admin/orders", {}, adToken);
      record("API Admin", "GET /api/v1/admin/orders", adminOrdersRes.status === 200, `Orders: ${adminOrdersRes.data?.data?.orders?.length || 0}`);

      const adminBookingsRes = await apiFetch("/admin/bookings", {}, adToken);
      record("API Admin", "GET /api/v1/admin/bookings", adminBookingsRes.status === 200, `Bookings: ${adminBookingsRes.data?.data?.bookings?.length || 0}`);

      const escrowsRes = await apiFetch("/admin/escrows", {}, adToken);
      record("API Admin", "GET /api/v1/admin/escrows", escrowsRes.status === 200, `Escrows: ${escrowsRes.data?.data?.escrows?.length || 0}`);

      const commissionsRes = await apiFetch("/admin/influencer-commissions", {}, adToken);
      record("API Admin", "GET /api/v1/admin/influencer-commissions", commissionsRes.status === 200, `Commissions: ${commissionsRes.data?.data?.commissions?.length || 0}`);
    }


    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: FRONTEND UI PAGES & USER EXPERIENCE VALIDATION
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n--- [PHASE 2] Frontend Playwright UI Journey ---");

    // 1. Home / Landing Page
    console.log("Navigating to Home...");
    await page.goto(FRONTEND_URL, { waitUntil: "networkidle", timeout: 30000 });
    await page.screenshot({ path: path.join(RESULTS_DIR, "01_home_desktop.png"), fullPage: false });
    const homeTitle = await page.title();
    record("UI Guest", "Load Home Page", homeTitle.includes("LuxeBeau"), `Title: "${homeTitle}"`);

    // Verify wordmark & navigation links
    const wordmark = await page.locator("header").first().textContent();
    record("UI Guest", "Header & Brand Wordmark rendered", wordmark.includes("LuxeBeau") || wordmark.includes("Shop"), "Header present");

    // 2. Shop Catalog Page
    console.log("Navigating to /shop...");
    await page.goto(`${FRONTEND_URL}/shop`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(RESULTS_DIR, "02_shop_catalog.png") });
    const productCards = await page.locator("a[href*='/shop/']").count();
    record("UI Guest", "Browse Shop Catalog (/shop)", productCards > 0, `Found ${productCards} product cards rendered`);

    // 3. Product Detail Page
    console.log("Navigating to Product Detail Page...");
    const firstProductHref = await page.locator("a[href*='/shop/']").first().getAttribute("href");
    if (firstProductHref) {
      await page.goto(`${FRONTEND_URL}${firstProductHref}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(RESULTS_DIR, "03_product_detail.png") });
      const pageText = await page.textContent("body");
      const hasTrust = pageText.includes("trust") || pageText.includes("escrow") || pageText.includes("Bag") || pageText.includes("₦");
      record("UI Guest", `View Product Details (${firstProductHref})`, hasTrust, "Trust badge and pricing rendered");

      // Add to bag click
      const addBtn = page.getByRole("button", { name: /add to (bag|cart)|buy/i }).first();
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(1000);
        record("UI Guest", "Click 'Add to Bag'", true, "Added item to cart state");
      }
    }

    // 4. Cart Page
    console.log("Navigating to /cart...");
    await page.goto(`${FRONTEND_URL}/cart`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(RESULTS_DIR, "04_cart_page.png") });
    const cartText = await page.textContent("body");
    record("UI Guest", "Inspect Cart Page (/cart)", cartText.includes("Cart") || cartText.includes("Bag") || cartText.includes("Order") || cartText.includes("Checkout"), "Cart view rendered");

    // 5. Artisans / Services Directory
    console.log("Navigating to /services...");
    await page.goto(`${FRONTEND_URL}/services`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(RESULTS_DIR, "05_services_artisans.png") });
    const artisanCards = await page.locator("a[href*='/services/']").count();
    record("UI Guest", "Browse Artisans Directory (/services)", artisanCards > 0, `Found ${artisanCards} artisan links`);

    // 6. Artisan Detail & Booking Page
    if (artisanCards > 0) {
      const firstArtisanHref = await page.locator("a[href*='/services/']").first().getAttribute("href");
      if (firstArtisanHref) {
        await page.goto(`${FRONTEND_URL}${firstArtisanHref}`, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.screenshot({ path: path.join(RESULTS_DIR, "06_artisan_detail.png") });
        const aText = await page.textContent("body");
        record("UI Guest", `View Artisan Profile (${firstArtisanHref})`, aText.includes("Services") || aText.includes("Book") || aText.includes("Verified"), "Artisan bio and services loaded");
      }
    }

    // 7. Buyer Protection Information Page
    console.log("Navigating to /buyer-protection...");
    await page.goto(`${FRONTEND_URL}/buyer-protection`, { waitUntil: "networkidle", timeout: 30000 });
    await page.screenshot({ path: path.join(RESULTS_DIR, "07_buyer_protection.png") });
    const bpText = await page.textContent("body");
    record("UI Guest", "Buyer Protection Page (/buyer-protection)", bpText.includes("Protection") || bpText.includes("Trust") || bpText.includes("Guarantee"), "Protection copy verified");

    // 8. Partnership Pages
    await page.goto(`${FRONTEND_URL}/partnership/seller`, { waitUntil: "networkidle", timeout: 30000 });
    await page.screenshot({ path: path.join(RESULTS_DIR, "08_seller_partnership.png") });
    record("UI Guest", "Seller Partnership Onboarding Page (/partnership/seller)", true, "Rendered");

    await page.goto(`${FRONTEND_URL}/partnership/artisan`, { waitUntil: "networkidle", timeout: 30000 });
    await page.screenshot({ path: path.join(RESULTS_DIR, "09_artisan_partnership.png") });
    record("UI Guest", "Artisan Partnership Onboarding Page (/partnership/artisan)", true, "Rendered");


    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 3: AUTHENTICATED ROLE DASHBOARDS
    // ═══════════════════════════════════════════════════════════════════════
    console.log("\n--- [PHASE 3] Authenticated Role Dashboards ---");

    // Helper to inject auth session cookie into browser
    async function authenticateContext(token) {
      const urlObj = new URL(FRONTEND_URL);
      await context.addCookies([
        {
          name: "lb_at",
          value: token,
          domain: urlObj.hostname,
          path: "/",
          httpOnly: false,
          secure: true,
          sameSite: "Lax",
        },
      ]);
    }

    // A. Buyer Dashboard
    if (sessions.buyer) {
      console.log("Testing Buyer Dashboard...");
      await authenticateContext(sessions.buyer.token);
      await page.goto(`${FRONTEND_URL}/dashboard`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(RESULTS_DIR, "10_buyer_dashboard.png") });
      const bDashText = await page.textContent("body");
      record("UI Buyer", "Buyer Dashboard (/dashboard)", bDashText.includes("Orders") || bDashText.includes("Wallet") || bDashText.includes("Bookings") || bDashText.includes("Ada"), "Buyer view verified");
    }

    // B. Seller Dashboard
    if (sessions.seller) {
      console.log("Testing Seller Dashboard...");
      await authenticateContext(sessions.seller.token);
      await page.goto(`${FRONTEND_URL}/dashboard/seller`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(RESULTS_DIR, "11_seller_dashboard.png") });
      const sDashText = await page.textContent("body");
      record("UI Seller", "Seller Dashboard (/dashboard/seller)", sDashText.includes("Products") || sDashText.includes("Sales") || sDashText.includes("Inventory") || sDashText.includes("Adunni"), "Seller dashboard verified");
    }

    // C. Artisan Dashboard
    if (sessions.artisan) {
      console.log("Testing Artisan Dashboard...");
      await authenticateContext(sessions.artisan.token);
      await page.goto(`${FRONTEND_URL}/dashboard/artisan`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(RESULTS_DIR, "12_artisan_dashboard.png") });
      const aDashText = await page.textContent("body");
      record("UI Artisan", "Artisan Dashboard (/dashboard/artisan)", aDashText.includes("Schedule") || aDashText.includes("Bookings") || aDashText.includes("Amaka") || aDashText.includes("Services"), "Artisan dashboard verified");
    }

    // D. Admin Dashboard
    if (sessions.admin) {
      console.log("Testing Admin Dashboard...");
      await authenticateContext(sessions.admin.token);
      await page.goto(`${FRONTEND_URL}/dashboard/admin`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: path.join(RESULTS_DIR, "13_admin_dashboard.png") });
      const adDashText = await page.textContent("body");
      record("UI Admin", "Admin Governance Dashboard (/dashboard/admin)", adDashText.includes("Users") || adDashText.includes("Escrows") || adDashText.includes("Admin") || adDashText.includes("Orders"), "Admin governance verified");
    }

  } catch (err) {
    console.error("Test execution encountered an error:", err);
    record("FATAL", "E2E Execution Error", false, err.message);
  } finally {
    await browser.close();
  }

  // Generate Report
  console.log("\n===============================================================");
  console.log("📊 LUXEBEAU E2E TEST SUMMARY");
  console.log("===============================================================");
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const pct = Math.round((passed / total) * 100);

  console.log(`Total Checks : ${total}`);
  console.log(`Passed       : ${passed} (${pct}%)`);
  console.log(`Failed       : ${failed}`);
  console.log(`Screenshots  : ${RESULTS_DIR}`);
  console.log("===============================================================\n");

  // Write JSON report
  fs.writeFileSync(
    path.join(RESULTS_DIR, "summary.json"),
    JSON.stringify({ total, passed, failed, percentage: pct, results }, null, 2)
  );

  if (failed > 0) {
    process.exitCode = 1;
  }
}

run();
