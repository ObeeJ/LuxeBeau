"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight } from "@/components/icons";
import { PageHeader, Panel, RecordList, StatusPill } from "@/components/dashboard/widgets";
import { Hold } from "@/components/dashboard/order-row";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/store";
import { formatKoboNaira, useOrderDetail } from "@/lib/order-detail";

const paymentLabel = (s: string) => (s === "paid" ? "Paid" : s === "failed" ? "Payment failed" : s === "refunded" ? "Refunded" : "Awaiting payment");

/* One order: what was bought, how the price adds up, where it is, and where
   each seller's payment stands (with the same release / report actions as the order list). */
export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(String(params?.id ?? ""));
  const user = useAuth(s => s.user);
  const status = useAuth(s => s.status);
  const q = useOrderDetail(id, Boolean(user));

  if (status === "loading") return <Skeleton className="h-64 w-full rounded-[28px] bg-surface" />;
  if (!user) {
    return (
      <div className="mx-auto max-w-sm rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <h1 className="t-display">Your order</h1>
        <p className="mt-2 text-[16px] text-muted">Sign in to see this order.</p>
        <Button asChild size="lg" className="mt-5"><Link href="/signin">Sign in</Link></Button>
      </div>
    );
  }

  const back = (
    <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-[14px] tracking-[-0.014em] text-muted underline-offset-4 hover:text-ink hover:underline">
      <ArrowRight className="h-4 w-4 rotate-180" aria-hidden /> Back to your orders
    </Link>
  );

  if (q.isLoading) {
    return (
      <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading order">
        {back}
        <Skeleton className="h-24 w-full rounded-[28px]" />
        <Skeleton className="h-48 w-full rounded-[28px]" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    const missing = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div className="space-y-5">
        {back}
        <Panel>
          {missing ? (
            <p role="alert" className="py-8 text-center text-[16px] text-muted">We couldn&apos;t find that order. It may belong to another account.</p>
          ) : (
            <LoadError onRetry={() => q.refetch()} message="We couldn't load this order." />
          )}
        </Panel>
      </div>
    );
  }

  const d = q.data;
  const o = d.order;
  const rows: [string, number][] = [
    ["Items", d.subtotalKobo],
    ["Delivery", d.deliveryKobo],
    ["Platform fee", d.platformKobo],
    ["Payment processing fee", d.processingKobo],
  ];
  const processing = o.shippingStatus === "pending" ? "processing" : o.shippingStatus;

  return (
    <div className="space-y-5">
      {back}
      <PageHeader title={`Order ${o.id}`} subtitle={[o.date, o.city].filter(Boolean).join(" · ")} />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Panel title="Items">
            {d.items.length === 0 ? (
              <p className="text-[14px] text-muted">No items on this order.</p>
            ) : (
              <RecordList>
                {d.items.map((i, idx) => (
                  <li key={idx} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="text-[16px] tracking-[-0.031em]">{i.name}</p>
                      <p className="text-[14px] tracking-[-0.014em] text-muted">
                        {[i.brand, `Qty ${i.qty} × ${formatKoboNaira(i.unitKobo)}`].filter(Boolean).join(" · ")}
                      </p>
                      {i.note && <p className="mt-0.5 text-[12px] tracking-[-0.017em] text-muted">Tracking: {i.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-[16px] tracking-[-0.031em]">{formatKoboNaira(i.lineKobo)}</span>
                      <StatusPill status={i.stage === "pending" ? "processing" : i.stage} />
                    </div>
                  </li>
                ))}
              </RecordList>
            )}
          </Panel>

          <Panel title="Payment held for each seller">
            {o.holds.length === 0 ? (
              <p className="text-[14px] tracking-[-0.014em] text-muted">
                {o.paymentStatus === "paid" ? "No payment is being held for this order." : "Payment is held for the seller once this order is paid."}
              </p>
            ) : (
              <div className="space-y-2">
                {o.holds.map(h => (
                  <div key={h.id}>
                    <Hold hold={h} showSeller={o.holds.length > 1} />
                  </div>
                ))}
                <p className="pt-1 text-[12px] tracking-[-0.017em] text-muted">
                  All of your payments held in trust are also under <Link href="/dashboard/escrow" className="text-ink underline underline-offset-4">Trust</Link>.
                </p>
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Price">
            <dl className="divide-y divide-hairline text-[14px] tracking-[-0.014em]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="tabular-nums">{v === 0 && k !== "Items" ? "Free" : formatKoboNaira(v)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-4 py-3 text-[16px] font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatKoboNaira(d.totalKobo)}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Status">
            <dl className="space-y-3 text-[14px] tracking-[-0.014em]">
              <div className="flex items-center justify-between gap-4"><dt className="text-muted">Payment</dt><dd><StatusPill status={paymentLabel(o.paymentStatus)} /></dd></div>
              <div className="flex items-center justify-between gap-4"><dt className="text-muted">Shipping</dt><dd><StatusPill status={processing} /></dd></div>
              {o.trackingNote && <div><dt className="text-muted">Tracking note</dt><dd className="mt-0.5">{o.trackingNote}</dd></div>}
              {o.address && <div><dt className="text-muted">Delivering to</dt><dd className="mt-0.5">{o.address}</dd></div>}
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
