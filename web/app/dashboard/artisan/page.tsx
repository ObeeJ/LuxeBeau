"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { Figures, PageHeader, Panel, RecordList, RecordRow, StatusPill, Tabs } from "@/components/dashboard/widgets";
import { IdentityPanel } from "@/components/dashboard/identity";
import { ServicesEditor } from "@/components/dashboard/services-editor";
import { AvailabilityEditor } from "@/components/dashboard/availability-editor";
import { PendingApproval } from "@/components/dashboard/pending-approval";
import { Avatar, visitLabel } from "@/components/site/catalog";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import { useConfirmBooking, useMyArtisanProfile, useMyBookings, useWallet } from "@/lib/queries";
import { type MyBooking } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { getFriendlyErrorMessage } from "@/lib/errors";

type Tab = "bookings" | "services" | "availability" | "verification";

export default function ArtisanDashboard() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const status = useAuth(s => s.status);
  const isArtisan = user?.role === "artisan";

  const enabled = Boolean(user && isArtisan);
  const profile = useMyArtisanProfile(enabled);
  const bookings = useMyBookings(enabled);
  const wallet = useWallet(enabled);
  const confirm = useConfirmBooking();
  const [tab, setTab] = useState<Tab>("bookings");
  const [error, setError] = useState("");

  /* Non-artisans are sent to onboarding. */
  useEffect(() => {
    if (status === "signedIn" && !isArtisan) router.replace("/partnership/artisan");
  }, [status, isArtisan, router]);

  if (status === "loading") return <Skeleton className="h-64 w-full rounded-[28px] bg-surface" />;
  if (!user) {
    return (
      <div className="mx-auto max-w-sm rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <h1 className="t-display">Artisan studio</h1>
        <p className="mt-2 text-[16px] text-muted">Sign in with your artisan account.</p>
        <Button asChild size="lg" className="mt-5"><Link href="/dashboard">Go to sign in</Link></Button>
      </div>
    );
  }
  if (!isArtisan) return null;

  const artisan = profile.data;
  const list = bookings.data ?? [];
  const pending = list.filter(b => b.status === "pending");
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = list.filter(b => b.status !== "pending" && b.date >= today);
  const past = list.filter(b => b.status !== "pending" && b.date < today);

  const confirmBooking = (id: string) => {
    setError("");
    confirm.mutate(id, { onError: err => setError(getFriendlyErrorMessage(err, "We couldn't confirm this booking.")) });
  };

  const bookingRow = (b: MyBooking, withConfirm = false) => (
    <RecordRow
      key={b.id}
      title={`${b.service}${b.client ? ` · ${b.client}` : ""}`}
      meta={`${b.date} at ${b.time} · ${b.serviceType === "home" ? `Home visit: ${b.address || "address pending"}` : "At the studio"} · ${b.id}`}
      status={withConfirm ? undefined : <StatusPill status={b.status} />}
      actions={withConfirm ? <Button size="sm" onClick={() => confirmBooking(b.id)} disabled={confirm.isPending}>Confirm</Button> : undefined}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={artisan?.imageUrl} name={user.name} className="h-14 w-14 text-[40px]" />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={artisan?.studio || user.name}
            subtitle={
              artisan ? (
                <span className="inline-flex flex-wrap items-center gap-x-1.5">
                  {artisan.craft} · {visitLabel(artisan.serviceMode)}
                  {artisan.verified && <span className="inline-flex items-center gap-1 text-ink"><BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified</span>}
                </span>
              ) : user.email
            }
          />
        </div>
        {artisan && user.verified && (
          <Button asChild variant="outline"><Link href={`/services/${artisan.slug}`}>View public page</Link></Button>
        )}
        {artisan && <Button asChild variant="outline"><Link href="/partnership/artisan">Edit profile</Link></Button>}
      </div>

      {!user.verified && <PendingApproval kind="artisan" />}

      <Figures
        items={[
          { label: "To confirm", value: bookings.isLoading ? "—" : String(pending.length) },
          { label: "Upcoming", value: bookings.isLoading ? "—" : String(upcoming.length) },
          { label: "Rating", value: artisan?.rating ? artisan.rating.toFixed(1) : "—" },
          { label: "Wallet", value: wallet.data ? formatNaira(wallet.data.balanceNGN) : "—" },
        ]}
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "bookings", label: "Bookings", count: list.length },
          { id: "services", label: "Services", count: artisan?.services.length },
          { id: "availability", label: "Availability" },
          { id: "verification", label: "Verification" },
        ]}
      />

      {tab === "bookings" && (
        <div className="space-y-5">
          {bookings.isLoading ? (
            <Panel><Skeleton className="h-32 w-full" /></Panel>
          ) : bookings.isError ? (
            <Panel><LoadError onRetry={() => bookings.refetch()} message="We couldn't load your bookings." /></Panel>
          ) : list.length === 0 ? (
            <Panel><EmptyState>No bookings yet. Share your public page to start receiving requests.</EmptyState></Panel>
          ) : (
            <>
              {pending.length > 0 && (
                <Panel title="Waiting for you to confirm">
                  <RecordList>{pending.map(b => bookingRow(b, true))}</RecordList>
                  <FieldError>{error}</FieldError>
                </Panel>
              )}
              {upcoming.length > 0 && <Panel title="Upcoming"><RecordList>{upcoming.map(b => bookingRow(b))}</RecordList></Panel>}
              {past.length > 0 && <Panel title="Past"><RecordList>{past.map(b => bookingRow(b))}</RecordList></Panel>}
            </>
          )}
        </div>
      )}

      {tab === "services" &&
        (profile.isLoading ? (
          <Panel><Skeleton className="h-40 w-full" /></Panel>
        ) : profile.isError || !artisan ? (
          <Panel><LoadError onRetry={() => profile.refetch()} message="We couldn't load your profile." /></Panel>
        ) : (
          <ServicesEditor key={artisan.id} services={artisan.services} />
        ))}

      {tab === "availability" && <AvailabilityEditor />}

      {tab === "verification" && <IdentityPanel />}
    </div>
  );
}
