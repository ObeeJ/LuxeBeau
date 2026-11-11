"use client";

import { useState } from "react";
import { Loader2 } from "@/components/icons";
import { StatusPill } from "@/components/dashboard/widgets";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { BookingActionDialog, type BookingActionKind } from "@/components/dashboard/booking-action-dialog";
import { useConfirmBooking } from "@/lib/queries";
import { canCancel, canComplete, canNoShow, completeBlockedReason, freeCancelText, isLateCancel, noShowBlockedReason } from "@/lib/booking-actions";
import { type MyBooking } from "@/lib/api";
import { bookingStart, formatLagosDateTime } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { useNow } from "@/lib/use-now";

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

/* A button that stays visible when it can't be used and says why in words,
   linked to the button so screen readers hear it too. */
function ActionButton({ label, reason, enabled, onClick, id, variant }: { label: string; reason: string; enabled: boolean; onClick: () => void; id: string; variant?: "outline" }) {
  return (
    <div className="flex max-w-[16rem] flex-col gap-1">
      <Button size="sm" variant={variant} onClick={onClick} disabled={!enabled} aria-describedby={!enabled && reason ? id : undefined}>{label}</Button>
      {!enabled && reason && <span id={id} className="text-[12px] tracking-[-0.017em] text-muted">{reason}</span>}
    </div>
  );
}

/* One booking, as the client or the artisan sees it. Rules (free-cancellation
   notice, late cancellation, no-show) are enforced by the API; this only
   explains them and offers the actions that apply. */
export function BookingRow({ booking: b, viewer }: { booking: MyBooking; viewer: "client" | "artisan" }) {
  const confirm = useConfirmBooking();
  const [dialog, setDialog] = useState<BookingActionKind | null>(null);
  const [error, setError] = useState("");

  const start = bookingStart(b.date, b.time);
  const now = useNow();
  const started = start.getTime() <= now;
  const open = b.status === "pending" || b.status === "confirmed";
  const busy = confirm.isPending;
  const fail = (fallback: string) => ({ onError: (e: unknown) => setError(getFriendlyErrorMessage(e, fallback)) });

  const policy = open && !started && viewer === "client" ? freeCancelText(b, now) : "";
  const lateNow = isLateCancel(b, viewer, now);

  const verb = viewer === "artisan" && b.status === "pending" ? "Decline" : "Cancel";
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
          {b.status === "completed" && <p className="mt-1.5 text-[12px] tracking-[-0.017em] text-muted">{viewer === "artisan" ? "You marked this appointment as done." : "The artisan marked this appointment as done."}</p>}
          {b.status === "no_show" && <p className="mt-1.5 text-[12px] tracking-[-0.017em] text-muted">{viewer === "artisan" ? "Recorded as a no-show. It counts against the client's record." : "Recorded as a no-show. This counts against your record for 90 days."}</p>}
          {b.status === "cancelled" && (
            <p className="mt-1.5 text-[12px] tracking-[-0.017em] text-muted">{cancelledText(b, viewer)}</p>
          )}
        </div>
        <StatusPill status={statusLabel(b, viewer)} />
      </div>

      {open && (
        <div className="mt-3 flex flex-wrap items-start gap-2">
          {viewer === "artisan" && b.status === "pending" && !started && (
            <Button size="sm" onClick={() => { setError(""); confirm.mutate(b.id, fail("We couldn't confirm this booking.")); }} disabled={busy}>
              {confirm.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Confirm
            </Button>
          )}
          {viewer === "artisan" && b.status === "confirmed" && (
            <>
              <ActionButton label="Mark complete" reason={completeBlockedReason(b, now)} enabled={canComplete(b, now)} onClick={() => setDialog("complete")} id={`${b.id}-complete`} />
              <ActionButton label="No-show" variant="outline" reason={noShowBlockedReason(b, now)} enabled={canNoShow(b, now)} onClick={() => setDialog("no_show")} id={`${b.id}-noshow`} />
            </>
          )}
          {canCancel(b, now) && (
            <Button size="sm" variant="outline" onClick={() => { setError(""); setDialog("cancel"); }} disabled={busy} aria-describedby={lateNow ? `${b.id}-late` : undefined}>
              {viewer === "client" ? "Cancel booking" : verb}
            </Button>
          )}
        </div>
      )}
      {lateNow && canCancel(b, now) && <span id={`${b.id}-late`} className="sr-only">Cancelling now is recorded as a late cancellation.</span>}

      {dialog && <BookingActionDialog kind={dialog} booking={b} viewer={viewer} onClose={() => setDialog(null)} />}
      <FieldError>{error}</FieldError>
    </li>
  );
}
