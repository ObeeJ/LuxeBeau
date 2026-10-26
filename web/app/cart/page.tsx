"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import SiteShell, { Container } from "@/components/site/shell";
import { ProductImage } from "@/components/site/catalog";
import { FieldError } from "@/components/site/states";
import { PageHeader, StatusPill } from "@/components/dashboard/widgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatNaira } from "@/lib/format";
import { useCart, useAuth } from "@/lib/store";
import { useCreateOrder, useWallet } from "@/lib/queries";
import { deliveryFeeNGN, deliverySchema, type OrderResult } from "@/lib/api";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { useToast } from "@/components/ui/slide-in-notifications";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Step = "bag" | "delivery" | "review";
type PayMethod = "wallet" | "card" | "transfer" | "ussd";

const NG_STATES = ["Lagos", "FCT Abuja", "Rivers", "Oyo", "Kano", "Enugu", "Edo", "Ogun", "Kaduna", "Delta", "Anambra", "Other"];

/* pay_method values accepted by POST /orders (order/handler.go). Only the
   wallet settles at checkout; the others create the order with payment
   pending until the provider's webhook confirms it. */
const PAY_METHODS: { id: PayMethod; label: string; hint: string }[] = [
  { id: "wallet", label: "LuxeBeau wallet", hint: "Charged now from your balance" },
  { id: "card", label: "Debit card", hint: "Payment confirmed by the provider" },
  { id: "transfer", label: "Bank transfer", hint: "Payment confirmed by the provider" },
  { id: "ussd", label: "USSD", hint: "Payment confirmed by the provider" },
];

const STEPS: { id: Step; label: string }[] = [
  { id: "bag", label: "Bag" },
  { id: "delivery", label: "Delivery" },
  { id: "review", label: "Review" },
];

export default function CartPage() {
  const { detailed, setQty, remove, clear, subtotalNGN, count } = useCart();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);
  const createOrder = useCreateOrder();
  const wallet = useWallet(Boolean(user));
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("bag");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("Lagos");
  const [pay, setPay] = useState<PayMethod>("wallet");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [placed, setPlaced] = useState<OrderResult | null>(null);

  const fee = deliveryFeeNGN(subtotalNGN);
  const total = subtotalNGN + fee;
  const balance = wallet.data?.balanceNGN;
  const walletShort = pay === "wallet" && balance !== undefined && balance < total;

  /* Prefill contact details from the signed-in profile (read at click time,
     after the persisted session has rehydrated). */
  const openDelivery = () => {
    const current = useAuth.getState().user;
    if (current) {
      setName(n => n || current.name);
      setPhone(p => p || current.phone || "");
    }
    setStep("delivery");
  };

  const goToDelivery = () => {
    if (!user) {
      toast("Please sign in to check out.", "info");
      showAuth("login", openDelivery);
      return;
    }
    openDelivery();
  };

  const submitDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = deliverySchema.safeParse({ name, phone, address, city, state });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setStep("review");
  };

  const placeOrder = () => {
    const items = detailed.map(d => ({ product_id: Number(d.product.id), qty: d.qty }));
    if (items.some(i => !Number.isInteger(i.product_id) || i.product_id <= 0)) {
      toast("One of the items in your bag is no longer available. Please remove it and try again.", "error");
      return;
    }
    createOrder.mutate(
      { items, delivery: { name, phone, address, city, state }, pay_method: pay },
      {
        onSuccess: result => {
          setPlaced(result);
          clear();
          toast(`Order ${result.id} placed.`, "success");
        },
        onError: err => toast(getFriendlyErrorMessage(err, "We couldn't place your order. Please try again."), "error"),
      },
    );
  };

  if (placed) {
    return (
      <SiteShell>
        <Container className="pt-10">
          <div className="mx-auto max-w-lg rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
            <CheckCircle2 className="mx-auto h-10 w-10" strokeWidth={1.5} aria-hidden />
            <h1 className="t-display mt-4">Order placed</h1>
            <p className="mt-2 text-[16px] text-muted">Reference <span className="text-ink">{placed.id}</span></p>
            <dl className="mx-auto mt-5 max-w-xs divide-y divide-hairline text-left text-[14px] tracking-[-0.014em]">
              <div className="flex justify-between py-2.5"><dt className="text-muted">Total</dt><dd>{formatNaira(placed.totalNGN)}</dd></div>
              <div className="flex justify-between py-2.5"><dt className="text-muted">Delivery</dt><dd>{placed.deliveryFeeNGN ? formatNaira(placed.deliveryFeeNGN) : "Free"}</dd></div>
              <div className="flex items-center justify-between py-2.5"><dt className="text-muted">Payment</dt><dd><StatusPill status={placed.paymentStatus} /></dd></div>
            </dl>
            {placed.paymentStatus !== "paid" && (
              <p className="t-meta mt-4 font-normal text-muted">Your payment shows as pending until the payment provider confirms it.</p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild><Link href="/dashboard">Track my orders</Link></Button>
              <Button asChild variant="outline"><Link href="/shop">Keep shopping</Link></Button>
            </div>
          </div>
        </Container>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <Container className="pt-8 md:pt-12">
        <PageHeader eyebrow="Checkout" title={step === "bag" ? "Your bag" : step === "delivery" ? "Delivery details" : "Review and place order"} />

        <ol className="mt-4 flex flex-wrap gap-2" aria-label="Checkout progress">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              aria-current={step === s.id ? "step" : undefined}
              className={cn(
                "inline-flex h-8 items-center gap-2 rounded-full px-3 text-[12px] tracking-[-0.017em]",
                step === s.id ? "bg-ink text-surface" : "bg-surface text-muted shadow-pill",
              )}
            >
              {i + 1}. {s.label}
            </li>
          ))}
        </ol>

        {count === 0 ? (
          <div className="mt-8 rounded-[28px] bg-surface p-8 text-center shadow-card">
            <ShoppingBag className="mx-auto h-8 w-8" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-[16px] text-muted">Your bag is empty.</p>
            <Button asChild className="mt-5"><Link href="/shop">Browse the shelf</Link></Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div>
              {step === "bag" && (
                <ul className="space-y-3">
                  {detailed.map(({ product, qty }) => (
                    <li key={product.id} className="flex gap-3 rounded-[28px] bg-surface p-2 pr-4 shadow-card">
                      <ProductImage product={{ ...product, category: "" }} size="sm" className="h-24 w-24 shrink-0 sm:h-28 sm:w-28" />
                      <div className="flex min-w-0 flex-1 flex-col py-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="t-sub truncate">{product.brand}</p>
                            <h2 className="line-clamp-2 text-[14px] tracking-[-0.014em] text-muted">{product.name}</h2>
                          </div>
                          <button
                            onClick={() => { remove(product.id); toast(`${product.name} removed from your bag.`, "info"); }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 hover:bg-canvas"
                            aria-label={`Remove ${product.name}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                          <div className="flex h-9 items-center rounded-full border border-hairline px-1" role="group" aria-label={`Quantity of ${product.name}`}>
                            <button onClick={() => setQty(product.id, qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-canvas" aria-label="Decrease">
                              <Minus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                            <span className="w-7 text-center text-[14px] tabular-nums">{qty}</span>
                            <button onClick={() => setQty(product.id, qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-canvas" aria-label="Increase">
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </div>
                          <span className="text-[16px] tabular-nums">{formatNaira(product.priceNGN * qty)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {step === "delivery" && (
                <form className="space-y-4 rounded-[28px] bg-surface p-5 shadow-card sm:p-6" onSubmit={submitDelivery} noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  </div>
                  <div>
                    <Label htmlFor="address">Delivery address</Label>
                    <Textarea id="address" value={address} onChange={e => setAddress(e.target.value)} rows={3} autoComplete="street-address" placeholder="14B Admiralty Way, Lekki Phase 1 (white gate beside the pharmacy)" className="mt-1.5" aria-invalid={Boolean(errors.address)} />
                    <FieldError>{errors.address}</FieldError>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="city">City</Label>
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
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setStep("bag")}>
                      <ArrowLeft aria-hidden /> Bag
                    </Button>
                    <Button type="submit" className="flex-1">Continue</Button>
                  </div>
                </form>
              )}

              {step === "review" && (
                <div className="space-y-4 rounded-[28px] bg-surface p-5 shadow-card sm:p-6">
                  <fieldset>
                    <legend className="t-sub">Payment method</legend>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                      {PAY_METHODS.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          role="radio"
                          aria-checked={pay === m.id}
                          onClick={() => setPay(m.id)}
                          className={cn(
                            "rounded-[20px] border p-4 text-left transition-colors duration-200",
                            pay === m.id ? "border-ink" : "border-hairline hover:bg-canvas",
                          )}
                        >
                          <p className="text-[16px]">{m.label}</p>
                          <p className="t-meta mt-0.5 font-normal text-muted">
                            {m.id === "wallet" && balance !== undefined ? `Balance ${formatNaira(balance)}` : m.hint}
                          </p>
                        </button>
                      ))}
                    </div>
                    {walletShort && (
                      <FieldError>Your wallet balance is lower than this order total. Choose another method.</FieldError>
                    )}
                  </fieldset>

                  <div className="rounded-[20px] bg-canvas p-4 text-[14px] tracking-[-0.014em]">
                    <p className="text-muted">Delivering to</p>
                    <p className="mt-1">{name} · {phone}</p>
                    <p className="text-muted">{address}, {city}, {state}</p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => setStep("delivery")}>
                      <ArrowLeft aria-hidden /> Details
                    </Button>
                    <Button onClick={placeOrder} disabled={createOrder.isPending || walletShort} className="flex-1">
                      {createOrder.isPending && <Loader2 className="animate-spin" aria-hidden />}
                      {createOrder.isPending ? "Placing order" : `Place order · ${formatNaira(total)}`}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <aside className="h-fit rounded-[28px] bg-surface p-5 shadow-card sm:p-6 lg:sticky lg:top-8" aria-label="Order summary">
              <h2 className="t-display">Summary</h2>
              <dl className="mt-4 divide-y divide-hairline text-[14px] tracking-[-0.014em]">
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">Subtotal ({count} item{count === 1 ? "" : "s"})</dt>
                  <dd className="tabular-nums">{formatNaira(subtotalNGN)}</dd>
                </div>
                <div className="flex justify-between py-2.5">
                  <dt className="text-muted">Delivery</dt>
                  <dd className="tabular-nums">{fee ? formatNaira(fee) : "Free"}</dd>
                </div>
                <div className="flex justify-between py-2.5 text-[16px] tracking-[-0.031em]">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatNaira(total)}</dd>
                </div>
              </dl>
              {fee > 0 && <p className="t-meta mt-1 font-normal text-muted">Free delivery on orders of {formatNaira(10000)} or more.</p>}
              {step === "bag" && (
                <Button onClick={goToDelivery} size="lg" className="mt-5 w-full">
                  Checkout <ArrowRight aria-hidden />
                </Button>
              )}
            </aside>
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
