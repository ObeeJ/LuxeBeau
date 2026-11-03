#!/usr/bin/env node

/**
 * End-to-End Payment Lifecycle & Financial Invariants Integration Test
 *
 * Verifies:
 * 1. Order creation in pending status
 * 2. Unsigned webhook rejected with 401
 * 3. Invalid signature rejected with 401
 * 4. Tampered amount handled safely (amount_invalid, order stays pending)
 * 5. Legitimate Paystack charge.success webhook with HMAC-SHA512
 * 6. Order transition to paid and escrow funding
 * 7. Duplicate webhook idempotency (outcome: ignored, no double crediting)
 * 8. Order verification endpoint
 */

const crypto = require("crypto");

const API_BASE = process.env.API_BASE || "https://luxebeau-api.onrender.com/api/v1";
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || "sk_test_e99eb614f281d0953422461442593ffc90b370fa";

function signHMAC(secret, body) {
  return crypto.createHmac("sha512", secret).update(body).digest("hex");
}

let cookieJar = "";

async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-LuxeBeau-Client": "web",
    ...(cookieJar ? { "Cookie": cookieJar } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [setCookie];
    const pairs = rawCookies.map(c => c.split(";")[0]);
    cookieJar = pairs.join("; ");
  }

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return { status: res.status, ok: res.ok, data: json };
}

async function run() {
  console.log("===============================================================================");
  console.log(" LUXEBEAU PAYMENT LIFECYCLE & FINANCIAL INVARIANTS E2E AUDIT");
  console.log(` Target API: ${API_BASE}`);
  console.log("===============================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, desc) {
    total++;
    if (condition) {
      console.log(`  ✓ [CHECK ${total}] ${desc}`);
      passed++;
    } else {
      console.error(`  ✗ [CHECK ${total}] FAILED: ${desc}`);
      process.exitCode = 1;
    }
  }

  // 1. Authenticate Buyer
  console.log("--- 1. Authenticating Buyer Account ---");
  const loginRes = await api("/auth/login", {
    method: "POST",
    body: { email: "buyer@luxebeau.ng", password: "TestLuxeBeau2026!" },
  });
  assert(loginRes.status === 200 && loginRes.data?.success, "Buyer login successful (HTTP 200)");

  // 2. Fetch Products
  console.log("\n--- 2. Fetching Products from Catalog ---");
  const prodRes = await api("/products");
  assert(prodRes.status === 200 && prodRes.data?.data?.products?.length > 0, "Catalog returned available products");
  const products = prodRes.data.data.products;
  const prod = products[0];
  console.log(`    Selected product: "${prod.name}" (ID: ${prod.id}, Price: ₦${prod.price / 100})`);

  // 3. Create Pending Order with Card Payment Method
  console.log("\n--- 3. Creating Pending Card Order ---");
  const orderRes = await api("/orders", {
    method: "POST",
    body: {
      items: [{ product_id: prod.id, qty: 1 }],
      address: "10 Victoria Island, Lagos",
      city: "Lagos",
      state: "Lagos",
      phone: "+2348011112222",
      pay_method: "card",
    },
  });
  assert(orderRes.status === 201 && orderRes.data?.success, "Order creation returned HTTP 201 Created");
  const order = orderRes.data.data.order;
  assert(order?.id?.startsWith("LB-"), `Order ID correctly generated: ${order?.id}`);
  assert(order?.payment_status === "pending", `Order initial payment_status is 'pending' (actual: ${order?.payment_status})`);
  assert(typeof order?.total === "number" && order.total > 0, `Order total is valid kobo integer: ${order?.total}`);

  // 4. Security Check: Unsigned Webhook
  console.log("\n--- 4. Security Check: Unsigned Webhook Rejection ---");
  const rawPayload = JSON.stringify({
    event: "charge.success",
    data: {
      reference: order.id,
      status: "success",
      amount: order.total,
      currency: "NGN",
    },
  });

  const unsignedRes = await fetch(`${API_BASE}/webhooks/paystack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawPayload,
  });
  assert(unsignedRes.status === 401, `Unsigned webhook correctly rejected with HTTP 401 (got ${unsignedRes.status})`);

  // 5. Security Check: Invalid HMAC Signature
  console.log("\n--- 5. Security Check: Invalid Signature Rejection ---");
  const badSigRes = await fetch(`${API_BASE}/webhooks/paystack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": "deadbeefcafebabe0000111122223333444455556666777788889999aaaabbbb",
    },
    body: rawPayload,
  });
  assert(badSigRes.status === 401, `Tampered signature webhook rejected with HTTP 401 (got ${badSigRes.status})`);

  // 6. Security Check: Tampered Amount (Underpayment Attack)
  console.log("\n--- 6. Security Check: Tampered Amount Underpayment Defense ---");
  const tamperedPayload = JSON.stringify({
    event: "charge.success",
    data: {
      reference: order.id,
      status: "success",
      amount: 10000, // ₦100 instead of actual order total
      currency: "NGN",
    },
  });
  const tamperedSig = signHMAC(PAYSTACK_SECRET, tamperedPayload);
  const tamperedRes = await fetch(`${API_BASE}/webhooks/paystack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": tamperedSig,
    },
    body: tamperedPayload,
  });
  const tamperedJson = await tamperedRes.json();
  assert(tamperedRes.status === 200, "Webhook acknowledges receipt with HTTP 200 (avoids provider spam)");
  assert(tamperedJson?.data?.outcome === "amount_invalid", `Tampered amount flagged as 'amount_invalid' (actual: ${tamperedJson?.data?.outcome})`);

  // Verify order is STILL pending
  const verifyStillPending = await api(`/orders/${order.id}`);
  assert(verifyStillPending.data?.data?.order?.payment_status === "pending", "Order payment_status remains 'pending' after underpayment attack");

  // 7. Legitimate Payment Simulation
  console.log("\n--- 7. Legitimate Paystack Webhook Processing ---");
  const validSig = signHMAC(PAYSTACK_SECRET, rawPayload);
  const validRes = await fetch(`${API_BASE}/webhooks/paystack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": validSig,
    },
    body: rawPayload,
  });
  const validJson = await validRes.json();
  assert(validRes.status === 200, "Valid webhook accepted with HTTP 200");
  assert(validJson?.data?.outcome === "paid", `Payment outcome is 'paid' (actual: ${validJson?.data?.outcome})`);

  // 8. Verify Order State & Escrow Holds
  console.log("\n--- 8. Verifying Order Transition & Escrow Invariants ---");
  const paidOrderRes = await api(`/orders/${order.id}`);
  const paidOrder = paidOrderRes.data?.data?.order;
  assert(paidOrder?.payment_status === "paid", `Order payment_status transitioned to 'paid' (actual: ${paidOrder?.payment_status})`);
  assert(paidOrder?.holds?.length > 0, `Escrow holds created for order (count: ${paidOrder?.holds?.length})`);
  const hold = paidOrder?.holds?.[0];
  assert(hold?.state === "funded", `Escrow hold state is 'funded' (actual: ${hold?.state})`);
  assert(typeof hold?.net === "number" && hold.net > 0, `Escrow hold net amount calculated correctly: ₦${hold?.net / 100}`);

  // 9. Concurrency / Idempotency Check: Duplicate Webhook Delivery
  console.log("\n--- 9. Idempotency Check: Duplicate Webhook Delivery ---");
  const duplicateRes = await fetch(`${API_BASE}/webhooks/paystack`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-paystack-signature": validSig,
    },
    body: rawPayload,
  });
  const duplicateJson = await duplicateRes.json();
  assert(duplicateRes.status === 200, "Duplicate webhook accepted with HTTP 200");
  assert(duplicateJson?.data?.outcome === "ignored", `Duplicate payment safely ignored (outcome: 'ignored', actual: ${duplicateJson?.data?.outcome})`);

  // Verify holds count did not duplicate
  const recheckedOrder = await api(`/orders/${order.id}`);
  assert(recheckedOrder.data?.data?.order?.holds?.length === paidOrder.holds.length, "Hold count remained identical (no duplicate escrows created)");

  // 10. Summary
  console.log("\n===============================================================================");
  console.log(` RESULTS: ${passed}/${total} checks passed (${Math.round((passed / total) * 100)}%)`);
  console.log("===============================================================================");

  if (passed === total) {
    console.log("✓ Full payment lifecycle and financial invariants verified successfully!\n");
  } else {
    console.error("✗ Some payment audit checks failed.\n");
    process.exit(1);
  }
}

run().catch(err => {
  console.error("Fatal error running payment audit:", err);
  process.exit(1);
});
