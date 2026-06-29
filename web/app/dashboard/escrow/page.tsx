"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Plus, Shield, ShieldCheck, X } from "lucide-react";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getFriendlyErrorMessage } from "@/lib/errors";

const stateTone: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  funded: "bg-royal-500/20 text-royal-300",
  released: "bg-success/15 text-success",
  refunded: "bg-lavender-400/15 text-lavender-200",
  disputed: "bg-danger/15 text-danger",
};

function EscrowPill({ state }: { state: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${stateTone[state] ?? "bg-velvet-700 text-lavender-200"}`}>{state}</span>;
}

export default function EscrowCenter() {
  const user = useAuth(s => s.user);
  const { toast } = useToast();
  const enabled = Boolean(user);

  const escrows = useMyEscrows(enabled);
  const createEscrow = useCreateEscrow();
  const fund = useFundEscrow();
  const release = useReleaseEscrow();
  const dispute = useDisputeEscrow();

  const [showForm, setShowForm] = useState(false);

  const canSell = user?.role === "seller" || user?.role === "artisan" || user?.role === "admin";

  if (!user) {
    return (
      <main className="mx-auto max-w-xl py-24 text-center">
        <Lock className="mx-auto h-10 w-10 text-gold-400" aria-hidden />
        <h1 className="mt-6 font-display text-3xl font-medium">Secure escrow</h1>
        <p className="mt-3 text-lavender-200">Sign in to protect your payments with LuxeBeau escrow.</p>
        <Link href="/dashboard" className="mt-8 inline-block rounded-full bg-royal-500 px-7 py-3 text-sm font-semibold transition-colors hover:bg-royal-400">Back to your account</Link>
      </main>
    );
  }

  const act = (fn: typeof fund, id: string, ok: string, reason?: string) =>
    fn.mutate(
      { id, reason },
      { onSuccess: () => toast(ok, "success"), onError: e => toast(getFriendlyErrorMessage(e, "We couldn't perform this action. Please check your internet connection and try again."), "error") },
    );

  const buying = escrows.data?.buying ?? [];
  const selling = escrows.data?.selling ?? [];

  return (
    <main className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Secure escrow
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium">Protected payments</h1>
          <p className="mt-1 text-sm text-lavender-400">Funds are held safely and only released when delivery is confirmed.</p>
        </div>
        {canSell && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-full bg-royal-500 px-6 py-3 text-sm font-semibold transition-colors hover:bg-royal-400">
            <Plus className="h-4 w-4" aria-hidden /> New escrow link
          </button>
        )}
      </header>

      {escrows.isLoading ? (
        <div className="mt-8 space-y-3" aria-busy="true" role="status">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full bg-velvet-800/60" />)}
        </div>
      ) : escrows.isError ? (
        <div className="mt-8"><LoadError onRetry={() => escrows.refetch()} message="We could not load your escrows." /></div>
      ) : (
        <>
          {/* Buying */}
          <section className="mt-8" aria-label="Escrows you are paying">
            <h2 className="font-display text-lg font-semibold">Paying</h2>
            {buying.length === 0 ? (
              <p className="mt-4 rounded-2xl border border-velvet-700 p-6 text-center text-sm text-lavender-400">No escrow payments yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {buying.map(e => (
                  <EscrowCard key={e.id} e={e} side="buyer">
                    {e.state === "pending" && (
                      <button onClick={() => act(fund, e.id, "Payment completed successfully. Your funds are secured in escrow.")} disabled={fund.isPending} className="rounded-full bg-gold-400 px-4 py-2 text-xs font-bold text-velvet-950 transition-colors hover:bg-gold-300 disabled:opacity-60">Fund now</button>
                    )}
                    {e.state === "funded" && (
                      <>
                        <button onClick={() => act(release, e.id, "Funds released to the seller successfully. Thank you for using LuxeBeau!")} disabled={release.isPending} className="rounded-full bg-success/90 px-4 py-2 text-xs font-bold text-velvet-950 transition-colors hover:bg-success disabled:opacity-60">Confirm received</button>
                        <button
                          onClick={() => { const r = window.prompt("What went wrong? (this opens a dispute)"); if (r) act(dispute, e.id, "Dispute has been formally opened. Our support team will review the details and contact both parties.", r); }}
                          disabled={dispute.isPending}
                          className="rounded-full border border-danger/50 px-4 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                        >Open dispute</button>
                      </>
                    )}
                  </EscrowCard>
                ))}
              </ul>
            )}
          </section>

          {/* Selling */}
          {canSell && (
            <section className="mt-10" aria-label="Escrows where you are paid">
              <h2 className="font-display text-lg font-semibold">Receiving</h2>
              {selling.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-velvet-700 p-6 text-center text-sm text-lavender-400">
                  No incoming escrows yet. Create an escrow link to sell safely to anyone, even off-platform.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {selling.map(e => (
                    <EscrowCard key={e.id} e={e} side="seller" />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      {showForm && (
        <EscrowLinkForm
          pending={createEscrow.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={input =>
            createEscrow.mutate(input, {
              onSuccess: () => { toast("Escrow link created successfully! Share it with your buyer to secure payment.", "success"); setShowForm(false); },
              onError: e => toast(getFriendlyErrorMessage(e, "We couldn't create your escrow link. Please try again."), "error"),
            })
          }
        />
      )}
    </main>
  );
}

function EscrowCard({ e, side, children }: { e: Escrow; side: "buyer" | "seller"; children?: React.ReactNode }) {
  return (
    <li className="card-velvet flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 shrink-0 text-gold-400" aria-hidden />
          <p className="truncate font-semibold">{e.title}</p>
          <EscrowPill state={e.state} />
        </div>
        <p className="mt-1 text-xs text-lavender-400">
          {e.id} · {e.kind}
          {side === "seller" && (e.buyerName || e.buyerPhone) ? ` · buyer ${e.buyerName || e.buyerPhone}` : ""}
          {e.deliveryCity ? ` · ${e.deliveryCity}` : ""}
          {e.disputeReason ? ` · dispute: ${e.disputeReason}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-display text-lg font-semibold text-gold-300">{formatNaira(e.amountNGN)}</span>
        {children}
      </div>
    </li>
  );
}

function EscrowLinkForm({ pending, onClose, onSubmit }: { pending: boolean; onClose: () => void; onSubmit: (i: CreateEscrowInput) => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [city, setCity] = useState("");

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const kobo = Math.round(parseFloat(amount) * 100);
    if (!title.trim() || !kobo || kobo <= 0) return;
    onSubmit({
      title: title.trim(),
      amount: kobo,
      buyer_name: buyerName.trim() || undefined,
      buyer_phone: buyerPhone.trim() || undefined,
      delivery_city: city.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-velvet-950/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="New escrow link" onKeyDown={e => e.key === "Escape" && onClose()}>
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-velvet-700/70 bg-velvet-900/90 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">New escrow link</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-lavender-300 hover:bg-velvet-800"><X className="h-5 w-5" aria-hidden /></button>
        </div>
        <p className="mt-2 text-sm text-lavender-300">Sell safely to anyone. We hold the buyer&apos;s funds and release them to you once they confirm delivery.</p>
        <div className="mt-5 grid gap-4">
          <label className="block text-sm"><span className="mb-1.5 block text-xs uppercase tracking-wider text-lavender-400">What are you selling?</span>
            <input value={title} onChange={e => setTitle(e.target.value)} required className="lb-input" placeholder="Premium Dunks (UK 9)" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-1.5 block text-xs uppercase tracking-wider text-lavender-400">Amount (₦)</span>
              <input value={amount} onChange={e => setAmount(e.target.value)} required inputMode="decimal" className="lb-input" placeholder="40000" />
            </label>
            <label className="block text-sm"><span className="mb-1.5 block text-xs uppercase tracking-wider text-lavender-400">Delivery city</span>
              <input value={city} onChange={e => setCity(e.target.value)} className="lb-input" placeholder="Abuja" />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm"><span className="mb-1.5 block text-xs uppercase tracking-wider text-lavender-400">Buyer name</span>
              <input value={buyerName} onChange={e => setBuyerName(e.target.value)} className="lb-input" placeholder="Amina" />
            </label>
            <label className="block text-sm"><span className="mb-1.5 block text-xs uppercase tracking-wider text-lavender-400">Buyer WhatsApp</span>
              <input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} inputMode="tel" className="lb-input" placeholder="0803 123 4567" />
            </label>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-velvet-700 px-5 py-2.5 text-sm font-semibold text-lavender-200 transition-colors hover:border-gold-400/60">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-full bg-royal-500 px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-royal-400 disabled:opacity-60">{pending ? "Creating…" : "Create link"}</button>
        </div>
      </form>
    </div>
  );
}
