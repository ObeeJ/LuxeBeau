"use client";

import { useState } from "react";
import { Plus, X } from "@/components/icons";
import { PageHeader, Panel, RecordList, RecordRow, StatusPill } from "@/components/dashboard/widgets";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import {
  useCreateEscrow,
  useDisputeEscrow,
  useFundEscrow,
  useMyEscrows,
  useReleaseEscrow,
  type CreateEscrowInput,
} from "@/lib/queries";
import { type Escrow } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/slide-in-notifications";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { getFriendlyErrorMessage } from "@/lib/errors";

function escrowMeta(e: Escrow, side: "buyer" | "seller") {
  return [
    e.id,
    e.kind,
    side === "seller" && (e.buyerName || e.buyerPhone) ? `buyer ${e.buyerName || e.buyerPhone}` : "",
    e.deliveryCity,
    e.disputeReason ? `dispute: ${e.disputeReason}` : "",
  ].filter(Boolean).join(" · ");
}

export default function EscrowCenter() {
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);
  const { toast } = useToast();

  const escrows = useMyEscrows(Boolean(user));
  const createEscrow = useCreateEscrow();
  const fund = useFundEscrow();
  const release = useReleaseEscrow();
  const dispute = useDisputeEscrow();

  const [showForm, setShowForm] = useState(false);
  const canSell = user?.role === "seller" || user?.role === "artisan" || user?.role === "admin";

  if (!user) {
    return (
      <div className="mx-auto max-w-sm rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <h1 className="t-display">Escrow</h1>
        <p className="mt-2 text-[16px] text-muted">Sign in to see payments held in escrow.</p>
        <Button onClick={() => showAuth("signin")} size="lg" className="mt-5">Sign in</Button>
      </div>
    );
  }

  const act = (fn: typeof fund, id: string, ok: string, reason?: string) =>
    fn.mutate(
      { id, reason },
      {
        onSuccess: () => toast(ok, "success"),
        onError: e => toast(getFriendlyErrorMessage(e, "We couldn't complete that action. Please try again."), "error"),
      },
    );

  const buying = escrows.data?.buying ?? [];
  const selling = escrows.data?.selling ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Escrow"
        subtitle="Funds are held and only released when the buyer confirms delivery."
        action={canSell && <Button onClick={() => setShowForm(true)}><Plus aria-hidden /> New escrow link</Button>}
      />

      {escrows.isLoading ? (
        <div className="space-y-3" aria-busy="true" role="status">
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-[28px] bg-surface" />)}
        </div>
      ) : escrows.isError ? (
        <LoadError onRetry={() => escrows.refetch()} message="We could not load your escrows." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Paying">
            {buying.length === 0 ? (
              <EmptyState>No escrow payments yet.</EmptyState>
            ) : (
              <RecordList>
                {buying.map(e => (
                  <RecordRow
                    key={e.id}
                    title={e.title}
                    meta={escrowMeta(e, "buyer")}
                    amount={formatNaira(e.amountNGN)}
                    status={<StatusPill status={e.state} />}
                    actions={
                      e.state === "pending" ? (
                        <Button size="sm" onClick={() => act(fund, e.id, "Funds secured in escrow.")} disabled={fund.isPending}>Fund from wallet</Button>
                      ) : e.state === "funded" ? (
                        <>
                          <Button size="sm" onClick={() => act(release, e.id, "Funds released to the seller.")} disabled={release.isPending}>Confirm received</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={dispute.isPending}
                            onClick={() => {
                              const r = window.prompt("What went wrong? This opens a dispute for our team to review.");
                              if (r?.trim()) act(dispute, e.id, "Dispute opened. Our team will review it.", r.trim());
                            }}
                          >
                            Open dispute
                          </Button>
                        </>
                      ) : undefined
                    }
                  />
                ))}
              </RecordList>
            )}
          </Panel>

          {canSell && (
            <Panel title="Receiving">
              {selling.length === 0 ? (
                <EmptyState>No incoming escrows yet. Create an escrow link to sell safely to anyone.</EmptyState>
              ) : (
                <RecordList>
                  {selling.map(e => (
                    <RecordRow
                      key={e.id}
                      title={e.title}
                      meta={escrowMeta(e, "seller")}
                      amount={formatNaira(e.amountNGN)}
                      status={<StatusPill status={e.state} />}
                    />
                  ))}
                </RecordList>
              )}
            </Panel>
          )}
        </div>
      )}

      {showForm && (
        <EscrowLinkForm
          pending={createEscrow.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={input =>
            createEscrow.mutate(input, {
              onSuccess: () => { toast("Escrow link created.", "success"); setShowForm(false); },
              onError: e => toast(getFriendlyErrorMessage(e, "We couldn't create your escrow link. Please try again."), "error"),
            })
          }
        />
      )}
    </div>
  );
}

/* POST /escrows: the signed-in user is the payee. The API requires a buyer
   phone because link buyers have no account (escrow/service.go Create). */
function EscrowLinkForm({ pending, onClose, onSubmit }: { pending: boolean; onClose: () => void; onSubmit: (i: CreateEscrowInput) => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const kobo = Math.round(parseFloat(amount) * 100);
    if (!title.trim()) return setError("Describe what you are selling.");
    if (!kobo || kobo <= 0) return setError("Enter an amount above zero.");
    if (!/^0[789][01]\d{8}$/.test(buyerPhone.replace(/\s+/g, ""))) return setError("Enter the buyer's Nigerian phone number, for example 0803 123 4567.");
    setError("");
    onSubmit({
      title: title.trim(),
      amount: kobo,
      buyer_name: buyerName.trim() || undefined,
      buyer_phone: buyerPhone.replace(/\s+/g, ""),
      delivery_city: city.trim() || undefined,
    });
  };

  const field = (label: string, input: React.ReactNode) => (
    <label className="block">
      <span className="t-meta mb-1.5 block">{label}</span>
      {input}
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="New escrow link" onKeyDown={e => e.key === "Escape" && onClose()}>
      <form onSubmit={submit} noValidate className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-float sm:rounded-[28px] sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="t-display">New escrow link</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 hover:bg-canvas"><X className="h-5 w-5" aria-hidden /></button>
        </div>
        <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">We hold the buyer&apos;s funds and release them to you once they confirm delivery.</p>
        <div className="mt-5 grid gap-4">
          {field("What are you selling?", <input value={title} onChange={e => setTitle(e.target.value)} className="lb-input h-11" placeholder="Bridal gele, 2 pieces" />)}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Amount (₦)", <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" className="lb-input h-11" placeholder="40000" />)}
            {field("Delivery city", <input value={city} onChange={e => setCity(e.target.value)} className="lb-input h-11" placeholder="Abuja" />)}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Buyer name", <input value={buyerName} onChange={e => setBuyerName(e.target.value)} className="lb-input h-11" placeholder="Amina" />)}
            {field("Buyer phone", <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} inputMode="tel" className="lb-input h-11" placeholder="0803 123 4567" />)}
          </div>
        </div>
        <FieldError>{error}</FieldError>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create link"}</Button>
        </div>
      </form>
    </div>
  );
}
