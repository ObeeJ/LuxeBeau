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
              <span className="t-display">{title}</span>
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[28px] bg-surface p-4 shadow-card sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="t-meta text-muted">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas">
          <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </span>
      </div>
      <p className="t-display mt-3 truncate tabular-nums">{value}</p>
    </div>
  );
}

const POSITIVE = new Set(["paid", "delivered", "completed", "confirmed", "released", "verified", "active", "approved", "shipped"]);
const NEGATIVE = new Set(["failed", "cancelled", "refunded", "disputed", "suspended"]);

/* Monochrome status chip: filled ink for done, outlined ink for problems,
   mist for anything still in flight. No second accent colour. */
export function StatusPill({ status }: { status: string }) {
  const key = status.toLowerCase();
  const tone = POSITIVE.has(key)
    ? "bg-ink text-surface"
    : NEGATIVE.has(key)
      ? "border border-ink bg-surface text-ink"
      : "bg-canvas text-ink";
  return (
    <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] capitalize tracking-[-0.017em]", tone)}>
      {status || "pending"}
    </span>
  );
}

/* Responsive record row: stacks on phones, aligns into columns from md. */
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
        <p className="truncate text-[16px] tracking-[-0.031em]">{title}</p>
        {subtitle && <p className="truncate text-[14px] tracking-[-0.014em] text-muted">{subtitle}</p>}
        {meta && <p className="t-meta mt-0.5 font-normal text-muted">{meta}</p>}
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

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="t-meta text-muted">{eyebrow}</p>}
        <h1 className="t-display mt-1">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
