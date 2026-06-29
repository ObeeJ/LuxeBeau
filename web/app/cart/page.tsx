"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Lock, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNaira } from "@/lib/format";
import { useCart, useAuth } from "@/lib/store";
import { useCreateOrder } from "@/lib/queries";
import { deliverySchema } from "@/lib/api";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { useToast } from "@/components/ui/slide-in-notifications";

type Step = "bag" | "delivery" | "payment" | "done";
type PayMethod = "card" | "transfer" | "ussd" | "wallet";

const DELIVERY_FEE = 2500;
const NG_CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City", "Other"];
const PAY_METHODS: { id: PayMethod; label: string; hint: string }[] = [
  { id: "card", label: "Debit card", hint: "Visa, Mastercard, Verve" },
  { id: "transfer", label: "Bank transfer", hint: "Pay from any Nigerian bank" },
  { id: "ussd", label: "USSD", hint: "Dial and confirm on your phone" },
  { id: "wallet", label: "Luxe Wallet", hint: "Use your wallet balance" },
];

const ease = [0.22, 1, 0.36, 1] as const;

export default function CartPage() {
  const { detailed, setQty, remove, clear, subtotalNGN, count } = useCart();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);
  const createOrder = useCreateOrder();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("bag");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lagos");
  const [pay, setPay] = useState<PayMethod>("card");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [orderRef, setOrderRef] = useState("");

  const total = subtotalNGN + (count > 0 ? DELIVERY_FEE : 0);

  const goToDelivery = () => {
    if (!user) {
      toast("Please sign in to check out.", "info");
      showAuth("login", () => setStep("delivery"));
      return;
    }
    setStep("delivery");
  };

  const submitDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = deliverySchema.safeParse({ name, phone, address, city, state: city });
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
    setStep("payment");
  };

  const numericId = (id: string) => Number(id.replace(/\D/g, "")) || 1;

  const handlePay = () => {
    createOrder.mutate(
      {
        items: detailed.map(d => ({ product_id: numericId(d.product.id), qty: d.qty })),
        delivery: { name, phone, address, city, state: city },
        pay_method: pay,
      },
      {
        onSuccess: result => {
          setOrderRef(result.reference ?? `LB-${result.id}`);
          clear();
          setStep("done");
          toast("Payment confirmed through Paystack. Receipt sent to your email.", "success");
        },
        onError: () => toast("We could not complete your payment. Please try again.", "error"),
      },
    );
  };

  return (
    <div className="min-h-dvh">
      <SiteNav />

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {step === "done" ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="mx-auto max-w-lg py-16 text-center"
          >
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
            <h1 className="mt-6 font-display text-3xl font-medium">Order confirmed</h1>
            <p className="mt-3 text-lavender-200">
              Reference <span className="font-semibold text-gold-300">{orderRef}</span>. Your items are being
              packed now. Track delivery from your email or your dashboard. Thank you for shopping LuxeBeau.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Button asChild className="rounded-full px-7"><Link href="/shop">Keep shopping</Link></Button>
              <Button asChild variant="outline" className="rounded-full border-velvet-700 px-7"><Link href="/">Back home</Link></Button>
            </div>
          </motion.div>
        ) : (
          <>
            <ol className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest" aria-label="Checkout progress">
              {(["bag", "delivery", "payment"] as const).map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className={step === s ? "text-gold-300" : "text-lavender-400"}>
                    {i + 1}. {s === "bag" ? "Your bag" : s === "delivery" ? "Delivery" : "Payment"}
                  </span>
                  {i < 2 && <span className="h-px w-8 bg-velvet-700" aria-hidden />}
                </li>
              ))}
            </ol>

            <h1 className="mt-6 font-display text-3xl font-medium sm:text-4xl">
              {step === "bag" && <>Your <em className="text-gold-gradient italic">bag</em></>}
              {step === "delivery" && <>Where should we <em className="text-gold-gradient italic">deliver?</em></>}
              {step === "payment" && <>Secure <em className="text-gold-gradient italic">payment</em></>}
            </h1>

            {count === 0 && step === "bag" ? (
              <div className="mt-16 text-center">
                <ShoppingBag className="mx-auto h-12 w-12 text-lavender-400" aria-hidden />
                <p className="mt-4 text-lavender-200">Your bag is empty. The shelf is waiting.</p>
                <Button asChild className="mt-6 rounded-full px-7"><Link href="/shop">Browse the edit</Link></Button>
              </div>
            ) : (
              <div className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3, ease }}
                  >
                    {step === "bag" && (
                      <ul className="space-y-4">
                        {detailed.map(({ product, qty }) => (
                          <li key={product.id} className="card-velvet flex gap-4 rounded-2xl p-4">
                            <div
                              className="h-24 w-24 shrink-0 rounded-xl"
                              style={{ background: `linear-gradient(140deg, ${product.tint[0]}, ${product.tint[1]})` }}
                              aria-hidden
                            />
                            <div className="flex flex-1 flex-col">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h2 className="font-display font-semibold leading-snug">{product.name}</h2>
                                  <p className="text-sm text-lavender-400">{product.brand}</p>
                                </div>
                                <button
                                  onClick={() => { remove(product.id); toast(`${product.name} removed.`, "info"); }}
                                  className="rounded-full p-2 text-lavender-400 transition-colors hover:text-danger"
                                  aria-label={`Remove ${product.name}`}
                                >
                                  <Trash2 className="h-4 w-4" aria-hidden />
                                </button>
                              </div>
                              <div className="mt-auto flex items-center justify-between pt-3">
                                <div className="flex items-center gap-2" role="group" aria-label={`Quantity of ${product.name}`}>
                                  <button onClick={() => setQty(product.id, qty - 1)} className="rounded-full border border-velvet-700 p-1.5 hover:border-royal-400/60" aria-label="Decrease">
                                    <Minus className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{qty}</span>
                                  <button onClick={() => setQty(product.id, qty + 1)} className="rounded-full border border-velvet-700 p-1.5 hover:border-royal-400/60" aria-label="Increase">
                                    <Plus className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                </div>
                                <span className="font-display font-semibold text-gold-300 tabular-nums">{formatNaira(product.priceNGN * qty)}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {step === "delivery" && (
                      <form className="card-velvet space-y-5 rounded-2xl p-6" onSubmit={submitDelivery} noValidate>
                        <div>
                          <Label htmlFor="name">Full name</Label>
                          <Input id="name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" className="mt-1.5" aria-invalid={Boolean(errors.name)} />
                          {errors.name && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.name}</p>}
                        </div>
                        <div>
                          <Label htmlFor="phone">Phone (WhatsApp preferred)</Label>
                          <Input id="phone" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="0803 123 4567" className="mt-1.5" aria-invalid={Boolean(errors.phone)} />
                          {errors.phone && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.phone}</p>}
                        </div>
                        <div>
                          <Label htmlFor="address">Delivery address</Label>
                          <Textarea id="address" value={address} onChange={e => setAddress(e.target.value)} rows={3} autoComplete="street-address" placeholder="14B Admiralty Way, Lekki Phase 1 (white gate beside the pharmacy)" className="mt-1.5" aria-invalid={Boolean(errors.address)} />
                          {errors.address && <p role="alert" className="mt-1.5 text-xs text-danger">{errors.address}</p>}
                          <p className="mt-1.5 text-xs text-lavender-400">Add a landmark. It helps dispatch riders find you faster.</p>
                        </div>
                        <div>
                          <Label htmlFor="city">City</Label>
                          <Select value={city} onValueChange={setCity}>
                            <SelectTrigger id="city" className="mt-1.5"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {NG_CITIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-3 pt-2">
                          <Button type="button" variant="outline" onClick={() => setStep("bag")} className="rounded-full border-velvet-700">
                            <ArrowLeft className="h-4 w-4" aria-hidden /> Back
                          </Button>
                          <Button type="submit" className="flex-1 rounded-full">Continue to payment</Button>
                        </div>
                      </form>
                    )}

                    {step === "payment" && (
                      <div className="card-velvet rounded-2xl p-6">
                        <p className="flex items-center gap-2 text-sm text-lavender-200">
                          <Lock className="h-4 w-4 text-gold-400" aria-hidden />
                          You will be charged <strong className="text-gold-300">{formatNaira(total)}</strong> through Paystack.
                        </p>

                        <fieldset className="mt-6">
                          <legend className="text-sm font-medium text-lavender-200">Choose how to pay</legend>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                            {PAY_METHODS.map(m => (
                              <button
                                key={m.id}
                                type="button"
                                role="radio"
                                aria-checked={pay === m.id}
                                onClick={() => setPay(m.id)}
                                className={`rounded-xl border p-4 text-left transition-colors ${
                                  pay === m.id ? "border-gold-400/70 bg-gold-400/5" : "border-velvet-700 hover:border-royal-400/60"
                                }`}
                              >
                                <p className="text-sm font-semibold">{m.label}</p>
                                <p className="mt-0.5 text-xs text-lavender-400">{m.hint}</p>
                              </button>
                            ))}
                          </div>
                        </fieldset>

                        <div className="mt-6 rounded-xl border border-velvet-700 bg-velvet-950 p-5 text-sm text-lavender-400">
                          <p>Delivering to:</p>
                          <p className="mt-1 text-lavender-100">{name} · {phone}</p>
                          <p>{address}, {city}</p>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <Button type="button" variant="outline" onClick={() => setStep("delivery")} className="rounded-full border-velvet-700">
                            <ArrowLeft className="h-4 w-4" aria-hidden /> Edit details
                          </Button>
                          <Button
                            onClick={handlePay}
                            disabled={createOrder.isPending}
                            className="flex-1 rounded-full bg-gold-400 font-bold text-velvet-950 hover:bg-gold-300"
                          >
                            {createOrder.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                            {createOrder.isPending ? "Contacting Paystack" : `Pay ${formatNaira(total)} securely`}
                          </Button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <aside className="card-velvet h-fit rounded-2xl p-6" aria-label="Order summary">
                  <h2 className="font-display text-lg font-semibold">Summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-lavender-400">Subtotal ({count} item{count === 1 ? "" : "s"})</dt>
                      <dd className="font-semibold tabular-nums">{formatNaira(subtotalNGN)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-lavender-400">Delivery</dt>
                      <dd className="font-semibold tabular-nums">{count > 0 ? formatNaira(DELIVERY_FEE) : formatNaira(0)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-velvet-700/60 pt-3 text-base">
                      <dt className="font-semibold">Total</dt>
                      <dd className="font-display font-semibold text-gold-300 tabular-nums">{formatNaira(total)}</dd>
                    </div>
                  </dl>
                  {step === "bag" && count > 0 && (
                    <Button onClick={goToDelivery} className="mt-6 w-full rounded-full">
                      Checkout <ArrowRight className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                  <p className="mt-4 flex items-center gap-2 text-xs text-lavender-400">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> Payments secured by Paystack. We never store card details.
                  </p>
                </aside>
              </div>
            )}
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
