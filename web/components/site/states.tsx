"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* Shared loading / error states for the backend-driven catalogue pages.
   Keeping them in one place means shop and services degrade identically. */

export function CardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div
      className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      role="status"
      aria-busy="true"
      aria-label="Loading catalogue"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card-velvet overflow-hidden rounded-3xl">
          <Skeleton className="h-52 w-full rounded-none bg-velvet-800/60" />
          <div className="space-y-3 p-6">
            <Skeleton className="h-4 w-1/3 bg-velvet-800/60" />
            <Skeleton className="h-5 w-3/4 bg-velvet-800/60" />
            <Skeleton className="h-4 w-full bg-velvet-800/60" />
            <Skeleton className="h-8 w-1/2 bg-velvet-800/60" />
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
    <div role="alert" className="mx-auto mt-16 max-w-md text-center">
      <AlertCircle className="mx-auto h-10 w-10 text-danger" aria-hidden />
      <p className="mt-4 text-lavender-200">{message}</p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-royal-500 px-6 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-royal-400"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Try again
      </button>
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-16 text-center text-lavender-400" role="status">
      {children}
    </div>
  );
}
