import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch, type MyBooking } from "@/lib/api";
import { bookingStart, formatLagosDateTime } from "@/lib/format";

/* Rules and requests for closing or cancelling a booking. The API enforces
   every rule; these helpers only decide what to offer and what to say, using
   the same arithmetic (api-go: booking/lifecycle.go). Bookings take no online
   payment, so none of these actions move money. */

/** How long after the start an artisan waits before a no-show (api-go: domain.NoShowGrace). */
export const NO_SHOW_GRACE_MINUTES = 15;
export const NO_SHOW_GRACE_MS = NO_SHOW_GRACE_MINUTES * 60 * 1000;
export const MAX_CANCEL_REASON = 300;

export type BookingViewer = "client" | "artisan";
type Timed = Pick<MyBooking, "date" | "time" | "status">;

const startMs = (b: Pick<MyBooking, "date" | "time">) => bookingStart(b.date, b.time).getTime();

/** Pending or confirmed: the only statuses that can still change by cancelling. */
export const isOpen = (b: Pick<MyBooking, "status">) => b.status === "pending" || b.status === "confirmed";

/** Complete is allowed for a confirmed booking once its start time has passed. */
export function canComplete(b: Timed, now: number): boolean {
  return b.status === "confirmed" && now >= startMs(b);
}

/** No-show is allowed for a confirmed booking once start + grace has passed. */
export function canNoShow(b: Timed, now: number): boolean {
  return b.status === "confirmed" && now >= startMs(b) + NO_SHOW_GRACE_MS;
}

/** Cancel is allowed for a pending or confirmed booking that hasn't started. */
export function canCancel(b: Timed, now: number): boolean {
  return isOpen(b) && now < startMs(b);
}

/** Why "Mark complete" is disabled, or "" when it is available. */
export function completeBlockedReason(b: Timed, now: number): string {
  if (b.status !== "confirmed") return "Only a confirmed booking can be marked complete.";
  return canComplete(b, now) ? "" : "Available after the appointment starts.";
}

/** Why "No-show" is disabled, or "" when it is available. */
export function noShowBlockedReason(b: Timed, now: number): string {
  if (b.status !== "confirmed") return "Only a confirmed booking can be marked as a no-show.";
  if (canNoShow(b, now)) return "";
  return `Available ${NO_SHOW_GRACE_MINUTES} minutes after the start time (${formatLagosDateTime(new Date(startMs(b) + NO_SHOW_GRACE_MS))}).`;
}

/**
 * Would cancelling now be recorded as a late cancellation? Only when the
 * client cancels a CONFIRMED booking inside the notice window: the server
 * rule is start - now < policyHours, i.e. now is past free_cancel_until.
 */
export function isLateCancel(b: Pick<MyBooking, "status" | "freeCancelUntil">, viewer: BookingViewer, now: number): boolean {
  if (viewer !== "client" || b.status !== "confirmed" || !b.freeCancelUntil) return false;
  const until = new Date(b.freeCancelUntil).getTime();
  return Number.isFinite(until) && until < now;
}

/** The free-cancellation line for a client, or "" when there is nothing to say. */
export function freeCancelText(b: Pick<MyBooking, "status" | "policyHours" | "freeCancelUntil">, now: number): string {
  if (!isOpen(b)) return "";
  if (b.status === "pending") return "You can withdraw this request any time before it's confirmed.";
  if (b.policyHours === 0) return "Free to cancel any time before the appointment.";
  if (!b.freeCancelUntil) return "";
  const until = new Date(b.freeCancelUntil);
  if (Number.isNaN(until.getTime())) return "";
  return until.getTime() < now
    ? "Free cancellation ended. Cancelling now is recorded as a late cancellation."
    : `Free to cancel until ${formatLagosDateTime(until)}.`;
}

/** Keeps a reason to what the server accepts (300 characters, trimmed). */
export const cleanReason = (s: string) => Array.from(s.trim()).slice(0, MAX_CANCEL_REASON).join("");

export const cancelInputSchema = z.object({ id: z.string().min(1), reason: z.string().max(MAX_CANCEL_REASON).optional() });
const bookingResponse = z.object({ booking: z.unknown() });

/* One mutation per action. Every success refreshes the bookings list (and the
   slot lists a cancel frees up). */
function useBookingMutation<V extends { id: string }>(request: (v: V) => { path: string; method: "POST" | "PATCH"; body?: unknown }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: V) => {
      const r = request(v);
      return apiFetch(r.path, bookingResponse, { method: r.method, body: r.body });
    },
    onSettled: () => {
      // Also on failure: a refused action usually means the list was stale.
      qc.invalidateQueries({ queryKey: ["me", "bookings"] });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me", "slots"] });
      qc.invalidateQueries({ queryKey: ["availability"] });
    },
  });
}

export const useCompleteBookingAction = () =>
  useBookingMutation<{ id: string }>(v => ({ path: `/bookings/${encodeURIComponent(v.id)}/complete`, method: "PATCH" }));
export const useNoShowBookingAction = () =>
  useBookingMutation<{ id: string }>(v => ({ path: `/bookings/${encodeURIComponent(v.id)}/no-show`, method: "PATCH" }));
export const useCancelBookingAction = () =>
  useBookingMutation<{ id: string; reason?: string }>(v => {
    const { id, reason } = cancelInputSchema.parse(v);
    return { path: `/bookings/${encodeURIComponent(id)}/cancel`, method: "POST", body: { reason: cleanReason(reason ?? "") } };
  });
