import { orderResultSchema } from "@/lib/api";
import { breakdownAddsUp, buildBreakdown, chargesProcessingFee, formatKoboNaira, hasCity, normalizeItems, quoteKey, quoteSchema } from "@/lib/quote";

const q = { subtotalKobo: 500_000, deliveryFeeKobo: 150_000, platformFeeKobo: 17_500, processingFeeKobo: 10_000, totalKobo: 677_500 };

describe("quoteSchema", () => {
  it("maps the server quote to camelCase kobo", () => {
    expect(quoteSchema.parse({ quote: { subtotal: 500000, delivery_fee: 150000, platform_fee: 17500, processing_fee: 10000, total: 677500 } })).toEqual(q);
  });
  it("defaults a missing processing fee to 0", () => {
    expect(quoteSchema.parse({ quote: { subtotal: 1, delivery_fee: 2, platform_fee: 3, total: 6 } }).processingFeeKobo).toBe(0);
  });
  it("rejects fractional kobo", () => {
    expect(quoteSchema.safeParse({ quote: { subtotal: 1.5, delivery_fee: 0, platform_fee: 0, total: 1 } }).success).toBe(false);
  });
});

describe("buildBreakdown", () => {
  it("includes processing fee for card, transfer, ussd", () => {
    for (const m of ["card", "transfer", "ussd"] as const) {
      expect(buildBreakdown(q, m).rows.map(r => r.key)).toEqual(["subtotal", "delivery", "platform", "processing"]);
    }
  });
  it("omits processing fee for wallet and keeps the server total", () => {
    const b = buildBreakdown(q, "wallet");
    expect(b.rows.map(r => r.key)).toEqual(["subtotal", "delivery", "platform"]);
    expect(b.totalKobo).toBe(677_500);
  });
  it("chargesProcessingFee", () => {
    expect(chargesProcessingFee("wallet")).toBe(false);
    expect(chargesProcessingFee("card")).toBe(true);
  });
});

describe("breakdownAddsUp", () => {
  it("true when parts equal total, false otherwise", () => {
    expect(breakdownAddsUp(q)).toBe(true);
    expect(breakdownAddsUp({ ...q, totalKobo: 1 })).toBe(false);
  });
});

describe("formatKoboNaira", () => {
  it("hides .00 and shows real kobo", () => {
    expect(formatKoboNaira(150_000)).toContain("1,500");
    expect(formatKoboNaira(150_000)).not.toContain(".");
    expect(formatKoboNaira(17_550)).toContain("175.50");
  });
});

describe("items and city", () => {
  it("normalizeItems merges and sorts so keys are stable", () => {
    const a = normalizeItems([{ product_id: 2, qty: 1 }, { product_id: 1, qty: 1 }, { product_id: 2, qty: 2 }]);
    expect(a).toEqual([{ product_id: 1, qty: 1 }, { product_id: 2, qty: 3 }]);
    expect(quoteKey([{ product_id: 2, qty: 1 }, { product_id: 1, qty: 1 }], " Lagos ", "card")).toEqual(
      quoteKey([{ product_id: 1, qty: 1 }, { product_id: 2, qty: 1 }], "lagos", "card"),
    );
  });
  it("hasCity needs 2+ characters", () => {
    expect(hasCity(" a ")).toBe(false);
    expect(hasCity("Lekki")).toBe(true);
  });
});

describe("orderResultSchema fees", () => {
  it("exposes platform and processing fees and keeps old fields", () => {
    const r = orderResultSchema.parse({ order: { id: "o1", total: 677500, subtotal: 500000, delivery_fee: 150000, platform_fee: 17500, processing_fee: 10000 } });
    expect(r).toMatchObject({ totalKobo: 677500, totalNGN: 6775, deliveryFeeKobo: 150000, platformFeeKobo: 17500, processingFeeKobo: 10000, subtotalKobo: 500000 });
  });
  it("defaults missing fees to 0", () => {
    const r = orderResultSchema.parse({ order: { id: "o1", total: 100 } });
    expect(r.platformFeeKobo).toBe(0);
    expect(r.processingFeeKobo).toBe(0);
  });
});
