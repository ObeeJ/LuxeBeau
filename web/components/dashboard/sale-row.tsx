"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { StatusPill } from "@/components/dashboard/widgets";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFulfil } from "@/lib/queries";
import { type MyOrder } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { formatDay } from "@/components/dashboard/order-row";
import { getFriendlyErrorMessage } from "@/lib/errors";

/* Stages in order; sellers can only move forward (api-go seller.Fulfil). */
const STAGES = ["pending", "processing", "shipped", "delivered"] as const;
type Stage = (typeof STAGES)[number];

const NEXT: Record<Stage, { stage: Exclude<Stage, "pending">; label: string } | null> = {
  pending: { stage: "processing", label: "Start packing" },
  processing: { stage: "shipped", label: "Mark as shipped" },
  shipped: { stage: "delivered", label: "Mark as delivered" },
  delivered: null,
};

const STAGE_LABEL: Record<Stage, string> = { pending: "To pack", processing: "Packing", shipped: "Shipped", delivered: "Delivered" };

/* The seller's own items in one order. /me/sales only returns this seller's
   items, so the slowest of them is where this seller is at. */
function sellerStage(o: MyOrder): Stage {
  let rank = STAGES.length - 1;
  for (const i of o.items) {
    const r = STAGES.indexOf(i.stage as Stage);
    if (r >= 0 && r < rank) rank = r;
  }
  return o.items.length ? STAGES[rank] : "pending";
}

export function SaleRow({ order }: { order: MyOrder }) {
  const fulfil = useFulfil();
  const stage = sellerStage(order);
  const next = NEXT[stage];
  const paid = order.paymentStatus === "paid";
  const [note, setNote] = useState(order.trackingNote);
  const [error, setError] = useState("");
  const asksForNote = next?.stage === "shipped";

  const advance = () => {
    if (!next) return;
    setError("");
    fulfil.mutate(
      { orderId: order.id, status: next.stage, trackingNote: note.trim() },
      { onError: err => setError(getFriendlyErrorMessage(err, "We couldn't update this order.")) },
    );
  };

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-[16px] tracking-[-0.031em]">{order.itemSummary}</p>
          <p className="mt-0.5 text-[12px] tracking-[-0.017em] text-muted">
            {order.id} · {order.date}
            {order.buyer ? ` · ${order.buyer}` : ""} · {paid ? "Paid" : "Awaiting payment"}
          </p>
          {paid && order.address && (
            <p className="mt-1 text-[14px] tracking-[-0.014em]">
              {order.address}
              {order.phone && <span className="text-muted"> · {order.phone}</span>}
            </p>
          )}
          {order.trackingNote && stage !== "pending" && stage !== "processing" && (
            <p className="mt-1 text-[12px] tracking-[-0.017em] text-muted">Tracking: {order.trackingNote}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[16px] tabular-nums tracking-[-0.031em]">{formatNaira(order.totalNGN)}</span>
          <StatusPill status={STAGE_LABEL[stage]} />
        </div>
      </div>

      {order.holds.map(h => (
        <p key={h.id} className="mt-2 text-[12px] tracking-[-0.017em] text-muted">
          {h.state === "released"
            ? `Paid ${formatNaira(h.netNGN)} to your wallet.`
            : h.state === "refunded"
              ? "Refunded to the buyer."
              : h.state === "disputed"
                ? "The buyer reported a problem. Payment is on hold while we review it."
                : h.releaseAt
                  ? `You're paid ${formatNaira(h.netNGN)} on ${formatDay(h.releaseAt)} unless the buyer reports a problem, or sooner if they confirm.`
                  : `${formatNaira(h.netNGN)} is held for you and paid after delivery is confirmed.`}
        </p>
      ))}

      {paid && next && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {asksForNote && (
            <div className="min-w-0 flex-1 basis-56 sm:max-w-xs">
              <Label htmlFor={`note-${order.id}`} className="sr-only">Tracking note</Label>
              <Input
                id={`note-${order.id}`}
                value={note}
                maxLength={200}
                onChange={e => setNote(e.target.value)}
                placeholder="Courier and tracking number (optional)"
                className="h-9"
              />
            </div>
          )}
          <Button size="sm" variant={next.stage === "processing" ? "outline" : "default"} onClick={advance} disabled={fulfil.isPending}>
            {fulfil.isPending && <Loader2 className="animate-spin" aria-hidden />}
            {next.label}
          </Button>
        </div>
      )}
      {!paid && <p className="mt-2 text-[12px] tracking-[-0.017em] text-muted">Ship once payment is confirmed. We&apos;ll show the delivery address then.</p>}
      <FieldError>{error}</FieldError>
    </li>
  );
}
