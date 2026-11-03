"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, Store, Tag, HelpCircle, Check } from "lucide-react";
import { useFeaturedAds, useRecordAdClick } from "@/lib/queries";
import { type FeaturedAd } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Fallback demo ads if API hasn't loaded or is empty
const DEFAULT_ADS: FeaturedAd[] = [
  {
    id: "f0000000-0000-0000-0000-000000000001",
    merchant_id: "00000000-0000-0000-0000-000000000002",
    type: "storefront",
    target_id: "adunni-organics",
    title: "Adunni Organics",
    tagline: "Handcrafted Luxury Skincare · Melanin-First Formulations",
    description: "Pure African black soap whipped with Ijebu wild honey, Zobo-petal AHA toners, and cold-pressed botanical oils handcrafted in Ibadan.",
    badge: "Featured Brand",
    image_url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80",
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
    tagline: "Raw African black soap whipped with Ijebu wild honey and shea",
    description: "Cold-processed in small batches. Balances oily and combination skin without stripping. Free of sulphates and synthetic fragrance.",
    badge: "Spotlight Product",
    image_url: "https://images.unsplash.com/photo-1608248597359-561b369528d2?auto=format&fit=crop&w=1200&q=80",
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

  const activeAd = ads[currentIndex] || ads[0];

  const handleClick = (ad: FeaturedAd) => {
    if (ad.id && !ad.id.startsWith("f0000000")) {
      clickMutation.mutate(ad.id);
    }
  };

  if (!activeAd) return null;

  const isStorefront = activeAd.type === "storefront";

  return (
    <section
      aria-label="Featured Partner Spotlight"
      className="relative overflow-hidden rounded-[28px] border border-gold/30 bg-gradient-to-br from-surface via-[#FAF7F2] to-surface p-6 shadow-sm transition-all duration-300 hover:border-gold/50 hover:shadow-md sm:p-8"
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline/60 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
            <Sparkles className="h-3 w-3 text-gold" aria-hidden="true" />
            {activeAd.badge || "Featured Partner"}
          </span>
          <span className="hidden items-center gap-1 text-[12px] font-medium text-muted sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Verified LuxeBeau Partner · 100% Escrow Protected
          </span>
        </div>

        {/* Multi-Ad Selector Indicator */}
        {ads.length > 1 && (
          <div className="flex items-center gap-1.5">
            {ads.map((ad, idx) => (
              <button
                key={ad.id || idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`View featured promotion ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-200 ${
                  idx === currentIndex
                    ? "w-6 bg-brand"
                    : "w-2 bg-hairline hover:bg-muted"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Card Content */}
      <div className="mt-6 grid grid-cols-1 items-center gap-6 md:grid-cols-12 md:gap-8">
        {/* Left Side: Creative Image with Luxury Framing */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-subtle md:col-span-5 lg:col-span-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeAd.image_url}
            alt={activeAd.title}
            className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium backdrop-blur-md">
              {isStorefront ? <Store className="h-3 w-3" /> : <Tag className="h-3 w-3" />}
              {isStorefront ? "Brand Storefront" : "Curated Product"}
            </span>
            <span className="rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider">
              Promoted
            </span>
          </div>
        </div>

        {/* Right Side: Business Profile or Featured Product Details */}
        <div className="flex flex-col justify-center space-y-4 md:col-span-7 lg:col-span-8">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[22px] font-extrabold tracking-[-0.03em] text-ink sm:text-[26px]">
                {activeAd.title}
              </h3>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" aria-label="Verified Authenticity" />
            </div>

            {activeAd.tagline && (
              <p className="mt-1 text-[15px] font-semibold text-brand/90 sm:text-[16px]">
                {activeAd.tagline}
              </p>
            )}

            {activeAd.description && (
              <p className="mt-2 text-[14px] leading-relaxed text-muted line-clamp-2 sm:text-[15px]">
                {activeAd.description}
              </p>
            )}
          </div>

          {/* Trust Highlights Strip */}
          <div className="grid grid-cols-2 gap-3 rounded-[16px] bg-surface/80 p-3 text-[13px] sm:grid-cols-3">
            <div className="flex flex-col">
              <span className="text-[11px] text-muted">Guarantee</span>
              <span className="font-semibold text-ink">Escrow Secured</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-muted">Authenticity</span>
              <span className="font-semibold text-ink">NAFDAC / Verified</span>
            </div>
            <div className="col-span-2 flex flex-col sm:col-span-1">
              <span className="text-[11px] text-muted">Dispatch</span>
              <span className="font-semibold text-ink">Nationwide NG</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <Link
              href={activeAd.link_url}
              onClick={() => handleClick(activeAd)}
              className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-[14px] font-semibold text-surface shadow-md transition-all duration-200 hover:bg-brand/90 hover:shadow-lg hover:translate-x-0.5"
            >
              <span>{isStorefront ? "Explore Storefront" : "Shop Featured Product"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-[12px] text-muted underline-offset-4 hover:text-ink hover:underline cursor-pointer"
                >
                  <HelpCircle className="h-3.5 w-3.5 text-brand" />
                  <span>Want your brand featured here?</span>
                  <span className="font-semibold text-brand">From ₦5k/wk · View Pricing & ROI</span>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 sm:p-8">
                <DialogHeader>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-brand/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-brand">
                      Featured Ad Pricing
                    </span>
                  </div>
                  <DialogTitle className="text-[22px] font-black tracking-tight text-ink sm:text-[26px]">
                    Paid Ads & Featured Spotlight: Pricing & Annual Math Analysis
                  </DialogTitle>
                  <DialogDescription className="text-[14px] text-muted">
                    Prominence directly beneath the LuxeBeau hero section for verified Nigerian luxury merchants and beauty artisans.
                  </DialogDescription>
                </DialogHeader>

                {/* 3 Pricing Tier Cards */}
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Tier 1: 7 Days */}
                  <div className="rounded-[20px] border border-hairline bg-surface p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-muted">Starter Boost</span>
                      <div className="mt-2 text-[24px] font-black text-ink">₦5,000</div>
                      <span className="text-[12px] font-medium text-brand">for 7 Days</span>
                      <p className="mt-2 text-[12px] text-muted leading-snug">
                        ₦714/day. Perfect for weekend product drops and flash promotional sprints.
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-hairline text-[11px] text-muted space-y-1">
                      <div className="flex items-center gap-1.5 text-ink"><Check className="h-3 w-3 text-emerald-600" /> Instant hero spot</div>
                      <div className="flex items-center gap-1.5 text-ink"><Check className="h-3 w-3 text-emerald-600" /> Verified badge</div>
                    </div>
                  </div>

                  {/* Tier 2: 30 Days */}
                  <div className="relative rounded-[20px] border-2 border-brand bg-surface p-4 shadow-md flex flex-col justify-between">
                    <span className="absolute -top-3 right-3 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold text-surface uppercase">
                      Most Popular
                    </span>
                    <div>
                      <span className="text-[11px] font-bold uppercase text-brand">Monthly Standard</span>
                      <div className="mt-2 text-[24px] font-black text-brand">₦15,000</div>
                      <span className="text-[12px] font-medium text-muted">for 30 Days</span>
                      <p className="mt-2 text-[12px] text-muted leading-snug">
                        ₦500/day. Saves 25% compared to weekly rate (saves ₦5,000 monthly).
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-hairline text-[11px] text-muted space-y-1">
                      <div className="flex items-center gap-1.5 text-ink"><Check className="h-3 w-3 text-emerald-600" /> Continuous 30 days</div>
                      <div className="flex items-center gap-1.5 text-ink"><Check className="h-3 w-3 text-emerald-600" /> Click & impression tracking</div>
                    </div>
                  </div>

                  {/* Tier 3: Annual */}
                  <div className="rounded-[20px] border border-amber-300 bg-gradient-to-br from-surface to-amber-50/50 p-4 shadow-sm flex flex-col justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-amber-700">Best Value · 33% Off</span>
                      <div className="mt-2 text-[24px] font-black text-ink">₦120,000</div>
                      <span className="text-[12px] font-medium text-brand">for 365 Days (1 Yr)</span>
                      <p className="mt-2 text-[12px] text-muted leading-snug">
                        <strong className="text-ink">₦10,000/mo flat</strong> (~₦328/day). 4 Months completely Free (saves ₦60,000/yr).
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-hairline text-[11px] text-muted space-y-1">
                      <div className="flex items-center gap-1.5 text-ink"><Check className="h-3 w-3 text-emerald-600" /> 365 days prominence</div>
                      <div className="flex items-center gap-1.5 text-ink"><Check className="h-3 w-3 text-emerald-600" /> Guaranteed prestige</div>
                    </div>
                  </div>
                </div>

                {/* Comparative Economics Analysis */}
                <div className="mt-4 rounded-[18px] bg-subtle p-4 text-[13px]">
                  <h4 className="font-bold text-ink">Why is this good & cheap enough for Nigerian brands?</h4>
                  <ul className="mt-2 space-y-1 text-muted text-[12px]">
                    <li>• <strong>vs Meta/Instagram Ads:</strong> Instagram ads in NG cost ₦4,500–₦15,000/day with high bounce rates. LuxeBeau costs as low as ₦328/day with 100% targeted beauty shoppers.</li>
                    <li>• <strong>vs Influencer Posts:</strong> A 24-hr disappearing IG story costs ₦30k–₦100k+. LuxeBeau gives 30 full days of hero placement for only ₦15k.</li>
                    <li>• <strong>Zero Risk Escrow:</strong> Shoppers buy directly through trust-backed escrow, maximizing conversion for featured sellers.</li>
                  </ul>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
                  <span className="text-[12px] text-muted">Available to verified Sellers & Artisans</span>
                  <Link
                    href="/partnership/seller"
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand px-5 py-2.5 text-[13px] font-semibold text-surface shadow hover:bg-brand/90"
                  >
                    <span>Register to Feature</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </section>
  );
}
