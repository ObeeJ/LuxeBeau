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
  Star,
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

// Reliable local photography that loads instantly without external hostname dependencies
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
    badge: "Featured Partner",
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
    badge: "Featured Spotlight",
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
      aria-label="Featured Partner Spotlight"
      className="group relative rounded-[32px] bg-surface p-6 shadow-soft transition-all duration-300 hover:shadow-float sm:p-8"
    >
      {/* Eyebrow & Navigation Row (Clean typographic header, NO pill badges) */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline/60 pb-5">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-brand" aria-hidden />
          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-brand">
            {activeAd.badge || "Featured Partner"} · Verified LuxeBeau Merchant
          </p>
        </div>

        {/* Minimal dot indicators matching LuxeBeau home layout */}
        {ads.length > 1 && (
          <div className="flex items-center gap-2">
            {ads.map((ad, idx) => (
              <button
                key={ad.id || idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`View featured item ${idx + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all duration-200 cursor-pointer",
                  idx === currentIndex ? "w-7 bg-brand" : "w-2 bg-hairline hover:bg-muted"
                )}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="mt-6 grid grid-cols-1 items-center gap-6 md:grid-cols-12 md:gap-8">
        {/* Left Side: Photo with LuxeBeau's signature smooth radius & overlay */}
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[24px] bg-canvas md:col-span-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImage}
            alt={activeAd.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>

        {/* Right Side: Editorial Information */}
        <div className="flex flex-col justify-between space-y-5 md:col-span-7">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink sm:text-[32px]">
                {activeAd.title}
              </h3>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand" aria-label="Verified" />
            </div>

            {activeAd.tagline && (
              <p className="mt-1.5 text-[15px] font-medium tracking-[-0.014em] text-brand sm:text-[16px]">
                {activeAd.tagline}
              </p>
            )}

            {activeAd.description && (
              <p className="mt-3 text-[14px] leading-relaxed tracking-[-0.014em] text-muted sm:text-[15px]">
                {activeAd.description}
              </p>
            )}
          </div>

          {/* Trust Value Signals: Typographic format matching EscrowStrip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-hairline/60 pt-4 text-[13px] text-muted">
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden />
              100% Escrow Protected
            </span>
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <BadgeCheck className="h-4 w-4 text-brand" aria-hidden />
              NAFDAC / Quality Checked
            </span>
            <span className="flex items-center gap-1.5 font-medium text-ink">
              <Naira className="h-4 w-4 text-brand" aria-hidden />
              Direct Naira Payout
            </span>
          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <Link
              href={activeAd.link_url}
              onClick={() => handleClick(activeAd)}
              className="lb-press inline-flex h-12 items-center gap-2 rounded-full bg-brand px-7 text-[15px] font-semibold text-surface shadow-glow hover:bg-brand-deep"
            >
              <span>{isStorefront ? "Explore Storefront" : "Shop Featured Product"}</span>
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>

            {/* Pricing & ROI Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="lb-press inline-flex h-12 items-center gap-2 rounded-full bg-surface px-5 text-[14px] font-semibold text-ink shadow-pill hover:bg-canvas border border-hairline cursor-pointer"
                >
                  <CircleHelp className="h-4 w-4 text-brand" aria-hidden />
                  <span>Promote your brand</span>
                  <span className="text-[12px] font-medium text-muted">From ₦5k/wk</span>
                </button>
              </DialogTrigger>

              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-surface p-6 sm:p-8 shadow-float border-0">
                <DialogHeader className="space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                    Advertising & Partner Spotlight
                  </p>
                  <DialogTitle className="text-[26px] font-extrabold tracking-[-0.04em] text-ink sm:text-[30px] leading-tight">
                    Featured Spotlight Pricing & Annual ROI Analysis
                  </DialogTitle>
                  <DialogDescription className="text-[14px] text-muted tracking-[-0.014em]">
                    Prominent homepage placement directly beneath the hero for verified Nigerian luxury merchants and beauty artisans.
                  </DialogDescription>
                </DialogHeader>

                {/* 3 Pricing Tier Cards (Landing page style cards) */}
                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Tier 1: 7 Days */}
                  <div className="rounded-[24px] bg-canvas p-5 flex flex-col justify-between transition-all hover:shadow-soft">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">Starter Boost</p>
                      <div className="mt-2 text-[28px] font-black tracking-[-0.04em] text-ink">₦5,000</div>
                      <p className="text-[12px] font-semibold text-brand">for 7 Days</p>
                      <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                        ~₦714/day. Ideal for weekend product drops and promotional sprints.
                      </p>
                    </div>
                    <ul className="mt-4 space-y-1.5 border-t border-hairline/80 pt-3 text-[11px] font-medium text-ink">
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-brand" /> Instant hero spot
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-brand" /> Verified badge
                      </li>
                    </ul>
                  </div>

                  {/* Tier 2: 30 Days (Highlighted Standard) */}
                  <div className="relative rounded-[24px] bg-surface p-5 shadow-float border-2 border-brand flex flex-col justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">Monthly Standard</p>
                      <div className="mt-2 text-[28px] font-black tracking-[-0.04em] text-brand">₦15,000</div>
                      <p className="text-[12px] font-semibold text-ink">for 30 Days (Save 25%)</p>
                      <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                        ₦500/day. Saves ₦5,000 each month compared to four weekly bookings.
                      </p>
                    </div>
                    <ul className="mt-4 space-y-1.5 border-t border-hairline/80 pt-3 text-[11px] font-medium text-ink">
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-brand" /> 30 days continuous
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-brand" /> Click & reach metrics
                      </li>
                    </ul>
                  </div>

                  {/* Tier 3: Annual (Best Value) */}
                  <div className="rounded-[24px] bg-canvas p-5 flex flex-col justify-between transition-all hover:shadow-soft border border-gold/40">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gold-dark font-extrabold">
                        Annual · 4 Months Free
                      </p>
                      <div className="mt-2 text-[28px] font-black tracking-[-0.04em] text-ink">₦120,000</div>
                      <p className="text-[12px] font-semibold text-brand">for 365 Days (1 Year)</p>
                      <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                        <strong className="text-ink">₦10,000/mo flat</strong> (~₦328/day). 33% off; saves ₦60,000 annually.
                      </p>
                    </div>
                    <ul className="mt-4 space-y-1.5 border-t border-hairline/80 pt-3 text-[11px] font-medium text-ink">
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-brand" /> Year-round prominence
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3 w-3 text-brand" /> Top prestige tier
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Comparative Economics Analysis */}
                <div className="mt-5 rounded-[24px] bg-canvas p-5">
                  <h4 className="text-[14px] font-bold tracking-tight text-ink">
                    Why is this good & cheap enough for Nigerian brands?
                  </h4>
                  <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-muted">
                    <p>
                      <strong className="text-ink">• vs Meta / Instagram Ads:</strong> Instagram ads in Nigeria typically cost ₦4,500 to ₦15,000/day ($3–$10/day) with high bounce rates, bot traffic, and zero purchase guarantee. LuxeBeau costs as low as <strong className="text-brand">₦328/day</strong> with 100% targeted luxury beauty shoppers.
                    </p>
                    <p>
                      <strong className="text-ink">• vs Influencer Shoutouts:</strong> A single 24-hour disappearing Instagram or TikTok story costs ₦30,000 to ₦100,000+. LuxeBeau gives 30 full days of hero visibility for only ₦15,000.
                    </p>
                    <p>
                      <strong className="text-ink">• Escrow Conversion:</strong> Shoppers buy directly through trust-backed escrow, ensuring higher checkout rates for featured sellers.
                    </p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
                  <p className="text-[12px] font-medium text-muted">
                    Available to approved LuxeBeau Sellers and Artisans
                  </p>
                  <Link
                    href="/partnership/seller"
                    className="lb-press inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-[14px] font-semibold text-surface shadow-glow hover:bg-brand-deep"
                  >
                    <span>Apply for Featured Placement</span>
                    <ArrowRight className="h-4 w-4" aria-hidden />
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
