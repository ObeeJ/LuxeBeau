const naira = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return naira.format(amount);
}

export function formatCompactNaira(amount: number): string {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}k`;
  return formatNaira(amount);
}

/* Dates and times in the API are Lagos time, which is UTC+1 all year (no daylight saving). */
const LAGOS_OFFSET = "+01:00";

/** The moment a booking on `date` (YYYY-MM-DD) at `time` (HH:MM) begins. */
export function bookingStart(date: string, time: string): Date {
  return new Date(`${date}T${time}:00${LAGOS_OFFSET}`);
}

const lagosDateTime = new Intl.DateTimeFormat("en-NG", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Africa/Lagos",
});

/** "Mon 2 Nov, 10:00 AM" for an instant, in Lagos time. */
export function formatLagosDateTime(iso: string | Date): string {
  const parts = Object.fromEntries(
    lagosDateTime.formatToParts(typeof iso === "string" ? new Date(iso) : iso).map(p => [p.type, p.value]),
  );
  return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()}`;
}

const lagosDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" });

/** Today's date in Lagos as YYYY-MM-DD. */
export function lagosToday(): string {
  return lagosDay.format(new Date());
}
