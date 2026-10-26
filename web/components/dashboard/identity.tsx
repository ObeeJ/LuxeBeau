"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel } from "@/components/dashboard/widgets";
import { FieldError } from "@/components/site/states";
import { Button } from "@/components/ui/button";
import { useSubmitKyc } from "@/lib/queries";
import { useAuth } from "@/lib/store";
import { getFriendlyErrorMessage } from "@/lib/errors";

/* NIN/BVN verification for sellers and artisans only. Buyers never see it. */
export function IdentityPanel() {
  const user = useAuth(s => s.user);
  const submit = useSubmitKyc();
  const [kind, setKind] = useState<"nin" | "bvn">("nin");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (!user) return null;
  const status = user.kyc_status ?? "unverified";

  return (
    <Panel title="Identity verification">
      {status === "verified" ? (
        <p className="text-[14px] tracking-[-0.014em]">Verified. Your profile shows the verified badge once our team approves your business.</p>
      ) : status === "pending" ? (
        <p className="text-[14px] tracking-[-0.014em] text-muted">Submitted. We&apos;ll update your status after review.</p>
      ) : (
        <form
          noValidate
          onSubmit={e => {
            e.preventDefault();
            if (!/^\d{11}$/.test(value.trim())) {
              setError(`Enter your 11-digit ${kind.toUpperCase()}.`);
              return;
            }
            setError("");
            submit.mutate(
              { type: kind, value: value.trim() },
              {
                onSuccess: r => {
                  useAuth.getState().updateUser({ kyc_status: r.kyc_status });
                  setValue("");
                },
                onError: err => setError(getFriendlyErrorMessage(err, "Verification failed. Check the number and try again.")),
              },
            );
          }}
        >
          <p className="text-[14px] tracking-[-0.014em] text-muted">
            Partners verify their identity before payouts. The number goes to our verification partner and is never stored.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="w-28">
              <span className="t-meta mb-1.5 block font-normal">Document</span>
              <select value={kind} onChange={e => setKind(e.target.value as "nin" | "bvn")} className="lb-input h-11">
                <option value="nin">NIN</option>
                <option value="bvn">BVN</option>
              </select>
            </label>
            <label className="min-w-44 flex-1">
              <span className="t-meta mb-1.5 block font-normal">Number</span>
              <input inputMode="numeric" value={value} onChange={e => setValue(e.target.value)} placeholder="11 digits" className="lb-input h-11" />
            </label>
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Verify
            </Button>
          </div>
          <FieldError>{error}</FieldError>
        </form>
      )}
    </Panel>
  );
}
