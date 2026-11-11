import {
  adActions, adStatusBadge, adminAdsResponseSchema, canActivate, clickThroughRate, formatPrice, matchesFilter,
  pageCount, planLabel, remainingDaysText, statusErrorMessage,
} from "./admin-ads";

const paid = "2026-11-01T10:00:00Z";

describe("status badge", () => {
  it("maps statuses when paid", () => {
    expect(adStatusBadge({ status: "active", paid_at: paid })).toEqual({ label: "Active", tone: "live" });
    expect(adStatusBadge({ status: "paused", paid_at: paid }).label).toBe("Paused");
    expect(adStatusBadge({ status: "expired", paid_at: paid }).label).toBe("Expired");
  });
  it("shows Awaiting payment for unpaid ads, but Expired stays Expired", () => {
    expect(adStatusBadge({ status: "pending", paid_at: null })).toEqual({ label: "Awaiting payment", tone: "wait" });
    expect(adStatusBadge({ status: "paused", paid_at: null }).label).toBe("Awaiting payment");
    expect(adStatusBadge({ status: "expired", paid_at: null }).label).toBe("Expired");
  });
});

describe("can activate / actions", () => {
  it("only paid, non-expired ads can activate", () => {
    expect(canActivate({ status: "paused", paid_at: paid })).toBe(true);
    expect(canActivate({ status: "pending", paid_at: null })).toBe(false);
    expect(canActivate({ status: "expired", paid_at: paid })).toBe(false);
  });
  it("never offers activate on unpaid ads", () => {
    for (const status of ["pending", "paused", "active"]) {
      expect(adActions({ status, paid_at: null }).some(a => a.status === "active")).toBe(false);
    }
  });
  it("offers pause on active, resume on paid paused, confirmed expire", () => {
    expect(adActions({ status: "active", paid_at: paid }).map(a => a.label)).toEqual(["Pause", "Expire now"]);
    expect(adActions({ status: "paused", paid_at: paid }).map(a => a.label)).toEqual(["Resume", "Expire now"]);
    expect(adActions({ status: "active", paid_at: paid }).find(a => a.status === "expired")?.confirm).toBe(true);
    expect(adActions({ status: "expired", paid_at: paid })).toEqual([]);
  });
});

describe("click-through rate", () => {
  it("is 0% with zero impressions", () => {
    expect(clickThroughRate(5, 0)).toBe("0%");
    expect(clickThroughRate(0, 0)).toBe("0%");
    expect(clickThroughRate(NaN, 10)).toBe("0%");
  });
  it("computes and rounds", () => {
    expect(clickThroughRate(1, 3)).toBe("33%");
    expect(clickThroughRate(1, 40)).toBe("2.5%");
    expect(clickThroughRate(10, 10)).toBe("100%");
  });
});

describe("price and plan", () => {
  it("formats kobo as naira", () => {
    expect(formatPrice(500000)).toBe("₦5,000");
    expect(formatPrice(0)).toBe("₦0");
    expect(formatPrice(NaN)).toBe("₦0");
  });
  it("labels plans", () => {
    expect(planLabel("7_days")).toBe("7 days");
    expect(planLabel("annual")).toBe("Annual");
    expect(planLabel("")).toBe("Unknown");
  });
});

describe("remaining days", () => {
  const now = new Date("2026-11-10T12:00:00Z");
  it("handles boundaries", () => {
    expect(remainingDaysText("2026-11-10T12:00:00Z", now)).toBe("Ended");
    expect(remainingDaysText("2026-11-10T11:00:00Z", now)).toBe("Ended");
    expect(remainingDaysText("2026-11-10T12:00:01Z", now)).toBe("Ends today");
    expect(remainingDaysText("2026-11-11T12:00:00Z", now)).toBe("Ends today");
    expect(remainingDaysText("2026-11-11T12:00:01Z", now)).toBe("2 days left");
    expect(remainingDaysText("2026-11-17T12:00:00Z", now)).toBe("7 days left");
  });
  it("is empty for missing or bad dates", () => {
    expect(remainingDaysText(null, now)).toBe("");
    expect(remainingDaysText("nope", now)).toBe("");
  });
});

describe("filters and paging", () => {
  it("matches chips", () => {
    expect(matchesFilter({ status: "pending", paid_at: null }, "unpaid")).toBe(true);
    expect(matchesFilter({ status: "active", paid_at: paid }, "unpaid")).toBe(false);
    expect(matchesFilter({ status: "paused", paid_at: paid }, "paused")).toBe(true);
    expect(matchesFilter({ status: "expired", paid_at: null }, "unpaid")).toBe(false);
  });
  it("counts pages", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
  });
});

describe("schema", () => {
  it("accepts nulls and missing lists", () => {
    expect(adminAdsResponseSchema.parse({ ads: null, total: null })).toEqual({ ads: [], total: 0 });
    const r = adminAdsResponseSchema.parse({
      ads: [{ id: "a", title: null, image_url: null, paid_at: null, expires_at: null, amount_kobo: null, clicks_count: null }],
      total: 1,
    });
    expect(r.ads[0]).toMatchObject({ id: "a", title: "", image_url: "", paid_at: null, amount_kobo: 0, clicks_count: 0 });
  });
});

describe("error message", () => {
  it("keeps the server reason on 409", () => {
    const msg = "This ad has not been paid for yet, so it cannot go live.";
    expect(statusErrorMessage({ status: 409, message: msg })).toBe(msg);
    expect(statusErrorMessage({ status: 403, message: "x" })).toMatch(/admins/);
    expect(statusErrorMessage(null)).toMatch(/couldn't/);
  });
});
