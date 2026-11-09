"use client";

import { useId, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, X } from "@/components/icons";
import { Panel } from "@/components/dashboard/widgets";
import { FieldError, LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  COMMON_CITIES,
  defaultRows,
  hasCatchAll,
  isDirty,
  newKey,
  normalize,
  rowsFromZones,
  useDeliveryZones,
  useSaveDeliveryZones,
  validate,
  type Zone,
  type ZoneRow,
} from "@/lib/delivery-zones";

type Notice = { kind: "success" | "error"; text: string } | null;

export function DeliveryZones() {
  const query = useDeliveryZones();
  return (
    <Panel title="Delivery fees" aria-label="Delivery fees">
      <p className="-mt-2 mb-5 max-w-prose text-[14px] text-muted">
        Buyers pay this delivery fee. You receive it with your payout. Set 0 for free delivery. If you set nothing, ₦1,500 applies.
      </p>
      {query.isLoading ? (
        <div role="status" aria-busy="true" aria-label="Loading delivery fees" className="space-y-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-[72px] w-full rounded-[16px]" />)}
          <span className="sr-only">Loading, please wait.</span>
        </div>
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 403 ? (
          <div role="alert" className="rounded-[16px] border border-ink bg-surface px-4 py-3 text-[14px]">
            Only seller accounts can set delivery fees.
          </div>
        ) : (
          <LoadError onRetry={() => query.refetch()} message="We couldn't load your delivery fees." />
        )
      ) : (
        <Editor saved={query.data ?? []} />
      )}
    </Panel>
  );
}

function Editor({ saved }: { saved: Zone[] }) {
  const uid = useId();
  const save = useSaveDeliveryZones();
  const [baseline, setBaseline] = useState<Zone[]>(saved);
  const first = saved.length === 0;
  const [rows, setRows] = useState<ZoneRow[]>(() => (first ? defaultRows() : rowsFromZones(saved)));
  const [notice, setNotice] = useState<Notice>(null);
  const [touched, setTouched] = useState(false);

  /* First-time sellers start with a pre-filled row that is not yet saved, so it counts as a change. */
  const dirty = first && baseline.length === 0 ? true : isDirty(baseline, rows);
  const result = useMemo(() => validate(rows), [rows]);
  const showErrors = touched || !result.valid;
  const busy = save.isPending;
  const canSave = dirty && result.valid && !busy;

  const update = (key: string, patch: Partial<ZoneRow>) => {
    setNotice(null);
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  };
  const remove = (key: string) => {
    setNotice(null);
    setRows(rs => rs.filter(r => r.key !== key));
  };
  const addCity = (city = "") => {
    setNotice(null);
    setRows(rs => {
      if (city && rs.some(r => r.city.trim().toLowerCase() === city.toLowerCase())) return rs;
      const row = { key: newKey(), city, naira: "1500" };
      const i = rs.findIndex(r => r.city.trim() === "");
      return i === -1 || !city ? [...rs, row] : [...rs.slice(0, i), row, ...rs.slice(i)];
    });
  };
  const addCatchAll = () => {
    setNotice(null);
    setRows(rs => [...rs, { key: newKey(), city: "", naira: "1500" }]);
  };
  const reset = () => {
    setNotice(null);
    setTouched(false);
    setRows(baseline.length === 0 ? defaultRows() : rowsFromZones(baseline));
  };

  const onSave = async () => {
    setTouched(true);
    if (!result.valid) {
      setNotice({ kind: "error", text: "Check the highlighted fields and try again." });
      return;
    }
    const zones = normalize(rows);
    try {
      await save.mutateAsync(zones);
      setBaseline(zones);
      setRows(rowsFromZones(zones));
      setTouched(false);
      setNotice({ kind: "success", text: "Delivery fees saved." });
    } catch (e) {
      setNotice({ kind: "error", text: getFriendlyErrorMessage(e, "We couldn't save your delivery fees. Please try again.") });
    }
  };

  const suggestions = COMMON_CITIES.filter(c => !rows.some(r => r.city.trim().toLowerCase() === c.toLowerCase()));
  const listId = `${uid}-cities`;

  return (
    <div>
      {first && (
        <p className="mb-4 rounded-[16px] bg-brand-wash px-4 py-3 text-[14px] text-brand-deep">
          You haven&apos;t set any fees yet. We&apos;ve added one &quot;Everywhere else&quot; row at ₦1,500. Add cities to charge differently.
        </p>
      )}

      <datalist id={listId}>{COMMON_CITIES.map(c => <option key={c} value={c} />)}</datalist>

      <ul className="space-y-3" aria-label="Delivery fees by city">
        {rows.map((r, i) => {
          const err = showErrors ? result.rows[r.key] : undefined;
          const catchAll = r.city.trim() === "";
          const cid = `${uid}-${r.key}-city`;
          const fid = `${uid}-${r.key}-fee`;
          return (
            <li key={r.key} className="rounded-[16px] border border-hairline bg-surface p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto] sm:items-start">
                <div>
                  <label htmlFor={cid} className="t-meta mb-1.5 block font-normal">
                    {catchAll ? "Everywhere else" : "City"}
                  </label>
                  <input
                    id={cid}
                    list={listId}
                    className="lb-input h-11"
                    value={r.city}
                    maxLength={120}
                    placeholder="Everywhere else (leave city blank)"
                    autoComplete="off"
                    aria-invalid={Boolean(err?.city)}
                    aria-describedby={err?.city ? `${cid}-err` : `${cid}-hint`}
                    onChange={e => update(r.key, { city: e.target.value })}
                  />
                  <p id={`${cid}-hint`} className="mt-1 text-[12px] text-muted">
                    {catchAll ? "Used for any city not listed above." : "Matches the buyer's city, ignoring capital letters."}
                  </p>
                  <div id={`${cid}-err`}><FieldError>{err?.city}</FieldError></div>
                </div>
                <div>
                  <label htmlFor={fid} className="t-meta mb-1.5 block font-normal">Fee (₦)</label>
                  <input
                    id={fid}
                    inputMode="decimal"
                    className="lb-input h-11 tabular-nums"
                    value={r.naira}
                    autoComplete="off"
                    aria-invalid={Boolean(err?.fee)}
                    aria-describedby={err?.fee ? `${fid}-err` : `${fid}-hint`}
                    onChange={e => update(r.key, { naira: e.target.value })}
                  />
                  <p id={`${fid}-hint`} className="mt-1 text-[12px] text-muted">
                    {err?.fee ? "" : r.naira.trim() !== "" && normalize([r])[0].feeKobo === 0 ? "Free delivery" : "0 = free delivery"}
                  </p>
                  <div id={`${fid}-err`}><FieldError>{err?.fee}</FieldError></div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(r.key)}
                  aria-label={`Remove ${catchAll ? "Everywhere else" : r.city.trim() || `row ${i + 1}`}`}
                  className="inline-flex h-11 w-11 items-center justify-center self-start rounded-full border border-hairline text-muted transition-colors duration-200 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:mt-[26px]"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {showErrors && result.form && <FieldError>{result.form}</FieldError>}

      {!hasCatchAll(rows) && rows.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-[16px] bg-brand-wash px-4 py-3 text-[14px] text-brand-deep">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Buyers in other cities will be charged the ₦1,500 platform default.{" "}
            <button type="button" onClick={addCatchAll} className="font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              Add an Everywhere else row
            </button>
          </span>
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => addCity()} disabled={busy}>
          <Plus aria-hidden /> Add city
        </Button>
        {suggestions.length > 0 && <span className="text-[12px] text-muted">Quick add:</span>}
        {suggestions.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => addCity(c)}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-full border border-hairline bg-surface px-3 text-[13px] transition-colors duration-200 hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center">
        <Button size="lg" onClick={onSave} disabled={!canSave}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {busy ? "Saving…" : "Save delivery fees"}
        </Button>
        <Button size="lg" variant="outline" onClick={reset} disabled={busy || !dirty}>
          Reset
        </Button>
        {dirty && !busy && <span className="text-[13px] font-medium text-brand-deep">Unsaved changes</span>}
      </div>

      <div aria-live="polite" role="status" className="mt-4 empty:hidden">
        {notice && (
          <p
            className={cn(
              "flex items-start gap-2 rounded-[16px] px-4 py-3 text-[14px] transition-opacity duration-200",
              notice.kind === "success" ? "bg-brand text-surface" : "border border-ink bg-surface text-ink",
            )}
          >
            {notice.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            <span>{notice.text}</span>
          </p>
        )}
      </div>
    </div>
  );
}
