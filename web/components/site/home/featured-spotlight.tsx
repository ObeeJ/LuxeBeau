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
      {/* Heatmap Attention Gradient Aura: Pure LuxeBeau brand purple depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/5 blur-3xl transition-opacity duration-500 group-hover:bg-brand/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-brand-wash/40 blur-3xl transition-opacity duration-500 group-hover:bg-brand-wash/60"
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

            {/* LuxeBeau Design System: Pricing & Market Benchmark Dialog */}
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

              <DialogContent className="w-[94vw] sm:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-surface p-6 sm:p-9 shadow-float border border-hairline">
                <DialogHeader className="text-center sm:text-left space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                      Spotlight Advertising
                    </span>
                  </div>
                  <DialogTitle className="text-[26px] sm:text-[32px] font-black tracking-[-0.03em] text-ink leading-tight">
                    Promote Your Brand Beneath the Hero
                  </DialogTitle>
                  <DialogDescription className="text-[14px] text-muted max-w-2xl leading-relaxed">
                    Reach verified Nigerian luxury beauty buyers with permanent homepage hero placement and built-in escrow checkout.
                  </DialogDescription>
                </DialogHeader>

                {/* Billing Cycle Segmented Control: Matching Landing Page Filter Aesthetic */}
                <div className="mt-6 flex items-center justify-center">
                  <div className="inline-flex items-center rounded-full bg-canvas p-1 border border-hairline">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "rounded-full px-5 py-2 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                        billingCycle === "monthly"
                          ? "bg-brand text-surface shadow-glow"
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
                          ? "bg-brand text-surface shadow-glow"
                          : "text-muted hover:text-ink"
                      )}
                    >
                      <span>Annual Commitment</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          billingCycle === "annual"
                            ? "bg-surface/20 text-surface"
                            : "bg-brand-wash text-brand"
                        )}
                      >
                        Save 33% · 4 Mos Free
                      </span>
                    </button>
                  </div>
                </div>

                {/* 3-Tier Grid Layout: Responsive, Single Brand Color Only */}
                <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                  {/* Tier 1: Starter Boost */}
                  <div className="min-w-0 flex flex-col justify-between rounded-[28px] border border-hairline bg-canvas p-6 transition-all hover:border-brand/40 hover:bg-surface">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0 rounded-full bg-surface border border-hairline px-3 py-1 text-[11px] font-bold text-muted">
                          7-Day Sprint
                        </span>
                        <span className="text-[11px] font-semibold text-muted">
                          Trial Tier
                        </span>
                      </div>

                      <h4 className="mt-3 text-[20px] font-extrabold tracking-tight text-ink">
                        Starter Boost
                      </h4>

                      <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[34px] font-black tracking-tight text-ink">₦5,000</span>
                        <span className="text-[13px] font-medium text-muted">/ sprint</span>
                      </div>
                      <p className="mt-0.5 text-[12px] font-semibold text-brand">~₦714 per day</p>

                      <p className="mt-3 text-[13px] leading-relaxed text-muted">
                        Ideal for testing new product launches, flash weekend sales, and early traction.
                      </p>

                      <ul className="mt-5 space-y-2.5 border-t border-hairline/80 pt-4 text-[12px] text-ink">
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
                      className="lb-press mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-hairline bg-surface text-[13px] font-semibold text-ink shadow-sm hover:bg-canvas transition-colors"
                    >
                      Select Starter
                    </Link>
                  </div>

                  {/* Tier 2: Monthly Growth (Featured Brand Highlight) */}
                  <div className="min-w-0 flex flex-col justify-between rounded-[28px] border-2 border-brand bg-brand-wash/20 p-6 shadow-soft transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0 rounded-full bg-surface border border-brand/30 px-3 py-1 text-[11px] font-bold text-brand">
                          30-Day Pass
                        </span>
                        <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface shadow-sm">
                          Most Popular
                        </span>
                      </div>

                      <h4 className="mt-3 text-[20px] font-extrabold tracking-tight text-ink">
                        Monthly Growth
                      </h4>

                      <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[34px] font-black tracking-tight text-brand">₦15,000</span>
                        <span className="text-[13px] font-medium text-muted">/ month</span>
                      </div>
                      <p className="mt-0.5 text-[12px] font-semibold text-brand">₦500/day · Saves 25% vs weekly</p>

                      <p className="mt-3 text-[13px] leading-relaxed text-muted">
                        Full month continuous visibility for established sellers and active beauty salons.
                      </p>

                      <ul className="mt-5 space-y-2.5 border-t border-hairline/80 pt-4 text-[12px] text-ink">
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
                      className="lb-press mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-surface shadow-glow hover:bg-brand-deep transition-all"
                    >
                      Select Monthly Growth
                    </Link>
                  </div>

                  {/* Tier 3: Annual Flagship (Pure LuxeBeau Brand Palette - No Amber/Yellow) */}
                  <div className="min-w-0 flex flex-col justify-between rounded-[28px] border border-hairline bg-canvas p-6 transition-all hover:border-brand/40 hover:bg-surface">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="shrink-0 rounded-full bg-surface border border-hairline px-3 py-1 text-[11px] font-bold text-muted">
                          365-Day Flagship
                        </span>
                        <span className="rounded-full bg-brand-wash px-2.5 py-0.5 text-[10px] font-bold text-brand">
                          Save 33%
                        </span>
                      </div>

                      <h4 className="mt-3 text-[20px] font-extrabold tracking-tight text-ink">
                        Annual Partnership
                      </h4>

                      <div className="mt-3 flex items-baseline gap-1.5 flex-wrap">
                        <span className="text-[34px] font-black tracking-tight text-ink">
                          {billingCycle === "annual" ? "₦10,000" : "₦120,000"}
                        </span>
                        <span className="text-[13px] font-medium text-muted">
                          {billingCycle === "annual" ? "/ mo" : "/ year"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] font-semibold text-brand">
                        {billingCycle === "annual"
                          ? "~₦328/day · Billed annually at ₦120,000"
                          : "~₦328/day · 4 Months completely free"}
                      </p>

                      <p className="mt-3 text-[13px] leading-relaxed text-muted">
                        Year-round dominant presence for flagship beauty houses seeking continuous market leadership.
                      </p>

                      <ul className="mt-5 space-y-2.5 border-t border-hairline/80 pt-4 text-[12px] text-ink">
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> 365 days permanent hero banner
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Saves ₦60,000 every year
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Guaranteed premier badge tier
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-brand shrink-0" /> Dedicated account manager support
                        </li>
                      </ul>
                    </div>

                    <Link
                      href="/partnership/seller?plan=annual"
                      className="lb-press mt-6 inline-flex h-11 w-full items-center justify-center rounded-full border border-brand/50 bg-brand-wash/30 text-[13px] font-semibold text-brand shadow-sm hover:bg-brand-wash transition-colors"
                    >
                      Select Annual Partnership
                    </Link>
                  </div>
                </div>

                {/* Market Benchmark: Matching EscrowStrip Design Language */}
                <div className="mt-8 rounded-[24px] bg-canvas p-5 sm:p-6 border border-hairline">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                      Market Benchmark
                    </span>
                  </div>
                  <h4 className="mt-1 text-[16px] font-extrabold tracking-tight text-ink">
                    Why LuxeBeau Spotlight delivers superior return on ad spend
                  </h4>
                  <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-3 text-[12px]">
                    <div className="rounded-2xl bg-surface p-4 border border-hairline shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                        Meta / Instagram Ads
                      </p>
                      <p className="mt-1 text-[14px] font-bold text-ink">₦4,500 – ₦15,000 / day</p>
                      <p className="mt-1.5 text-muted leading-relaxed">
                        High bounce rates, unverified traffic, and zero purchase escrow guarantee.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-surface p-4 border border-hairline shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
                        Influencer Collaboration
                      </p>
                      <p className="mt-1 text-[14px] font-bold text-ink">₦30,000 – ₦100,000+</p>
                      <p className="mt-1.5 text-muted leading-relaxed">
                        Single 24-hr disappearing story with no lasting presence or buyer search indexing.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-brand-wash/30 p-4 border-2 border-brand shadow-sm">
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand">
                        LuxeBeau Hero Spotlight
                      </p>
                      <p className="mt-1 text-[14px] font-bold text-brand">From ~₦328 / day</p>
                      <p className="mt-1.5 text-ink/90 font-medium leading-relaxed">
                        100% targeted luxury beauty buyers, continuous visibility, and built-in escrow checkout.
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
