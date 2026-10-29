"use client";

import { AlertCircle, RefreshCw } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/* Shared loading / error / empty states for backend-driven pages. */

export function CardSkeletonGrid({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4", className)}
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[28px] bg-surface p-2 shadow-card">
          <Skeleton className="aspect-square w-full rounded-[20px]" />
          <div className="space-y-2 px-2 pb-2 pt-3">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading, please wait.</span>
    </div>
  );
}

export function LoadError({
  onRetry,
  message = "We could not load this right now. Check your connection and try again.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div role="alert" className="mx-auto my-12 max-w-md text-center">
      <AlertCircle className="mx-auto h-8 w-8 text-ink" strokeWidth={1.75} aria-hidden />
      <p className="mt-3 text-[16px] text-muted">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-5 text-[14px] tracking-[-0.014em] shadow-pill transition-shadow duration-200 hover:shadow-card"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  );
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[20px] bg-canvas px-6 py-10 text-center text-[14px] tracking-[-0.014em] text-muted", className)} role="status">
      {children}
    </div>
  );
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] tracking-[-0.017em] text-ink">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> {children}
    </p>
  );
}
