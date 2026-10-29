import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarDays, ShoppingBag } from "@/components/icons";
import { ARTISAN_COVER } from "@/lib/photos";

const CARD =
  "lb-press group relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-[32px] p-6 transition-shadow duration-200 hover:shadow-float sm:min-h-[230px]";
const ARROW =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-pill transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1";

/* Sell, fill a calendar, partner: three big cards, each with a duotone icon, a
   faded watermark of the same icon, and an arrow that lifts on hover. */
export function JoinRow() {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
      <Link href="/partnership/seller" className={`${CARD} bg-brand text-surface shadow-glow`}>
        <ShoppingBag aria-hidden className="pointer-events-none absolute -bottom-8 -right-6 h-44 w-44 text-surface opacity-[0.13]" />
        <div className="relative flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/15">
            <ShoppingBag className="h-6 w-6" aria-hidden />
          </span>
          <span className={`${ARROW} text-brand`}>
            <ArrowUpRight className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="relative mt-8">
          <h4 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em]">Sell on LuxeBeau</h4>
          <p className="mt-2 max-w-[300px] text-[14px] leading-snug opacity-90">
            Open a shop in minutes. Paid as soon as buyers confirm delivery.
          </p>
          <span className="mt-4 inline-block text-[14px] font-semibold">Start selling</span>
        </div>
      </Link>

      <Link href="/partnership/artisan" className={`${CARD} text-surface shadow-soft`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ARTISAN_COVER} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/50 to-ink/20" />
        <div className="relative flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/20 backdrop-blur-sm">
            <CalendarDays className="h-6 w-6" aria-hidden />
          </span>
          <span className={`${ARROW} text-brand`}>
            <ArrowUpRight className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="relative mt-8">
          <h4 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em]">Fill your calendar</h4>
          <p className="mt-2 max-w-[300px] text-[14px] leading-snug opacity-90">
            Braiders, barbers, MUAs: guaranteed appointments with protected deposits.
          </p>
          <span className="mt-4 inline-block text-[14px] font-semibold">Join as an artisan</span>
        </div>
      </Link>

      <Link href="/partnership/seller#brands" className={`${CARD} bg-brand-wash text-brand-deep shadow-soft`}>
        <BadgeCheck aria-hidden className="pointer-events-none absolute -bottom-8 -right-6 h-44 w-44 text-brand opacity-[0.12]" />
        <div className="relative flex items-start justify-between">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface text-brand">
            <BadgeCheck className="h-6 w-6" aria-hidden />
          </span>
          <span className={`${ARROW} text-brand`}>
            <ArrowUpRight className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <div className="relative mt-8">
          <h4 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em]">Brand partnerships</h4>
          <p className="mt-2 max-w-[300px] text-[14px] leading-snug opacity-90">
            Launches and creator campaigns with a community that proudly reps you.
          </p>
          <span className="mt-4 inline-block text-[14px] font-semibold">Partner with us</span>
        </div>
      </Link>
    </div>
  );
}
