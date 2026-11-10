"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "@/components/icons";
import { Panel, RecordList } from "@/components/dashboard/widgets";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { formatLagosDateTime } from "@/lib/format";
import { useAuth } from "@/lib/store";
import { useWallet } from "@/lib/queries";
import { cn } from "@/lib/utils";
import {
  BANKS,
  MIN_WITHDRAWAL_KOBO,
  afterResult,
  bankName,
  attemptSignature,
  keyForAttempt,
  koboToNairaInput,
  maskAccount,
  nairaToKobo,
  resolveAccount,
  useWithdraw,
  useWithdrawals,
  validateWithdrawal,
  withdrawalStateInfo,
  type KeyStore,
  type Withdrawal,
} from "@/lib/withdrawals";
import { formatKobo } from "@/lib/ads";

type Lookup =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; name: string }
  | { status: "error"; message: string };

type Notice = { kind: "success" | "error" | "info"; text: string; verify?: boolean } | null;

function lookupMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === "PAYOUTS_UNAVAILABLE") return "Bank withdrawals aren't switched on yet. Your money is safe in your wallet.";
    if (e.status === 429) return "You are checking too fast. Wait a moment and try again.";
    if (e.status === 400) return e.message || "We couldn't find that bank account. Check the bank and number.";
    if (e.status === 0) return "Connection lost. Check your internet and try again.";
  }
  return "We couldn't check that account right now. Please try again.";
}

function submitError(e: unknown): Notice {
  if (e instanceof ApiError) {
    if (e.code === "KYC_REQUIRED") return { kind: "error", text: "Complete identity verification before withdrawing.", verify: true };
    if (e.code === "PAYOUTS_UNAVAILABLE") return { kind: "error", text: "Bank withdrawals aren't switched on yet. Your money is safe in your wallet." };
    if (e.status === 409) {
      return /already/i.test(e.message)
        ? { kind: "info", text: "This withdrawal was already submitted. Check your history below before trying again." }
        : { kind: "error", text: "Your wallet balance is too low for this amount. Lower the amount and try again." };
    }
    if (e.status === 400) return { kind: "error", text: e.message || "We couldn't process those details. Check the amount and account and try again." };
    if (e.status === 0 || e.status === 408 || e.status >= 500) {
      return {
        kind: "error",
        text: "We couldn't confirm whether this went through. Check your history below. If it isn't listed, press Confirm again: it is safe and will not send the money twice.",
      };
    }
  }
  return { kind: "error", text: "Something went wrong. Please check your history below before trying again." };
}

export function Withdraw({ onVerify }: { onVerify?: () => void }) {
  const user = useAuth(s => s.user);
  const enabled = Boolean(user);
  const wallet = useWallet(enabled);
  const history = useWithdrawals(enabled);
  const withdraw = useWithdraw();
  const uid = useId();
  const id = (n: string) => `${uid}-${n}`;

  const [amount, setAmount] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const [confirmed, setConfirmed] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [touched, setTouched] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const keyStore = useRef<KeyStore>(null);
  const inFlight = useRef(false);

  const balance = wallet.data?.balanceKobo;
  const errors = validateWithdrawal(amount, balance, account);
  const amountKobo = nairaToKobo(amount);

  /* Look the account up once bank + 10 digits are in. Debounced; a newer
     input aborts the older request and its answer is ignored. */
  useEffect(() => {
    if (!bank || !/^\d{10}$/.test(account)) return;
    const ctl = new AbortController();
    let stale = false;
    const t = setTimeout(() => {
      setLookup({ status: "loading" });
      resolveAccount(bank, account, ctl.signal)
        .then(name => { if (!stale) setLookup({ status: "ok", name }); })
        .catch(e => { if (!stale) setLookup({ status: "error", message: lookupMessage(e) }); });
    }, 450);
    return () => { stale = true; clearTimeout(t); ctl.abort(); };
  }, [bank, account]);

  if (!user) return null;

  const resetLookup = () => { setLookup({ status: "idle" }); setConfirmed(false); setStep("form"); };
  const lookupReady = bank !== "" && /^\d{10}$/.test(account);
  const shownLookup: Lookup = lookupReady ? lookup : { status: "idle" };

  if (user.kyc_status !== "verified") {
    return (
      <Panel title="Withdraw">
        <p className="max-w-prose text-[14px] text-muted">
          Verify your identity before you can withdraw money to a bank account. It only takes a minute.
        </p>
        {onVerify && <Button className="mt-4" onClick={onVerify}>Go to identity verification</Button>}
      </Panel>
    );
  }

  const canReview =
    Object.keys(errors).length === 0 && shownLookup.status === "ok" && confirmed && amountKobo !== null && !wallet.isError;

  const goReview = () => {
    setTouched(true);
    setNotice(null);
    if (canReview) setStep("review");
  };

  const confirmSend = async () => {
    if (inFlight.current || !canReview || amountKobo === null || shownLookup.status !== "ok") return;
    inFlight.current = true;
    setNotice(null);
    const sig = attemptSignature(amountKobo, bank, account);
    const k = keyForAttempt(keyStore.current, sig);
    keyStore.current = k.store;
    try {
      await withdraw.mutateAsync({
        input: { amount: amountKobo, bank_code: bank, account_number: account, account_name: shownLookup.name },
        key: k.key,
      });
      keyStore.current = afterResult(keyStore.current, 201, true);
      setNotice({ kind: "success", text: "We've sent it to your bank. This usually takes a few minutes. You can track it below." });
      setAmount(""); setBank(""); setAccount(""); setTouched(false);
      resetLookup();
    } catch (e) {
      const status = e instanceof ApiError ? e.status : undefined;
      keyStore.current = afterResult(keyStore.current, status, false);
      const n = submitError(e);
      setNotice(n);
      if (n?.kind === "error" && status !== undefined && status >= 400 && status < 500) setStep("form");
    } finally {
      inFlight.current = false;
    }
  };

  const busy = withdraw.isPending;
  const noticeTone = (k: "success" | "error" | "info") =>
    k === "success" ? "bg-brand text-surface" : k === "error" ? "border border-ink bg-surface text-ink" : "bg-brand-wash text-brand-deep";

  return (
    <div className="space-y-5">
      <Panel title="Withdraw to your bank">
        <div className="rounded-[20px] bg-brand-wash p-4">
          <p className="t-meta font-normal">Available to withdraw</p>
          <p className="mt-1 text-[28px] font-bold tabular-nums tracking-[-0.03em]">
            {wallet.isLoading ? "…" : balance === undefined ? "Unavailable" : formatKobo(balance)}
          </p>
          <p className="mt-1 text-[12px] text-muted">Money waiting on delivery is not included. It joins your wallet once the order is complete.</p>
        </div>
        {wallet.isError && <p className="mt-2 text-[12px]">We couldn&apos;t read your balance. Refresh the page and try again.</p>}

        {step === "form" ? (
          <form noValidate onSubmit={e => { e.preventDefault(); goReview(); }} className="mt-5 grid gap-4 sm:max-w-md" aria-label="Withdrawal details">
            <div>
              <label htmlFor={id("amount")} className="t-meta mb-1.5 block font-normal">Amount (₦)</label>
              <div className="flex gap-2">
                <input
                  id={id("amount")} className="lb-input h-11 flex-1" inputMode="decimal" autoComplete="off" value={amount}
                  onChange={e => { setAmount(e.target.value); setConfirmed(false); }}
                  aria-invalid={touched && Boolean(errors.amount)} aria-describedby={`${id("amount")}-hint ${id("amount")}-err`}
                  placeholder="5000"
                />
                <Button type="button" variant="outline" disabled={!balance || balance < MIN_WITHDRAWAL_KOBO}
                  onClick={() => { if (balance !== undefined) { setAmount(koboToNairaInput(balance)); setConfirmed(false); } }}>
                  Withdraw all
                </Button>
              </div>
              <p id={`${id("amount")}-hint`} className="mt-1 text-[12px] text-muted">Minimum ₦1,000. There is no withdrawal fee.</p>
              <div id={`${id("amount")}-err`}><FieldError>{touched ? errors.amount : undefined}</FieldError></div>
            </div>

            <div>
              <label htmlFor={id("bank")} className="t-meta mb-1.5 block font-normal">Bank</label>
              <select id={id("bank")} className="lb-input h-11" value={bank} onChange={e => { setBank(e.target.value); resetLookup(); }}>
                <option value="">Choose your bank</option>
                {BANKS.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor={id("acct")} className="t-meta mb-1.5 block font-normal">Account number</label>
              <input
                id={id("acct")} className="lb-input h-11" inputMode="numeric" autoComplete="off" maxLength={10} value={account}
                onChange={e => { setAccount(e.target.value.replace(/\D/g, "")); resetLookup(); }}
                aria-invalid={touched && Boolean(errors.account)} aria-describedby={`${id("acct")}-err ${id("lookup")}`}
                placeholder="0123456789"
              />
              <div id={`${id("acct")}-err`}><FieldError>{touched ? errors.account : undefined}</FieldError></div>
            </div>

            <div id={id("lookup")} aria-live="polite" role="status" className="empty:hidden">
              {shownLookup.status === "loading" && (
                <p className="flex items-center gap-2 text-[14px] text-muted"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking account…</p>
              )}
              {shownLookup.status === "error" && <p className="rounded-[16px] border border-ink px-4 py-3 text-[14px]">{shownLookup.message}</p>}
              {shownLookup.status === "ok" && (
                <div className="rounded-[16px] bg-brand-wash px-4 py-3 text-[14px]">
                  <p>Is this you? <strong>{shownLookup.name}</strong></p>
                  <label className="mt-2 flex items-start gap-2">
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                    <span>Yes, this is my account and the name is correct.</span>
                  </label>
                </div>
              )}
            </div>

            <Button type="submit" size="lg" disabled={touched ? !canReview : false}>Review withdrawal</Button>
          </form>
        ) : (
          <div className="mt-5 sm:max-w-md">
            <dl className="divide-y divide-hairline rounded-[20px] border border-hairline text-[14px]">
              {[
                ["Amount", amountKobo === null ? "" : formatKobo(amountKobo)],
                ["Bank", bankName(bank)],
                ["Account", maskAccount(account)],
                ["Name", shownLookup.status === "ok" ? shownLookup.name : ""],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-3 text-[14px]">You will receive <strong>{amountKobo === null ? "" : formatKobo(amountKobo)}</strong>. No fee.</p>
            <div className="mt-4 flex gap-3">
              <Button variant="outline" onClick={() => setStep("form")} disabled={busy}>Back</Button>
              <Button onClick={confirmSend} disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                {busy ? "Sending…" : "Confirm withdrawal"}
              </Button>
            </div>
          </div>
        )}

        <div aria-live="polite" role="status" className="mt-4 empty:hidden">
          {notice && (
            <div className={cn("flex items-start gap-2 rounded-[16px] px-4 py-3 text-[14px] transition-opacity duration-200", noticeTone(notice.kind))}>
              {notice.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
              <div>
                <p>{notice.text}</p>
                {notice.verify && onVerify && <Button className="mt-2" size="sm" variant="outline" onClick={onVerify}>Go to identity verification</Button>}
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="Withdrawal history">
        {history.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : history.isError ? (
          <LoadError onRetry={() => history.refetch()} message="We couldn't load your withdrawals." />
        ) : (history.data ?? []).length === 0 ? (
          <EmptyState>No withdrawals yet.</EmptyState>
        ) : (
          <RecordList>{(history.data ?? []).map(w => <HistoryRow key={w.id} w={w} />)}</RecordList>
        )}
      </Panel>
    </div>
  );
}

function HistoryRow({ w }: { w: Withdrawal }) {
  const info = withdrawalStateInfo(w.state);
  const tone = info.tone === "success" ? "bg-brand text-surface" : info.tone === "failed" ? "border border-ink bg-surface text-ink" : "bg-brand-wash text-brand-deep";
  return (
    <li className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="font-semibold tabular-nums">{formatKobo(w.amount)}</p>
        <p className="text-[12px] text-muted">
          {bankName(w.bank_code)} {maskAccount(w.account_number)}{w.created_at ? ` · ${formatLagosDateTime(w.created_at)}` : ""}
        </p>
        <p className="mt-1 text-[12px]">
          {info.hint}
          {info.returned && " The money was returned to your wallet."}
          {w.fail_reason ? ` (${w.fail_reason})` : ""}
        </p>
      </div>
      <span className={cn("inline-flex h-6 shrink-0 items-center self-start whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold", tone)}>
        {info.label}
      </span>
    </li>
  );
}
