"use client";

import { useState } from "react";
import { Loader2 } from "@/components/icons";
import { StatusPill } from "@/components/dashboard/widgets";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDisputeEscrow, useReleaseEscrow } from "@/lib/queries";
import { type MyOrder, type OrderHold } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";

/* Dates come from the API as UTC instants; show them as Lagos calendar days. */
const dayFmt = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));

/* One seller's share of the order. The money sits in escrow until the buyer
   confirms delivery, reports a problem, or the confirmation window passes
   (api-go: escrow.HoldOrder, seller.Fulfil, escrow.SweepAutoReleases). */
function Hold({ hold, showSeller }: { hold: OrderHold; showSeller: boolean }) {
  const release = useReleaseEscrow();
  const dispute = useDisputeEscrow();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const busy = release.isPending || dispute.isPending;
  const who = hold.seller || "the seller";

  const confirm = () => {
    if (!window.confirm(`Pay ${who} ${formatNaira(hold.amountNGN)} now? This can't be undone.`)) return;
    setError("");
    release.mutate({ id: hold.id }, { onError: e => setError(getFriendlyErrorMessage(e, "We couldn't release this payment.")) });
  };

  const report = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) return setError("Tell us what went wrong in a sentence or two.");
    setError("");
    dispute.mutate(
      { id: hold.id, reason: reason.trim() },
      { onSuccess: () => setReporting(false), onError: err => setError(getFriendlyErrorMessage(err, "We couldn't send your report.")) },
    );
  };

  let line: string;
  switch (hold.state) {
    case "released":
      line = `Paid to ${who}.`;
      break;
    case "refunded":
      line = `${formatNaira(hold.amountNGN)} refunded to your LuxeBeau wallet.`;
      break;
    case "disputed":
      line = "Your report is with our team. The payment stays held until we decide.";
      break;
    default:
      line = hold.releaseAt
        ? `${who} marked this delivered. Confirm by ${formatDay(hold.releaseAt)}, or the payment goes to them.`
        : `${formatNaira(hold.amountNGN)} is held until ${who} delivers.`;
  }
  const open = hold.state === "funded";

  return (
    <div className="rounded-[16px] bg-canvas px-4 py-3">
      <p className="text-[14px] tracking-[-0.014em]">
        {/* The seller's name is already in the sentence; a prefix only helps when one order has several sellers. */}
        {showSeller && hold.seller && <span className="text-muted">{hold.seller}: </span>}
        {line}
      </p>
      {open && !reporting && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {hold.releaseAt && (
            <Button size="sm" onClick={confirm} disabled={busy}>
              {release.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Confirm delivery
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setReporting(true)} disabled={busy}>Report a problem</Button>
        </div>
      )}
      {open && reporting && (
        <form onSubmit={report} noValidate className="mt-3">
          <Label htmlFor={`report-${hold.id}`}>What went wrong?</Label>
          <Textarea
            id={`report-${hold.id}`}
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="For example: the parcel never arrived, or an item was damaged."
            className="mt-1.5 min-h-0 bg-surface"
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" type="submit" disabled={dispute.isPending}>
              {dispute.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Send report
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => { setReporting(false); setError(""); }}>Cancel</Button>
          </div>
        </form>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/* A buyer's order: summary row plus where each seller's payment stands. */
export function OrderRow({ order, status, subtitle, paymentLabel }: { order: MyOrder; status: string; subtitle?: string; paymentLabel: string }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-48">
          <p className="line-clamp-2 text-[16px] tracking-[-0.031em]">{order.itemSummary}</p>
          {subtitle && <p className="truncate text-[14px] tracking-[-0.014em] text-muted">{subtitle}</p>}
          <p className="mt-0.5 text-[12px] tracking-[-0.017em] text-muted">{`${order.id} · ${order.date} · ${paymentLabel}`}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[16px] tabular-nums tracking-[-0.031em]">{formatNaira(order.totalNGN)}</span>
          <StatusPill status={status} />
        </div>
      </div>
      {order.holds.length > 0 && (
        <div className="mt-3 space-y-2" aria-label={`Payment for order ${order.id}`}>
          {order.holds.map(h => <Hold key={h.id} hold={h} showSeller={order.holds.length > 1} />)}
        </div>
      )}
    </li>
  );
}
