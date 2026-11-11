/* Admin ads moderation: schemas, API calls, react-query hooks and pure helpers.
   Money is kobo. Payment, not an admin click, makes an ad live: the server
   refuses to activate an unpaid ad, and the helpers here mirror that rule. */
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { formatNaira } from "@/lib/format";

export const PAGE_SIZE = 20;

export type AdminAdStatus = "pending" | "active" | "paused" | "expired";
export type SettableStatus = "active" | "paused" | "expired";

export const adminAdSchema = z.object({
  id: z.string(),
  merchant_id: z.string().nullish().transform(v => v ?? ""),
  type: z.string().nullish().transform(v => v ?? ""),
  target_id: z.string().nullish().transform(v => v ?? ""),
  title: z.string().nullish().transform(v => v ?? ""),
  tagline: z.string().nullish().transform(v => v ?? ""),
  description: z.string().nullish().transform(v => v ?? ""),
  badge: z.string().nullish().transform(v => v ?? ""),
  image_url: z.string().nullish().transform(v => v ?? ""),
  link_url: z.string().nullish().transform(v => v ?? ""),
  plan: z.string().nullish().transform(v => v ?? ""),
  amount_kobo: z.number().nullish().transform(v => v ?? 0),
  starts_at: z.string().nullish().transform(v => v ?? null),
  expires_at: z.string().nullish().transform(v => v ?? null),
  status: z.string().nullish().transform(v => v ?? ""),
  paid_at: z.string().nullish().transform(v => v ?? null),
  payment_method: z.string().nullish().transform(v => v ?? ""),
  payment_ref: z.string().nullish().transform(v => v ?? ""),
  clicks_count: z.number().nullish().transform(v => v ?? 0),
  impressions_count: z.number().nullish().transform(v => v ?? 0),
  created_at: z.string().nullish().transform(v => v ?? null),
});
export type AdminAd = z.infer<typeof adminAdSchema>;

export const adminAdsResponseSchema = z.object({
  ads: z.array(adminAdSchema).nullish().transform(v => v ?? []),
  total: z.number().nullish().transform(v => v ?? 0),
});
export type AdminAdsPage = z.infer<typeof adminAdsResponseSchema>;

/* ── API ── */

export function fetchAdminAds(offset: number, limit = PAGE_SIZE): Promise<AdminAdsPage> {
  return apiFetch(`/admin/promotions?limit=${limit}&offset=${offset}`, adminAdsResponseSchema);
}

export function setAdStatus(id: string, status: SettableStatus) {
  return apiFetch(`/admin/promotions/${encodeURIComponent(id)}/status`, z.object({ message: z.string().nullish() }), {
    method: "PATCH",
    body: { status },
  });
}

export function useAdminAds(offset: number, enabled = true) {
  return useQuery({
    queryKey: ["admin", "promotions", offset],
    queryFn: () => fetchAdminAds(offset),
    enabled,
    placeholderData: keepPreviousData,
    retry: (count, err) => (err as { status?: number })?.status !== 403 && count < 1,
  });
}

export function useSetAdStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SettableStatus }) => setAdStatus(id, status),
    // Refetch even on failure: a 409 means our copy of the ad was out of date.
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin", "promotions"] }),
  });
}

/* ── Pure helpers ── */

export type Tone = "live" | "wait" | "off";

/** Label and tone for the status badge. An unpaid ad is "Awaiting payment" whatever its status. */
export function adStatusBadge(ad: Pick<AdminAd, "status" | "paid_at">): { label: string; tone: Tone } {
  if (!ad.paid_at && ad.status !== "expired") return { label: "Awaiting payment", tone: "wait" };
  switch (ad.status) {
    case "active": return { label: "Active", tone: "live" };
    case "pending": return { label: "Pending", tone: "wait" };
    case "paused": return { label: "Paused", tone: "off" };
    case "expired": return { label: "Expired", tone: "off" };
    default: return { label: ad.status || "Unknown", tone: "off" };
  }
}

export function planLabel(plan: string): string {
  if (plan === "7_days") return "7 days";
  if (plan === "30_days") return "30 days";
  if (plan === "annual") return "Annual";
  return plan || "Unknown";
}

export function typeLabel(type: string): string {
  if (type === "product") return "Product";
  if (type === "storefront") return "Storefront";
  if (type === "artisan") return "Artisan";
  return type || "Unknown";
}

export function isPaid(ad: Pick<AdminAd, "paid_at">): boolean {
  return !!ad.paid_at;
}

/** The server only lets a paid ad go active, so the UI must not offer it otherwise. */
export function canActivate(ad: Pick<AdminAd, "paid_at" | "status">): boolean {
  return isPaid(ad) && ad.status !== "expired";
}

export type AdAction = { status: SettableStatus; label: string; confirm: boolean };

/** Which moderation buttons apply to this ad. Never includes an activate for an unpaid ad. */
export function adActions(ad: Pick<AdminAd, "paid_at" | "status">): AdAction[] {
  const out: AdAction[] = [];
  if (ad.status === "active") out.push({ status: "paused", label: "Pause", confirm: false });
  if ((ad.status === "paused" || ad.status === "pending") && canActivate(ad)) {
    out.push({ status: "active", label: ad.status === "paused" ? "Resume" : "Activate", confirm: false });
  }
  if (ad.status !== "expired") out.push({ status: "expired", label: "Expire now", confirm: true });
  return out;
}

/** Kobo to naira text, "₦5,000". Bad input shows as ₦0. */
export function formatPrice(kobo: number): string {
  return formatNaira(Number.isFinite(kobo) ? kobo / 100 : 0);
}

const DAY = 86_400_000;

/** "12 days left", "1 day left", "Ends today", "Ended", or "" when the date is missing or invalid. */
export function remainingDaysText(expiresAt: string | null | undefined, now: Date = new Date()): string {
  if (!expiresAt) return "";
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return "";
  const ms = end - now.getTime();
  if (ms <= 0) return "Ended";
  if (ms <= DAY) return "Ends today";
  const days = Math.ceil(ms / DAY);
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

/** Clicks per impression as a percent string. Zero impressions gives "0%", never NaN or Infinity. */
export function clickThroughRate(clicks: number, impressions: number): string {
  if (!(impressions > 0) || !(clicks > 0)) return "0%";
  const pct = (clicks / impressions) * 100;
  return `${pct >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}

export type StatusFilter = "all" | "unpaid" | "active" | "paused" | "expired";
export const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unpaid", label: "Pending payment" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "expired", label: "Expired" },
];

/** The list endpoint has no filter parameter, so chips narrow the loaded page. */
export function matchesFilter(ad: Pick<AdminAd, "status" | "paid_at">, f: StatusFilter): boolean {
  switch (f) {
    case "all": return true;
    case "unpaid": return !ad.paid_at && ad.status !== "expired";
    default: return ad.status === f;
  }
}

export function pageCount(total: number, size = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / size));
}

/** Plain-language error for a failed status change, keeping the server's reason (e.g. unpaid 409). */
export function statusErrorMessage(err: unknown): string {
  const e = err as { status?: number; message?: string } | null;
  if (e?.status === 403) return "Only admins can change ads.";
  if (e?.message && (e.status === 409 || e.status === 400)) return e.message;
  return e?.message || "We couldn't update this ad. Please try again.";
}
