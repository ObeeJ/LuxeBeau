"use client";

import { useQueries } from "@tanstack/react-query";
import { ReviewFeed } from "@/components/site/reviews";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicReviews, mergeReviews, toFeedReview, usePublicReviews, type ReviewTarget } from "@/lib/reviews";

const MAX_STORE_PRODUCTS = 10;

/* Real reviews for one product or artisan. Falls back to the given summary
   (and no posts) only if the request fails. */
export function TargetReviews({ targetType, targetId, fallback }: { targetType: ReviewTarget; targetId: string; fallback?: { rating: number; count: number } }) {
  const q = usePublicReviews(targetType, targetId);
  if (q.isLoading) return <Skeleton className="h-40 w-full rounded-[28px]" aria-busy="true" />;
  if (q.isError || !q.data) return <ReviewFeed reviews={[]} rating={fallback?.rating ?? 0} count={fallback?.count ?? 0} />;
  return <ReviewFeed reviews={q.data.reviews.map(toFeedReview)} rating={q.data.average} count={q.data.count} />;
}

/* A store has many products: fetch the first few products' reviews and merge them. */
export function StoreReviews({ productIds, fallback }: { productIds: string[]; fallback: { rating: number; count: number } }) {
  const ids = productIds.slice(0, MAX_STORE_PRODUCTS);
  const results = useQueries({
    queries: ids.map(id => ({ queryKey: ["reviews", "product", id], queryFn: () => fetchPublicReviews("product", id) })),
  });
  const loading = results.some(r => r.isLoading);
  const failed = results.length > 0 && results.every(r => r.isError);
  const merged = mergeReviews(results.flatMap(r => (r.data ? [r.data] : [])));
  if (loading) return <Skeleton className="h-40 w-full rounded-[28px]" aria-busy="true" />;
  if (failed) return <ReviewFeed reviews={[]} rating={fallback.rating} count={fallback.count} />;
  return <ReviewFeed reviews={merged.reviews} rating={merged.average} count={merged.count} />;
}
