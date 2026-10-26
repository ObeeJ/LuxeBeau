"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel, StatusPill } from "@/components/dashboard/widgets";
import { Avatar, visitLabel } from "@/components/site/catalog";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useApplications, useVerifyUser } from "@/lib/queries";
import { type Application } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-[14px] tracking-[-0.014em]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function ApplicationCard({ app }: { app: Application }) {
  const verify = useVerifyUser();
  const [error, setError] = useState("");
  const { user, artisan } = app;
  const isArtisan = user.role === "artisan";
  const services = artisan?.services ?? [];

  const approve = () => {
    setError("");
    verify.mutate({ id: user.id }, { onError: err => setError(getFriendlyErrorMessage(err, "We couldn't approve this account.")) });
  };

  return (
    <li className="py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar src={artisan?.image_url ?? undefined} name={user.name} className="h-12 w-12 text-[32px]" />
        <div className="min-w-0 flex-1 basis-56">
          <p className="flex flex-wrap items-center gap-2 text-[16px] tracking-[-0.031em]">
            {isArtisan && artisan?.studio ? artisan.studio : user.name}
            <StatusPill status={isArtisan ? "Artisan" : "Seller"} />
          </p>
          <p className="truncate text-[14px] tracking-[-0.014em] text-muted">{user.name} · {user.email}</p>
          <p className="mt-0.5 text-[12px] tracking-[-0.017em] text-muted">Applied {(user.created_at ?? "").slice(0, 10)}</p>
        </div>
      </div>

      <dl className="mt-3 divide-y divide-hairline rounded-[20px] bg-canvas px-4 py-1">
        <Detail label="CAC number">{user.cac_number || "Not given"}</Detail>
        <Detail label="Phone">{user.phone || "Not given"}</Detail>
        <Detail label="Identity check">{user.kyc_status || "unverified"}</Detail>
        {isArtisan ? (
          <>
            <Detail label="Craft">{artisan?.craft || artisan?.specialty || "Not given"}</Detail>
            <Detail label="Works">{artisan?.service_mode ? visitLabel(artisan.service_mode) : "Not given"}</Detail>
            <Detail label="Location">{[artisan?.area, artisan?.city].filter(Boolean).join(", ") || artisan?.location || "Not given"}</Detail>
            <Detail label="Services">
              {services.length ? services.map(s => `${s.name} (${formatNaira(s.price / 100)})`).join(", ") : "None yet"}
            </Detail>
          </>
        ) : (
          <Detail label="Products listed">{app.products ?? 0}</Detail>
        )}
      </dl>
      {isArtisan && artisan?.bio && <p className="mt-3 text-[14px] tracking-[-0.014em] text-muted">{artisan.bio}</p>}
      <div className="mt-4">
          <Button onClick={approve} disabled={verify.isPending}>
            {verify.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Approve
          </Button>
      </div>
      <FieldError>{error}</FieldError>
    </li>
  );
}

/* Sellers and artisans waiting for approval, oldest first. Approving makes
   their products / profile public and emails them. */
export function ApplicationsPanel({ enabled }: { enabled: boolean }) {
  const apps = useApplications(enabled);
  return (
    <Panel title="Waiting for approval">
      {apps.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : apps.isError ? (
        <LoadError onRetry={() => apps.refetch()} message="We couldn't load applications." />
      ) : (apps.data ?? []).length === 0 ? (
        <EmptyState>No one is waiting. New seller and artisan sign-ups appear here.</EmptyState>
      ) : (
        <ul className="divide-y divide-hairline">
          {apps.data!.map(a => <ApplicationCard key={a.user.id} app={a} />)}
        </ul>
      )}
    </Panel>
  );
}
