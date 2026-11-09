"use client";

import { useId, useMemo, useState } from "react";
import { AlertCircle } from "@/components/icons";
import { Panel, Table } from "@/components/dashboard/widgets";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  PRESETS, formatKobo, isEmptyRevenue, matchPreset, periodLabel, presetRange, validateRange, useAdminRevenue,
  type Group, type PresetId, type RevenuePoint,
} from "@/lib/revenue";

const GROUPS: { id: Group; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];

const chip = (on: boolean) =>
  cn(
    "lb-press inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[14px] font-semibold tracking-[-0.014em] transition-all duration-150",
    on ? "bg-brand text-surface shadow-glow" : "bg-canvas text-muted hover:text-ink",
  );

function Kpi({ label, value, note, big }: { label: string; value: string; note?: string; big?: boolean }) {
  return (
    <div className={cn("rounded-[24px] bg-surface p-4 shadow-soft", big && "col-span-2 sm:col-span-1")}>
      <dt className="text-[12px] font-medium tracking-[-0.017em] text-muted">{label}</dt>
      <dd className={cn("mt-1 font-black tabular-nums tracking-[-0.05em] text-brand", big ? "text-[28px]" : "text-[22px]")}>{value}</dd>
      {note && <p className="mt-0.5 text-[12px] text-muted">{note}</p>}
    </div>
  );
}

/* Net per period as accessible SVG bars. Negative net (refunds above income) is drawn below the baseline. */
function NetChart({ series, group }: { series: RevenuePoint[]; group: Group }) {
  const uid = useId();
  const W = 720, H = 220, PAD_T = 12, PAD_B = 28;
  const max = Math.max(0, ...series.map(p => p.net));
  const min = Math.min(0, ...series.map(p => p.net));
  const span = max - min || 1;
  const plotH = H - PAD_T - PAD_B;
  const y = (v: number) => PAD_T + ((max - v) / span) * plotH;
  const slot = W / Math.max(series.length, 1);
  const bar = Math.max(Math.min(slot * 0.7, 40), 2);
  const every = Math.ceil(series.length / 8);
  const total = series.reduce((a, p) => a + p.net, 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full" role="img" aria-labelledby={`${uid}t ${uid}d`}>
      <title id={`${uid}t`}>Net revenue per {group}</title>
      <desc id={`${uid}d`}>
        Bar chart of {series.length} periods, total net {formatKobo(total)}, highest {formatKobo(max)}. The same numbers are in the data table.
      </desc>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-hairline" strokeWidth={1} />
      {series.map((p, i) => {
        const x = i * slot + (slot - bar) / 2;
        const top = Math.min(y(p.net), y(0));
        const h = Math.max(Math.abs(y(p.net) - y(0)), p.net === 0 ? 0 : 1);
        return (
          <g key={p.period} tabIndex={0} aria-label={`${periodLabel(p.period, group)}: net ${formatKobo(p.net)}`} className="outline-none [&:focus-visible>rect]:stroke-ink [&:focus-visible>rect]:stroke-2">
            <title>{`${periodLabel(p.period, group)}: ${formatKobo(p.net)}`}</title>
            <rect x={x} y={top} width={bar} height={h} rx={Math.min(3, bar / 2)} className={p.net < 0 ? "fill-ink" : "fill-brand"} style={{ transition: "height 200ms, y 200ms" }} />
            {i % every === 0 && (
              <text x={x + bar / 2} y={H - 8} textAnchor="middle" className="fill-muted" fontSize={11}>{periodLabel(p.period, group)}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function RevenueBody({ from, to, group }: { from: string; to: string; group: Group }) {
  const q = useAdminRevenue(from, to, group);
  const [table, setTable] = useState(false);
  const tableId = useId();

  if (q.isLoading) {
    return (
      <div aria-busy="true">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} className={cn("h-[88px] rounded-[24px]", i === 0 && "col-span-2 sm:col-span-1")} />)}
        </div>
        <Skeleton className="mt-4 h-56 w-full" />
        <span className="sr-only">Loading revenue, please wait.</span>
      </div>
    );
  }
  if (q.isError) {
    const forbidden = q.error instanceof ApiError && q.error.status === 403;
    return forbidden
      ? <EmptyState>Revenue figures are for LuxeBeau admins only. Your account does not have access.</EmptyState>
      : <LoadError onRetry={() => q.refetch()} message="We couldn't load revenue figures." />;
  }

  const r = q.data;
  if (!r) return null;
  const t = r.totals;
  return (
    <div className={cn("space-y-4 transition-opacity duration-200", q.isFetching && "opacity-60")} aria-busy={q.isFetching}>
      {r.health.unbalanced_escrows > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-[20px] border border-ink bg-brand-wash p-4 text-[14px] text-ink">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <p>
            <strong>{r.health.unbalanced_escrows} {r.health.unbalanced_escrows === 1 ? "escrow doesn't" : "escrows don't"} balance.</strong>{" "}
            Check the audit.
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi big label="Net revenue" value={formatKobo(t.net)} note="Fees + ads - refunded fees" />
        <Kpi label="Platform fees" value={formatKobo(t.platform_fees)} note={`${t.orders_paid} paid ${t.orders_paid === 1 ? "order" : "orders"}`} />
        <Kpi label="Ad revenue" value={formatKobo(t.ad_revenue)} note={`${t.ads_paid} paid ${t.ads_paid === 1 ? "ad" : "ads"}`} />
        <Kpi label="Refunded fees" value={formatKobo(t.fee_refunds)} />
      </dl>

      {isEmptyRevenue(r) ? (
        <EmptyState>No revenue in this range. Try a longer period; fees and ad payments show up here once orders and promotions are paid.</EmptyState>
      ) : (
        <div className="rounded-[24px] bg-canvas p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-bold tracking-[-0.014em]">Net revenue per {group}</h3>
            <button type="button" onClick={() => setTable(v => !v)} aria-expanded={table} aria-controls={tableId} className="text-[13px] font-semibold text-brand-deep underline-offset-2 transition-colors duration-150 hover:underline">
              {table ? "Hide data table" : "Show data table"}
            </button>
          </div>
          <NetChart series={r.series} group={group} />
          <div id={tableId} hidden={!table} className="mt-3">
            <Table head={["Period", "Platform fees", "Ad revenue", "Refunded fees", "Net"]} minWidth={560}>
              {r.series.map(p => (
                <tr key={p.period}>
                  <th scope="row" className="py-2 pr-4 font-medium">{periodLabel(p.period, group)}</th>
                  <td className="py-2 pr-4 tabular-nums">{formatKobo(p.platform_fees)}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatKobo(p.ad_revenue)}</td>
                  <td className="py-2 pr-4 tabular-nums">{formatKobo(p.fee_refunds)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{formatKobo(p.net)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </div>
      )}

      <ul className="space-y-2 text-[13px] text-muted">
        <li>
          <span className="font-semibold text-ink tabular-nums">{formatKobo(t.estimated_vat)}</span> estimated VAT (7.5%) included in net revenue. Estimate, confirm with your accountant.
        </li>
        <li>
          <span className="font-semibold text-ink tabular-nums">{formatKobo(t.processing_fees_collected)}</span> processing fees collected for the payment gateway. Pass-through money, not LuxeBeau revenue.
        </li>
      </ul>
    </div>
  );
}

export function AdminRevenue() {
  const [range, setRange] = useState(() => presetRange("last30"));
  const [draft, setDraft] = useState(range);
  const [group, setGroup] = useState<Group>("day");

  const problem = validateRange(draft.from, draft.to);
  const active = useMemo(() => matchPreset(range.from, range.to), [range]);

  const pick = (id: PresetId) => {
    const r = presetRange(id);
    setRange(r);
    setDraft(r);
  };
  const edit = (patch: Partial<typeof draft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (!validateRange(next.from, next.to)) setRange(next);
  };

  return (
    <Panel
      title="Revenue"
      action={
        <div role="group" aria-label="Group by" className="flex gap-1.5">
          {GROUPS.map(g => (
            <button key={g.id} type="button" aria-pressed={group === g.id} onClick={() => setGroup(g.id)} className={chip(group === g.id)}>{g.label}</button>
          ))}
        </div>
      }
    >
      <div className="mb-4 space-y-3">
        <div role="group" aria-label="Date range" className="no-scrollbar flex gap-1.5 overflow-x-auto">
          {PRESETS.map(p => (
            <button key={p.id} type="button" aria-pressed={active === p.id} onClick={() => pick(p.id)} className={chip(active === p.id)}>{p.label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12px] font-medium text-muted">
            From
            <input type="date" value={draft.from} max={draft.to || undefined} onChange={e => edit({ from: e.target.value })} aria-invalid={!!problem} className="lb-input mt-1 block h-9 w-auto py-0 text-[14px]" />
          </label>
          <label className="text-[12px] font-medium text-muted">
            To
            <input type="date" value={draft.to} min={draft.from || undefined} onChange={e => edit({ to: e.target.value })} aria-invalid={!!problem} className="lb-input mt-1 block h-9 w-auto py-0 text-[14px]" />
          </label>
        </div>
        <FieldError>{problem}</FieldError>
      </div>
      <RevenueBody from={range.from} to={range.to} group={group} />
    </Panel>
  );
}
