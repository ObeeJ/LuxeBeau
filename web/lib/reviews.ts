import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch, ApiError } from "@/lib/api";
import type { Review } from "@/components/site/reviews";

/* Wire shapes follow api-go/internal/review (snake_case). The API may send
   null instead of an empty list, so every list is null-tolerant. */

export type ReviewTarget = "product" | "artisan";
export const MAX_REVIEW_BODY = 500;
export const ADMIN_PAGE_SIZE = 20;

export const publicReviewSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  author: z.string().nullish().transform(v => v || "LuxeBeau customer"),
  verified_buyer: z.boolean().nullish().transform(v => v ?? false),
  rating: z.number().nullish().transform(v => v ?? 0),
  date: z.string().nullish().transform(v => v ?? ""),
  text: z.string().nullish().transform(v => v ?? ""),
  item: z.string().nullish().transform(v => v ?? ""),
  created_at: z.string().nullish(),
});
export type PublicReview = z.infer<typeof publicReviewSchema>;

export const publicReviewsResponseSchema = z.object({
  reviews: z.array(publicReviewSchema).nullish().transform(v => v ?? []),
  count: z.number().nullish().transform(v => v ?? 0),
  average: z.number().nullish().transform(v => v ?? 0),
});
export type PublicReviews = z.infer<typeof publicReviewsResponseSchema>;

export const reviewableItemSchema = z.object({
  target_type: z.enum(["product", "artisan"]),
  target_id: z.union([z.string(), z.number()]).transform(String),
  name: z.string().nullish().transform(v => v ?? ""),
});
export type ReviewableItem = z.infer<typeof reviewableItemSchema>;

export const reviewableResponseSchema = z
  .object({ items: z.array(reviewableItemSchema).nullish() })
  .transform(({ items }) => items ?? []);

export const adminReviewSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  author: z.string().nullish().transform(v => v ?? ""),
  target_type: z.string().nullish().transform(v => v ?? ""),
  target_id: z.union([z.string(), z.number()]).nullish().transform(v => (v == null ? "" : String(v))),
  target_name: z.string().nullish().transform(v => v ?? ""),
  rating: z.number().nullish().transform(v => v ?? 0),
  body: z.string().nullish().transform(v => v ?? ""),
  status: z.string().nullish().transform(v => v ?? "visible"),
  created_at: z.string().nullish().transform(v => v ?? ""),
});
export type AdminReview = z.infer<typeof adminReviewSchema>;

export const adminReviewsResponseSchema = z.object({
  reviews: z.array(adminReviewSchema).nullish().transform(v => v ?? []),
  total: z.number().nullish().transform(v => v ?? 0),
});

export type ReviewStatus = "visible" | "hidden";
export type ReviewFilter = "all" | ReviewStatus;
export const REVIEW_FILTERS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "visible", label: "Visible" },
  { id: "hidden", label: "Hidden" },
];

/* ── Pure helpers (unit tested) ── */

export function toFeedReview(r: PublicReview): Review {
  return {
    id: r.id,
    author: r.author,
    verifiedBuyer: r.verified_buyer,
    rating: r.rating,
    date: r.date,
    text: r.text,
    item: r.item || undefined,
  };
}

/** Merges several targets' results: newest first, count summed, average weighted by count. */
export function mergeReviews(results: PublicReviews[]): { reviews: Review[]; count: number; average: number } {
  const all: PublicReview[] = results.flatMap(r => r.reviews);
  const stamp = (r: PublicReview) => {
    const t = Date.parse(r.created_at ?? r.date);
    return Number.isNaN(t) ? 0 : t;
  };
  // Array.sort is stable, so reviews without a usable date keep API order.
  const sorted = [...all].sort((a, b) => stamp(b) - stamp(a));
  const count = results.reduce((s, r) => s + r.count, 0);
  const average = count > 0 ? results.reduce((s, r) => s + r.average * r.count, 0) / count : 0;
  return { reviews: sorted.map(toFeedReview), count, average };
}

export function reviewKey(item: Pick<ReviewableItem, "target_type" | "target_id">): string {
  return `${item.target_type}:${item.target_id}`;
}

export const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Moves a star choice with arrow keys, wrapping 1..5. Returns null for other keys. */
export function nextRating(current: number, key: string): number | null {
  if (key === "ArrowRight" || key === "ArrowUp") return current >= 5 ? 1 : Math.max(current, 0) + 1;
  if (key === "ArrowLeft" || key === "ArrowDown") return current <= 1 ? 5 : current - 1;
  if (key === "Home") return 1;
  if (key === "End") return 5;
  return null;
}

export function validateReview(rating: number, body: string): string {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return "Choose a star rating from 1 to 5.";
  if (body.trim().length > MAX_REVIEW_BODY) return `Keep your review under ${MAX_REVIEW_BODY} characters.`;
  return "";
}

export function toCreateBody(item: ReviewableItem, rating: number, body: string) {
  const text = body.trim();
  return { target_type: item.target_type, target_id: item.target_id, rating, body: text || undefined };
}

/** Friendly words for the review errors the API can return. */
export function reviewErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "NOT_ELIGIBLE" || (err.status === 403 && err.code !== "UNAUTHORIZED"))
      return "You can review this once your order is delivered or your booking is complete.";
    if (err.status === 409) return "You have already reviewed this.";
    if (err.status === 400) return err.message || "Please check your rating and comment, then try again.";
    if (err.code === "NETWORK") return "Connection lost. Please check your internet and try again.";
    if (err.status === 401) return "Your session has expired. Please sign in again.";
    return err.message || "We couldn't save your review. Please try again.";
  }
  return "We couldn't save your review. Please try again.";
}

export function moderationErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return "Only LuxeBeau admins can moderate reviews.";
  if (err instanceof ApiError && err.code === "NETWORK") return "Connection lost. Please try again.";
  return "We couldn't update that review. Please try again.";
}

export function pageCount(total: number, size = ADMIN_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

/* ── API + hooks ── */

export function fetchPublicReviews(targetType: ReviewTarget, targetId: string) {
  const qs = new URLSearchParams({ target_type: targetType, target_id: targetId, limit: "50", offset: "0" });
  return apiFetch(`/reviews?${qs}`, publicReviewsResponseSchema);
}

export function usePublicReviews(targetType: ReviewTarget, targetId: string | undefined) {
  return useQuery({
    queryKey: ["reviews", targetType, targetId],
    enabled: Boolean(targetId),
    queryFn: () => fetchPublicReviews(targetType, targetId as string),
  });
}

export function useReviewable(enabled = true) {
  return useQuery({
    queryKey: ["me", "reviewable"],
    enabled,
    queryFn: () => apiFetch("/me/reviewable", reviewableResponseSchema),
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { item: ReviewableItem; rating: number; body: string }) =>
      apiFetch("/reviews", z.object({ review: z.unknown().optional() }), { method: "POST", body: toCreateBody(v.item, v.rating, v.body) }),
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: ["me", "reviewable"] });
      qc.invalidateQueries({ queryKey: ["reviews", v.item.target_type, v.item.target_id] });
    },
  });
}

export function useAdminReviews(status: ReviewFilter, page: number, enabled = true) {
  return useQuery({
    queryKey: ["admin", "reviews", status, page],
    enabled,
    placeholderData: keepPreviousData,
    retry: (count, err) => (err as { status?: number })?.status !== 403 && count < 1,
    queryFn: () => {
      const qs = new URLSearchParams({ limit: String(ADMIN_PAGE_SIZE), offset: String(page * ADMIN_PAGE_SIZE) });
      if (status !== "all") qs.set("status", status);
      return apiFetch(`/admin/reviews?${qs}`, adminReviewsResponseSchema);
    },
  });
}

export function useSetReviewStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: ReviewStatus }) =>
      apiFetch(`/admin/reviews/${encodeURIComponent(v.id)}`, z.object({ status: z.string().nullish() }), { method: "PATCH", body: { status: v.status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "reviews"] });
      qc.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}
