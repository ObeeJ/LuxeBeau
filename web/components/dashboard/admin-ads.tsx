"use client";

import { useState } from "react";
import { Panel, Table } from "@/components/dashboard/widgets";
import { EmptyState, LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { isSafeImageUrl } from "@/lib/ads";
import { formatLagosDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  FILTERS, PAGE_SIZE, adActions, adStatusBadge, clickThroughRate, formatPrice, matchesFilter, pageCount, planLabel,
  remainingDaysText, statusErrorMessage, typeLabel, useAdminAds, useSetAdStatus,
  type AdAction, type AdminAd, type StatusFilter,
} from "@/lib/admin-ads";

const chip = (on: boolean) =>
  cn(
    "lb-press inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold tracking-[-0.014em] transition-all duration-150",
    on ? "bg-brand text-surface shadow-glow" : "bg-canvas text-muted hover:text-ink",
  );

function shortDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : formatLagosDateTime(d).split(",")[0];
}

function Thumb({ ad }: { ad: AdminAd }) {
  const ok = isSafeImageUrl(ad.image_url);
  return (
    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-canvas">
      {ok && (
        // eslint-disable-next-line @next/next/no-img-element -- admin preview of merchant-supplied URLs, host not known ahead of time
        <img src={ad.image_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function StatusBadge({ ad }: { ad: AdminAd }) {
  const b = adStatusBadge(ad);
  const tone = b.tone === "live" ? "bg-brand text-surface" : b.tone === "wait" ? "bg-brand-wash text-brand-deep" : "border border-ink bg-surface text-ink";
  return <span className={cn("inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold", tone)}>{b.label}</span>;
}

function PaidBadge({ ad }: { ad: AdminAd }) {
  return ad.paid_at ? (
    <span className="text-[13px]">Paid{ad.payment_method ? ` by ${ad.payment_method}` : ""}</span>
  ) : (
    <span className="text-[13px] text-muted">Not paid</span>
  );
}

function Actions({ ad, busy, onRun }: { ad: AdminAd; busy: boolean; onRun: (ad: AdminAd, a: AdAction) => void }) {
  const actions = adActions(ad);
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {!ad.paid_at && ad.status !== "expired" && <span className="text-[12px] text-muted">Awaiting payment</span>}
      {actions.map(a => (
        <Button key={a.status} size="sm" variant={a.status === "expired" ? "ghost" : "outline"} disabled={busy} onClick={() => onRun(ad, a)}>
          {a.label}
        </Button>
      ))}
    </div>
  );
}

function Stats({ ad }: { ad: AdminAd }) {
  return (
    <span className="tabular-nums">
      {ad.clicks_count} clicks / {ad.impressions_count} views ({clickThroughRate(ad.clicks_count, ad.impressions_count)})
    </span>
  );
}

function AdsList({ ads, runningId, onRun }: { ads: AdminAd[]; runningId: string | null; onRun: (ad: AdminAd, a: AdAction) => void }) {
  return (
    <>
      {/* Phones: one card per ad */}
      <ul className="space-y-3 md:hidden">
        {ads.map(ad => (
          <li key={ad.id} className="rounded-[20px] bg-canvas p-4">
            <div className="flex items-start gap-3">
              <Thumb ad={ad} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[15px] font-semibold">{ad.title || "Untitled ad"}</p>
                <p className="text-[12px] text-muted">{typeLabel(ad.type)}: {ad.target_id}</p>
              </div>
              <StatusBadge ad={ad} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
              <div><dt className="text-muted">Plan</dt><dd>{planLabel(ad.plan)}</dd></div>
              <div><dt className="text-muted">Price</dt><dd className="tabular-nums">{formatPrice(ad.amount_kobo)}</dd></div>
              <div><dt className="text-muted">Payment</dt><dd><PaidBadge ad={ad} /></dd></div>
              <div><dt className="text-muted">Runs</dt><dd>{shortDate(ad.starts_at)} to {shortDate(ad.expires_at)}<br /><span className="text-muted">{remainingDaysText(ad.expires_at)}</span></dd></div>
              <div className="col-span-2"><dt className="text-muted">Results</dt><dd><Stats ad={ad} /></dd></div>
              <div className="col-span-2 break-all text-[12px] text-muted">Merchant {ad.merchant_id}</div>
            </dl>
            <div className="mt-3"><Actions ad={ad} busy={runningId === ad.id} onRun={onRun} /></div>
          </li>
        ))}
      </ul>

      {/* Tablet and up: table */}
      <div className="hidden md:block">
        <Table head={["Ad", "Merchant", "Plan and price", "Payment", "Status", "Dates", "Results", "Actions"]} minWidth={1000}>
          {ads.map(ad => (
            <tr key={ad.id}>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <Thumb ad={ad} />
                  <div className="min-w-0 max-w-56">
                    <p className="truncate font-semibold">{ad.title || "Untitled ad"}</p>
                    <p className="truncate text-[12px] text-muted">{typeLabel(ad.type)}: {ad.target_id}</p>
                  </div>
                </div>
              </td>
              <td className="max-w-32 truncate py-3 pr-4 text-[12px] text-muted" title={ad.merchant_id}>{ad.merchant_id.slice(0, 8)}</td>
              <td className="py-3 pr-4"><p>{planLabel(ad.plan)}</p><p className="text-[12px] tabular-nums text-muted">{formatPrice(ad.amount_kobo)}</p></td>
              <td className="py-3 pr-4"><PaidBadge ad={ad} /></td>
              <td className="py-3 pr-4"><StatusBadge ad={ad} /></td>
              <td className="py-3 pr-4 text-[13px]"><p>{shortDate(ad.starts_at)} to {shortDate(ad.expires_at)}</p><p className="text-[12px] text-muted">{remainingDaysText(ad.expires_at)}</p></td>
              <td className="py-3 pr-4 text-[13px]"><Stats ad={ad} /></td>
              <td className="py-3 text-right"><Actions ad={ad} busy={runningId === ad.id} onRun={onRun} /></td>
            </tr>
          ))}
        </Table>
      </div>
    </>
  );
}

export function AdminAds({ enabled = true }: { enabled?: boolean }) {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [confirmAd, setConfirmAd] = useState<AdminAd | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const q = useAdminAds(page * PAGE_SIZE, enabled);
  const setStatus = useSetAdStatus();

  const total = q.data?.total ?? 0;
  const pages = pageCount(total);
  const run = (ad: AdminAd, a: AdAction) => {
    if (a.confirm) {
      setConfirmAd(ad);
      return;
    }
    exec(ad, a.status, a.label);
  };
  const exec = (ad: AdminAd, status: AdAction["status"], label: string) => {
    setMessage(null);
    setRunningId(ad.id);
    setStatus.mutate(
      { id: ad.id, status },
      {
        onSuccess: () => setMessage({ kind: "ok", text: `Done: ${label} for "${ad.title || "this ad"}".` }),
        onError: e => setMessage({ kind: "error", text: statusErrorMessage(e) }),
        onSettled: () => setRunningId(null),
      },
    );
  };

  const forbidden = q.error instanceof ApiError && q.error.status === 403;
  const visible = (q.data?.ads ?? []).filter(a => matchesFilter(a, filter));

  let body: React.ReactNode;
  if (q.isLoading) {
    body = (
      <div aria-busy="true" className="space-y-3">
        {[0, 1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-[20px]" />)}
        <span className="sr-only">Loading ads, please wait.</span>
      </div>
    );
  } else if (q.isError) {
    body = forbidden
      ? <EmptyState>Ad moderation is for LuxeBeau admins only. Your account does not have access.</EmptyState>
      : <LoadError onRetry={() => q.refetch()} message="We couldn't load ads." />;
  } else if ((q.data?.ads.length ?? 0) === 0) {
    body = page > 0 ? (
      <EmptyState>
        <p>This page is empty now.</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => setPage(0)}>Back to the first page</Button>
      </EmptyState>
    ) : <EmptyState>No ads yet. Ads appear here when a seller or artisan creates one.</EmptyState>;
  } else if (visible.length === 0) {
    body = <EmptyState>No ads on this page match that filter. Try another page or choose All.</EmptyState>;
  } else {
    body = <AdsList ads={visible} runningId={runningId} onRun={run} />;
  }

  return (
    <Panel title="Featured ads">
      <div className="mb-4 space-y-3">
        <div role="group" aria-label="Filter ads by status" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map(f => (
            <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={chip(filter === f.id)}>{f.label}</button>
          ))}
        </div>
        <p className="text-[13px] text-muted">Ads go live when the merchant pays, not when you click. You can pause, resume or end a paid ad.</p>
        <div role="status" aria-live="polite" className="min-h-0 text-[14px]">
          {message && (
            <p role={message.kind === "error" ? "alert" : undefined} className={cn("rounded-[16px] px-4 py-3", message.kind === "error" ? "border border-ink bg-surface" : "bg-brand-wash text-brand-deep")}>
              {message.text}
            </p>
          )}
        </div>
      </div>

      <div className={cn("transition-opacity duration-200", q.isFetching && !q.isLoading && "opacity-60")} aria-busy={q.isFetching}>
        {body}
      </div>

      {!q.isError && total > PAGE_SIZE && (
        <nav aria-label="Ads pages" className="mt-4 flex items-center justify-between gap-3">
          <Button size="sm" variant="outline" disabled={page === 0 || q.isFetching} onClick={() => setPage(p => Math.max(0, p - 1))}>Previous</Button>
          <span className="text-[13px] text-muted" aria-live="polite">Page {page + 1} of {pages} ({total} ads)</span>
          <Button size="sm" variant="outline" disabled={page + 1 >= pages || q.isFetching} onClick={() => setPage(p => p + 1)}>Next</Button>
        </nav>
      )}

      <Dialog open={!!confirmAd} onOpenChange={o => !o && setConfirmAd(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this ad now?</DialogTitle>
            <DialogDescription>
              &quot;{confirmAd?.title || "This ad"}&quot; will stop showing straight away and cannot be turned back on. The merchant is not refunded automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAd(null)}>Keep running</Button>
            <Button
              variant="destructive"
              disabled={setStatus.isPending}
              onClick={() => {
                const ad = confirmAd;
                setConfirmAd(null);
                if (ad) exec(ad, "expired", "Expire now");
              }}
            >
              End ad now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
