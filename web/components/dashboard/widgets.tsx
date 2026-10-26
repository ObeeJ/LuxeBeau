import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* White elevated panel: 28px radius, dual soft shadow, no border. */
export function Panel({
  title,
  icon: Icon,
  action,
  id,
  className,
  children,
  "aria-label": ariaLabel,
}: {
  title?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  return (
    <section
      id={id}
      aria-label={ariaLabel ?? title}
      className={cn("scroll-mt-20 rounded-[28px] bg-surface p-4 shadow-card sm:p-6", className)}
    >
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />}
              <span className="t-sub">{title}</span>
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* Segmented pill tabs with optional counts. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label = "Sections",
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string; count?: number }[];
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] tracking-[-0.014em] transition-colors duration-200",
            value === t.id ? "bg-ink text-surface" : "text-ink hover:bg-surface",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={cn("tabular-nums", value === t.id ? "text-surface/70" : "text-muted")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

const POSITIVE = new Set(["paid", "delivered", "completed", "confirmed", "released", "verified", "active", "approved", "shipped"]);
const NEGATIVE = new Set(["failed", "cancelled", "refunded", "disputed", "suspended", "sold out", "payment failed"]);

/* Monochrome status chip: filled ink for done, outlined ink for problems,
   mist for anything still in flight. No second accent colour. */
export function StatusPill({ status }: { status: string }) {
  const label = status || "pending";
  const key = label.toLowerCase();
  const tone = POSITIVE.has(key)
    ? "bg-ink text-surface"
    : NEGATIVE.has(key)
      ? "border border-ink bg-surface text-ink"
      : "bg-canvas text-ink";
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] tracking-[-0.017em]", tone)}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

/* Responsive record row: stacks on phones, aligns into columns from sm. */
export function RecordList({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-hairline">{children}</ul>;
}

export function RecordRow({
  title,
  subtitle,
  meta,
  amount,
  status,
  actions,
  leading,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode;
  amount?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0">
      {leading}
      <div className="min-w-0 flex-1 basis-48">
        <p className="line-clamp-2 text-[16px] tracking-[-0.031em]">{title}</p>
        {subtitle && <p className="truncate text-[14px] tracking-[-0.014em] text-muted">{subtitle}</p>}
        {meta && <p className="mt-0.5 text-[12px] tracking-[-0.017em] text-muted">{meta}</p>}
      </div>
      {(amount || status) && (
        <div className="flex items-center gap-3">
          {amount && <span className="text-[16px] tabular-nums tracking-[-0.031em]">{amount}</span>}
          {status}
        </div>
      )}
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </li>
  );
}

/* Data table for staff views; scrolls inside its panel on narrow screens. */
export function Table({ head, children, minWidth = 640 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-left text-[14px] tracking-[-0.014em]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-hairline text-[12px] tracking-[-0.017em] text-muted">
            {head.map((h, i) => (
              <th key={h || i} scope="col" className={cn("pb-2.5 pr-4 font-normal", i === head.length - 1 && "pr-0 text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">{children}</tbody>
      </table>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="t-display">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* Small figure row for studio headers: plain numbers, no icon tiles. */
export function Figures({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[20px] bg-hairline sm:grid-cols-4">
      {items.map(i => (
        <div key={i.label} className="bg-surface px-4 py-3">
          <dt className="text-[12px] tracking-[-0.017em] text-muted">{i.label}</dt>
          <dd className="mt-0.5 text-[20px] tabular-nums tracking-[-0.05em]">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
