"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, CalendarDays, Check, Clock, ExternalLink, Scissors, Star, Wallet } from "lucide-react";
import { PageHeader, Panel, RecordList, RecordRow, StatCard, StatusPill } from "@/components/dashboard/widgets";
import { EmptyState, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import { useConfirmBooking, useMyArtisanProfile, useMyBookings, useWallet } from "@/lib/queries";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/slide-in-notifications";
import { getFriendlyErrorMessage } from "@/lib/errors";

function duration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "—";
}

export default function ArtisanDashboard() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const isArtisan = user?.role === "artisan";
  const { toast } = useToast();

  const enabled = Boolean(user && isArtisan);
  const profile = useMyArtisanProfile(enabled);
  const bookings = useMyBookings(enabled);
  const wallet = useWallet(enabled);
  const confirm = useConfirmBooking();

  /* Non-artisans are sent to onboarding. */
  useEffect(() => {
    if (user && !isArtisan) router.replace("/partnership/artisan");
  }, [user, isArtisan, router]);

  if (!user || !isArtisan) return null;

  const artisan = profile.data;
  const list = bookings.data ?? [];
  const pending = list.filter(b => b.status === "pending");
  const upcoming = list.filter(b => b.status === "pending" || b.status === "confirmed");

  const confirmBooking = (id: string) =>
    confirm.mutate(id, {
      onSuccess: () => toast(`Booking ${id} confirmed.`, "success"),
      onError: err => toast(getFriendlyErrorMessage(err, "We couldn't confirm this booking."), "error"),
    });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Artisan studio"
        title={profile.isLoading ? "Loading…" : artisan?.studio || user.name}
        subtitle={
          artisan ? (
            <span className="inline-flex flex-wrap items-center gap-x-2">
              {[artisan.craft, [artisan.area, artisan.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
              {artisan.verified && <span className="inline-flex items-center gap-1 text-ink"><BadgeCheck className="h-4 w-4" aria-hidden /> Verified</span>}
            </span>
          ) : user.email
        }
        action={
          artisan && (
            <Button asChild variant="outline">
              <Link href={`/services/${artisan.slug}`}>View public profile <ExternalLink aria-hidden /></Link>
            </Button>
          )
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key metrics">
        <StatCard icon={CalendarDays} label="Awaiting confirmation" value={bookings.isLoading ? "—" : String(pending.length)} />
        <StatCard icon={Clock} label="Upcoming" value={bookings.isLoading ? "—" : String(upcoming.length)} />
        <StatCard icon={Star} label="Rating" value={artisan ? artisan.rating.toFixed(1) : "—"} />
        <StatCard icon={Wallet} label="Wallet balance" value={wallet.data ? formatNaira(wallet.data.balanceNGN) : "—"} />
      </section>

      <Panel id="bookings" title="Incoming bookings" icon={CalendarDays}>
        {bookings.isLoading ? (
          <div className="space-y-2" role="status" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : bookings.isError ? (
          <LoadError onRetry={() => bookings.refetch()} message="We could not load your bookings." />
        ) : list.length === 0 ? (
          <EmptyState>No bookings yet. Share your public profile to start receiving requests.</EmptyState>
        ) : (
          <RecordList>
            {list.map(b => (
              <RecordRow
                key={b.id}
                title={b.service}
                subtitle={b.client ? `Client: ${b.client}` : undefined}
                meta={`${b.id} · ${b.date}${b.time ? ` · ${b.time}` : ""}${b.serviceType ? ` · ${b.serviceType}` : ""}`}
                amount={formatNaira(b.priceNGN)}
                status={<StatusPill status={b.status} />}
                actions={
                  b.status === "pending" && (
                    <Button size="sm" onClick={() => confirmBooking(b.id)} disabled={confirm.isPending}>
                      <Check aria-hidden /> Confirm
                    </Button>
                  )
                }
              />
            ))}
          </RecordList>
        )}
      </Panel>

      <Panel title="Your services" icon={Scissors}>
        {profile.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : profile.isError ? (
          <LoadError onRetry={() => profile.refetch()} message="We could not load your profile." />
        ) : !artisan || artisan.services.length === 0 ? (
          <EmptyState>No services published yet. Clients can still book from your starting price.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {artisan.services.map(s => (
              <div key={s.name} className="rounded-[20px] bg-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="t-sub">{s.name}</p>
                  <span className="shrink-0 text-[14px] tracking-[-0.014em]">{formatNaira(s.priceNGN)}</span>
                </div>
                {s.description && <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">{s.description}</p>}
                <p className="t-meta mt-2 flex items-center gap-1 font-normal text-muted"><Clock className="h-3.5 w-3.5" aria-hidden /> {duration(s.durationMins)}</p>
              </div>
            ))}
          </div>
        )}
        {artisan && (
          <p className="t-meta mt-4 font-normal text-muted">
            Starting price {formatNaira(artisan.fromNGN)} · {artisan.bookings} jobs completed
          </p>
        )}
      </Panel>
    </div>
  );
}
