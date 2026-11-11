"use client";

import { useRef, useState } from "react";
import { Loader2, Star } from "@/components/icons";
import { Panel } from "@/components/dashboard/widgets";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/slide-in-notifications";
import { cn } from "@/lib/utils";
import {
  MAX_REVIEW_BODY, RATING_LABELS, nextRating, reviewErrorMessage, reviewKey, useCreateReview, useReviewable, validateReview,
  type ReviewableItem,
} from "@/lib/reviews";

function StarPicker({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (e: React.KeyboardEvent) => {
    const n = nextRating(value, e.key);
    if (n === null) return;
    e.preventDefault();
    onChange(n);
    refs.current[n - 1]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Your rating" className="flex gap-1" onKeyDown={move}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          ref={el => { refs.current[n - 1] = el; }}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}, ${RATING_LABELS[n]}`}
          tabIndex={value === n || (value === 0 && n === 1) ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(n)}
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink"
        >
          <Star className={cn("h-7 w-7", n <= value ? "fill-brand text-brand" : "text-stone")} strokeWidth={n <= value ? 0 : 1.6} aria-hidden />
        </button>
      ))}
    </div>
  );
}

function ReviewDialog({ item, onClose }: { item: ReviewableItem; onClose: () => void }) {
  const create = useCreateReview();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const pending = create.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    const problem = validateReview(rating, body);
    if (problem) {
      setError(problem);
      return;
    }
    inFlight.current = true;
    setError("");
    create.mutate(
      { item, rating, body },
      {
        onSuccess: () => {
          toast("Thank you. Your review is live.", "success");
          onClose();
        },
        onError: err => setError(reviewErrorMessage(err)),
        onSettled: () => { inFlight.current = false; },
      },
    );
  };

  return (
    <Dialog open onOpenChange={o => { if (!o && !pending) onClose(); }}>
      <DialogContent className="max-w-md" onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>Review {item.name || "this purchase"}</DialogTitle>
            <DialogDescription>Your review helps other shoppers. It shows as a verified buyer.</DialogDescription>
          </DialogHeader>
          <div>
            <p className="mb-1 text-[14px] font-semibold">Rating</p>
            <StarPicker value={rating} onChange={setRating} disabled={pending} />
            <p className="mt-1 min-h-5 text-[13px] text-muted" aria-live="polite">{rating > 0 ? RATING_LABELS[rating] : "Choose 1 to 5 stars"}</p>
          </div>
          <div>
            <Label htmlFor="review-body">Comment (optional)</Label>
            <Textarea id="review-body" value={body} maxLength={MAX_REVIEW_BODY} rows={4} disabled={pending} onChange={e => setBody(e.target.value)} className="mt-1.5" />
            <p className="mt-1 text-right text-[12px] tabular-nums text-muted" aria-live="polite">{body.length}/{MAX_REVIEW_BODY}</p>
          </div>
          <div role="alert">{error && <FieldError>{error}</FieldError>}</div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} {pending ? "Sending" : "Submit review"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* "Review your purchases" card. Renders nothing when there is nothing to review
   (or while loading / on error, since it is optional). */
export function ReviewPrompts({ enabled = true }: { enabled?: boolean }) {
  const q = useReviewable(enabled);
  const [active, setActive] = useState<ReviewableItem | null>(null);
  const items = q.data ?? [];
  if (items.length === 0 && !active) return null;
  return (
    <Panel title="Review your purchases">
      <ul className="divide-y divide-hairline">
        {items.map(it => (
          <li key={reviewKey(it)} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{it.name || "Your purchase"}</p>
              <p className="text-[12px] text-muted">{it.target_type === "product" ? "Product" : "Artisan service"}</p>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setActive(it)}>Write a review</Button>
          </li>
        ))}
      </ul>
      {active && <ReviewDialog item={active} onClose={() => setActive(null)} />}
    </Panel>
  );
}
