"use client";

import { useRef, useState } from "react";
import { Loader2 } from "@/components/icons";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/slide-in-notifications";
import { type MyBooking } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  MAX_CANCEL_REASON,
  isLateCancel,
  useCancelBookingAction,
  useCompleteBookingAction,
  useNoShowBookingAction,
  type BookingViewer,
} from "@/lib/booking-actions";

export type BookingActionKind = "complete" | "no_show" | "cancel";

const COPY: Record<BookingActionKind, { title: string; body: string; confirm: string; done: string; fallback: string }> = {
  complete: {
    title: "Mark this appointment as done?",
    body: "This marks the appointment as done. The client's record is updated.",
    confirm: "Yes, mark complete",
    done: "Appointment marked as done.",
    fallback: "We couldn't update this booking.",
  },
  no_show: {
    title: "Mark as no-show?",
    body: "This counts against the client's record.",
    confirm: "Yes, record no-show",
    done: "Recorded as a no-show.",
    fallback: "We couldn't update this booking.",
  },
  cancel: {
    title: "Cancel this booking?",
    body: "The time slot is released. Nobody is charged: bookings take no online payment.",
    confirm: "Yes, cancel booking",
    done: "Booking cancelled.",
    fallback: "We couldn't cancel this booking.",
  },
};

/* One small confirmation for every booking action. Always states what will
   happen, and for a client's cancel inside the notice window, that it will be
   recorded as a late cancellation (computed fresh when the dialog opens). */
export function BookingActionDialog({
  kind,
  booking: b,
  viewer,
  onClose,
}: {
  kind: BookingActionKind;
  booking: MyBooking;
  viewer: BookingViewer;
  onClose: () => void;
}) {
  const complete = useCompleteBookingAction();
  const noShow = useNoShowBookingAction();
  const cancel = useCancelBookingAction();
  const { toast } = useToast();
  // Judged when the dialog opens, so the late-cancellation warning is never a stale minute-old guess.
  const [openedAt] = useState(() => Date.now());
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const copy = COPY[kind];
  const pending = complete.isPending || noShow.isPending || cancel.isPending;
  const late = kind === "cancel" && isLateCancel(b, viewer, openedAt);
  const who = viewer === "artisan" ? b.client || "the client" : b.artisan || b.with || "the artisan";

  const run = () => {
    if (inFlight.current) return; // a fast double click must not send two requests
    inFlight.current = true;
    setError("");
    const opts = {
      onSuccess: () => {
        toast(copy.done, "success");
        onClose();
      },
      onError: (e: unknown) => setError(getFriendlyErrorMessage(e, copy.fallback)),
      onSettled: () => {
        inFlight.current = false;
      },
    };
    if (kind === "complete") complete.mutate({ id: b.id }, opts);
    else if (kind === "no_show") noShow.mutate({ id: b.id }, opts);
    else cancel.mutate({ id: b.id, reason }, opts);
  };

  return (
    <Dialog open onOpenChange={o => { if (!o && !pending) onClose(); }}>
      <DialogContent className="max-w-md" onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {b.service} with {who}. {copy.body}
          </DialogDescription>
        </DialogHeader>

        {late && (
          <p role="alert" className="rounded-[16px] bg-canvas px-4 py-3 text-[14px] font-semibold tracking-[-0.014em]">
            Free cancellation ended. This will be recorded as a late cancellation on your record, and {b.artisan || "the artisan"} will see it.
          </p>
        )}
        {kind === "cancel" && viewer === "artisan" && (
          <p className="text-[14px] tracking-[-0.014em] text-muted">{who} will be told, and the reason below is shared with them.</p>
        )}

        {kind === "cancel" && (
          <div>
            <Label htmlFor={`cancel-reason-${b.id}`}>Reason (optional)</Label>
            <Textarea
              id={`cancel-reason-${b.id}`}
              value={reason}
              onChange={e => setReason(e.target.value)}
              maxLength={MAX_CANCEL_REASON}
              rows={3}
              disabled={pending}
              className="mt-1.5 min-h-0"
            />
            <p className="mt-1 text-right text-[12px] tabular-nums text-muted">{reason.length}/{MAX_CANCEL_REASON}</p>
          </div>
        )}

        <div aria-live="polite"><FieldError>{error}</FieldError></div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {kind === "cancel" ? "Keep booking" : "Not yet"}
          </Button>
          <Button onClick={run} disabled={pending} aria-busy={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
