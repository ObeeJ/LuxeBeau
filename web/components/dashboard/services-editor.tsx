"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Panel } from "@/components/dashboard/widgets";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSaveServices } from "@/lib/queries";
import { type ArtisanService } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";

/* Limits mirror api-go/internal/booking/studio.go (validServices). */
const MAX_SERVICES = 20;
const DURATIONS = [15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480, 600, 720];

function durationLabel(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

interface Row {
  key: number;
  name: string;
  duration: number;
  price: string;
  description: string;
}

let nextKey = 0;
const toRow = (s?: ArtisanService): Row => ({
  key: nextKey++,
  name: s?.name ?? "",
  duration: s?.durationMins || 60,
  price: s ? String(s.priceNGN) : "",
  description: s?.description ?? "",
});

function validate(rows: Row[]): string {
  if (rows.length === 0) return "Add at least one service.";
  const seen = new Set<string>();
  for (const r of rows) {
    const name = r.name.trim();
    if (!name) return "Every service needs a name.";
    if (seen.has(name.toLowerCase())) return `"${name}" is listed twice.`;
    seen.add(name.toLowerCase());
    const price = Number(r.price);
    if (!Number.isInteger(price) || price < 1 || price > 10_000_000) return `Give "${name}" a price in naira.`;
    if (r.description.length > 300) return `Keep "${name}"'s description under 300 characters.`;
  }
  return "";
}

/* The artisan's service menu: what clients can book, how long it takes and
   what it costs. Saving replaces the whole list. */
export function ServicesEditor({ services }: { services: ArtisanService[] }) {
  const [rows, setRows] = useState<Row[]>(() => (services.length ? services.map(toRow) : [toRow()]));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const save = useSaveServices();

  const update = (key: number, patch: Partial<Row>) => {
    setSaved(false);
    setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate(rows);
    setError(problem);
    if (problem) return;
    save.mutate(
      rows.map(r => ({ name: r.name.trim(), duration_mins: r.duration, price: Number(r.price), description: r.description.trim() })),
      { onSuccess: () => setSaved(true), onError: err => setError(getFriendlyErrorMessage(err, "We couldn't save your services.")) },
    );
  };

  return (
    <Panel title="Services">
      <form onSubmit={submit} noValidate>
        <ul className="divide-y divide-hairline">
          {rows.map((r, i) => (
            <li key={r.key} className="py-4 first:pt-0">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-[12px] tracking-[-0.017em] text-muted">Service {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${r.name || `service ${i + 1}`}`}
                  disabled={rows.length === 1}
                  onClick={() => setRows(rs => rs.filter(x => x.key !== r.key))}
                >
                  <X aria-hidden />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_140px]">
                <div className="min-w-0">
                  <Label htmlFor={`svc-name-${r.key}`}>Name</Label>
                  <Input id={`svc-name-${r.key}`} value={r.name} maxLength={80} onChange={e => update(r.key, { name: e.target.value })} placeholder="Knotless braids, mid-back" className="mt-1.5" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:contents">
                  <div>
                    <Label htmlFor={`svc-dur-${r.key}`}>Length</Label>
                    <select id={`svc-dur-${r.key}`} value={r.duration} onChange={e => update(r.key, { duration: Number(e.target.value) })} className="lb-input mt-1.5 h-11 w-full">
                      {DURATIONS.map(d => <option key={d} value={d}>{durationLabel(d)}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`svc-price-${r.key}`}>Price (₦)</Label>
                    <Input id={`svc-price-${r.key}`} inputMode="numeric" value={r.price} onChange={e => update(r.key, { price: e.target.value.replace(/\D/g, "") })} placeholder="25000" className="mt-1.5" />
                  </div>
                </div>
                <div className="sm:col-span-3">
                  <Label htmlFor={`svc-desc-${r.key}`} className="sr-only">Description</Label>
                  <Input id={`svc-desc-${r.key}`} value={r.description} maxLength={300} onChange={e => update(r.key, { description: e.target.value })} placeholder="What's included (optional)" />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={rows.length >= MAX_SERVICES} onClick={() => setRows(rs => [...rs, toRow()])}>
            <Plus aria-hidden /> Add service
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Save services
          </Button>
          {saved && <span className="text-[14px] tracking-[-0.014em] text-muted" role="status">Saved. Your public page is updated.</span>}
        </div>
        <FieldError>{error}</FieldError>
        <p className="mt-3 text-[12px] tracking-[-0.017em] text-muted">
          Clients only see start times where the whole service fits in your open hours.
        </p>
      </form>
    </Panel>
  );
}
