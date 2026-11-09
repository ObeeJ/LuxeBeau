"use client";

import { AlertCircle, RefreshCw } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { buildBreakdown, formatKoboNaira, type Quote } from "@/lib/quote";
import { cn } from "@/lib/utils";

/* Price breakdown card body: items, delivery, platform fee, processing fee
   (card/transfer/USSD only) and the total the buyer is charged. Every amount
   comes from the server quote or the created order. */

type Amounts = Pick<Quote, "subtotalKobo" | "deliveryFeeKobo" | "platformFeeKobo" | "processingFeeKobo" | "totalKobo">;

interface Props {
  amounts?: Amounts;
  payMethod: string;
  /** Bag has items but no city yet: delivery and fees cannot be quoted. */
  needsCity?: boolean;
  loading?: boolean;
  /** A newer quote is loading while the previous amounts stay visible. */
  refreshing?: boolean;
  error?: string;
  onRetry?: () => void;
  className?: string;
}

export function PriceBreakdown({ amounts, payMethod, needsCity, loading, refreshing, error, onRetry, className }: Props) {
  if (error && !amounts) {
    return (
      <div role="alert" className={cn("min-h-[196px] rounded-2xl bg-canvas p-4 text-[14px]", className)}>
        <p className="flex items-start gap-2 text-ink">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
        {onRetry && (
          <button onClick={onRetry} className="lb-press mt-3 inline-flex h-11 items-center gap-2 rounded-full border border-hairline bg-surface px-5 text-[14px] transition-shadow duration-200 hover:shadow-card">
            <RefreshCw className="h-4 w-4" aria-hidden /> Try again
          </button>
        )}
      </div>
    );
  }

  if (!amounts && needsCity) {
    return (
      <div className={cn("min-h-[196px] rounded-2xl bg-canvas p-4 text-[14px] text-muted", className)}>
        <p className="font-semibold text-ink">Delivery is calculated once you enter a city.</p>
        <p className="mt-1">Continue to checkout and enter your delivery city to see delivery, fees and your final total.</p>
      </div>
    );
  }

  if (!amounts) {
    return (
      <div role="status" aria-busy={loading ? "true" : undefined} aria-label="Calculating your total" className={cn("min-h-[196px] space-y-3", className)}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex justify-between py-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
        <Skeleton className="h-6 w-full" />
        <span className="sr-only">Calculating your total, please wait.</span>
      </div>
    );
  }

  const { rows, totalKobo } = buildBreakdown(amounts, payMethod);
  return (
    <div className={className}>
      <dl className={cn("divide-y divide-hairline text-[14px] tracking-[-0.014em] transition-opacity duration-200", refreshing && "opacity-60")} aria-busy={refreshing ? "true" : undefined}>
        {rows.map(r => (
          <div key={r.key} className="py-2.5">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">{r.label}</dt>
              <dd className="font-semibold tabular-nums">{formatKoboNaira(r.amountKobo)}</dd>
            </div>
            {r.note && <p className="mt-0.5 pr-16 text-[12px] leading-snug text-muted">{r.note}</p>}
          </div>
        ))}
        <div className="flex justify-between gap-3 py-2.5 text-[16px] font-bold tracking-[-0.031em]">
          <dt>Total</dt>
          <dd className="tabular-nums text-brand">{formatKoboNaira(totalKobo)}</dd>
        </div>
      </dl>
      <p className="sr-only" role="status" aria-live="polite">{refreshing ? "Updating total" : `Total ${formatKoboNaira(totalKobo)}`}</p>
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-destructive">
          Could not refresh this total. {onRetry && <button onClick={onRetry} className="underline">Try again</button>}
        </p>
      )}
    </div>
  );
}
