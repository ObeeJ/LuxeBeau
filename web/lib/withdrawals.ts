import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api";

/* ── Withdraw (cash out) ─────────────────────────────────────
   Wire shapes follow api-go/internal/withdrawal. Money is KOBO integers
   (100 kobo = N1). Account numbers live only in component state. */

export const MIN_WITHDRAWAL_KOBO = 100_000; // N1,000

/* A convenience list only. The bank lookup is the real check: the server
   resolves the account itself and stores the bank's own name. */
export const BANKS: { code: string; name: string }[] = [
  { code: "058", name: "Guaranty Trust Bank (GTBank)" },
  { code: "044", name: "Access Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "032", name: "Union Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "214", name: "First City Monument Bank (FCMB)" },
  { code: "076", name: "Polaris Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "215", name: "Unity Bank" },
  { code: "030", name: "Heritage Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "999992", name: "Opay" },
  { code: "999991", name: "PalmPay" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "565", name: "Carbon" },
  { code: "566", name: "VFD Microfinance Bank" },
  { code: "51310", name: "Sparkle" },
  { code: "000026", name: "TAJ Bank" },
  { code: "301", name: "Jaiz Bank" },
  { code: "102", name: "Titan Trust Bank" },
  { code: "103", name: "Globus Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "023", name: "Citibank Nigeria" },
];

export function bankName(code: string): string {
  return BANKS.find(b => b.code === code)?.name ?? "Bank";
}

/* ── Schemas (accept nulls) ─────────────────────────────────── */

export const withdrawalSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  amount: z.number().int(),
  bank_code: z.string().nullish().transform(v => v ?? ""),
  account_number: z.string().nullish().transform(v => v ?? ""),
  account_name: z.string().nullish().transform(v => v ?? ""),
  state: z.string(),
  fail_reason: z.string().nullish().transform(v => v ?? ""),
  created_at: z.string().nullish().transform(v => v ?? ""),
});
export type Withdrawal = z.infer<typeof withdrawalSchema>;

/* The API sends null (not []) when there is no history. */
export const withdrawalsResponseSchema = z
  .object({ withdrawals: z.array(withdrawalSchema).nullish() })
  .transform(({ withdrawals }) => withdrawals ?? []);

export const withdrawResponseSchema = z.object({ withdrawal: withdrawalSchema });
export const resolveResponseSchema = z.object({ account_name: z.string() });

/* ── Pure helpers (unit tested) ─────────────────────────────── */

/** Naira text ("5,000", "1000.5") → kobo integer, no float drift. null when not a valid amount. */
export function nairaToKobo(input: string | number): number | null {
  const raw = typeof input === "number" ? String(input) : input;
  const s = raw.trim().replace(/[,\s]/g, "").replace(/^₦|^N(?=\d)/i, "");
  if (!/^\d+(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
  const [whole = "0", frac = ""] = s.split(".");
  const kobo = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return Number.isSafeInteger(kobo) ? kobo : null;
}

/** Kobo → plain naira text for an input box: 500000 → "5000", 150050 → "1500.5". */
export function koboToNairaInput(kobo: number): string {
  const whole = Math.trunc(kobo / 100);
  const frac = Math.abs(kobo % 100);
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, "0").replace(/0$/, "")}`;
}

export function isAccountNumber(v: string): boolean {
  return /^\d{10}$/.test(v);
}

export type WithdrawErrors = Partial<Record<"amount" | "account", string>>;

export function validateWithdrawal(amountInput: string, balanceKobo: number | undefined, accountNumber: string): WithdrawErrors {
  const errors: WithdrawErrors = {};
  const kobo = nairaToKobo(amountInput);
  if (amountInput.trim() === "") errors.amount = "Enter how much you want to withdraw.";
  else if (kobo === null || kobo <= 0) errors.amount = "Enter a valid amount in naira, for example 5000.";
  else if (kobo < MIN_WITHDRAWAL_KOBO) errors.amount = "The minimum withdrawal is ₦1,000.";
  else if (balanceKobo !== undefined && kobo > balanceKobo) errors.amount = "That is more than your available balance.";
  if (!isAccountNumber(accountNumber)) errors.account = "Enter the 10-digit account number.";
  return errors;
}

/** "0123456789" → "****6789". */
export function maskAccount(n: string): string {
  const digits = n ?? "";
  return digits.length <= 4 ? "****" : `****${digits.slice(-4)}`;
}

export type WithdrawalTone = "success" | "pending" | "failed";
export type WithdrawalStateInfo = { label: string; hint: string; tone: WithdrawalTone; returned: boolean; active: boolean };

export function withdrawalStateInfo(state: string): WithdrawalStateInfo {
  switch (state) {
    case "pending":
      return { label: "Queued", hint: "We are sending this to your bank.", tone: "pending", returned: false, active: true };
    case "processing":
      return { label: "With your bank", hint: "Your bank is processing this. It usually takes a few minutes.", tone: "pending", returned: false, active: true };
    case "succeeded":
      return { label: "Paid", hint: "The money has reached your bank account.", tone: "success", returned: false, active: false };
    case "failed":
      return { label: "Failed", hint: "Your bank could not pay this.", tone: "failed", returned: true, active: false };
    case "reversed":
      return { label: "Reversed", hint: "Your bank sent this back.", tone: "failed", returned: true, active: false };
    default:
      return { label: state || "Unknown", hint: "", tone: "pending", returned: false, active: false };
  }
}

export function hasActiveWithdrawal(list: Withdrawal[] | undefined): boolean {
  return (list ?? []).some(w => withdrawalStateInfo(w.state).active);
}

/* ── Idempotency key lifecycle ─────────────────────────────────
   ONE key per attempt. It is reused while the user retries the same
   attempt after a network error / timeout / 5xx (outcome unknown), and
   replaced after a definite result or when the amount/account changes. */

export type KeyStore = { key: string; sig: string } | null;

export function attemptSignature(amountKobo: number, bankCode: string, accountNumber: string): string {
  return `${amountKobo}|${bankCode}|${accountNumber}`;
}

export function newKey(): string {
  return crypto.randomUUID();
}

/** Returns the key to send. Reuses the stored one only when the inputs are unchanged. */
export function keyForAttempt(store: KeyStore, sig: string, make: () => string = newKey): { key: string; store: KeyStore } {
  if (store && store.sig === sig) return { key: store.key, store };
  const next = { key: make(), sig };
  return { key: next.key, store: next };
}

/** True when the request got a definite answer, so the next attempt needs a fresh key. */
export function isDefiniteResult(status: number | undefined, ok: boolean): boolean {
  if (ok) return true;
  return status !== undefined && status >= 400 && status < 500 && status !== 408 && status !== 429;
}

/** After a definite result, drop the stored key. Otherwise keep it for the retry. */
export function afterResult(store: KeyStore, status: number | undefined, ok: boolean): KeyStore {
  return isDefiniteResult(status, ok) ? null : store;
}

/* ── API + hooks ────────────────────────────────────────────── */

export type WithdrawInput = { amount: number; bank_code: string; account_number: string; account_name: string };

export function resolveAccount(bankCode: string, accountNumber: string, signal?: AbortSignal) {
  return apiFetch("/me/wallet/resolve-account", resolveResponseSchema, {
    method: "POST",
    body: { bank_code: bankCode, account_number: accountNumber },
    signal,
  }).then(r => r.account_name);
}

export function submitWithdrawal(input: WithdrawInput, idempotencyKey: string) {
  return apiFetch("/me/wallet/withdraw", withdrawResponseSchema, {
    method: "POST",
    body: input,
    headers: { "Idempotency-Key": idempotencyKey },
  }).then(r => r.withdrawal);
}

export function fetchWithdrawals() {
  return apiFetch("/me/wallet/withdrawals", withdrawalsResponseSchema);
}

/** Polls every 15s only while something is still pending/processing. */
export function useWithdrawals(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "withdrawals"],
    enabled,
    queryFn: fetchWithdrawals,
    refetchInterval: q => (hasActiveWithdrawal(q.state.data) ? 15_000 : false),
  });
}

export function useWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, key }: { input: WithdrawInput; key: string }) => submitWithdrawal(input, key),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["me", "wallet"] });
      qc.invalidateQueries({ queryKey: ["me", "withdrawals"] });
    },
  });
}

export function useResolveAccount() {
  return useMutation({
    mutationFn: ({ bankCode, accountNumber, signal }: { bankCode: string; accountNumber: string; signal?: AbortSignal }) =>
      resolveAccount(bankCode, accountNumber, signal),
  });
}
