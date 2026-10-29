import { type LucideIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/* White elevated panel: 32px radius, dual soft shadow. */
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
      className={cn("scroll-mt-20 rounded-[32px] bg-surface p-5 shadow-soft sm:p-7", className)}
    >
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {title && (
            <h2 className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-brand" strokeWidth={2} aria-hidden />}
              <span className="t-sub font-bold">{title}</span>
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
    <div role="tablist" aria-label={label} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "lb-press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold tracking-[-0.014em] transition-all duration-150",
            value === t.id ? "bg-brand text-surface shadow-glow" : "text-muted hover:bg-surface hover:text-ink",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cn("tabular-nums text-[12px]", value === t.id ? "text-surface/80" : "text-muted")}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

const POSITIVE = new Set(["paid", "delivered", "completed", "confirmed", "released", "verified", "active", "approved", "shipped"]);
const NEGATIVE = new Set(["failed", "cancelled", "refunded", "disputed", "suspended", "sold out", "payment failed"]);

/* Purple & monochrome status chip conforming to design system tokens. */
export function StatusPill({ status }: { status: string }) {
  const label = status || "pending";
  const key = label.toLowerCase();
  const tone = POSITIVE.has(key)
    ? "bg-brand text-surface"
    : NEGATIVE.has(key)
      ? "border border-ink bg-surface text-ink"
      : "bg-brand-wash text-brand-deep";
  return (
    <span className={cn("inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold tracking-[-0.017em]", tone)}>
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
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-x-4 gap-y-2 py-3.5 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {leading}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-semibold tracking-[-0.02em]">{title}</p>
          {subtitle && <p className="truncate text-[13px] tracking-[-0.014em] text-muted">{subtitle}</p>}
          {meta && <p className="mt-0.5 text-[12px] tracking-[-0.017em] text-muted">{meta}</p>}
        </div>
      </div>
      {(amount || status || actions) && (
        <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
          {amount && <span className="text-[15px] font-bold tabular-nums tracking-[-0.031em]">{amount}</span>}
          {status}
          {actions}
        </div>
      )}
    </li>
  );
}

/* Data table for staff views; scrolls inside its panel on narrow screens. */
export function Table({ head, children, minWidth = 640 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full text-left text-[14px] tracking-[-0.014em]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-hairline text-[12px] tracking-[-0.017em] text-muted font-semibold">
            {head.map((h, i) => (
              <th key={h || i} scope="col" className={cn("pb-2.5 pr-4 font-semibold uppercase tracking-wider", i === head.length - 1 && "pr-0 text-right")}>{h}</th>
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
        <h1 className="t-hero text-[32px] sm:text-[38px] text-ink leading-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/* Small figure row for studio headers: plain numbers, no icon tiles. */
export function Figures({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(i => (
        <div key={i.label} className="rounded-[24px] bg-surface p-4 shadow-soft">
          <dt className="text-[12px] font-medium tracking-[-0.017em] text-muted">{i.label}</dt>
          <dd className="mt-1 text-[22px] font-black tabular-nums tracking-[-0.05em] text-brand">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
