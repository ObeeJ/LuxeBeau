"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, Loader2, Minus, Plus, ShieldCheck, X } from "@/components/icons";
import SiteShell, { Container } from "@/components/site/shell";
import { Photo } from "@/components/site/catalog";
import { FieldError } from "@/components/site/states";
import { PageHeader } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNaira } from "@/lib/format";
import { PriceBreakdown } from "@/components/site/price-breakdown";
import { formatKoboNaira, hasCity, useOrderQuote } from "@/lib/quote";
import { useCart, useAuth } from "@/lib/store";
import { useCreateOrder, useWallet } from "@/lib/queries";
import { deliverySchema, verifyOrderPayment, type OrderResult } from "@/lib/api";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { NG_STATES } from "@/lib/data";

type PayMethod = "wallet" | "card" | "transfer" | "ussd";

/* pay_method values accepted by POST /orders. Only the wallet settles at
   checkout; the others are confirmed later by the payment provider. */
const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: "card", label: "Card" },
  { id: "transfer", label: "Bank transfer" },
  { id: "ussd", label: "USSD" },
  { id: "wallet", label: "LuxeBeau wallet" },
];

export default function CartPage() {
  const { detailed, setQty, remove, clear, count } = useCart();
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [isOpeningPaystack, setIsOpeningPaystack] = useState(false);

  const quoteItems = detailed.map(d => ({ product_id: Number(d.product.id), qty: d.qty }));
  const quote = useOrderQuote({ items: quoteItems, city: checkout ? city : "", payMethod: pay });
  const q = quote.data;
  const quoteError = quote.isError ? getFriendlyErrorMessage(quote.error, "We couldn't calculate your total. Please try again.") : undefined;
  const quoteStale = quote.isPlaceholderData || quote.isFetching || quote.settling;
  const balanceKobo = wallet.data?.balanceKobo;
  /* Wallet is compared against the server quote total, never a local sum. */
  const walletShort = pay === "wallet" && (balanceKobo === undefined || (q ? balanceKobo < q.totalKobo : false));
  const canPlace = Boolean(q) && !quote.isError && !quote.settling && !quote.isPlaceholderData && !quote.isFetching;
  const balance = wallet.data?.balanceNGN;

  /* Dynamically loads Paystack inline script if not present */
  const loadPaystack = (): Promise<boolean> => {
    return new Promise(resolve => {
      if (typeof window === "undefined") return resolve(false);
      if ((window as any).PaystackPop) return resolve(true);
      const existing = document.getElementById("paystack-inline-js");
      if (existing) {
        existing.addEventListener("load", () => resolve(true), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.id = "paystack-inline-js";
      script.src = "https://js.paystack.co/v1/inline.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  /* Launches Paystack inline modal for card/transfer/ussd payment */
  const triggerPaystack = async (order: OrderResult) => {
    setIsOpeningPaystack(true);
    const loaded = await loadPaystack();
    setIsOpeningPaystack(false);

    const currentUser = useAuth.getState().user;
    const email = currentUser?.email || "buyer@luxebeau.com";
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_8f297ae20d9fcad597746b3989cca684e971d9f8";

    if (!loaded || !(window as any).PaystackPop) {
      setPlaced(order);
      setFormError("Could not load Paystack modal. You can pay or retry verification below.");
      return;
    }

    const handler = (window as any).PaystackPop.setup({
      key: publicKey,
      email: email,
      amount: order.totalKobo, // the server's exact total in kobo
      ref: order.id,
      currency: "NGN",
      callback: async (response: { reference: string }) => {
        setIsVerifying(true);
        try {
          const verifiedOrder = await verifyOrderPayment(order.id, response.reference);
          setPlaced(verifiedOrder);
        } catch {
          // If immediate API verification is still processing, keep order and wait for webhook
          setPlaced({ ...order, paymentStatus: "paid" });
        } finally {
          setIsVerifying(false);
        }
      },
      onClose: () => {
        setPlaced(order);
      },
    });
    handler.openIframe();
  };

  const manualVerify = async (orderId: string) => {
    setIsVerifying(true);
    setFormError("");
    try {
      const verified = await verifyOrderPayment(orderId);
      setPlaced(verified);
    } catch (err) {
      setFormError(getFriendlyErrorMessage(err, "Payment has not yet been confirmed by Paystack. Please complete payment first."));
    } finally {
      setIsVerifying(false);
    }
  };

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
    const items = quoteItems;
    if (items.some(i => !Number.isInteger(i.product_id) || i.product_id <= 0)) {
      setFormError("An item in your bag is no longer available. Remove it and try again.");
      return;
    }
    if (!canPlace) {
      setFormError("We are still calculating your total. Please wait a moment and try again.");
      return;
    }
    createOrder.mutate(
      { items, delivery: parsed.data, pay_method: pay },
      {
        onSuccess: result => {
          clear();
          window.scrollTo({ top: 0 });
          if (pay === "wallet") {
            setPlaced(result);
          } else {
            // Trigger Paystack inline checkout popup
            setPlaced(result);
            triggerPaystack(result);
          }
        },
        onError: err => setFormError(getFriendlyErrorMessage(err, "We couldn't place your order. Please try again.")),
      },
    );
  };

  if (placed) {
    const isPaid = placed.paymentStatus === "paid";
    return (
      <SiteShell>
        <Container className="pt-10">
          <div className="mx-auto max-w-md rounded-[32px] bg-surface p-6 shadow-soft sm:p-8">
            <div className="flex items-center gap-3">
              {isPaid ? (
                <CheckCircle2 className="h-8 w-8 text-brand" strokeWidth={1.75} aria-hidden />
              ) : (
                <ShieldCheck className="h-8 w-8 text-amber-500" strokeWidth={1.75} aria-hidden />
              )}
              <div>
                <h1 className="t-display text-[22px]">Order {placed.id}</h1>
                <p className="text-[13px] font-medium text-muted">
                  {isPaid ? "Payment confirmed • Escrow funded" : "Pending payment • Reserved"}
                </p>
              </div>
            </div>

            <p className="mt-3 text-[14px] leading-relaxed text-muted">
              {isPaid
                ? "Your payment is safely held in LuxeBeau Escrow. The seller will only be paid once you receive and confirm your order."
                : "Your items are reserved. Complete your payment via Paystack to fund escrow and release your order for dispatch."}
            </p>

            {formError && (
              <div className="mt-3 rounded-xl bg-destructive/10 p-3 text-[13px] text-destructive">
                {formError}
              </div>
            )}

            <dl className="mt-5 divide-y divide-hairline text-[14px] tracking-[-0.014em]">
              <div className="flex justify-between py-2.5"><dt className="text-muted">Payment status</dt><dd className="font-semibold capitalize text-ink">{placed.paymentStatus}</dd></div>
            </dl>
            <h2 className="mt-4 text-[13px] font-bold">Price breakdown</h2>
            <PriceBreakdown className="mt-1" payMethod={placed.paymentMethod} amounts={placed} />

            {!isPaid && (
              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  onClick={() => triggerPaystack(placed)}
                  disabled={isOpeningPaystack || isVerifying}
                  className="w-full"
                >
                  {isOpeningPaystack && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Pay {formatKoboNaira(placed.totalKobo)} with Paystack
                </Button>
                <Button
                  onClick={() => manualVerify(placed.id)}
                  disabled={isVerifying}
                  variant="outline"
                  className="w-full text-[13px]"
                >
                  {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  I have already paid (Verify now)
                </Button>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2.5 border-t border-hairline pt-4">
              <Button asChild variant={isPaid ? "default" : "outline"}><Link href="/dashboard">Track order</Link></Button>
              <Button asChild variant="ghost"><Link href="/shop">Keep shopping</Link></Button>
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
          <div className="mt-6 rounded-[32px] bg-surface p-8 text-center shadow-soft">
            <p className="text-[16px] text-muted">Your bag is empty.</p>
            <Button asChild className="mt-4"><Link href="/shop">Start shopping</Link></Button>
          </div>
        </Container>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Container className="pt-8 md:pt-12">
        {checkout ? (
          <button onClick={() => setCheckout(false)} className="lb-press inline-flex items-center gap-1 text-[14px] font-medium tracking-[-0.014em] text-muted hover:text-ink">
            <ChevronLeft className="h-4 w-4" aria-hidden /> Back to Bag
          </button>
        ) : null}
        <PageHeader title={checkout ? "Checkout" : "Your bag"} subtitle={checkout ? undefined : `${count} item${count === 1 ? "" : "s"}`} />

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:gap-10">
          {!checkout ? (
            <ul className="divide-y divide-hairline rounded-[32px] bg-surface px-4 shadow-soft sm:px-6">
              {detailed.map(({ product, qty }) => (
                <li key={product.id} className="flex gap-4 py-5">
                  <Link href={`/shop/${product.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-[18px] sm:h-24 sm:w-24">
                    <Photo src={product.imageUrl} alt={product.name} fallback={product.brand} sizes="sm" className="rounded-[18px]" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium tracking-[-0.017em] text-muted">{product.brand}</p>
                        <Link href={`/shop/${product.slug}`} className="line-clamp-2 text-[14px] font-semibold tracking-[-0.014em] hover:underline">
                          {product.name}
                        </Link>
                      </div>
                      <button
                        onClick={() => remove(product.id)}
                        className="lb-press -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-ink"
                        aria-label={`Remove ${product.name}`}
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                      <div className="flex h-9 items-center rounded-full border border-hairline px-1" role="group" aria-label={`Quantity of ${product.name}`}>
                        <button onClick={() => setQty(product.id, qty - 1)} className="lb-press flex h-7 w-7 items-center justify-center rounded-full hover:bg-canvas" aria-label="Decrease">
                          <Minus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <span className="w-6 text-center text-[14px] font-semibold tabular-nums">{qty}</span>
                        <button onClick={() => setQty(product.id, qty + 1)} className="lb-press flex h-7 w-7 items-center justify-center rounded-full hover:bg-canvas" aria-label="Increase">
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                      <span className="text-[16px] font-bold tabular-nums tracking-[-0.031em]">{formatNaira(product.priceNGN * qty)}</span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <form id="checkout" onSubmit={placeOrder} noValidate className="space-y-8">
              <section aria-label="Delivery" className="rounded-[32px] bg-surface p-5 shadow-soft sm:p-6">
                <h2 className="t-sub font-bold">Delivery address</h2>
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

              <section aria-label="Payment" className="rounded-[32px] bg-surface p-5 shadow-soft sm:p-6">
                <h2 className="t-sub font-bold">Payment method</h2>
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
                        className={cn("lb-press flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-canvas", i > 0 && "border-t border-hairline")}
                      >
                        <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-brand" : "border-stone")} aria-hidden>
                          {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                        </span>
                        <span className="flex-1 text-[15px] font-medium tracking-[-0.031em]">{m.label}</span>
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

          <aside className="h-fit rounded-[32px] bg-surface p-5 shadow-soft sm:p-6 lg:sticky lg:top-8" aria-label="Order summary">
            <h2 className="mb-2 text-[16px] font-bold tracking-[-0.031em]">Price breakdown</h2>
            <PriceBreakdown
              payMethod={pay}
              amounts={q}
              needsCity={!hasCity(checkout ? city : "")}
              loading={quote.isLoading}
              refreshing={Boolean(q) && quoteStale}
              error={quoteError}
              onRetry={() => quote.refetch()}
            />

            {/* Trust Guarantee Callout beside pay button */}
            <div className="mt-4 rounded-2xl bg-brand-wash p-3 text-[12px] text-brand-deep">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand" />
                LuxeBeau Trust Protection
              </p>
              <p className="mt-1 opacity-90 leading-tight">
                Your payment is held securely. Sellers are only paid after you inspect and confirm your package.
              </p>
            </div>

            {checkout ? (
              <Button type="submit" form="checkout" size="lg" disabled={createOrder.isPending || walletShort || !canPlace} className="mt-5 w-full">
                {createOrder.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Place order{q ? ` · ${formatKoboNaira(q.totalKobo)}` : ""}
              </Button>
            ) : (
              <Button onClick={startCheckout} size="lg" className="mt-5 w-full">
                Checkout
              </Button>
            )}
          </aside>
        </div>
      </Container>
    </SiteShell>
  );
}
