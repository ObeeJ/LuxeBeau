"use client";

import { useState } from "react";
import { ChevronRight, Copy, ExternalLink, Loader2, Plus, X } from "@/components/icons";
import { Panel, RecordList, Figures } from "@/components/dashboard/widgets";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatKobo } from "@/lib/ads";
import { formatLagosDateTime } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";
import {
  commissionPct,
  commissionTone,
  stateLabel,
  stateTone,
  useCommissions,
  useCreatePackage,
  useInfluencerPackages,
  useSetPackageState,
  useUpdatePackage,
  type InfluencerCommission,
  type InfluencerPackage,
  type PackageInput,
} from "@/lib/influencer";

/* ── State pill ─────────────────────────────────────────────────── */
function StatePill({ state, tone }: { state: string; tone: ReturnType<typeof stateTone> }) {
  return (
    <span className={cn(
      "inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-[12px] font-semibold",
      tone === "success" && "bg-brand text-surface",
      tone === "pending" && "bg-brand-wash text-brand-deep",
      tone === "failed" && "border border-ink bg-surface text-ink",
      tone === "neutral" && "bg-canvas text-muted",
    )}>
      {stateLabel(state)}
    </span>
  );
}

/* ── Copy link button ───────────────────────────────────────────── */
function CopyLink({ slug, ownerHandle }: { slug: string; ownerHandle?: string }) {
  const [copied, setCopied] = useState(false);
  // The tracking route lives on the Go API, not the Next.js web app.
  // Strip /api/v1 from the API base to get the root API URL.
  const apiRoot = process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, "")
    : "https://luxebeau-api.onrender.com";
  const url = ownerHandle
    ? `${apiRoot}/ref/${ownerHandle}/${slug}`
    : `${apiRoot}/ref/-/${slug}`;

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-[12px] bg-canvas px-3 py-2 text-[12px] text-muted">{url}</code>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy referral link"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Copy className={cn("h-4 w-4 transition-colors", copied ? "text-brand" : "text-muted")} aria-hidden />
      </button>
    </div>
  );
}

/* ── Commission row ─────────────────────────────────────────────── */
function CommissionRow({ c }: { c: InfluencerCommission }) {
  const tone = commissionTone(c.state);
  return (
    <li className="flex items-center justify-between gap-4 py-3 text-[14px]">
      <div className="min-w-0">
        <p className="font-semibold tabular-nums">{formatKobo(c.commission_amount)}</p>
        <p className="text-[12px] text-muted">
          Order {c.order_id}{c.created_at ? ` · ${formatLagosDateTime(c.created_at)}` : ""}
        </p>
      </div>
      <StatePill state={c.state} tone={tone === "success" ? "success" : tone === "pending" ? "pending" : "neutral"} />
    </li>
  );
}

/* ── Commission drill-down panel ────────────────────────────────── */
function CommissionsPanel({ pkg, onBack }: { pkg: InfluencerPackage; onBack: () => void }) {
  const q = useCommissions(pkg.id);
  const list = q.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-[14px] text-muted hover:text-ink focus-visible:outline-none">
          ← Back
        </button>
        <h2 className="text-[16px] font-semibold">{pkg.influencer_name} — commissions</h2>
      </div>

      <Figures items={[
        { label: "Pending", value: formatKobo(pkg.total_pending_kobo) },
        { label: "Earned", value: formatKobo(pkg.total_earned_kobo) },
        { label: "Paid out", value: formatKobo(pkg.total_paid_kobo) },
        { label: "Conversions", value: String(pkg.conversion_count) },
      ]} />

      <Panel title="Commission history">
        {q.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : q.isError ? (
          <LoadError onRetry={() => q.refetch()} message="We couldn't load commissions." />
        ) : list.length === 0 ? (
          <EmptyState>No commissions yet. Share the referral link to start earning.</EmptyState>
        ) : (
          <RecordList>{list.map(c => <CommissionRow key={c.id} c={c} />)}</RecordList>
        )}
      </Panel>
    </div>
  );
}

/* ── Package form ───────────────────────────────────────────────── */
interface FormProps {
  initial?: InfluencerPackage;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: PackageInput, setError: (m: string) => void) => void;
}

function PackageForm({ initial, pending, onClose, onSubmit }: FormProps) {
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [name, setName] = useState(initial?.influencer_name ?? "");
  const [email, setEmail] = useState(initial?.influencer_email ?? "");
  const [phone, setPhone] = useState(initial?.influencer_phone ?? "");
  const [handle, setHandle] = useState(initial?.influencer_handle ?? "");
  const [scope, setScope] = useState(initial?.scope ?? "");
  const [agreement, setAgreement] = useState(initial?.agreement ?? "");
  const [commPct, setCommPct] = useState(initial ? String(initial.commission_bps / 100) : "");
  const [bankCode, setBankCode] = useState(initial?.bank_code ?? "");
  const [accountNumber, setAccountNumber] = useState(initial?.account_number ?? "");
  const [accountName, setAccountName] = useState(initial?.account_name ?? "");
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const bps = Math.round(parseFloat(commPct) * 100);
    if (!name.trim()) return setError("Enter the influencer's name.");
    if (!scope.trim() || scope.trim().length < 10) return setError("Describe the scope (at least 10 characters).");
    if (!bps || bps < 1 || bps > 5000) return setError("Commission must be between 0.01% and 50%.");
    if (!initial && !slug.trim()) return setError("Enter a link name.");
    setError("");
    onSubmit({
      slug: slug.trim().toLowerCase(),
      influencer_name: name.trim(),
      influencer_email: email.trim() || undefined,
      influencer_phone: phone.trim() || undefined,
      influencer_handle: handle.trim() || undefined,
      scope: scope.trim(),
      agreement: agreement.trim() || undefined,
      commission_bps: bps,
      bank_code: bankCode.trim() || undefined,
      account_number: accountNumber.trim() || undefined,
      account_name: accountName.trim() || undefined,
    }, setError);
  };

  const field = (label: string, control: React.ReactNode, hint?: string) => (
    <div>
      <Label className="mb-1.5 block text-[13px] font-medium">{label}</Label>
      {control}
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={initial ? "Edit influencer package" : "New influencer package"}
      onKeyDown={e => e.key === "Escape" && onClose()}
    >
      <form
        onSubmit={submit}
        noValidate
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-surface p-5 shadow-float sm:rounded-[28px] sm:p-6"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-bold tracking-tight">
            {initial ? "Edit package" : "New influencer package"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-canvas"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Slug — immutable after creation */}
          {!initial && field(
            "Link name",
            <input
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="lb-input h-11"
              placeholder="chioma-beauty"
            />,
            "Lowercase letters, numbers and hyphens. Cannot be changed after creation.",
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {field("Influencer name", <Input value={name} onChange={e => setName(e.target.value)} placeholder="Chioma Obi" />)}
            {field(
              "Commission (%)",
              <Input
                value={commPct}
                onChange={e => setCommPct(e.target.value)}
                inputMode="decimal"
                placeholder="10"
              />,
              "Your net payout after the platform fee.",
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {field("Email (optional)", <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="chioma@example.com" />)}
            {field("Phone (optional)", <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0803 123 4567" />)}
          </div>

          {field("Instagram / TikTok handle (optional)", <Input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@chioma_beauty" />)}

          {field(
            "Scope of work",
            <textarea
              value={scope}
              onChange={e => setScope(e.target.value)}
              rows={3}
              className="lb-input"
              placeholder="Promote our skincare range on Instagram Stories and TikTok for 30 days."
            />,
          )}

          {field(
            "Agreement / terms (optional)",
            <textarea
              value={agreement}
              onChange={e => setAgreement(e.target.value)}
              rows={3}
              className="lb-input"
              placeholder="Commission is paid 7 days after delivery is confirmed…"
            />,
          )}

          <p className="text-[13px] font-semibold text-ink">Payout bank details (optional)</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {field("Bank code", <Input value={bankCode} onChange={e => setBankCode(e.target.value)} placeholder="058" maxLength={10} />)}
            {field("Account number", <Input value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ""))} placeholder="0123456789" maxLength={10} />)}
            {field("Account name", <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Chioma Obi" />)}
          </div>
        </div>

        <FieldError>{error}</FieldError>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {pending ? "Saving…" : initial ? "Save changes" : "Create package"}
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ── Package card ───────────────────────────────────────────────── */
function PackageCard({
  pkg,
  onEdit,
  onViewCommissions,
  onStateChange,
  stateChanging,
}: {
  pkg: InfluencerPackage;
  onEdit: () => void;
  onViewCommissions: () => void;
  onStateChange: (state: string) => void;
  stateChanging: boolean;
}) {
  const tone = stateTone(pkg.state);
  const totalActivity = pkg.total_pending_kobo + pkg.total_earned_kobo + pkg.total_paid_kobo;

  return (
    <li className="rounded-[20px] border border-hairline bg-surface p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{pkg.influencer_name}</p>
          {pkg.influencer_handle && (
            <p className="text-[12px] text-muted">{pkg.influencer_handle}</p>
          )}
        </div>
        <StatePill state={pkg.state} tone={tone} />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-[16px] bg-canvas p-3 text-center text-[12px]">
        <div>
          <p className="font-semibold tabular-nums">{commissionPct(pkg.commission_bps)}</p>
          <p className="text-muted">Commission</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{pkg.conversion_count}</p>
          <p className="text-muted">Conversions</p>
        </div>
        <div>
          <p className="font-semibold tabular-nums">{totalActivity > 0 ? formatKobo(totalActivity) : "—"}</p>
          <p className="text-muted">Total earned</p>
        </div>
      </div>

      <CopyLink slug={pkg.slug} />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button>
        <Button size="sm" variant="ghost" onClick={onViewCommissions} className="gap-1">
          Commissions <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
        {pkg.state === "active" && (
          <Button size="sm" variant="ghost" disabled={stateChanging} onClick={() => onStateChange("paused")}>
            Pause
          </Button>
        )}
        {pkg.state === "paused" && (
          <Button size="sm" variant="ghost" disabled={stateChanging} onClick={() => onStateChange("active")}>
            Resume
          </Button>
        )}
        {pkg.state !== "cancelled" && (
          <Button size="sm" variant="ghost" disabled={stateChanging}
            onClick={() => { if (window.confirm("Cancel this package? The influencer's link will stop working.")) onStateChange("cancelled"); }}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  );
}

/* ── Main export ────────────────────────────────────────────────── */
export function InfluencerPackages({ enabled }: { enabled: boolean }) {
  const q = useInfluencerPackages(enabled);
  const create = useCreatePackage();
  const update = useUpdatePackage();
  const setState = useSetPackageState();

  type Editing = { mode: "new" } | { mode: "edit"; pkg: InfluencerPackage };
  const [editing, setEditing] = useState<Editing | null>(null);
  const [viewing, setViewing] = useState<InfluencerPackage | null>(null);
  const [stateChangingId, setStateChangingId] = useState<number | null>(null);

  const packages = q.data ?? [];

  if (viewing) {
    return <CommissionsPanel pkg={viewing} onBack={() => setViewing(null)} />;
  }

  const handleSubmit = (input: PackageInput, setError: (m: string) => void) => {
    if (editing?.mode === "edit") {
      update.mutate({ id: editing.pkg.id, input }, {
        onSuccess: () => setEditing(null),
        onError: e => setError(getFriendlyErrorMessage(e, "We couldn't save this package.")),
      });
    } else {
      create.mutate(input, {
        onSuccess: () => setEditing(null),
        onError: e => setError(getFriendlyErrorMessage(e, "We couldn't create this package.")),
      });
    }
  };

  const handleStateChange = (pkg: InfluencerPackage, state: string) => {
    setStateChangingId(pkg.id);
    setState.mutate({ id: pkg.id, state }, {
      onSettled: () => setStateChangingId(null),
    });
  };

  const active = packages.filter(p => p.state === "active");
  const inactive = packages.filter(p => p.state !== "active");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[14px] text-muted">
            Create a unique referral link for each influencer. They earn a commission on every order they bring in.
          </p>
        </div>
        <Button onClick={() => setEditing({ mode: "new" })} size="sm">
          <Plus aria-hidden /> New package
        </Button>
      </div>

      {q.isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-[20px]" />)}
        </div>
      ) : q.isError ? (
        <LoadError onRetry={() => q.refetch()} message="We couldn't load your influencer packages." />
      ) : packages.length === 0 ? (
        <Panel>
          <EmptyState>
            No influencer packages yet.{" "}
            <button onClick={() => setEditing({ mode: "new" })} className="text-ink underline underline-offset-4">
              Create your first one
            </button>
          </EmptyState>
        </Panel>
      ) : (
        <div className="space-y-5">
          {active.length > 0 && (
            <div>
              <p className="mb-3 text-[13px] font-semibold text-muted uppercase tracking-wider">Active</p>
              <ul className="space-y-3">
                {active.map(pkg => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onEdit={() => setEditing({ mode: "edit", pkg })}
                    onViewCommissions={() => setViewing(pkg)}
                    onStateChange={state => handleStateChange(pkg, state)}
                    stateChanging={stateChangingId === pkg.id}
                  />
                ))}
              </ul>
            </div>
          )}
          {inactive.length > 0 && (
            <div>
              <p className="mb-3 text-[13px] font-semibold text-muted uppercase tracking-wider">Inactive</p>
              <ul className="space-y-3">
                {inactive.map(pkg => (
                  <PackageCard
                    key={pkg.id}
                    pkg={pkg}
                    onEdit={() => setEditing({ mode: "edit", pkg })}
                    onViewCommissions={() => setViewing(pkg)}
                    onStateChange={state => handleStateChange(pkg, state)}
                    stateChanging={stateChangingId === pkg.id}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {editing && (
        <PackageForm
          initial={editing.mode === "edit" ? editing.pkg : undefined}
          pending={create.isPending || update.isPending}
          onClose={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
