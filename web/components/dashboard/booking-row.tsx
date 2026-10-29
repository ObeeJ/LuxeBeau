"use client";

import { useState } from "react";
import { Loader2 } from "@/components/icons";
import { StatusPill } from "@/components/dashboard/widgets";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCancelBooking, useCompleteBooking, useConfirmBooking, useMarkNoShow } from "@/lib/queries";
import { type MyBooking } from "@/lib/api";
import { bookingStart, formatLagosDateTime } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { useNow } from "@/lib/use-now";

/* How long after the start an artisan waits before recording a no-show (api-go: domain.NoShowGrace). */
const NO_SHOW_GRACE_MS = 15 * 60 * 1000;

/* Who cancelled, in words that fit whoever is reading. */
function cancelledText(b: MyBooking, viewer: "client" | "artisan"): string {
  const late = b.lateCancel ? " (late cancellation)" : "";
  const reason = b.cancelReason && b.cancelledBy !== "system" ? `: ${b.cancelReason}` : ".";
  const mine = (viewer === "client" && b.cancelledBy === "buyer") || (viewer === "artisan" && b.cancelledBy === "artisan");
  if (mine) return `You cancelled this${late}${reason}`;
  switch (b.cancelledBy) {
    case "buyer":
      return `Cancelled by the client${late}${reason}`;
    case "artisan":
      return `Cancelled by the artisan${reason}`;
    case "system":
      return viewer === "artisan"
        ? "Cancelled automatically because you didn't answer in time."
        : "Cancelled because the artisan didn't answer in time. You weren't charged.";
    default:
      return `Cancelled by LuxeBeau${reason}`;
  }
}

function statusLabel(b: MyBooking, viewer: "client" | "artisan") {
  if (b.status === "no_show") return "No-show";
  if (b.status === "pending") return viewer === "artisan" ? "to confirm" : "awaiting confirmation";
  return b.status;
}

/* One booking, as the client or the artisan sees it. Rules (free-cancellation
   notice, late cancellation, no-show) are enforced by the API; this only
   explains them and offers the actions that apply. */
export function BookingRow({ booking: b, viewer }: { booking: MyBooking; viewer: "client" | "artisan" }) {
  const cancel = useCancelBooking();
  const confirm = useConfirmBooking();
  const complete = useCompleteBooking();
  const noShow = useMarkNoShow();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const start = bookingStart(b.date, b.time);
  const now = useNow();
  const started = start.getTime() <= now;
  const open = b.status === "pending" || b.status === "confirmed";
  const freeUntil = b.freeCancelUntil ? new Date(b.freeCancelUntil) : null;
  // The same rule the API applies: only a confirmed booking can be "late".
  const wouldBeLate = viewer === "client" && b.status === "confirmed" && freeUntil !== null && freeUntil.getTime() < now;
  const busy = cancel.isPending || confirm.isPending || complete.isPending || noShow.isPending;
  const fail = (fallback: string) => ({ onError: (e: unknown) => setError(getFriendlyErrorMessage(e, fallback)) });

  const submitCancel = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    cancel.mutate({ id: b.id, reason: reason.trim() }, { onSuccess: () => setCancelling(false), ...fail("We couldn't cancel this booking.") });
  };

  let policy = "";
  if (open && !started && viewer === "client") {
    if (b.status === "pending") policy = "You can withdraw this request any time before it's confirmed.";
    else if (b.policyHours === 0) policy = "Free to cancel any time before the appointment.";
    else if (wouldBeLate) policy = "Cancelling now counts as a late cancellation.";
    else if (freeUntil) policy = `Free to cancel until ${formatLagosDateTime(freeUntil)}.`;
  }

  const verb = viewer === "artisan" && b.status === "pending" ? "Decline" : "Cancel";
  const who = viewer === "artisan" ? b.client || "the client" : b.with || "your artisan";
  const where = b.serviceType === "home" ? `Home visit${b.address ? `: ${b.address}` : ""}` : "At the studio";

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1 basis-56">
          <p className="line-clamp-2 text-[16px] tracking-[-0.031em]">
            {viewer === "artisan" ? `${b.service} · ${b.client || "Client"}` : `${b.service} with ${b.artisan || "your artisan"}`}
          </p>
          <p className="mt-0.5 text-[14px] tracking-[-0.014em] text-muted">{formatLagosDateTime(start)} · {where}</p>
          <p className="mt-0.5 text-[12px] tracking-[-0.017em] text-muted">{b.id}</p>
          {/* Only where the artisan still has a decision to make. */}
          {viewer === "artisan" && b.status === "pending" && b.buyerStrikes > 0 && (
            <p className="mt-1.5 inline-flex rounded-full bg-canvas px-2.5 py-1 text-[12px] tracking-[-0.017em]">
              {b.buyerStrikes} late cancellation{b.buyerStrikes === 1 ? "" : "s"} or no-show{b.buyerStrikes === 1 ? "" : "s"} in the last 90 days
            </p>
          )}
          {policy && <p className="mt-1.5 text-[12px] tracking-[-0.017em] text-muted">{policy}</p>}
          {b.status === "cancelled" && (
            <p className="mt-1.5 text-[12px] tracking-[-0.017em] text-muted">{cancelledText(b, viewer)}</p>
          )}
        </div>
        <StatusPill status={statusLabel(b, viewer)} />
      </div>

      {open && !cancelling && (
        <div className="mt-3 flex flex-wrap gap-2">
          {viewer === "artisan" && b.status === "pending" && !started && (
            <Button size="sm" onClick={() => { setError(""); confirm.mutate(b.id, fail("We couldn't confirm this booking.")); }} disabled={busy}>
              {confirm.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Confirm
            </Button>
          )}
          {viewer === "artisan" && b.status === "confirmed" && started && (
            <>
              <Button size="sm" onClick={() => { setError(""); complete.mutate({ id: b.id }, fail("We couldn't update this booking.")); }} disabled={busy}>
                {complete.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Mark completed
              </Button>
              {now >= start.getTime() + NO_SHOW_GRACE_MS ? (
                <Button size="sm" variant="outline" onClick={() => { setError(""); noShow.mutate({ id: b.id }, fail("We couldn't update this booking.")); }} disabled={busy}>
                  Client didn&apos;t come
                </Button>
              ) : (
                <span className="self-center text-[12px] tracking-[-0.017em] text-muted">You can record a no-show 15 minutes after the start.</span>
              )}
            </>
          )}
          {!started && (
            <Button size="sm" variant="outline" onClick={() => { setError(""); setCancelling(true); }} disabled={busy}>
              {verb}
            </Button>
          )}
        </div>
      )}

      {open && cancelling && (
        <form onSubmit={submitCancel} noValidate className="mt-3 rounded-[16px] bg-canvas p-3">
          {wouldBeLate && (
            <p className="mb-2 text-[14px] tracking-[-0.014em]">
              This is inside {b.policyHours} hours of the appointment, so it will be recorded as a late cancellation. {b.artisan || "The artisan"} will see it. You won&apos;t be charged.
            </p>
          )}
          <Label htmlFor={`reason-${b.id}`}>{viewer === "artisan" ? `Tell ${who} why (optional)` : "Reason (optional)"}</Label>
          <Input id={`reason-${b.id}`} value={reason} onChange={e => setReason(e.target.value)} maxLength={300} className="mt-1.5 h-10 bg-surface" />
          <div className="mt-2.5 flex gap-2">
            <Button size="sm" type="submit" disabled={cancel.isPending}>
              {cancel.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {viewer === "artisan" ? `${verb} booking` : "Yes, cancel"}
            </Button>
            <Button size="sm" type="button" variant="ghost" onClick={() => setCancelling(false)}>Keep it</Button>
          </div>
        </form>
      )}
      <FieldError>{error}</FieldError>
    </li>
  );
}
