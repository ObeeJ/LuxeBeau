"use client";

import Link from "next/link";
import { Play } from "@/components/icons";
import { RotatingWord } from "./rotating-word";
import { HeroSlides } from "./hero-slides";

/* Hero: one portrait at a time fills the card and slides to the next behind
   a dark-purple overlay; the headline and actions sit in the centre. */
export function HeroCard() {
  return (
    <div className="relative isolate flex aspect-[7/10] items-center justify-center overflow-hidden rounded-[40px] bg-ink shadow-soft md:aspect-auto md:h-[440px] xl:aspect-[2.75/1] xl:h-auto xl:max-h-[685px]">
      <HeroSlides className="absolute inset-0 -z-20 h-full w-full" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 72% 85% at 50% 52%, rgba(42,11,72,.55) 0%, rgba(42,11,72,.32) 58%, rgba(42,11,72,.06) 100%), linear-gradient(180deg, rgba(138,31,199,.22) 0%, rgba(42,11,72,0) 38%, rgba(42,11,72,.4) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[780px] flex-col items-center px-6 text-center text-surface">
        <h1 className="text-[40px] font-extrabold leading-[0.95] tracking-[-0.05em] sm:text-[56px] lg:text-[72px]">
          Beauty is all about
          <RotatingWord
            words={["you", "her", "him", "us"]}
            className="block w-full pr-[0.14em] text-center font-extrabold italic leading-[1.02] tracking-[-0.05em] text-[#d9c2ff]"
          />
        </h1>
        <p className="mt-4 max-w-[520px] text-[16px] leading-snug tracking-[-0.02em] text-surface/90 sm:text-[17px]">
          Shop beauty for her, him and everyone, or book an artisan, with every payment held in escrow until you confirm.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href="/shop"
            className="lb-press inline-flex h-12 items-center rounded-full bg-brand px-6 text-[15px] font-semibold text-surface shadow-glow hover:bg-brand-deep"
          >
            Start shopping
          </Link>
          <Link
            href="/dashboard/escrow"
            className="lb-press hidden h-12 items-center gap-2 rounded-full bg-surface px-5 text-[15px] font-semibold text-ink shadow-pill sm:inline-flex"
          >
            <Play className="h-3.5 w-3.5 fill-ink" aria-hidden />
            How escrow works
          </Link>
        </div>
      </div>
    </div>
  );
}
