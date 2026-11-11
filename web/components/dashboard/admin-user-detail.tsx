"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "@/components/icons";
import { LoadError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { useDeleteUser, useUpdateUser, useVerifyUser } from "@/lib/queries";
import {
  ROLE_CHOICES, consequenceText, deleteConfirmed, deletePhrase, kycLabel, memberSince, roleLabel, useAdminUser, userActionRules,
  type AdminUserDetail,
} from "@/lib/admin-user-detail";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-[20px] bg-canvas p-4">
      <h3 className="mb-1 text-[13px] font-bold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Moderation({ user, onDeleted }: { user: AdminUserDetail; onDeleted: () => void }) {
  const qc = useQueryClient();
  const update = useUpdateUser();
  const verify = useVerifyUser();
  const del = useDeleteUser();
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [cac, setCac] = useState(user.cac_number);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const rules = userActionRules(user);
  const busy = update.isPending || verify.isPending || del.isPending;
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "user", user.id] });

  const act = (fn: (cb: { onSuccess: () => void; onError: (e: unknown) => void }) => void, success: string, fallback: string) => {
    setError("");
    setOk("");
    fn({
      onSuccess: () => { setOk(success); refresh(); },
      onError: e => setError(getFriendlyErrorMessage(e, fallback)),
    });
  };

  return (
    <Section title="Moderation">
      <div role="status" aria-live="polite">
        {ok && <p className="mb-2 rounded-[12px] bg-brand-wash px-3 py-2 text-[14px] text-brand-deep">{ok}</p>}
        {error && <p role="alert" className="mb-2 rounded-[12px] border border-ink bg-surface px-3 py-2 text-[14px]">{error}</p>}
      </div>

      {!rules.canChangeRole && (
        <p className="py-2 text-[14px] text-muted">Admin accounts can&apos;t be changed, suspended or removed from here.</p>
      )}

      {rules.canChangeRole && (
        <div className="space-y-4 divide-y divide-hairline">
          <div className="pt-1">
            <label htmlFor="ud-role" className="text-[14px] font-semibold">Role</label>
            <select
              id="ud-role"
              value={user.role}
              disabled={busy}
              onChange={e => e.target.value !== user.role && act(cb => update.mutate({ id: user.id, patch: { role: e.target.value } }, cb), "Role updated.", "Couldn't change the role.")}
              className="lb-input mt-1 h-10 w-full py-0 text-[14px]"
              aria-describedby="ud-role-note"
            >
              {ROLE_CHOICES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <p id="ud-role-note" className="mt-1 text-[12px] text-muted">{consequenceText("role", user.name)}</p>
          </div>

          <div className="pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => act(cb => update.mutate({ id: user.id, patch: { status: rules.isSuspended ? "active" : "suspended" } }, cb), rules.isSuspended ? "Account reactivated." : "Account suspended.", "Couldn't update the account.")}
              aria-describedby="ud-susp-note"
            >
              {rules.isSuspended ? "Reactivate account" : "Suspend account"}
            </Button>
            <p id="ud-susp-note" className="mt-1 text-[12px] text-muted">{consequenceText(rules.isSuspended ? "reactivate" : "suspend", user.name)}</p>
          </div>

          {rules.canVerify && (
            <div className="pt-4">
              <label htmlFor="ud-cac" className="text-[14px] font-semibold">CAC number (optional)</label>
              <div className="mt-1 flex gap-2">
                <input id="ud-cac" value={cac} onChange={e => setCac(e.target.value)} maxLength={30} className="lb-input h-10 py-0 text-[14px]" aria-describedby="ud-verify-note" />
                <Button size="sm" disabled={busy} onClick={() => act(cb => verify.mutate({ id: user.id, cac_number: cac.trim() || undefined }, cb), "Partner verified.", "Verification failed.")}>
                  Verify
                </Button>
              </div>
              <p id="ud-verify-note" className="mt-1 text-[12px] text-muted">{consequenceText("verify", user.name)}</p>
            </div>
          )}

          <div className="pt-4">
            {!confirming ? (
              <>
                <Button variant="destructive" size="sm" disabled={busy} onClick={() => { setConfirming(true); setTyped(""); }} aria-describedby="ud-del-note">
                  Delete account
                </Button>
                <p id="ud-del-note" className="mt-1 text-[12px] text-muted">{consequenceText("delete", user.name)}</p>
              </>
            ) : (
              <div role="group" aria-labelledby="ud-del-title" className="rounded-[16px] border border-ink bg-surface p-3">
                <p id="ud-del-title" className="text-[14px] font-semibold">Delete {user.name} for good?</p>
                <p className="mt-1 text-[13px] text-muted">{consequenceText("delete", user.name)} Type <strong className="text-ink">{deletePhrase(user)}</strong> to confirm.</p>
                <label htmlFor="ud-del-input" className="sr-only">Type {deletePhrase(user)} to confirm</label>
                <input id="ud-del-input" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" autoFocus className="lb-input mt-2 h-10 py-0 text-[14px]" />
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={del.isPending}>Cancel</Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!deleteConfirmed(typed, user) || del.isPending}
                    onClick={() => act(cb => del.mutate(user.id, { ...cb, onSuccess: () => { cb.onSuccess(); onDeleted(); } }), "Account deleted.", "Couldn't remove the user.")}
                  >
                    {del.isPending ? "Deleting..." : `Delete ${user.name}`}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

function Body({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useAdminUser(id);
  if (q.isLoading) {
    return (
      <div aria-busy="true" className="space-y-3">
        <Skeleton className="h-28 w-full rounded-[20px]" />
        <Skeleton className="h-40 w-full rounded-[20px]" />
        <span className="sr-only">Loading user, please wait.</span>
      </div>
    );
  }
  if (q.isError) {
    const status = q.error instanceof ApiError ? q.error.status : 0;
    if (status === 404) return <p role="alert" className="py-8 text-center text-[14px] text-muted">This user no longer exists. They may have been removed.</p>;
    if (status === 403) return <p role="alert" className="py-8 text-center text-[14px] text-muted">User details are for LuxeBeau admins only.</p>;
    return <LoadError onRetry={() => q.refetch()} message="We couldn't load this user." />;
  }
  const u = q.data;
  if (!u) return null;
  return (
    <div className="space-y-3">
      <Section title="Identity">
        <dl className="divide-y divide-hairline">
          <Row label="Name">{u.name || "-"}</Row>
          <Row label="Email">{u.email || "-"}</Row>
          <Row label="Email confirmed">{u.email_verified ? "Yes" : "No"}</Row>
          <Row label="Phone">{u.phone || "Not given"}</Row>
          <Row label="Role">{roleLabel(u.role)}</Row>
          <Row label="Account status">{u.status === "suspended" ? "Suspended" : "Active"}</Row>
          <Row label="Identity check">{kycLabel(u.kyc_status)}</Row>
          <Row label="Member since">{memberSince(u.created_at)}</Row>
        </dl>
      </Section>
      {(u.role === "seller" || u.role === "artisan") && (
        <Section title="Business">
          <dl className="divide-y divide-hairline">
            <Row label="Partner check">
              {u.verified ? <span className="inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4" aria-hidden /> Verified</span> : "Not verified yet"}
            </Row>
            <Row label="CAC number">{u.cac_number || "Not given"}</Row>
            <Row label="Location">{[u.jurisdiction, u.country_code].filter(Boolean).join(", ") || "Not given"}</Row>
          </dl>
          <p className="mt-2 text-[12px] text-muted">Shop details are not part of this record.</p>
        </Section>
      )}
      <Moderation key={u.id} user={u} onDeleted={onClose} />
    </div>
  );
}

/** Slide-over style dialog with a user's details and every moderation action. */
export function AdminUserDetailPanel({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  return (
    <Dialog open={!!userId} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>User details</DialogTitle>
          <DialogDescription>Review this account and take moderation action.</DialogDescription>
        </DialogHeader>
        {userId && <Body id={userId} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
