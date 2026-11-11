import { type MyBooking } from "@/lib/api";
import {
  NO_SHOW_GRACE_MS, canCancel, canComplete, canNoShow, cancelInputSchema, cleanReason, completeBlockedReason,
  freeCancelText, isLateCancel, noShowBlockedReason,
} from "./booking-actions";

const START = Date.parse("2026-11-15T14:00:00+01:00"); // 14:00 Lagos
const b = (o: Partial<MyBooking> = {}) => ({ date: "2026-11-15", time: "14:00", status: "confirmed", policyHours: 24, freeCancelUntil: null, ...o }) as MyBooking;

describe("can complete / no-show", () => {
  it("complete opens exactly at the start", () => {
    expect(canComplete(b(), START - 1)).toBe(false);
    expect(canComplete(b(), START)).toBe(true);
    expect(completeBlockedReason(b(), START - 1)).toBe("Available after the appointment starts.");
    expect(completeBlockedReason(b(), START)).toBe("");
  });
  it("no-show waits for the 15 minute grace", () => {
    expect(NO_SHOW_GRACE_MS).toBe(15 * 60 * 1000);
    expect(canNoShow(b(), START + NO_SHOW_GRACE_MS - 1)).toBe(false);
    expect(canNoShow(b(), START + NO_SHOW_GRACE_MS)).toBe(true);
    expect(noShowBlockedReason(b(), START)).toContain("15 minutes after the start time");
    expect(noShowBlockedReason(b(), START)).toContain("2:15 PM"); // Lagos time, not UTC
  });
  it("needs a confirmed booking", () => {
    for (const status of ["pending", "cancelled", "completed", "no_show"]) {
      expect(canComplete(b({ status }), START + 1e7)).toBe(false);
      expect(canNoShow(b({ status }), START + 1e7)).toBe(false);
    }
  });
});

describe("can cancel", () => {
  it("only open bookings that have not started", () => {
    expect(canCancel(b({ status: "pending" }), START - 1)).toBe(true);
    expect(canCancel(b(), START - 1)).toBe(true);
    expect(canCancel(b(), START)).toBe(false);
    expect(canCancel(b({ status: "completed" }), START - 1e6)).toBe(false);
    expect(canCancel(b({ status: "cancelled" }), START - 1e6)).toBe(false);
  });
});

describe("late cancellation", () => {
  const until = new Date(START - 24 * 3600e3).toISOString();
  it("is late only for a client cancelling a confirmed booking past the deadline", () => {
    expect(isLateCancel(b({ freeCancelUntil: until }), "client", START - 24 * 3600e3 - 1)).toBe(false);
    expect(isLateCancel(b({ freeCancelUntil: until }), "client", START - 24 * 3600e3)).toBe(false); // server: start-now < policy, strict
    expect(isLateCancel(b({ freeCancelUntil: until }), "client", START - 24 * 3600e3 + 1)).toBe(true);
    expect(isLateCancel(b({ freeCancelUntil: until }), "artisan", START - 1000)).toBe(false);
    expect(isLateCancel(b({ freeCancelUntil: until, status: "pending" }), "client", START - 1000)).toBe(false);
    expect(isLateCancel(b({ freeCancelUntil: null }), "client", START - 1000)).toBe(false);
  });
});

describe("deadline text", () => {
  const until = new Date(START - 24 * 3600e3).toISOString();
  it("shows the deadline in Lagos time while it is in the future", () => {
    expect(freeCancelText(b({ freeCancelUntil: until }), START - 48 * 3600e3)).toBe("Free to cancel until Sat 14 Nov, 2:00 PM.");
  });
  it("says it ended after the deadline", () => {
    expect(freeCancelText(b({ freeCancelUntil: until }), START - 3600e3)).toMatch(/Free cancellation ended/);
  });
  it("handles pending, zero-hour and closed bookings", () => {
    expect(freeCancelText(b({ status: "pending" }), 0)).toMatch(/withdraw/);
    expect(freeCancelText(b({ policyHours: 0 }), 0)).toMatch(/any time/);
    expect(freeCancelText(b({ status: "cancelled" }), 0)).toBe("");
  });
});

describe("reason", () => {
  it("is trimmed and capped at 300", () => {
    expect(cleanReason("  hi  ")).toBe("hi");
    expect(cleanReason("x".repeat(400))).toHaveLength(300);
    expect(cancelInputSchema.safeParse({ id: "BK-1", reason: "x".repeat(301) }).success).toBe(false);
    expect(cancelInputSchema.safeParse({ id: "BK-1" }).success).toBe(true);
  });
});
