"use client";

import Link from "next/link";
import { ArrowRight, Play, ShieldCheck } from "lucide-react";
import { RotatingWord } from "./rotating-word";
import { type Product } from "@/lib/api";
import { Photo } from "@/components/site/catalog";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HeroCardProps {
  floating?: Product[];
}

export function HeroCard({ floating = [] }: HeroCardProps) {
  const showFloating = floating.length >= 4;

  return (
    <div className="relative overflow-hidden rounded-[36px] bg-surface p-6 shadow-soft transition-all duration-200 aspect-[7/10] md:h-[440px] md:aspect-auto xl:aspect-[2.75/1] xl:max-h-[685px] sm:p-10 flex flex-col justify-between">
      {/* Background / Floating product items (Shop.com constellation) */}
      {showFloating && (
        <div className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block" aria-hidden>
          {/* Card 1 */}
          <div
            className="lb-idle absolute top-8 left-[45%] w-[130px] rounded-2xl bg-surface p-1.5 shadow-card"
            style={{ animationDelay: "-0.5s", transform: "rotate(-5deg)" }}
          >
            <div className="aspect-square overflow-hidden rounded-xl">
              <Photo src={floating[0]?.imageUrl} alt="" fallback={floating[0]?.brand || ""} sizes="sm" />
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold">{floating[0]?.name}</p>
            <p className="text-[11px] text-muted">{formatNaira(floating[0]?.priceNGN || 0)}</p>
          </div>

          {/* Card 2 */}
          <div
            className="lb-idle absolute top-12 right-[18%] w-[120px] rounded-2xl bg-surface p-1.5 shadow-card"
            style={{ animationDelay: "-2.2s", transform: "rotate(6deg)" }}
          >
            <div className="aspect-square overflow-hidden rounded-xl">
              <Photo src={floating[1]?.imageUrl} alt="" fallback={floating[1]?.brand || ""} sizes="sm" />
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold">{floating[1]?.name}</p>
          </div>

          {/* Card 3 */}
          <div
            className="lb-idle absolute bottom-12 right-[8%] w-[140px] rounded-2xl bg-surface p-1.5 shadow-card"
            style={{ animationDelay: "-1.4s", transform: "rotate(-3deg)" }}
          >
            <div className="aspect-square overflow-hidden rounded-xl">
              <Photo src={floating[2]?.imageUrl} alt="" fallback={floating[2]?.brand || ""} sizes="sm" />
            </div>
            <div className="p-1">
              <span className="rounded-full bg-brand-wash px-2 py-0.5 text-[10px] font-bold text-brand-deep">
                Top rated
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Escrow Phone Graphic inside hero (Desktop/Tablet) */}
      <div
        className="pointer-events-none absolute top-10 right-10 hidden w-[240px] rounded-[36px] bg-ink p-2.5 shadow-2xl lg:block"
        style={{ transform: "rotate(3deg)" }}
        aria-hidden
      >
        <div className="overflow-hidden rounded-[28px] bg-surface p-4 text-ink">
          <div className="mx-auto mb-3 h-4 w-20 rounded-full bg-ink" />
          <p className="text-[13px] font-bold">Your Bag</p>

          <div className="mt-2 space-y-1.5 border-b border-hairline pb-2.5 text-[11px]">
            <div className="flex justify-between">
              <span className="truncate">Glow Vitamin C</span>
              <span className="font-semibold">₦12,500</span>
            </div>
            <div className="flex justify-between">
              <span className="truncate">Shea Butter Pure</span>
              <span className="font-semibold">₦4,200</span>
            </div>
          </div>

          <div className="mt-2.5 rounded-xl bg-brand-wash p-2 text-[10.5px]">
            <p className="font-bold text-brand-deep flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Held in escrow
            </p>
            <p className="mt-0.5 opacity-80 leading-tight">
              Seller paid only after you inspect and confirm.
            </p>
          </div>

          <div className="mt-2.5 rounded-full bg-brand py-1.5 text-center text-[11px] font-semibold text-surface">
            Pay ₦16,700
          </div>
        </div>
      </div>

      {/* Hero Headline and Call to Actions */}
      <div className="relative z-10 max-w-lg mt-auto sm:my-auto">
        <h1 className="t-hero text-ink leading-[0.95]">
          Beauty is all about{" "}
          <RotatingWord words={["you", "her", "him", "us"]} />
        </h1>

        <p className="mt-4 max-w-sm text-[16px] text-muted leading-snug">
          Curated beauty for everyone. Verified sellers and artisans across Nigeria. Every kobo protected in escrow.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href="/shop"
            className="lb-press inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-surface shadow-glow hover:bg-brand-deep"
          >
            <span>Start shopping</span>
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/dashboard/escrow"
            className="lb-press inline-flex h-12 items-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold text-ink shadow-soft hover:bg-canvas"
          >
            <Play className="h-3.5 w-3.5 fill-ink" />
            <span>How escrow works</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
