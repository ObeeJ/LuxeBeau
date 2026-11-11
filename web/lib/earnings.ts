import { type MyBooking } from "@/lib/api";
import { bookingStart } from "@/lib/format";

/* Earnings are worked out only from the bookings the API already returns.
   Clients pay the artisan directly (bookings take no online payment), so
   these figures are the RECORDED VALUE of completed jobs, not wallet money.
   Amounts are whole naira, exactly as MyBooking.priceNGN carries them (the
   API sends kobo; toMyBooking converts). Months follow Lagos time (UTC+1
   all year) and use the booking's own date, the same day the client sees. */

export interface ServiceEarnings {
  service: string;
  jobs: number;
  valueNGN: number;
}

export interface Earnings {
  completedJobs: number;
  totalNGN: number;
  thisMonthNGN: number;
  lastMonthNGN: number;
  thisMonthJobs: number;
  lastMonthJobs: number;
  upcomingNGN: number;
  upcomingJobs: number;
  byService: ServiceEarnings[];
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const value = (b: Pick<MyBooking, "priceNGN">) => (Number.isFinite(b.priceNGN) && b.priceNGN > 0 ? b.priceNGN : 0);

/** "YYYY-MM" of an instant in Lagos. */
export function lagosMonth(ms: number): string {
  return new Date(ms + LAGOS_OFFSET_MS).toISOString().slice(0, 7);
}

/** The month before a "YYYY-MM" key (handles January to December). */
export function previousMonth(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function computeEarnings(bookings: readonly MyBooking[], now: number): Earnings {
  const thisMonth = lagosMonth(now);
  const lastMonth = previousMonth(thisMonth);
  const out: Earnings = {
    completedJobs: 0, totalNGN: 0, thisMonthNGN: 0, lastMonthNGN: 0, thisMonthJobs: 0, lastMonthJobs: 0,
    upcomingNGN: 0, upcomingJobs: 0, byService: [],
  };
  const services = new Map<string, ServiceEarnings>();

  for (const b of bookings) {
    if (b.status === "completed") {
      const v = value(b);
      out.completedJobs += 1;
      out.totalNGN += v;
      const month = b.date.slice(0, 7);
      if (month === thisMonth) { out.thisMonthNGN += v; out.thisMonthJobs += 1; }
      else if (month === lastMonth) { out.lastMonthNGN += v; out.lastMonthJobs += 1; }
      const name = b.service || "Service";
      const row = services.get(name) ?? { service: name, jobs: 0, valueNGN: 0 };
      row.jobs += 1;
      row.valueNGN += v;
      services.set(name, row);
    } else if (b.status === "confirmed" && bookingStart(b.date, b.time).getTime() > now) {
      out.upcomingNGN += value(b);
      out.upcomingJobs += 1;
    }
  }
  out.byService = [...services.values()].sort((a, c) => c.valueNGN - a.valueNGN || c.jobs - a.jobs || a.service.localeCompare(c.service));
  return out;
}

/** Plain-words comparison of this month to last month, or "" when there is nothing to compare. */
export function monthChangeText(thisNGN: number, lastNGN: number): string {
  if (lastNGN <= 0) return thisNGN > 0 ? "Nothing recorded last month." : "";
  if (thisNGN === lastNGN) return "Same as last month.";
  const pct = Math.round((Math.abs(thisNGN - lastNGN) / lastNGN) * 100);
  return `${pct}% ${thisNGN > lastNGN ? "more" : "less"} than last month.`;
}
