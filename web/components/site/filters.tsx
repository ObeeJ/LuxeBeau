"use client";

import { cn } from "@/lib/utils";

/* Labelled filter block: a small caps label above the control. */
export function FilterGroup({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("min-w-0", className)}>
      <p className="mb-1.5 px-1 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-muted max-sm:text-left">{label}</p>
      {children}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

/* One pill holding every option; the chosen one is filled purple. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar mx-auto flex w-fit max-w-full overflow-x-auto rounded-full bg-surface p-1 shadow-soft max-sm:mx-0">
      {options.map(({ value: v, label, icon: Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={cn(
              "lb-press inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[14px] font-semibold tracking-[-0.014em] transition-colors duration-200",
              on ? "bg-brand text-surface shadow-glow" : "text-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="h-[18px] w-[18px]" aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* A row of separate chips (cities); the chosen one gets a purple outline and wash. */
export function ChipRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
      {options.map(({ value: v, label, icon: Icon }) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(v)}
            className={cn(
              "lb-press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium tracking-[-0.014em] shadow-pill ring-1 transition-colors duration-200",
              on ? "bg-brand-wash text-brand-deep ring-brand" : "bg-surface text-ink ring-hairline hover:bg-canvas",
            )}
          >
            {Icon && <Icon className="h-4 w-4" aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
