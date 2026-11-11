"use client";

import { useState } from "react";
import { Star } from "@/components/icons";
import { Panel } from "@/components/dashboard/widgets";
import { EmptyState, LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { formatLagosDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ADMIN_PAGE_SIZE, REVIEW_FILTERS, moderationErrorMessage, pageCount, useAdminReviews, useSetReviewStatus,
  type AdminReview, type ReviewFilter,
} from "@/lib/reviews";

const chip = (on: boolean) =>
  cn(
    "lb-press inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold tracking-[-0.014em] transition-all duration-150",
    on ? "bg-brand text-surface shadow-glow" : "bg-canvas text-muted hover:text-ink",
  );

function when(iso: string): string {
  const d = new Date(iso);
  return iso && !Number.isNaN(d.getTime()) ? formatLagosDateTime(d) : "-";
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(i => <Star key={i} className={cn("h-4 w-4", i <= n ? "fill-brand text-brand" : "text-stone")} strokeWidth={i <= n ? 0 : 1.6} aria-hidden />)}
    </span>
  );
}

export function AdminReviews({ enabled = true }: { enabled?: boolean }) {
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<AdminReview | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const q = useAdminReviews(filter, page, enabled);
  const setStatus = useSetReviewStatus();

  const total = q.data?.total ?? 0;
  const pages = pageCount(total);
  const rows = q.data?.reviews ?? [];
  const forbidden = q.error instanceof ApiError && q.error.status === 403;

  const exec = (r: AdminReview, status: "visible" | "hidden") => {
    if (busyId) return;
    setMessage(null);
    setBusyId(r.id);
    setStatus.mutate(
      { id: r.id, status },
      {
        onSuccess: () => setMessage({ kind: "ok", text: status === "hidden" ? `Hidden the review by ${r.author || "this customer"}.` : `Restored the review by ${r.author || "this customer"}.` }),
        onError: e => setMessage({ kind: "error", text: moderationErrorMessage(e) }),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const pick = (f: ReviewFilter) => { setFilter(f); setPage(0); setMessage(null); };

  let body: React.ReactNode;
  if (q.isLoading) {
    body = (
      <div aria-busy="true" className="space-y-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-24 w-full rounded-[20px]" />)}
        <span className="sr-only">Loading reviews, please wait.</span>
      </div>
    );
  } else if (q.isError) {
    body = forbidden
      ? <EmptyState>Review moderation is for LuxeBeau admins only. Your account does not have access.</EmptyState>
      : <LoadError onRetry={() => q.refetch()} message="We couldn't load reviews." />;
  } else if (rows.length === 0) {
    body = page > 0
      ? <EmptyState><p>This page is empty now.</p><Button className="mt-3" size="sm" variant="outline" onClick={() => setPage(0)}>Back to the first page</Button></EmptyState>
      : <EmptyState>{filter === "all" ? "No reviews yet." : `No ${filter} reviews.`}</EmptyState>;
  } else {
    body = (
      <ul className="space-y-3">
        {rows.map(r => (
          <li key={r.id} className="rounded-[20px] bg-canvas p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words text-[15px] font-semibold">{r.author || "Unknown"}</p>
                <p className="break-words text-[12px] text-muted">
                  {r.target_type === "artisan" ? "Artisan" : "Product"}: {r.target_name || r.target_id} · {when(r.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Stars n={r.rating} />
                <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-semibold", r.status === "hidden" ? "border border-ink bg-surface" : "bg-brand-wash text-brand-deep")}>
                  {r.status === "hidden" ? "Hidden" : "Visible"}
                </span>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line break-words text-[14px] leading-relaxed">{r.body || <span className="text-muted">No comment, rating only.</span>}</p>
            <div className="mt-3 flex justify-end">
              {r.status === "hidden" ? (
                <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => exec(r, "visible")}>Restore</Button>
              ) : (
                <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => setConfirm(r)}>Hide</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Panel title="Reviews">
      <div className="mb-4 space-y-3">
        <div role="group" aria-label="Filter reviews by status" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {REVIEW_FILTERS.map(f => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => pick(f.id)} className={chip(filter === f.id)}>{f.label}</button>
          ))}
        </div>
        <div role="status" aria-live="polite" className="text-[14px]">
          {message && (
            <p role={message.kind === "error" ? "alert" : undefined} className={cn("rounded-[16px] px-4 py-3", message.kind === "error" ? "border border-ink bg-surface" : "bg-brand-wash text-brand-deep")}>{message.text}</p>
          )}
        </div>
      </div>

      <div className={cn("transition-opacity duration-200", q.isFetching && !q.isLoading && "opacity-60")} aria-busy={q.isFetching}>{body}</div>

      {!q.isError && total > ADMIN_PAGE_SIZE && (
        <nav aria-label="Reviews pages" className="mt-4 flex items-center justify-between gap-3">
          <Button size="sm" variant="outline" disabled={page === 0 || q.isFetching} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
          <span className="text-[13px] text-muted" aria-live="polite">Page {page + 1} of {pages} ({total} reviews)</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages || q.isFetching} onClick={() => setPage(p => p + 1)}>Next</Button>
        </nav>
      )}

      <Dialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide this review?</DialogTitle>
            <DialogDescription>The review by {confirm?.author || "this customer"} will no longer show to shoppers. You can restore it any time.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>Keep it visible</Button>
            <Button variant="destructive" onClick={() => { const r = confirm; setConfirm(null); if (r) exec(r, "hidden"); }}>Hide review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
