"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  CircleHelp,
  Naira,
  ShieldCheck,
  Sparkles,
} from "@/components/icons";
import { useFeaturedAds, useRecordAdClick } from "@/lib/queries";
import { type FeaturedAd } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const DEFAULT_ADS: FeaturedAd[] = [
  {
    id: "f0000000-0000-0000-0000-000000000001",
    merchant_id: "00000000-0000-0000-0000-000000000002",
    type: "storefront",
    target_id: "adunni-organics",
    title: "Adunni Organics",
    tagline: "Handcrafted Luxury Skincare · Melanin-First Formulations",
    description:
      "Pure African black soap whipped with Ijebu wild honey, Zobo-petal AHA toners, and cold-pressed botanical oils handcrafted in small batches.",
    badge: "Curated Brand Spotlight",
    image_url: "/images/photos/facial-treatment.webp",
    link_url: "/s/adunni-organics",
    plan: "annual",
    amount_kobo: 12000000,
    status: "active",
    clicks_count: 0,
    impressions_count: 0,
  },
  {
    id: "f0000000-0000-0000-0000-000000000002",
    merchant_id: "00000000-0000-0000-0000-000000000002",
    type: "product",
    target_id: "ose-dudu-honey-cleansing-bar",
    title: "Ọsẹ Dúdú Honey Cleansing Bar",
    tagline: "Raw African black soap whipped with wild honey & unrefined shea",
    description:
      "Balances oily and combination skin without stripping. Free of sulphates, parabens, and synthetic fragrance. Cold-processed in Ibadan.",
    badge: "Spotlight Product",
    image_url: "/images/photos/skin-cream.webp",
    link_url: "/shop/ose-dudu-honey-cleansing-bar",
    plan: "30_days",
    amount_kobo: 1500000,
    status: "active",
    clicks_count: 0,
    impressions_count: 0,
  },
];

export function FeaturedSpotlight() {
  const { data: adsData } = useFeaturedAds(6);
  const clickMutation = useRecordAdClick();

  const ads = adsData && adsData.length > 0 ? adsData : DEFAULT_ADS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");

  const activeAd = ads[currentIndex] || ads[0];

  const handleClick = (ad: FeaturedAd) => {
    if (ad.id && !ad.id.startsWith("f0000000")) {
      clickMutation.mutate(ad.id);
    }
  };

  if (!activeAd) return null;

  const isStorefront = activeAd.type === "storefront";
  const displayImage =
    activeAd.image_url && !activeAd.image_url.startsWith("http")
      ? activeAd.image_url
      : isStorefront
      ? "/images/photos/facial-treatment.webp"
      : "/images/photos/skin-cream.webp";

  return (
    <section
      aria-label="Curated Merchant Spotlight"
      className="group relative isolate overflow-hidden rounded-[36px] border border-hairline/90 bg-surface p-7 sm:p-9 shadow-[0_16px_50px_rgba(42,11,72,0.06)] transition-all duration-300 hover:border-brand/35 hover:shadow-[0_20px_60px_rgba(138,31,199,0.12)]"
    >
      {/* Heatmap Attention Gradient Aura: draws focal eye gaze to the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/5 blur-3xl transition-opacity duration-500 group-hover:bg-brand/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-amber-500/5 blur-3xl transition-opacity duration-500 group-hover:bg-amber-500/10"
      />

      {/* Top Editorial Row (Clean luxury header, no glowing dots or generic pills) */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-hairline/70 pb-5">
        <div className="flex items-center gap-2.5 text-[12px] tracking-wide text-muted">
          <span className="font-bold uppercase tracking-[0.08em] text-brand">
            Curated Spotlight
          </span>
          <span className="text-hairline font-light">/</span>
          <span className="font-semibold text-ink">
            {isStorefront ? "Verified Atelier" : "Top Formulation"}
          </span>
        </div>

        {/* Minimal tactile pagination indicator */}
        {ads.length > 1 && (
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold tracking-tight text-muted">
              0{currentIndex + 1} <span className="opacity-40">/</span> 0{ads.length}
            </span>
            <div className="flex items-center gap-1.5">
              {ads.map((ad, idx) => (
                <button
                  key={ad.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`View featured item ${idx + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                    idx === currentIndex
                      ? "w-6 bg-brand"
                      : "w-2 bg-hairline hover:bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Magazine Layout: High-contrast focal hierarchy */}
      <div className="relative z-10 mt-7 grid grid-cols-1 items-center gap-8 md:grid-cols-12 md:gap-10">
        {/* Left: Framed High-Res Visual Asset */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[26px] bg-canvas shadow-inner md:col-span-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={activeAd.title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        </div>

        {/* Right: Editorial Typography & Magnetic CTA */}
        <div className="flex flex-col justify-between space-y-5 md:col-span-7">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[28px] font-extrabold leading-[1.04] tracking-[-0.04em] text-ink sm:text-[36px]">
                {activeAd.title}
              </h3>
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-brand"
                aria-label="Verified Authenticity"
              />
            </div>

            {activeAd.tagline && (
              <p className="mt-2 text-[16px] font-medium tracking-[-0.015em] text-brand sm:text-[17px]">
                {activeAd.tagline}
              </p>
            )}

            {activeAd.description && (
              <p className="mt-3.5 text-[14px] leading-relaxed tracking-[-0.012em] text-muted sm:text-[15px]">
                {activeAd.description}
              </p>
            )}
          </div>

          {/* Value Badges: Editorial typography matching landing page escrow strip */}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5 border-t border-hairline/80 pt-4 text-[13px] text-muted">
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
              100% Escrow Protected
            </span>
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <BadgeCheck className="h-4 w-4 text-brand" aria-hidden />
              NAFDAC Quality Tested
            </span>
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <Naira className="h-4 w-4 text-brand" aria-hidden />
              Direct Naira Payout
            </span>
          </div>

          {/* Action Row: Primary Conversion CTA + Shopify-style Pricing Modal */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1.5">
            <Link
              href={activeAd.link_url}
              onClick={() => handleClick(activeAd)}
              className="lb-press inline-flex h-13 items-center gap-2 rounded-full bg-brand px-8 text-[15px] font-semibold text-surface shadow-glow hover:bg-brand-deep transition-all duration-200"
            >
              <span>{isStorefront ? "Explore Storefront" : "Shop Featured Product"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>

            {/* Shopify-Style Pricing & ROI Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="lb-press inline-flex h-13 items-center gap-2 rounded-full border border-hairline bg-surface px-6 text-[14px] font-semibold text-ink shadow-pill hover:bg-canvas transition-colors duration-150 cursor-pointer"
                >
                  <CircleHelp className="h-4 w-4 text-brand" aria-hidden />
                  <span>Feature your brand</span>
                  <span className="text-[12px] font-semibold text-brand">From ₦5k/wk</span>
                </button>
              </DialogTrigger>

              <DialogContent className="w-[95vw] sm:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto rounded-[36px] bg-surface p-7 sm:p-10 shadow-float border border-hairline/80">
                <DialogHeader className="text-center sm:text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                      LuxeBeau Growth & Advertising
                    </span>
                  </div>
                  <DialogTitle className="text-[28px] font-black tracking-[-0.04em] text-ink sm:text-[34px] leading-tight">
                    Promote Your Brand Beneath the Hero
                  </DialogTitle>
                  <DialogDescription className="text-[15px] text-muted">
                    Reach 100% of luxury beauty buyers with permanent homepage hero placement and built-in escrow checkout.
                  </DialogDescription>
                </DialogHeader>

                {/* Shopify-Style Billing Cycle Toggle */}
                <div className="mt-7 flex items-center justify-center">
                  <div className="inline-flex items-center rounded-full bg-canvas p-1 border border-hairline">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "rounded-full px-5 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                        billingCycle === "monthly"
                          ? "bg-surface text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      Standard Billing
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("annual")}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                        billingCycle === "annual"
                          ? "bg-brand text-surface shadow-sm"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      <span>Annual Commitment</span>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-bold",
                        billingCycle === "annual" ? "bg-surface/20 text-surface" : "bg-brand/10 text-brand"
                      )}>
                        Save 33% · 4 Mos Free
                      </span>
                    </button>
                  </div>
                </div>

                {/* Shopify 3-Tier Grid Layout */}
                <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
                  {/* Tier 1: Weekly Sprint */}
                  <div className="flex flex-col justify-between rounded-[28px] border border-hairline bg-canvas/70 p-6 transition-all hover:bg-surface hover:shadow-soft">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
                          Starter Boost
                        </span>
                        <span className="text-[11px] font-semibold text-muted">7 Days</span>
                      </div>

                      <div className="mt-4">
                        <span className="text-[34px] font-extrabold tracking-tight text-ink">₦5,000</span>
                        <span className="text-[13px] text-muted ml-1">/ sprint</span>
                      </div>
                      <p className="mt-1 text-[12px] font-medium text-brand">~₦714 per day</p>

                      <p className="mt-4 text-[13px] leading-relaxed text-muted">
                        Ideal for testing new product launches, flash weekend sales, and early traction.
                      </p>

                      <ul className="mt-6 space-y-2.5 border-t border-hairline/80 pt-5 text-[12px] text-ink">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Fixed homepage hero placement
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Verified Merchant badge
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Direct checkout or booking link
                        </li>
                      </ul>
                    </div>

                    <Link
                      href="/partnership/seller?plan=7_days"
                      className="lb-press mt-8 inline-flex h-11 w-full items-center justify-center rounded-full border border-hairline bg-surface text-[13px] font-semibold text-ink shadow-sm hover:bg-canvas transition-colors"
                    >
                      Choose Starter
                    </Link>
                  </div>

                  {/* Tier 2: Monthly Growth (Shopify Hero Highlighted Plan) */}
                  <div className="relative flex flex-col justify-between rounded-[28px] border-2 border-brand bg-surface p-6 shadow-float">
                    <span className="absolute -top-3 right-6 rounded-full bg-brand px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-surface shadow-sm">
                      Most Popular
                    </span>

                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-brand">
                          Monthly Growth
                        </span>
                        <span className="text-[11px] font-semibold text-brand">30 Days</span>
                      </div>

                      <div className="mt-4">
                        <span className="text-[34px] font-extrabold tracking-tight text-brand">₦15,000</span>
                        <span className="text-[13px] text-muted ml-1">/ month</span>
                      </div>
                      <p className="mt-1 text-[12px] font-medium text-emerald-700">₦500/day · Saves 25%</p>

                      <p className="mt-4 text-[13px] leading-relaxed text-muted">
                        Full month continuous visibility for established sellers and active beauty salons.
                      </p>

                      <ul className="mt-6 space-y-2.5 border-t border-hairline/80 pt-5 text-[12px] text-ink">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> 30 days continuous hero spot
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Saves ₦5,000 vs weekly renewal
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Real-time click & impression metrics
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Priority catalog indexing
                        </li>
                      </ul>
                    </div>

                    <Link
                      href="/partnership/seller?plan=30_days"
                      className="lb-press mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-surface shadow-glow hover:bg-brand-deep transition-all"
                    >
                      Choose Monthly Growth
                    </Link>
                  </div>

                  {/* Tier 3: Annual Flagship (Shopify Best Value Tier) */}
                  <div className="flex flex-col justify-between rounded-[28px] border border-amber-300 bg-gradient-to-b from-surface to-amber-50/40 p-6 transition-all hover:shadow-soft">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-amber-800">
                          Annual Flagship
                        </span>
                        <span className="text-[11px] font-bold text-amber-800">365 Days</span>
                      </div>

                      <div className="mt-4">
                        <span className="text-[34px] font-extrabold tracking-tight text-ink">
                          {billingCycle === "annual" ? "₦10,000" : "₦120,000"}
                        </span>
                        <span className="text-[13px] text-muted ml-1">
                          {billingCycle === "annual" ? "/ mo" : "/ year"}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] font-semibold text-amber-800">
                        {billingCycle === "annual"
                          ? "Billed annually at ₦120,000 · Save ₦60k"
                          : "4 Months Free (33% Discount)"}
                      </p>

                      <p className="mt-4 text-[13px] leading-relaxed text-muted">
                        Year-round dominant presence for flagship beauty houses seeking continuous market leadership.
                      </p>

                      <ul className="mt-6 space-y-2.5 border-t border-hairline/80 pt-5 text-[12px] text-ink">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-amber-700 shrink-0" /> 365 days permanent hero banner
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-amber-700 shrink-0" /> Saves ₦60,000 every year
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-amber-700 shrink-0" /> Guaranteed premier badge tier
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-amber-700 shrink-0" /> Dedicated account manager support
                        </li>
                      </ul>
                    </div>

                    <Link
                      href="/partnership/seller?plan=annual"
                      className="lb-press mt-8 inline-flex h-11 w-full items-center justify-center rounded-full border border-amber-400 bg-surface text-[13px] font-semibold text-amber-900 shadow-sm hover:bg-amber-50 transition-colors"
                    >
                      Choose Annual Flagship
                    </Link>
                  </div>
                </div>

                {/* Shopify-Style Comparative Market Matrix */}
                <div className="mt-9 rounded-[28px] bg-canvas p-6 sm:p-7">
                  <h4 className="text-[15px] font-bold tracking-tight text-ink">
                    ROI Comparison: LuxeBeau Spotlight vs Traditional Channels
                  </h4>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 text-[12px]">
                    <div className="rounded-2xl bg-surface p-4 shadow-sm">
                      <p className="font-bold text-ink">Meta / Instagram Ads in NG</p>
                      <p className="mt-1 text-muted leading-snug">
                        Costs ₦4,500–₦15,000/day ($3–$10/day). High bounce rates, bots, and zero purchase escrow guarantee.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-surface p-4 shadow-sm">
                      <p className="font-bold text-ink">Influencer Collaboration</p>
                      <p className="mt-1 text-muted leading-snug">
                        ₦30,000–₦100,000+ for a single 24-hr disappearing story with no long-term indexing.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand/10 p-4 border border-brand/20">
                      <p className="font-bold text-brand">LuxeBeau Hero Spotlight</p>
                      <p className="mt-1 text-brand/90 leading-snug font-medium">
                        As low as <strong>₦328 to ₦500/day</strong>. 100% targeted luxury shoppers, continuous visibility, and built-in escrow checkout.
                      </p>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </section>
  );
}
