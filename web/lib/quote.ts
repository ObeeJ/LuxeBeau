import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ApiError, apiFetch } from "@/lib/api";

/* ── Order price quote (POST /orders/quote) ──────────────────
   File purpose: ask the server what the buyer will really pay BEFORE the
   order is placed. All money is KOBO integers. We never compute fees here;
   we only show what the server returns. */

export type QuotePayMethod = "wallet" | "card" | "transfer" | "ussd";

export interface QuoteItem {
  product_id: number;
  qty: number;
}

export const quoteSchema = z
  .object({
    quote: z.object({
      subtotal: z.number().int().nonnegative(),
      delivery_fee: z.number().int().nonnegative(),
      platform_fee: z.number().int().nonnegative(),
      processing_fee: z.number().int().nonnegative().optional().default(0),
      total: z.number().int().nonnegative(),
    }),
  })
  .transform(({ quote }) => ({
    subtotalKobo: quote.subtotal,
    deliveryFeeKobo: quote.delivery_fee,
    platformFeeKobo: quote.platform_fee,
    processingFeeKobo: quote.processing_fee,
    totalKobo: quote.total,
  }));
export type Quote = z.infer<typeof quoteSchema>;

export async function fetchQuote(
  input: { items: QuoteItem[]; city: string; payMethod: QuotePayMethod },
  signal?: AbortSignal,
): Promise<Quote> {
  return apiFetch("/orders/quote", quoteSchema, {
    method: "POST",
    body: { items: input.items, city: input.city, pay_method: input.payMethod },
    signal,
  });
}

/* ── Pure helpers (unit tested) ─────────────────────────────── */

/** A city is "chosen" once it has at least 2 real characters. */
export function normalizeCity(city: string): string {
  return city.trim().replace(/\s+/g, " ");
}

export function hasCity(city: string): boolean {
  return normalizeCity(city).length >= 2;
}

/** Same bag in any order gives the same list, so the query key is stable. */
export function normalizeItems(items: QuoteItem[]): QuoteItem[] {
  const merged = new Map<number, number>();
  for (const i of items) merged.set(i.product_id, (merged.get(i.product_id) ?? 0) + i.qty);
  return [...merged.entries()]
    .map(([product_id, qty]) => ({ product_id, qty }))
    .sort((a, b) => a.product_id - b.product_id);
}

export function quoteKey(items: QuoteItem[], city: string, payMethod: QuotePayMethod) {
  return ["orders", "quote", normalizeItems(items), normalizeCity(city).toLowerCase(), payMethod] as const;
}

/** Card, bank transfer and USSD carry a processing fee; the wallet does not. */
export function chargesProcessingFee(payMethod: QuotePayMethod): boolean {
  return payMethod !== "wallet";
}

/** Kobo (integer) → "₦1,234.50". Shows kobo when there is any, so fees are never rounded away. */
export function formatKoboNaira(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: kobo % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

export interface BreakdownRow {
  key: "subtotal" | "delivery" | "platform" | "processing";
  label: string;
  note?: string;
  amountKobo: number;
}

export interface Breakdown {
  rows: BreakdownRow[];
  totalKobo: number;
}

type Amounts = Pick<Quote, "subtotalKobo" | "deliveryFeeKobo" | "platformFeeKobo" | "processingFeeKobo" | "totalKobo">;

/** Turns server amounts into display rows. The total is the server's, never re-summed. */
export function buildBreakdown(q: Amounts, payMethod: QuotePayMethod | string): Breakdown {
  const rows: BreakdownRow[] = [
    { key: "subtotal", label: "Items subtotal", amountKobo: q.subtotalKobo },
    { key: "delivery", label: "Delivery", note: "Set by each seller. Items from different sellers each pay their own delivery fee.", amountKobo: q.deliveryFeeKobo },
    { key: "platform", label: "Platform fee", amountKobo: q.platformFeeKobo },
  ];
  if (payMethod !== "wallet" && payMethod !== "") {
    rows.push({ key: "processing", label: "Payment processing fee", note: "Charged by our payment partner.", amountKobo: q.processingFeeKobo });
  }
  return { rows, totalKobo: q.totalKobo };
}

/** True when the parts add up to the total (a sanity check; mismatches are logged by callers, not hidden). */
export function breakdownAddsUp(q: Amounts): boolean {
  return q.subtotalKobo + q.deliveryFeeKobo + q.platformFeeKobo + q.processingFeeKobo === q.totalKobo;
}

/* ── Hooks ──────────────────────────────────────────────────── */

export function useDebounced<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/* Refetches when the bag, city or payment method change. City typing is
   debounced; previous data stays on screen while a new quote loads. */
export function useOrderQuote(args: { items: QuoteItem[]; city: string; payMethod: QuotePayMethod }) {
  const itemsSig = JSON.stringify(normalizeItems(args.items));
  const debouncedCity = useDebounced(normalizeCity(args.city), 500);
  const debouncedItems = useDebounced(itemsSig, 250);
  const items = JSON.parse(debouncedItems) as QuoteItem[];
  const ready = items.length > 0 && hasCity(debouncedCity);
  /* "settling" = the inputs on screen are newer than the quote request. */
  const settling = debouncedCity !== normalizeCity(args.city) || debouncedItems !== itemsSig;

  const query = useQuery({
    queryKey: quoteKey(items, debouncedCity, args.payMethod),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    queryFn: ({ signal }) => fetchQuote({ items, city: debouncedCity, payMethod: args.payMethod }, signal),
  });

  return { ...query, ready, settling };
}
