"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Loader2, Minus, Plus, X } from "lucide-react";
import SiteShell, { Container } from "@/components/site/shell";
import { Photo } from "@/components/site/catalog";
import { FieldError } from "@/components/site/states";
import { PageHeader } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNaira } from "@/lib/format";
import { useCart, useAuth } from "@/lib/store";
import { useCreateOrder, useWallet } from "@/lib/queries";
import { deliveryFeeNGN, deliverySchema, type OrderResult } from "@/lib/api";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type PayMethod = "wallet" | "card" | "transfer" | "ussd";

const NG_STATES = ["Lagos", "FCT Abuja", "Rivers", "Oyo", "Kano", "Enugu", "Edo", "Ogun", "Kaduna", "Delta", "Anambra", "Other"];

/* pay_method values accepted by POST /orders. Only the wallet settles at
   checkout; the others are confirmed later by the payment provider. */
const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: "card", label: "Card" },
  { id: "transfer", label: "Bank transfer" },
  { id: "ussd", label: "USSD" },
  { id: "wallet", label: "LuxeBeau wallet" },
];

export default function CartPage() {
  const { detailed, setQty, remove, clear, subtotalNGN, count } = useCart();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);
  const createOrder = useCreateOrder();
  const wallet = useWallet(Boolean(user));

  const [checkout, setCheckout] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Lagos");
  const [pay, setPay] = useState<PayMethod>("card");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [placed, setPlaced] = useState<OrderResult | null>(null);

  const fee = deliveryFeeNGN(subtotalNGN);
  const total = subtotalNGN + fee;
  const balance = wallet.data?.balanceNGN;
  const walletShort = pay === "wallet" && (balance === undefined || balance < total);

  /* Contact details prefill from the profile when checkout opens. */
  const openCheckout = () => {
    const current = useAuth.getState().user;
    if (current) {
      setName(n => n || current.name);
      setPhone(p => p || current.phone || "");
    }
    setCheckout(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startCheckout = () => {
    if (!user) {
      showAuth("signin", openCheckout, "Sign in to check out. Your bag is saved.");
      return;
    }
    openCheckout();
  };

  const placeOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const parsed = deliverySchema.safeParse({ name, phone, address, city, state });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    const items = detailed.map(d => ({ product_id: Number(d.product.id), qty: d.qty }));
    if (items.some(i => !Number.isInteger(i.product_id) || i.product_id <= 0)) {
      setFormError("An item in your bag is no longer available. Remove it and try again.");
      return;
    }
    createOrder.mutate(
      { items, delivery: parsed.data, pay_method: pay },
      {
        onSuccess: result => {
          setPlaced(result);
          clear();
          window.scrollTo({ top: 0 });
        },
        onError: err => setFormError(getFriendlyErrorMessage(err, "We couldn't place your order. Please try again.")),
      },
    );
  };

  if (placed) {
    return (
      <SiteShell>
        <Container className="pt-10">
          <div className="mx-auto max-w-md rounded-[28px] bg-surface p-6 shadow-card sm:p-8">
            <CheckCircle2 className="h-8 w-8" strokeWidth={1.5} aria-hidden />
            <h1 className="t-display mt-4">Order {placed.id} placed</h1>
            <p className="mt-2 text-[16px] text-muted">
              {placed.paymentStatus === "paid"
                ? "Paid from your wallet. We've emailed your receipt."
                : "We've emailed your order details. We'll start packing as soon as the payment is confirmed."}
            </p>
            <dl className="mt-5 divide-y divide-hairline text-[14px] tracking-[-0.014em]">
              <div className="flex justify-between py-2.5"><dt className="text-muted">Delivery</dt><dd>{placed.deliveryFeeNGN ? formatNaira(placed.deliveryFeeNGN) : "Free"}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-muted">Total</dt><dd>{formatNaira(placed.totalNGN)}</dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild><Link href="/dashboard">Track order</Link></Button>
              <Button asChild variant="outline"><Link href="/shop">Keep shopping</Link></Button>
            </div>
          </div>
        </Container>
      </SiteShell>
    );
  }

  if (count === 0) {
    return (
      <SiteShell>
        <Container className="pt-8 md:pt-12">
          <PageHeader title="Your bag" />
          <div className="mt-6 rounded-[28px] bg-surface p-8 text-center shadow-card">
            <p className="text-[16px] text-muted">Your bag is empty.</p>
            <Button asChild className="mt-4"><Link href="/shop">Start shopping</Link></Button>
          </div>
        </Container>
      </SiteShell>
    );
  }

  const summary = (
    <dl className="divide-y divide-hairline text-[14px] tracking-[-0.014em]">
      <div className="flex justify-between py-2.5"><dt className="text-muted">Subtotal</dt><dd className="tabular-nums">{formatNaira(subtotalNGN)}</dd></div>
      <div className="flex justify-between py-2.5">
        <dt className="text-muted">Delivery</dt>
        <dd className="tabular-nums">{fee ? formatNaira(fee) : "Free"}</dd>
      </div>
      <div className="flex justify-between py-2.5 text-[16px] tracking-[-0.031em]"><dt>Total</dt><dd className="tabular-nums">{formatNaira(total)}</dd></div>
    </dl>
  );

  return (
    <SiteShell>
      <Container className="pt-8 md:pt-12">
        {checkout ? (
          <button onClick={() => setCheckout(false)} className="inline-flex items-center gap-1 text-[14px] tracking-[-0.014em] text-muted hover:text-ink">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Bag
          </button>
        ) : null}
        <PageHeader title={checkout ? "Checkout" : "Your bag"} subtitle={checkout ? undefined : `${count} item${count === 1 ? "" : "s"}`} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
          {!checkout ? (
            <ul className="divide-y divide-hairline rounded-[28px] bg-surface px-4 shadow-card sm:px-5">
              {detailed.map(({ product, qty }) => (
                <li key={product.id} className="flex gap-3 py-4">
                  <Link href={`/shop/${product.slug}`} className="h-20 w-20 shrink-0 sm:h-24 sm:w-24">
                    <Photo src={product.imageUrl} alt={product.name} fallback="" sizes="sm" className="rounded-[16px]" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] tracking-[-0.017em] text-muted">{product.brand}</p>
                        <Link href={`/shop/${product.slug}`} className="line-clamp-2 text-[14px] tracking-[-0.014em] hover:underline">{product.name}</Link>
                      </div>
                      <button onClick={() => remove(product.id)} className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink" aria-label={`Remove ${product.name}`}>
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                      <div className="flex h-9 items-center rounded-full border border-hairline px-1" role="group" aria-label={`Quantity of ${product.name}`}>
                        <button onClick={() => setQty(product.id, qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-canvas" aria-label="Decrease">
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="w-6 text-center text-[14px] tabular-nums">{qty}</span>
                        <button onClick={() => setQty(product.id, qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-canvas" aria-label="Increase">
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <span className="text-[16px] tabular-nums tracking-[-0.031em]">{formatNaira(product.priceNGN * qty)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <form id="checkout" onSubmit={placeOrder} noValidate className="space-y-8">
              <section aria-label="Delivery" className="rounded-[28px] bg-surface p-5 shadow-card sm:p-6">
                <h2 className="t-sub">Delivery</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="name">Full name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-1.5" aria-invalid={Boolean(errors.name)} />
                    <FieldError>{errors.name}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="0803 123 4567" className="mt-1.5" aria-invalid={Boolean(errors.phone)} />
                    <FieldError>{errors.phone}</FieldError>
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea id="address" value={address} onChange={e => setAddress(e.target.value)} rows={2} autoComplete="street-address" placeholder="House number, street and a landmark" className="mt-1.5 min-h-0" aria-invalid={Boolean(errors.address)} />
                    <FieldError>{errors.address}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="city">City or area</Label>
                    <Input id="city" value={city} onChange={e => setCity(e.target.value)} autoComplete="address-level2" placeholder="Lekki" className="mt-1.5" aria-invalid={Boolean(errors.city)} />
                    <FieldError>{errors.city}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <select id="state" value={state} onChange={e => setState(e.target.value)} className="lb-input mt-1.5 h-11" autoComplete="address-level1">
                      {NG_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section aria-label="Payment" className="rounded-[28px] bg-surface p-5 shadow-card sm:p-6">
                <h2 className="t-sub">Payment</h2>
                <div className="mt-3 overflow-hidden rounded-[20px] border border-hairline" role="radiogroup" aria-label="Payment method">
                  {PAY_METHODS.map((m, i) => {
                    const selected = pay === m.id;
                    const hint = m.id === "wallet" ? (balance !== undefined ? `Balance ${formatNaira(balance)}` : "Balance unavailable") : null;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPay(m.id)}
                        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas", i > 0 && "border-t border-hairline")}
                      >
                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-ink" : "border-stone")} aria-hidden>
                          {selected && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}
                        </span>
                        <span className="flex-1 text-[16px] tracking-[-0.031em]">{m.label}</span>
                        {hint && <span className="text-[12px] text-muted">{hint}</span>}
                      </button>
                    );
                  })}
                </div>
                {walletShort && <FieldError>Your wallet balance doesn&apos;t cover this order. Choose another method.</FieldError>}
              </section>
              {formError && <FieldError>{formError}</FieldError>}
            </form>
          )}

          <aside className="h-fit rounded-[28px] bg-surface p-5 shadow-card sm:p-6 lg:sticky lg:top-8" aria-label="Order summary">
            {summary}
            {fee > 0 && <p className="mt-1 text-[12px] text-muted">Free delivery from {formatNaira(10000)}.</p>}
            {checkout ? (
              <Button type="submit" form="checkout" size="lg" disabled={createOrder.isPending || walletShort} className="mt-5 w-full">
                {createOrder.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Place order · {formatNaira(total)}
              </Button>
            ) : (
              <Button onClick={startCheckout} size="lg" className="mt-5 w-full">Checkout</Button>
            )}
          </aside>
        </div>
      </Container>
    </SiteShell>
  );
}
