"use client";

import Link from "next/link";
import { ArrowRight, Play, ShieldCheck, Sparkles } from "lucide-react";
import { RotatingWord } from "./rotating-word";
import { HeroSlider } from "./hero-slider";
import { type Product } from "@/lib/api";
import { Photo } from "@/components/site/catalog";
import { formatNaira } from "@/lib/format";

interface HeroCardProps {
  floating?: Product[];
}

export function HeroCard({ floating = [] }: HeroCardProps) {
  const showFloating = floating.length >= 2;

  return (
    <div className="relative overflow-hidden rounded-[36px] bg-surface p-6 shadow-soft transition-all duration-200 sm:p-8 lg:p-10 border border-hairline/60">
      {/* Background ambient glow */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-brand/5 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-brand-wash/60 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.15fr_1fr] xl:gap-12">
        {/* Left: Headline, Value Proposition & Actions */}
        <div className="flex flex-col justify-center">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-brand-wash px-3.5 py-1 text-[12px] font-bold text-brand-deep shadow-sm mb-4">
            <ShieldCheck className="h-3.5 w-3.5 text-brand" />
            <span>Escrow Protected Marketplace</span>
            <span className="opacity-40">·</span>
            <span>All Nigeria</span>
          </div>

          <h1 className="t-hero text-ink leading-[0.95]">
            Beauty is all about{" "}
            <RotatingWord words={["you", "her", "him", "us"]} />
          </h1>

          <p className="mt-4 max-w-md text-[16px] text-muted leading-relaxed">
            Curated beauty for everyone. Verified sellers and artisans across Nigeria.
            Every kobo held safely in escrow until you inspect and approve.
          </p>

          {/* Call to Actions */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/shop"
              className="lb-press inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-surface shadow-glow hover:bg-brand-deep transition-all duration-150"
            >
              <span>Start shopping</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/dashboard/escrow"
              className="lb-press inline-flex h-12 items-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold text-ink shadow-soft hover:bg-canvas border border-hairline transition-all duration-150"
            >
              <Play className="h-3.5 w-3.5 fill-ink" />
              <span>How escrow works</span>
            </Link>
          </div>

          {/* Quick micro-perks */}
          <div className="mt-8 pt-6 border-t border-hairline flex flex-wrap items-center gap-5 text-[13px] text-muted">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-wash text-brand text-[11px] font-bold">
                ✓
              </span>
              Verified Sellers & Artisans
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-wash text-brand text-[11px] font-bold">
                ₦
              </span>
              Pay on Delivery Approval
            </span>
          </div>
        </div>

        {/* Right: Fluid Slide Showcase & Floating Cards */}
        <div className="relative flex items-center justify-center">
          {/* Main Fluid Hero Slider */}
          <div className="w-full aspect-[4/5] sm:aspect-[4/4.5] md:aspect-[4/4.8] max-h-[500px] lg:max-h-[520px]">
            <HeroSlider className="h-full w-full" />
          </div>

          {/* Floating Product Spotlight (Desktop/Tablet) */}
          {showFloating && floating[0] && (
            <div
              className="lb-idle pointer-events-none absolute -bottom-4 -left-4 hidden w-[148px] rounded-2xl bg-surface/95 p-2 shadow-card backdrop-blur-md border border-hairline sm:block lg:-left-6"
              style={{ animationDelay: "-1.2s", transform: "rotate(-3deg)" }}
              aria-hidden
            >
              <div className="aspect-square overflow-hidden rounded-xl">
                <Photo
                  src={floating[0]?.imageUrl}
                  alt=""
                  fallback={floating[0]?.brand || ""}
                  sizes="sm"
                />
              </div>
              <p className="mt-1.5 truncate text-[11px] font-semibold text-ink">
                {floating[0]?.name}
              </p>
              <p className="text-[11px] text-muted">
                {formatNaira(floating[0]?.priceNGN || 0)}
              </p>
            </div>
          )}

          {/* Escrow badge pill (Desktop) */}
          <div
            className="pointer-events-none absolute -top-3 -right-3 hidden items-center gap-2 rounded-2xl bg-surface/95 px-3 py-2 shadow-card backdrop-blur-md border border-hairline sm:flex lg:-right-4"
            aria-hidden
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-surface">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="text-left text-[11px] leading-tight">
              <p className="font-bold text-ink">100% Escrow</p>
              <p className="text-muted text-[10px]">Funds locked safely</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
