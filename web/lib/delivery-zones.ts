import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";

/* ── Seller delivery fees by city ────────────────────────────
   Wire shapes follow the Go API (snake_case, money in KOBO).
   A zone with city "" is the catch-all, "Everywhere else". Saving REPLACES
   the seller's whole table. */

export const DEFAULT_FEE_KOBO = 150_000; // platform default, N1,500
export const MAX_FEE_KOBO = 10_000_000; // sanity cap, N100,000 per zone
export const MAX_CITY_LENGTH = 80;

export const COMMON_CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Benin City", "Kaduna"];

export const zoneSchema = z.object({
  id: z.number().optional(),
  seller_id: z.string().optional(),
  city: z.string(),
  fee_kobo: z.number().int(),
});

/* The API sends null (not []) when the seller has set nothing. */
export const zonesResponseSchema = z
  .object({ zones: z.array(zoneSchema).nullish() })
  .transform(({ zones }) => (zones ?? []).map(z => ({ city: z.city, feeKobo: z.fee_kobo })));

export const saveResponseSchema = z.object({ message: z.string().optional() });

/** A zone as the API stores it. */
export type Zone = { city: string; feeKobo: number };

/** A row being edited. The fee is the raw text typed into the naira box. */
export type ZoneRow = { key: string; city: string; naira: string };

/* ── Money without float drift ───────────────────────────────── */

/** Kobo → plain naira text for an input: 150000 → "1500", 150050 → "1500.50". */
export function koboToNairaText(kobo: number): string {
  const whole = Math.trunc(kobo / 100);
  const rem = Math.abs(kobo % 100);
  return rem === 0 ? String(whole) : `${whole}.${String(rem).padStart(2, "0")}`;
}

/** Naira text → kobo by reading the digits, never multiplying a float.
    Returns null for anything that is not a plain non-negative amount with at most 2 decimals. */
export function nairaTextToKobo(text: string): number | null {
  const t = text.trim().replace(/,/g, "");
  const m = /^(\d+)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m) return null;
  const kobo = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(kobo) ? kobo : null;
}

/** Number of naira → kobo, rounded to the nearest kobo (0.1 + 0.2 → 30). */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}

/* ── Display ─────────────────────────────────────────────────── */

const opts = { style: "currency", currency: "NGN" } as const;
const nairaWhole = new Intl.NumberFormat("en-NG", { ...opts, minimumFractionDigits: 0, maximumFractionDigits: 0 });
const nairaExact = new Intl.NumberFormat("en-NG", { ...opts, minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Free" for 0, otherwise "₦1,500" or "₦1,500.50". */
export function formatFee(kobo: number): string {
  if (kobo === 0) return "Free";
  return (kobo % 100 === 0 ? nairaWhole : nairaExact).format(kobo / 100);
}

export function cityLabel(city: string): string {
  return city.trim() === "" ? "Everywhere else" : city.trim();
}

/* ── Rows, validation, normalize, dirty ──────────────────────── */

let counter = 0;
export function newKey(): string {
  counter += 1;
  return `z${counter}`;
}

export function rowsFromZones(zones: Zone[]): ZoneRow[] {
  return zones.map(z => ({ key: newKey(), city: z.city, naira: koboToNairaText(z.feeKobo) }));
}

/** What a first-time seller starts with: one "Everywhere else" row at the platform default. */
export function defaultRows(): ZoneRow[] {
  return [{ key: newKey(), city: "", naira: koboToNairaText(DEFAULT_FEE_KOBO) }];
}

export type RowErrors = { city?: string; fee?: string };
export type ValidationResult = { valid: boolean; rows: Record<string, RowErrors>; form?: string };

const cityKey = (c: string) => c.trim().toLowerCase();

export function validate(rows: ZoneRow[]): ValidationResult {
  const out: Record<string, RowErrors> = {};
  const add = (key: string, e: RowErrors) => {
    out[key] = { ...out[key], ...e };
  };
  if (rows.length === 0) return { valid: false, rows: out, form: "Add at least one delivery fee." };

  const seen = new Map<string, string>();
  for (const r of rows) {
    const k = cityKey(r.city);
    if (r.city.trim().length > MAX_CITY_LENGTH) add(r.key, { city: `Keep the city under ${MAX_CITY_LENGTH} characters.` });
    const first = seen.get(k);
    if (first !== undefined) {
      const msg = k === "" ? "You can only have one Everywhere else row." : "This city is already in your list.";
      add(r.key, { city: msg });
    } else {
      seen.set(k, r.key);
    }

    const t = r.naira.trim();
    if (t === "") {
      add(r.key, { fee: "Enter a fee, or 0 for free delivery." });
      continue;
    }
    const kobo = nairaTextToKobo(t);
    if (kobo === null) add(r.key, { fee: "Enter a valid amount in naira, like 1500 or 1500.50." });
    else if (kobo > MAX_FEE_KOBO) add(r.key, { fee: "The most you can charge for one city is ₦100,000." });
  }
  return { valid: Object.keys(out).length === 0, rows: out };
}

/** Rows → the zones to send/compare: trimmed cities, kobo fees, catch-all last, then A to Z. Invalid fees become 0. */
export function normalize(rows: ZoneRow[]): Zone[] {
  return rows
    .map(r => ({ city: r.city.trim(), feeKobo: nairaTextToKobo(r.naira) ?? 0 }))
    .sort((a, b) => {
      if (a.city === "" && b.city !== "") return 1;
      if (b.city === "" && a.city !== "") return -1;
      return a.city.localeCompare(b.city, "en", { sensitivity: "base" });
    });
}

/** True when the edited rows differ from what is saved. City case/space and row order are compared like the server does. */
export function isDirty(original: Zone[], edited: ZoneRow[]): boolean {
  const norm = (zs: Zone[]) =>
    zs
      .map(z => `${cityKey(z.city)}|${z.feeKobo}`)
      .sort()
      .join("\n");
  const editedZones = edited.map(r => ({ city: r.city, feeKobo: nairaTextToKobo(r.naira) ?? -1 }));
  return norm(original) !== norm(editedZones);
}

export function hasCatchAll(rows: ZoneRow[]): boolean {
  return rows.some(r => r.city.trim() === "");
}

/* ── API ─────────────────────────────────────────────────────── */

export const deliveryZonesKey = ["me", "delivery-zones"] as const;

export function fetchDeliveryZones(): Promise<Zone[]> {
  return apiFetch("/me/delivery-zones", zonesResponseSchema);
}

export function saveDeliveryZones(zones: Zone[]) {
  const body = { zones: zones.map(z => ({ city: z.city, fee_kobo: z.feeKobo })) };
  return apiFetch("/me/delivery-zones", saveResponseSchema, { method: "POST", body });
}

export function useDeliveryZones(enabled = true) {
  return useQuery({ queryKey: deliveryZonesKey, enabled, queryFn: fetchDeliveryZones });
}

export function useSaveDeliveryZones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveDeliveryZones,
    onSuccess: () => qc.invalidateQueries({ queryKey: deliveryZonesKey }),
  });
}
