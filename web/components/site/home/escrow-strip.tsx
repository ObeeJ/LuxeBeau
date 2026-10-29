import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function EscrowStrip() {
  return (
    <div className="lb-press flex flex-wrap items-center justify-between gap-4 rounded-full bg-surface p-3.5 px-6 shadow-soft transition-all duration-200 hover:shadow-float">
      <ul className="flex flex-1 flex-wrap items-center gap-4 sm:gap-6" aria-label="How escrow works">
        <li className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-wash text-[12px] font-bold text-brand-deep">
            ₦
          </span>
          <span>You pay into escrow</span>
        </li>

        <span className="hidden h-0.5 flex-1 rounded bg-hairline lb-sweep sm:block" aria-hidden />

        <li className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-wash text-[12px] font-bold text-brand-deep">
            ✓
          </span>
          <span>Verified seller delivers</span>
        </li>

        <span className="hidden h-0.5 flex-1 rounded bg-hairline lb-sweep sm:block" aria-hidden />

        <li className="flex items-center gap-2.5 text-[14px] font-semibold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-wash text-[12px] font-bold text-brand-deep">
            ★
          </span>
          <span>You confirm, they get paid</span>
        </li>
      </ul>

      <Link
        href="/dashboard/escrow"
        className="lb-press inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[13px] font-semibold text-surface shadow-glow transition-all hover:bg-brand-deep"
      >
        <ShieldCheck className="h-4 w-4" aria-hidden />
        <span>How it works</span>
      </Link>
    </div>
  );
}
