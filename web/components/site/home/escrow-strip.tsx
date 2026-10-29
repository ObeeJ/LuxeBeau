import Link from "next/link";
import { BadgeCheck, CheckCircle2, CircleHelp, Naira } from "@/components/icons";

const STEPS = [
  { icon: Naira, label: "You pay into escrow" },
  { icon: BadgeCheck, label: "Verified seller delivers" },
  { icon: CheckCircle2, label: "You confirm, they get paid" },
];

/* Three steps as small cards joined by a moving line; the button sits beside
   them on wide screens and below on phones. */
export function EscrowStrip() {
  return (
    <div className="rounded-[32px] bg-surface p-4 shadow-soft transition-shadow duration-200 hover:shadow-float sm:p-5 lg:flex lg:items-center lg:gap-6">
      <ul className="grid flex-1 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="How escrow works">
        {STEPS.map(({ icon: Icon, label }, i) => (
          <li key={label} className="relative flex items-center gap-3 rounded-2xl bg-canvas p-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-wash text-brand">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand">Step {i + 1}</p>
              <p className="text-[14px] font-semibold leading-tight tracking-[-0.014em]">{label}</p>
            </div>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="lb-sweep absolute -right-4 top-1/2 hidden h-0.5 w-4 -translate-y-1/2 rounded sm:block" />
            )}
          </li>
        ))}
      </ul>

      <Link
        href="/dashboard/escrow"
        className="lb-press mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-[14px] font-semibold text-surface shadow-glow hover:bg-brand-deep lg:mt-0 lg:w-auto lg:shrink-0"
      >
        <CircleHelp className="h-5 w-5" aria-hidden />
        <span>How it works</span>
      </Link>
    </div>
  );
}
