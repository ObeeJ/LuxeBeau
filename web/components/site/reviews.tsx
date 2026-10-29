import { Star } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface Review {
  id: string;
  author: string;
  avatar?: string;
  /** Only buyers with a completed order or booking can review. */
  verifiedBuyer: boolean;
  rating: number;
  date: string;
  text: string;
  photos?: string[];
  item?: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={cn("h-4 w-4", n <= Math.round(rating) ? "fill-brand text-brand" : "text-stone")} strokeWidth={n <= Math.round(rating) ? 0 : 1.6} aria-hidden />
      ))}
    </span>
  );
}

/* One review, laid out like a social post: avatar and name on top, the
   words, then any photos. */
export function ReviewCard({ review }: { review: Review }) {
  const initials = review.author.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <article className="rounded-[28px] bg-surface p-5 shadow-card">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-wash text-[14px] font-bold text-brand-deep">
          {review.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            initials
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]">
            {review.author}
            {review.verifiedBuyer && (
              <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-semibold text-brand-deep">Verified buyer</span>
            )}
          </p>
          <p className="text-[12px] text-muted">{review.date}{review.item ? ` · ${review.item}` : ""}</p>
        </div>
        <Stars rating={review.rating} />
      </header>
      <p className="mt-3 text-[15px] leading-relaxed">{review.text}</p>
      {review.photos && review.photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {review.photos.slice(0, 3).map(src => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" loading="lazy" className="aspect-square w-full rounded-2xl object-cover" />
          ))}
        </div>
      )}
    </article>
  );
}

/* Summary bar plus the posts. With no reviews it says so honestly instead of
   showing made-up ones. */
export function ReviewFeed({ reviews, rating, count }: { reviews: Review[]; rating: number; count: number }) {
  return (
    <div>
      <div className="flex items-center gap-4 rounded-[28px] bg-brand-wash p-5">
        <p className="text-[44px] font-extrabold leading-none tracking-[-0.05em] text-brand-deep">{rating > 0 ? rating.toFixed(1) : "–"}</p>
        <div>
          {rating > 0 && <Stars rating={rating} />}
          <p className="mt-1 text-[13px] text-brand-deep/80">
            {count > 0 ? `${count.toLocaleString("en-NG")} ratings` : "No ratings yet"}
          </p>
        </div>
      </div>
      {reviews.length === 0 ? (
        <p className="mt-4 rounded-[28px] bg-surface p-6 text-[15px] leading-relaxed text-muted shadow-card">
          Written reviews will appear here. Only buyers whose order has been delivered, or whose booking is complete, can
          leave one.
        </p>
      ) : (
        <div className="mt-4 grid gap-3.5 md:grid-cols-2">
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </div>
      )}
    </div>
  );
}
