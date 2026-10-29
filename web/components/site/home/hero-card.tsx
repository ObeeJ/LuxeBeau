"use client";

import Link from "next/link";
import { Play } from "@/components/icons";
import { RotatingWord } from "./rotating-word";
import { HeroSlides } from "./hero-slides";
import { HERO_PHOTOS } from "@/lib/photos";

/* Hero: the two portraits fill the whole card and slide past each other behind
   a dark-purple overlay; the headline and actions sit in the centre. */
export function HeroCard() {
  return (
    <div className="relative isolate flex aspect-[7/10] items-center justify-center overflow-hidden rounded-[40px] bg-ink shadow-soft md:aspect-auto md:h-[440px] xl:aspect-[2.75/1] xl:h-auto xl:max-h-[685px]">
      <HeroSlides className="absolute inset-0 -z-20 h-full w-full md:hidden" />
      <div aria-hidden className="absolute inset-0 -z-20 hidden grid-cols-2 md:grid">
        {HERO_PHOTOS.map(src => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover object-[50%_28%]" />
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 72% 85% at 50% 52%, rgba(42,11,72,.66) 0%, rgba(42,11,72,.4) 58%, rgba(42,11,72,.1) 100%), linear-gradient(180deg, rgba(138,31,199,.22) 0%, rgba(42,11,72,0) 38%, rgba(42,11,72,.5) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[780px] flex-col items-center px-6 text-center text-surface">
        <h1 className="text-[40px] font-extrabold leading-[0.95] tracking-[-0.05em] sm:text-[56px] lg:text-[72px]">
          Beauty is all about
          <RotatingWord
            words={["you", "her", "him", "us"]}
            className="block w-full pr-[0.14em] text-center text-[1.28em] font-black italic leading-[1.02] tracking-[-0.06em] text-[#d9c2ff] [text-shadow:0_0_36px_rgba(217,194,255,.55)]"
          />
        </h1>
        <p className="mt-4 max-w-[520px] text-[16px] leading-snug tracking-[-0.02em] text-surface/90 sm:text-[17px]">
          All the brands you love, for her, him and everyone. Verified sellers. Your money held safe till it arrives.
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
