/* Admin revenue: response schema, query hook and pure date/summing helpers.
   All money from the API is kobo (integer); show it with formatKobo. */
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { formatNaira } from "@/lib/format";

export type Group = "day" | "week" | "month";
export const MAX_RANGE_DAYS = 366;

const kobo = z.number().int();

export const revenueResponseSchema = z.object({
  range: z.object({ from: z.string(), to: z.string(), group: z.enum(["day", "week", "month"]) }),
  totals: z.object({
    platform_fees: kobo,
    ad_revenue: kobo,
    fee_refunds: kobo,
    net: kobo,
    estimated_vat: kobo,
    processing_fees_collected: kobo,
    orders_paid: z.number().int(),
    ads_paid: z.number().int(),
  }),
  series: z
    .array(z.object({ period: z.string(), platform_fees: kobo, ad_revenue: kobo, fee_refunds: kobo, net: kobo }))
    .nullish()
    .transform(v => v ?? []),
  health: z.object({ unbalanced_escrows: z.number().int() }),
});
export type RevenueResponse = z.infer<typeof revenueResponseSchema>;
export type RevenuePoint = RevenueResponse["series"][number];

export function fetchRevenue(from: string, to: string, group: Group): Promise<RevenueResponse> {
  const qs = new URLSearchParams({ from, to, group });
  return apiFetch(`/admin/revenue?${qs}`, revenueResponseSchema);
}

export function useAdminRevenue(from: string, to: string, group: Group, enabled = true) {
  return useQuery({
    queryKey: ["admin", "revenue", from, to, group],
    queryFn: () => fetchRevenue(from, to, group),
    enabled,
    retry: (count, err) => (err as { status?: number })?.status !== 403 && count < 1,
  });
}

/** Kobo to a naira string, e.g. 500000 -> "₦5,000". */
export function formatKobo(k: number): string {
  return formatNaira(k / 100);
}

/* ── Dates: plain calendar maths (no timezone involved) ── */

const pad = (n: number) => String(n).padStart(2, "0");

/** YYYY-MM-DD from a Date's LOCAL calendar fields (never toISOString, which shifts by timezone). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? { y, m, d } : null;
}

function dayNumber(s: string): number | null {
  const p = parseISODate(s);
  return p ? Date.UTC(p.y, p.m - 1, p.d) / 86_400_000 : null;
}

/** Add days to an ISO date string. */
export function addDays(s: string, n: number): string {
  const p = parseISODate(s);
  if (!p) return s;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Days in the inclusive range, or null if either date is invalid. */
export function rangeDays(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a + 1;
}

export type PresetId = "last7" | "last30" | "thisMonth" | "lastMonth";
export const PRESETS: { id: PresetId; label: string }[] = [
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
];

/** Inclusive from/to for a preset, relative to `now` in the user's local calendar. */
export function presetRange(id: PresetId, now: Date = new Date()): { from: string; to: string } {
  const today = toISODate(now);
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  switch (id) {
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "thisMonth":
      return { from: toISODate(new Date(y, m, 1)), to: today };
    case "lastMonth":
      return { from: toISODate(new Date(y, m - 1, 1)), to: toISODate(new Date(y, m, 0)) };
  }
}

/** Which preset (if any) matches this range exactly. */
export function matchPreset(from: string, to: string, now: Date = new Date()): PresetId | null {
  for (const p of PRESETS) {
    const r = presetRange(p.id, now);
    if (r.from === from && r.to === to) return p.id;
  }
  return null;
}

/** A plain-language problem with the range, or "" when it is fine. */
export function validateRange(from: string, to: string): string {
  const days = rangeDays(from, to);
  if (!from || !to) return "Choose both a start and an end date.";
  if (days === null) return "Enter valid dates.";
  if (days < 1) return "The start date must be on or before the end date.";
  if (days > MAX_RANGE_DAYS) return `Choose at most ${MAX_RANGE_DAYS} days.`;
  return "";
}

/* ── Series helpers ── */

export function sumSeries(series: RevenuePoint[]) {
  return series.reduce(
    (a, p) => ({
      platform_fees: a.platform_fees + p.platform_fees,
      ad_revenue: a.ad_revenue + p.ad_revenue,
      fee_refunds: a.fee_refunds + p.fee_refunds,
      net: a.net + p.net,
    }),
    { platform_fees: 0, ad_revenue: 0, fee_refunds: 0, net: 0 },
  );
}

/** True when nothing at all was earned, refunded or counted in the range. */
export function isEmptyRevenue(r: RevenueResponse): boolean {
  const t = r.totals;
  return t.platform_fees === 0 && t.ad_revenue === 0 && t.fee_refunds === 0 && t.net === 0 && t.orders_paid === 0 && t.ads_paid === 0;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Short label for a period start: "9 Nov" (day/week) or "Nov 2026" (month). */
export function periodLabel(period: string, group: Group): string {
  const p = parseISODate(period);
  if (!p) return period;
  return group === "month" ? `${MONTHS[p.m - 1]} ${p.y}` : `${p.d} ${MONTHS[p.m - 1]}`;
}

/** Percent change vs a previous value; null when the previous value is zero. */
export function percentChange(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / Math.abs(previous)) * 100);
}
