import { type MyBooking } from "@/lib/api";
import { computeEarnings, lagosMonth, monthChangeText, previousMonth } from "./earnings";

const bk = (o: Partial<MyBooking>): MyBooking => ({
  id: "BK-1", service: "Braids", with: "", date: "2026-11-05", time: "10:00", priceNGN: 10000, status: "completed",
  client: "", artisan: "", serviceType: "studio", address: "", policyHours: 24, freeCancelUntil: null,
  cancelledBy: "", cancelReason: "", lateCancel: false, buyerStrikes: 0, ...o,
});
// 12:00 Lagos on 15 Nov 2026
const NOW = Date.parse("2026-11-15T12:00:00+01:00");

describe("months", () => {
  it("uses Lagos time at the boundary", () => {
    expect(lagosMonth(Date.parse("2026-10-31T23:30:00Z"))).toBe("2026-11"); // already 00:30 on 1 Nov in Lagos
    expect(lagosMonth(Date.parse("2026-10-31T22:30:00Z"))).toBe("2026-10");
  });
  it("wraps January", () => {
    expect(previousMonth("2026-01")).toBe("2025-12");
    expect(previousMonth("2026-03")).toBe("2026-02");
  });
});

describe("computeEarnings", () => {
  it("handles an empty list", () => {
    expect(computeEarnings([], NOW)).toEqual({
      completedJobs: 0, totalNGN: 0, thisMonthNGN: 0, lastMonthNGN: 0, thisMonthJobs: 0, lastMonthJobs: 0,
      upcomingNGN: 0, upcomingJobs: 0, byService: [],
    });
  });
  it("counts only completed jobs and splits months", () => {
    const e = computeEarnings([
      bk({ date: "2026-11-01", priceNGN: 15000 }),
      bk({ date: "2026-10-31", priceNGN: 8000 }),
      bk({ date: "2026-09-30", priceNGN: 5000 }),
    ], NOW);
    expect(e).toMatchObject({ completedJobs: 3, totalNGN: 28000, thisMonthNGN: 15000, lastMonthNGN: 8000, thisMonthJobs: 1, lastMonthJobs: 1 });
  });
  it("excludes cancelled, no-show and pending", () => {
    const e = computeEarnings([bk({ status: "cancelled" }), bk({ status: "no_show" }), bk({ status: "pending" })], NOW);
    expect(e.completedJobs).toBe(0);
    expect(e.totalNGN).toBe(0);
    expect(e.upcomingNGN).toBe(0);
  });
  it("sums upcoming confirmed value for future starts only", () => {
    const e = computeEarnings([
      bk({ status: "confirmed", date: "2026-11-20", priceNGN: 12000 }),
      bk({ status: "confirmed", date: "2026-11-15", time: "13:00", priceNGN: 3000 }),
      bk({ status: "confirmed", date: "2026-11-15", time: "11:00", priceNGN: 9999 }), // started: not upcoming
    ], NOW);
    expect(e.upcomingNGN).toBe(15000);
    expect(e.upcomingJobs).toBe(2);
  });
  it("breaks down by service, biggest first, ties by name", () => {
    const e = computeEarnings([
      bk({ service: "Braids", priceNGN: 10000 }),
      bk({ service: "Braids", priceNGN: 10000 }),
      bk({ service: "Makeup", priceNGN: 25000 }),
      bk({ service: "Gele", priceNGN: 20000 }),
    ], NOW);
    expect(e.byService).toEqual([
      { service: "Gele", jobs: 1, valueNGN: 20000 },
      { service: "Braids", jobs: 2, valueNGN: 20000 },
      { service: "Makeup", jobs: 1, valueNGN: 25000 },
    ].sort((a, b) => b.valueNGN - a.valueNGN || b.jobs - a.jobs || a.service.localeCompare(b.service)));
  });
  it("keeps whole-naira amounts exact and ignores bad values", () => {
    const e = computeEarnings([bk({ priceNGN: 1234 }), bk({ priceNGN: NaN }), bk({ priceNGN: -5 })], NOW);
    expect(e.totalNGN).toBe(1234);
    expect(e.completedJobs).toBe(3);
  });
});

describe("monthChangeText", () => {
  it("describes the change", () => {
    expect(monthChangeText(150, 100)).toBe("50% more than last month.");
    expect(monthChangeText(50, 100)).toBe("50% less than last month.");
    expect(monthChangeText(100, 100)).toBe("Same as last month.");
    expect(monthChangeText(100, 0)).toBe("Nothing recorded last month.");
    expect(monthChangeText(0, 0)).toBe("");
  });
});
