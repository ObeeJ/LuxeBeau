"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, CheckCircle2, Loader2 } from "@/components/icons";
import { Panel, RecordList, StatusPill } from "@/components/dashboard/widgets";
import { ImageField } from "@/components/dashboard/image-field";
import { Photo } from "@/components/site/catalog";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { formatLagosDateTime } from "@/lib/format";
import { useAuth } from "@/lib/store";
import { useWallet } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  AD_TARGETS,
  FALLBACK_PLANS,
  adStatusInfo,
  canPayFromWallet,
  createAd,
  draftSignature,
  durationLabel,
  fetchMyAds,
  formatKobo,
  planLabel,
  useAdPricing,
  useMyAds,
  usePayAdWithWallet,
  validateDraft,
  waitUntilActive,
  walletShortfallKobo,
  type AdDraft,
  type AdPlanId,
  type AdTargetType,
  type MyAd,
} from "@/lib/ads";

type PaystackHandler = { openIframe: () => void };
type PaystackWindow = Window & {
  PaystackPop?: {
    setup: (o: {
      key: string;
      email: string;
      amount: number;
      ref: string;
      currency: string;
      callback: (r: { reference: string }) => void;
      onClose: () => void;
    }) => PaystackHandler;
  };
};

/* Loads Paystack's inline script once (same script the cart uses). */
function loadPaystack(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as PaystackWindow).PaystackPop) return resolve(true);
    const existing = document.getElementById("paystack-inline-js");
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
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
}

type Notice = { kind: "success" | "error" | "info"; text: string } | null;

const EMPTY_DRAFT: AdDraft = {
  type: "storefront",
  targetId: "",
  title: "",
  tagline: "",
  imageUrl: "",
  linkUrl: "",
  plan: "30_days",
};

export function Promote() {
  const user = useAuth(s => s.user);
  const qc = useQueryClient();
  const enabled = Boolean(user);
  const pricing = useAdPricing();
  const wallet = useWallet(enabled);
  const myAds = useMyAds(enabled);
  const payWallet = usePayAdWithWallet();

  const [draft, setDraft] = useState<AdDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ReturnType<typeof validateDraft>>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<"" | "wallet" | "card" | string>("");
  /* The ad created from the current form, so retrying never makes a duplicate. */
  const created = useRef<{ sig: string; ad: MyAd } | null>(null);
  const uid = useId();

  const plans = useMemo(() => (pricing.data && pricing.data.length > 0 ? pricing.data : FALLBACK_PLANS), [pricing.data]);
  const plan = plans.find(p => p.id === draft.plan) ?? plans[0];
  const balance = wallet.data?.balanceKobo;
  const walletOk = canPayFromWallet(balance, plan.amountKobo);
  const set = <K extends keyof AdDraft>(k: K, v: AdDraft[K]) => setDraft(d => ({ ...d, [k]: v }));

  const ensureAd = async (): Promise<MyAd | null> => {
    const found = validateDraft(draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setNotice({ kind: "error", text: "Check the highlighted fields and try again." });
      return null;
    }
    const sig = draftSignature(draft);
    if (created.current?.sig === sig) return created.current.ad;
    const ad = await createAd(draft);
    created.current = { sig, ad };
    qc.invalidateQueries({ queryKey: ["me", "ads"] });
    return ad;
  };

  const done = (text: string) => {
    setNotice({ kind: "success", text });
    created.current = null;
    setDraft(EMPTY_DRAFT);
    setErrors({});
  };

  const walletPay = async (ad: MyAd, fromForm: boolean) => {
    try {
      await payWallet.mutateAsync(ad.id);
      if (fromForm) done("Payment received. Your ad is now live.");
      else setNotice({ kind: "success", text: `Payment received. "${ad.title}" is now live.` });
    } catch (e) {
      if (e instanceof ApiError && e.code === "INSUFFICIENT_BALANCE") {
        setNotice({ kind: "error", text: "Your wallet balance is too low for this ad. Pay with card instead, or top up your wallet." });
      } else if (e instanceof ApiError && e.status === 409) {
        qc.invalidateQueries({ queryKey: ["me", "ads"] });
        setNotice({ kind: "info", text: "This ad was already paid for or can no longer be paid. Check My ads below." });
      } else {
        setNotice({ kind: "error", text: getFriendlyErrorMessage(e, "We couldn't take payment. Nothing was charged. Please try again.") });
      }
    }
  };

  const cardPay = async (ad: MyAd, fromForm: boolean) => {
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
    const loaded = await loadPaystack();
    const pop = (window as PaystackWindow).PaystackPop;
    if (!loaded || !pop || !publicKey) {
      setNotice({ kind: "error", text: "We couldn't open the card payment window. Check your connection and try again." });
      return;
    }
    const email = useAuth.getState().user?.email;
    if (!email) {
      setNotice({ kind: "error", text: "Add an email to your account to pay by card." });
      return;
    }
    pop
      .setup({
        key: publicKey,
        email,
        amount: ad.amount_kobo, // exact kobo integer
        ref: ad.id, // the ad id is the payment reference
        currency: "NGN",
        callback: () => {
          setBusy("verify");
          setNotice({ kind: "info", text: "Payment received. Confirming with Paystack, this takes a few seconds." });
          waitUntilActive(fetchMyAds, ad.id)
            .then(live => {
              if (live) {
                if (fromForm) done("Payment confirmed. Your ad is now live.");
                else setNotice({ kind: "success", text: `Payment confirmed. "${ad.title}" is now live.` });
              } else {
                setNotice({ kind: "info", text: "We have your payment and are still activating the ad. It will show as Live in My ads shortly." });
              }
            })
            .finally(() => {
              setBusy("");
              qc.invalidateQueries({ queryKey: ["me", "ads"] });
            });
        },
        onClose: () => setNotice({ kind: "info", text: "Payment window closed. Your ad is saved as unpaid in My ads." }),
      })
      .openIframe();
  };

  const run = async (method: "wallet" | "card") => {
    setNotice(null);
    setBusy(method);
    try {
      const ad = await ensureAd();
      if (!ad) return;
      if (method === "wallet") await walletPay(ad, true);
      else await cardPay(ad, true);
    } catch (e) {
      setNotice({ kind: "error", text: getFriendlyErrorMessage(e, "We couldn't create your ad. Check the details and try again.") });
    } finally {
      setBusy(b => (b === "verify" ? b : ""));
    }
  };

  const payExisting = async (ad: MyAd, method: "wallet" | "card") => {
    setNotice(null);
    setBusy(ad.id);
    try {
      if (method === "wallet") await walletPay(ad, false);
      else await cardPay(ad, false);
    } finally {
      setBusy(b => (b === "verify" ? b : ""));
    }
  };

  const target = AD_TARGETS.find(t => t.id === draft.type) ?? AD_TARGETS[0];
  const fieldId = (n: string) => `${uid}-${n}`;
  const working = busy !== "";

  return (
    <div className="space-y-5">
      <Panel title="Promote your business" aria-label="Promote">
        <p className="-mt-2 mb-5 max-w-prose text-[14px] text-muted">
          Feature your storefront, a product or your services on the LuxeBeau home page. Pick a plan, add your details and pay. Your ad goes live as soon as payment clears.
        </p>

        {pricing.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 w-full rounded-[20px]" />)}
          </div>
        ) : (
          <fieldset>
            <legend className="t-meta mb-2 font-normal">Choose a plan</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map(p => {
                const selected = p.id === draft.plan;
                return (
                  <label
                    key={p.id}
                    className={cn(
                      "relative flex cursor-pointer flex-col gap-1 rounded-[20px] border p-4 transition-all duration-200 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
                      selected ? "border-brand bg-brand-wash shadow-glow" : "border-hairline bg-surface hover:border-brand",
                    )}
                  >
                    <input
                      type="radio"
                      name={fieldId("plan")}
                      value={p.id}
                      checked={selected}
                      onChange={() => set("plan", p.id as AdPlanId)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between text-[14px] font-semibold">
                      {durationLabel(p.days)}
                      {selected && <Check className="h-4 w-4 text-brand" aria-hidden />}
                    </span>
                    <span className="text-[24px] font-bold tabular-nums tracking-[-0.03em]">{formatKobo(p.amountKobo)}</span>
                    {p.tag && <span className="text-[12px] text-muted">{p.tag}</span>}
                  </label>
                );
              })}
            </div>
            {pricing.isError && (
              <p className="mt-2 text-[12px] text-muted">We couldn&apos;t load live prices, so these are our standard rates. You will see the exact amount before paying.</p>
            )}
          </fieldset>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <form noValidate onSubmit={e => e.preventDefault()} className="grid gap-4" aria-label="Ad details">
            <div>
              <label htmlFor={fieldId("type")} className="t-meta mb-1.5 block font-normal">What to promote</label>
              <select
                id={fieldId("type")}
                className="lb-input h-11"
                value={draft.type}
                aria-describedby={fieldId("type-hint")}
                onChange={e => set("type", e.target.value as AdTargetType)}
              >
                {AD_TARGETS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <p id={fieldId("type-hint")} className="mt-1 text-[12px] text-muted">{target.hint}</p>
            </div>

            <Field id={fieldId("target")} label={draft.type === "storefront" ? "Storefront handle" : draft.type === "product" ? "Product id or slug" : "Artisan id"} error={errors.targetId}>
              <input id={fieldId("target")} className="lb-input h-11" value={draft.targetId} onChange={e => set("targetId", e.target.value)} aria-invalid={Boolean(errors.targetId)} aria-describedby={errors.targetId ? `${fieldId("target")}-err` : undefined} placeholder={draft.type === "storefront" ? "adunni-organics" : ""} autoComplete="off" />
            </Field>

            <Field id={fieldId("title")} label="Title" error={errors.title}>
              <input id={fieldId("title")} className="lb-input h-11" value={draft.title} maxLength={150} onChange={e => set("title", e.target.value)} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? `${fieldId("title")}-err` : undefined} placeholder="Handcrafted skincare from Ibadan" />
            </Field>

            <Field id={fieldId("tagline")} label="Tagline (optional)" error={errors.tagline}>
              <input id={fieldId("tagline")} className="lb-input h-11" value={draft.tagline} maxLength={255} onChange={e => set("tagline", e.target.value)} aria-describedby={errors.tagline ? `${fieldId("tagline")}-err` : undefined} />
            </Field>

            <div>
              <ImageField label="Ad image" value={draft.imageUrl} onChange={v => set("imageUrl", v)} />
              <label htmlFor={fieldId("image")} className="t-meta mb-1.5 mt-3 block font-normal">Or paste an image link</label>
              <input id={fieldId("image")} type="url" inputMode="url" className="lb-input h-11" value={draft.imageUrl} onChange={e => set("imageUrl", e.target.value)} aria-invalid={Boolean(errors.imageUrl)} aria-describedby={errors.imageUrl ? `${fieldId("image")}-err` : undefined} placeholder="https://" />
              <div id={`${fieldId("image")}-err`}><FieldError>{errors.imageUrl}</FieldError></div>
            </div>

            <Field id={fieldId("link")} label="Link (optional)" error={errors.linkUrl}>
              <input id={fieldId("link")} className="lb-input h-11" value={draft.linkUrl} onChange={e => set("linkUrl", e.target.value)} aria-invalid={Boolean(errors.linkUrl)} aria-describedby={`${fieldId("link")}-hint${errors.linkUrl ? ` ${fieldId("link")}-err` : ""}`} placeholder="/s/your-handle" />
              <span id={`${fieldId("link")}-hint`} className="mt-1 block text-[12px] text-muted">Leave blank to link straight to what you are promoting.</span>
            </Field>
          </form>

          <AdPreview draft={draft} />
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center">
          <Button size="lg" onClick={() => run("wallet")} disabled={working || !walletOk} aria-describedby={fieldId("wallet-note")}>
            {busy === "wallet" && <Loader2 className="animate-spin" aria-hidden />}
            {wallet.isLoading ? "Checking wallet…" : `Pay with wallet (balance ${balance === undefined ? "unavailable" : formatKobo(balance)})`}
          </Button>
          <Button size="lg" variant="outline" onClick={() => run("card")} disabled={working}>
            {busy === "card" && <Loader2 className="animate-spin" aria-hidden />}
            Pay {formatKobo(plan.amountKobo)} with card
          </Button>
        </div>
        <p id={fieldId("wallet-note")} className="mt-2 text-[12px] text-muted">
          {wallet.isError
            ? "We couldn't read your wallet balance. You can still pay with card."
            : balance !== undefined && !walletOk
              ? `Your wallet is ${formatKobo(walletShortfallKobo(balance, plan.amountKobo))} short for this plan. Pay with card or choose a cheaper plan.`
              : "Wallet payment is instant."}
        </p>

        <div aria-live="polite" role="status" className="mt-4 empty:hidden">
          {notice && (
            <p
              className={cn(
                "flex items-start gap-2 rounded-[16px] px-4 py-3 text-[14px]",
                notice.kind === "success" ? "bg-brand text-surface" : notice.kind === "error" ? "border border-ink bg-surface text-ink" : "bg-brand-wash text-brand-deep",
              )}
            >
              {notice.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              {busy === "verify" && <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden />}
              <span>{notice.text}</span>
            </p>
          )}
        </div>
      </Panel>

      <Panel title="My ads" aria-label="My ads">
        {myAds.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : myAds.isError ? (
          <LoadError onRetry={() => myAds.refetch()} message="We couldn't load your ads." />
        ) : (myAds.data ?? []).length === 0 ? (
          <EmptyState>You have no ads yet. Create your first one above.</EmptyState>
        ) : (
          <RecordList>
            {(myAds.data ?? []).map(ad => (
              <AdRow
                key={ad.id}
                ad={ad}
                busy={busy === ad.id || busy === "verify"}
                walletOk={canPayFromWallet(balance, ad.amount_kobo)}
                onWallet={() => payExisting(ad, "wallet")}
                onCard={() => payExisting(ad, "card")}
              />
            ))}
          </RecordList>
        )}
      </Panel>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="t-meta mb-1.5 block font-normal">{label}</label>
      {children}
      <div id={`${id}-err`}><FieldError>{error}</FieldError></div>
    </div>
  );
}

/* A simple card showing how the ad will read. Only safe image links render. */
function AdPreview({ draft }: { draft: AdDraft }) {
  const ok = validateDraft({ ...draft, title: "x", targetId: "x" }).imageUrl === undefined;
  return (
    <figure aria-label="Ad preview" className="self-start overflow-hidden rounded-[24px] border border-hairline bg-surface shadow-soft">
      <div className="aspect-[16/10] w-full bg-canvas">
        <Photo src={ok ? draft.imageUrl.trim() : undefined} alt="" fallback={draft.title || "Your ad"} className="rounded-none" />
      </div>
      <figcaption className="p-4">
        <span className="inline-flex h-6 items-center rounded-full bg-brand-wash px-2.5 text-[12px] font-semibold text-brand-deep">Featured Partner</span>
        <p className="mt-2 text-[18px] font-bold tracking-[-0.02em]">{draft.title.trim() || "Your ad title"}</p>
        <p className="mt-1 text-[14px] text-muted">{draft.tagline.trim() || "Your tagline appears here."}</p>
        <p className="mt-3 text-[12px] text-muted">Preview, how shoppers will see your ad.</p>
      </figcaption>
    </figure>
  );
}

function AdRow({ ad, busy, walletOk, onWallet, onCard }: { ad: MyAd; busy: boolean; walletOk: boolean; onWallet: () => void; onCard: () => void }) {
  const info = adStatusInfo(ad.status);
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-4">
      <div className="h-14 w-14 shrink-0">
        <Photo src={ad.image_url || undefined} alt="" fallback={ad.title} sizes="sm" className="rounded-[12px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{ad.title}</p>
          <StatusPill status={info.label === "Live" ? "active" : ad.status === "pending" ? "pending" : ad.status === "expired" ? "cancelled" : "pending"} />
          <span className="sr-only">{info.label}</span>
        </div>
        <p className="mt-0.5 text-[12px] text-muted">
          {planLabel(ad.plan)} · {formatKobo(ad.amount_kobo)} · {info.label}
          {ad.status !== "pending" && ad.starts_at && ad.expires_at
            ? ` · ${formatLagosDateTime(ad.starts_at)} to ${formatLagosDateTime(ad.expires_at)}`
            : ""}
        </p>
        <p className="mt-0.5 text-[12px] tabular-nums text-muted">
          {ad.clicks_count.toLocaleString("en-NG")} clicks · {ad.impressions_count.toLocaleString("en-NG")} views
        </p>
      </div>
      {ad.status === "pending" && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onWallet} disabled={busy || !walletOk} title={walletOk ? undefined : "Your wallet balance is too low"}>
            Pay now from wallet
          </Button>
          <Button size="sm" variant="outline" onClick={onCard} disabled={busy}>
            Pay now by card
          </Button>
        </div>
      )}
    </li>
  );
}
