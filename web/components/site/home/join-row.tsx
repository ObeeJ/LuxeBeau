import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function JoinRow() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {/* 1. Sellers */}
      <Link
        href="/partnership/seller"
        className="lb-press group flex min-h-[170px] flex-col justify-between rounded-[28px] bg-brand p-6 text-surface shadow-glow transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-deep"
      >
        <div>
          <h4 className="text-[22px] font-extrabold tracking-[-0.04em] leading-tight">
            Sell on LuxeBeau
          </h4>
          <p className="mt-2 text-[14px] opacity-90 leading-snug">
            Open a shop in minutes. Paid as soon as buyers confirm delivery.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[14px] font-semibold">
          <span>Start selling</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      {/* 2. Artisans */}
      <Link
        href="/partnership/artisan"
        className="lb-press group flex min-h-[170px] flex-col justify-between rounded-[28px] bg-surface p-6 text-ink shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float"
      >
        <div>
          <h4 className="text-[22px] font-extrabold tracking-[-0.04em] leading-tight">
            Fill your calendar
          </h4>
          <p className="mt-2 text-[14px] text-muted leading-snug">
            Braiders, barbers, MUAs: guaranteed appointments with protected deposits.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[14px] font-semibold text-brand">
          <span>Join as an artisan</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      {/* 3. Brands */}
      <Link
        href="/partnership/seller#brands"
        className="lb-press group flex min-h-[170px] flex-col justify-between rounded-[28px] bg-brand-wash p-6 text-brand-deep shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-wash/80"
      >
        <div>
          <h4 className="text-[22px] font-extrabold tracking-[-0.04em] leading-tight">
            Brand partnerships
          </h4>
          <p className="mt-2 text-[14px] opacity-90 leading-snug">
            Launches and creator campaigns with a community that proudly reps you.
          </p>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-[14px] font-semibold text-brand-deep">
          <span>Partner with us</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>
    </div>
  );
}
