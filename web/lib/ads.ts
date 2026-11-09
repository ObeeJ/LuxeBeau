import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";
import { formatNaira } from "@/lib/format";

/* ── Promote / buy an ad ─────────────────────────────────────
   Wire shapes follow api-go/internal/promotion (snake_case, money in KOBO).
   An ad starts "pending" and only goes live after it is paid. */

export type AdPlanId = "7_days" | "30_days" | "annual";
export type AdTargetType = "product" | "storefront" | "artisan";

export const AD_TARGETS: { id: AdTargetType; label: string; hint: string }[] = [
  { id: "storefront", label: "My storefront", hint: "Send shoppers to your storefront page." },
  { id: "product", label: "A product", hint: "Spotlight one of your products." },
  { id: "artisan", label: "Artisan profile", hint: "Promote your services and bookings." },
];

/* Used for display until (or if) the live pricing loads. The amount a
   customer is charged always comes from the created ad, never from here. */
export const FALLBACK_PLANS: AdPlan[] = [
  { id: "7_days", amountKobo: 500_000, days: 7, tag: "Starter Boost" },
  { id: "30_days", amountKobo: 1_500_000, days: 30, tag: "Most Popular (Save 25%)" },
  { id: "annual", amountKobo: 12_000_000, days: 365, tag: "Best Value (4 Months Free)" },
];

export type AdPlan = { id: AdPlanId; amountKobo: number; days: number; tag: string };

export const adPlanIdSchema = z.enum(["7_days", "30_days", "annual"]);

const planEntrySchema = z.object({
  amount_kobo: z.number().int().nonnegative(),
  days: z.number().int().positive(),
  tag: z.string().optional().default(""),
});

/* GET /featured-ads/pricing → { pricing: { "7_days": {...}, ... } } */
export const pricingResponseSchema = z
  .object({ pricing: z.record(z.string(), planEntrySchema) })
  .transform(({ pricing }): AdPlan[] => {
    const order: AdPlanId[] = ["7_days", "30_days", "annual"];
    return order.flatMap(id => {
      const p = pricing[id];
      return p ? [{ id, amountKobo: p.amount_kobo, days: p.days, tag: p.tag }] : [];
    });
  });

export const adStatusSchema = z.enum(["pending", "active", "paused", "expired"]);
export type AdStatus = z.infer<typeof adStatusSchema>;

export const myAdSchema = z.object({
  id: z.string(),
  type: z.enum(["product", "storefront", "artisan"]),
  title: z.string(),
  image_url: z.string().optional().default(""),
  plan: z.string(),
  amount_kobo: z.number().int(),
  status: z.string(),
  starts_at: z.string().nullish(),
  expires_at: z.string().nullish(),
  paid_at: z.string().nullish(),
  clicks_count: z.number().optional().default(0),
  impressions_count: z.number().optional().default(0),
});
export type MyAd = z.infer<typeof myAdSchema>;

/* The API sends `null` (not []) when there are no ads yet. */
export const myAdsResponseSchema = z
  .object({ ads: z.array(myAdSchema).nullable() })
  .transform(({ ads }) => ads ?? []);

export const createAdResponseSchema = z.object({ ad: myAdSchema });

/* ── Pure helpers (unit tested) ─────────────────────────────── */

/** Kobo → "₦5,000". */
export function formatKobo(kobo: number): string {
  return formatNaira(kobo / 100);
}

/** Wallet can pay only when its balance is known and covers the price. */
export function canPayFromWallet(balanceKobo: number | undefined, priceKobo: number): boolean {
  return balanceKobo !== undefined && priceKobo > 0 && balanceKobo >= priceKobo;
}

/** How much more the wallet needs, in kobo (0 when enough). */
export function walletShortfallKobo(balanceKobo: number, priceKobo: number): number {
  return Math.max(0, priceKobo - balanceKobo);
}

export function durationLabel(days: number): string {
  if (days >= 365) return "1 year";
  return `${days} days`;
}

export function planLabel(id: string): string {
  if (id === "7_days") return "7 days";
  if (id === "30_days") return "30 days";
  if (id === "annual") return "Annual";
  return id;
}

export type AdStatusInfo = { label: string; hint: string; tone: "live" | "wait" | "off" };

export function adStatusInfo(status: string): AdStatusInfo {
  switch (status) {
    case "active":
      return { label: "Live", hint: "Your ad is showing to shoppers.", tone: "live" };
    case "pending":
      return { label: "Awaiting payment", hint: "Pay to put this ad live.", tone: "wait" };
    case "paused":
      return { label: "Paused", hint: "This ad is paused and not showing.", tone: "off" };
    case "expired":
      return { label: "Ended", hint: "This ad has finished running.", tone: "off" };
    default:
      return { label: status || "Unknown", hint: "", tone: "off" };
  }
}

/* Only https images or site-relative paths may be previewed or submitted. */
export function isSafeImageUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("/")) return !v.startsWith("//");
  try {
    return new URL(v).protocol === "https:";
  } catch {
    return false;
  }
}

/* Optional link: blank (backend picks the default), a site path, or https. */
export function isSafeLinkUrl(value: string): boolean {
  const v = value.trim();
  return v === "" || isSafeImageUrl(v);
}

export type AdDraft = {
  type: AdTargetType;
  targetId: string;
  title: string;
  tagline: string;
  imageUrl: string;
  linkUrl: string;
  plan: AdPlanId;
};

export function validateDraft(d: AdDraft): Partial<Record<"title" | "targetId" | "imageUrl" | "linkUrl" | "tagline", string>> {
  const errors: Partial<Record<"title" | "targetId" | "imageUrl" | "linkUrl" | "tagline", string>> = {};
  if (!d.title.trim()) errors.title = "Give your ad a title.";
  else if (d.title.trim().length > 150) errors.title = "Keep the title under 150 characters.";
  if (d.tagline.trim().length > 255) errors.tagline = "Keep the tagline under 255 characters.";
  if (!d.targetId.trim()) {
    errors.targetId =
      d.type === "storefront" ? "Enter your storefront handle." : d.type === "product" ? "Enter the product id or slug." : "Enter your artisan id.";
  }
  if (!d.imageUrl.trim()) errors.imageUrl = "Add an image for your ad.";
  else if (!isSafeImageUrl(d.imageUrl)) errors.imageUrl = "Use a secure image link that starts with https://.";
  if (!isSafeLinkUrl(d.linkUrl)) errors.linkUrl = "Use a link that starts with https:// or a page on this site such as /shop/my-product.";
  return errors;
}

/** Same draft → same signature, so a retry never creates a duplicate ad. */
export function draftSignature(d: AdDraft): string {
  return JSON.stringify([d.type, d.targetId.trim(), d.title.trim(), d.tagline.trim(), d.imageUrl.trim(), d.linkUrl.trim(), d.plan]);
}

export function toCreateBody(d: AdDraft) {
  return {
    type: d.type,
    target_id: d.targetId.trim(),
    title: d.title.trim(),
    tagline: d.tagline.trim() || undefined,
    image_url: d.imageUrl.trim(),
    link_url: d.linkUrl.trim() || undefined,
    plan: d.plan,
  };
}

/** Checks `read` up to `tries` times until the ad is live (the card webhook can lag a moment). */
export async function waitUntilActive(
  read: () => Promise<MyAd[]>,
  adId: string,
  { tries = 6, delayMs = 2000, sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms)) } = {},
): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const ad = (await read()).find(a => a.id === adId);
      if (ad?.status === "active") return true;
    } catch {
      // keep trying; the webhook may still be on its way
    }
    if (i < tries - 1) await sleep(delayMs);
  }
  return false;
}

/* ── API + hooks ────────────────────────────────────────────── */

export function fetchAdPricing() {
  return apiFetch("/featured-ads/pricing", pricingResponseSchema);
}

export function fetchMyAds() {
  return apiFetch("/me/promotions", myAdsResponseSchema);
}

export function createAd(draft: AdDraft) {
  return apiFetch("/me/promotions", createAdResponseSchema, { method: "POST", body: toCreateBody(draft) }).then(r => r.ad);
}

export function payAdWithWallet(id: string) {
  return apiFetch(`/me/promotions/${encodeURIComponent(id)}/pay-wallet`, z.unknown(), { method: "POST" });
}

export function useAdPricing() {
  return useQuery({ queryKey: ["ads", "pricing"], staleTime: 10 * 60 * 1000, queryFn: fetchAdPricing });
}

export function useMyAds(enabled: boolean) {
  return useQuery({ queryKey: ["me", "ads"], enabled, queryFn: fetchMyAds });
}

export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAd,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "ads"] }),
  });
}

export function usePayAdWithWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payAdWithWallet,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["me", "ads"] });
      qc.invalidateQueries({ queryKey: ["me", "wallet"] });
    },
  });
}
