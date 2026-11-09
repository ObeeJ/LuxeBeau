import {
  addDays, formatKobo, isEmptyRevenue, matchPreset, parseISODate, percentChange, periodLabel, presetRange,
  rangeDays, revenueResponseSchema, sumSeries, toISODate, validateRange,
} from "./revenue";

const sample = {
  range: { from: "2026-11-01", to: "2026-11-02", group: "day" },
  totals: { platform_fees: 1000, ad_revenue: 500, fee_refunds: 100, net: 1400, estimated_vat: 98, processing_fees_collected: 300, orders_paid: 2, ads_paid: 1 },
  series: [
    { period: "2026-11-01", platform_fees: 1000, ad_revenue: 0, fee_refunds: 0, net: 1000 },
    { period: "2026-11-02", platform_fees: 0, ad_revenue: 500, fee_refunds: 100, net: 400 },
  ],
  health: { unbalanced_escrows: 0 },
};

describe("dates", () => {
  it("builds local ISO dates without timezone shift", () => {
    expect(toISODate(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });
  it("adds days across month, year and leap edges", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("rejects impossible dates", () => {
    expect(parseISODate("2026-02-30")).toBeNull();
    expect(parseISODate("2026-2-3")).toBeNull();
    expect(parseISODate("2028-02-29")).not.toBeNull();
  });
  it("counts inclusive days", () => {
    expect(rangeDays("2026-11-01", "2026-11-01")).toBe(1);
    expect(rangeDays("2026-11-01", "2026-11-09")).toBe(9);
    expect(rangeDays("2026-01-01", "2026-12-31")).toBe(365);
  });
});

describe("presets", () => {
  const now = new Date(2026, 10, 9, 15, 0); // 9 Nov 2026 local
  it("last 7 / 30 days are inclusive of today", () => {
    expect(presetRange("last7", now)).toEqual({ from: "2026-11-03", to: "2026-11-09" });
    expect(presetRange("last30", now)).toEqual({ from: "2026-10-11", to: "2026-11-09" });
  });
  it("this month and last month", () => {
    expect(presetRange("thisMonth", now)).toEqual({ from: "2026-11-01", to: "2026-11-09" });
    expect(presetRange("lastMonth", now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("last month wraps the year in January", () => {
    expect(presetRange("lastMonth", new Date(2027, 0, 15))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
  it("last month handles leap February", () => {
    expect(presetRange("lastMonth", new Date(2028, 2, 5))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("this month on the 1st is a single day", () => {
    expect(presetRange("thisMonth", new Date(2026, 4, 1))).toEqual({ from: "2026-05-01", to: "2026-05-01" });
  });
  it("matches a preset or none", () => {
    expect(matchPreset("2026-11-03", "2026-11-09", now)).toBe("last7");
    expect(matchPreset("2026-11-04", "2026-11-09", now)).toBeNull();
  });
});

describe("validateRange", () => {
  it("accepts good ranges, including exactly 366 days", () => {
    expect(validateRange("2026-11-01", "2026-11-09")).toBe("");
    expect(validateRange("2026-11-01", "2026-11-01")).toBe("");
    expect(validateRange("2026-01-01", "2027-01-01")).toBe(""); // 366 days
  });
  it("rejects bad ranges", () => {
    expect(validateRange("2026-11-09", "2026-11-01")).toMatch(/on or before/);
    expect(validateRange("2026-01-01", "2027-01-02")).toMatch(/at most 366/);
    expect(validateRange("", "2026-11-01")).toMatch(/both/);
    expect(validateRange("2026-02-30", "2026-03-01")).toMatch(/valid/);
  });
});

describe("data helpers", () => {
  it("formats kobo as naira", () => {
    expect(formatKobo(500000)).toContain("5,000");
    expect(formatKobo(0)).toContain("0");
  });
  it("parses the response and tolerates a null series", () => {
    expect(revenueResponseSchema.parse(sample).series).toHaveLength(2);
    expect(revenueResponseSchema.parse({ ...sample, series: null }).series).toEqual([]);
    expect(revenueResponseSchema.safeParse({ ...sample, totals: { ...sample.totals, net: 1.5 } }).success).toBe(false);
    expect(revenueResponseSchema.safeParse({ ...sample, range: { ...sample.range, group: "year" } }).success).toBe(false);
  });
  it("sums a series", () => {
    expect(sumSeries(revenueResponseSchema.parse(sample).series)).toEqual({ platform_fees: 1000, ad_revenue: 500, fee_refunds: 100, net: 1400 });
  });
  it("detects an empty range", () => {
    const empty = { ...sample.totals, platform_fees: 0, ad_revenue: 0, fee_refunds: 0, net: 0, orders_paid: 0, ads_paid: 0 };
    expect(isEmptyRevenue(revenueResponseSchema.parse({ ...sample, totals: empty }))).toBe(true);
    expect(isEmptyRevenue(revenueResponseSchema.parse(sample))).toBe(false);
  });
  it("labels periods", () => {
    expect(periodLabel("2026-11-09", "day")).toBe("9 Nov");
    expect(periodLabel("2026-11-01", "month")).toBe("Nov 2026");
  });
  it("percent change", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(5, 0)).toBeNull();
  });
});
