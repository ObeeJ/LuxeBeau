"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, CalendarDays, CheckCircle2, ChevronLeft, Home, Loader2, MapPin, Star, Store } from "@/components/icons";
import SiteShell, { Container } from "@/components/site/shell";
import { visitLabel } from "@/components/site/catalog";
import { Segmented } from "@/components/site/filters";
import { FieldError, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { bookingStart, formatLagosDateTime, formatNaira } from "@/lib/format";
import { useAuth } from "@/lib/store";
import { useArtisan, useAvailability, useCreateBooking } from "@/lib/queries";
import { ApiError, type ArtisanService, type BookingResult } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { cn } from "@/lib/utils";

/* Times come from GET /artisans/:id/availability for the chosen service:
   only start times where the whole service fits are offered. The value
   sent is 24h; the label is 12h. */
function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

/* Dates arrive as YYYY-MM-DD in Lagos time; format them as calendar dates
   (UTC) so the viewer's own timezone can't shift the day. */
const weekdayFmt = new Intl.DateTimeFormat("en-NG", { weekday: "short", timeZone: "UTC" });
const dayFmt = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });
function dayLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return { iso, weekday: weekdayFmt.format(d), date: dayFmt.format(d) };
}

/* The cancellation terms in words, shown before the client requests a booking
   (the API stores the same notice on the booking so the terms can't change later). */
function policyLine(hours: number, day: string, time: string): string {
  if (hours <= 0) return "Free to cancel any time";
  if (day && time) {
    const until = new Date(bookingStart(day, time).getTime() - hours * 3_600_000);
    return `Free to cancel until ${formatLagosDateTime(until)}`;
  }
  return `Free to cancel up to ${hours} hours before`;
}

function duration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ") || "";
}

function Chip({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 text-[14px] tracking-[-0.014em] transition-colors duration-200",
        selected ? "border-ink bg-ink text-surface" : "border-hairline bg-surface text-ink hover:bg-canvas",
        className,
      )}
    >
      {children}
    </button>
  );
}

export default function ArtisanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: artisan, isLoading, isError, refetch } = useArtisan(slug);
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);
  const createBooking = useCreateBooking();

  const [service, setService] = useState<ArtisanService | null>(null);
  const availability = useAvailability(artisan?.id, service?.name ?? "", 14);
  const days = useMemo(() => (availability.data ?? []).map(d => ({ ...dayLabel(d.date), times: d.times })), [availability.data]);
  const [visit, setVisit] = useState<"studio" | "home" | null>(null);
  const [address, setAddress] = useState("");
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<BookingResult | null>(null);

  if (isLoading) {
    return (
      <SiteShell>
        <Container className="pt-8 md:pt-12">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]" role="status" aria-busy="true">
            <div className="space-y-4">
              <Skeleton className="h-24 w-full rounded-[28px] bg-surface" />
              <Skeleton className="h-64 w-full rounded-[28px] bg-surface" />
            </div>
            <Skeleton className="h-72 w-full rounded-[28px] bg-surface" />
            <span className="sr-only">Loading artisan</span>
          </div>
        </Container>
      </SiteShell>
    );
  }

  if (isError) {
    return (
      <SiteShell>
        <Container className="pt-8"><LoadError onRetry={() => refetch()} message="We couldn't load this artisan. Please try again." /></Container>
      </SiteShell>
    );
  }

  if (!artisan) notFound();

  const offersStudio = artisan.serviceMode !== "home";
  const offersHome = artisan.serviceMode !== "studio";
  // A single-mode artisan has no choice to make.
  const chosenVisit = visit ?? (offersStudio && !offersHome ? "studio" : !offersStudio && offersHome ? "home" : null);
  const studioAddress = [artisan.studio, artisan.area, artisan.city].filter(Boolean).join(", ");
  const dayInfo = days.find(d => d.iso === day);
  const pickService = (s: ArtisanService) => {
    setService(s);
    // Open times depend on the service's length, so start the time over.
    if (s.name !== service?.name) {
      setDay("");
      setSlot("");
    }
  };
  const ready = Boolean(service && chosenVisit && day && slot && (chosenVisit === "studio" || address.trim().length >= 8));

  const submit = () => {
    if (!service || !chosenVisit || !day || !slot) return;
    if (chosenVisit === "home" && address.trim().length < 8) {
      setError("Enter the full address for your home appointment.");
      return;
    }
    setError("");
    createBooking.mutate(
      {
        artisan_id: Number(artisan.id),
        service_name: service.name,
        date: day,
        slot_time: slot,
        service_type: chosenVisit,
        address: chosenVisit === "home" ? address.trim() : undefined,
      },
      {
        onSuccess: setBooked,
        onError: err => {
          if (err instanceof ApiError && err.status === 409) {
            setSlot("");
            availability.refetch();
          }
          setError(getFriendlyErrorMessage(err, "We couldn't reserve that slot. Please pick another time."));
        },
      },
    );
  };

  const request = () => {
    if (!user) {
      showAuth("signin", submit, "Sign in to request this booking. Your choices are kept.");
      return;
    }
    submit();
  };

  if (booked) {
    return (
      <SiteShell>
        <Container className="pt-10">
          <div className="mx-auto max-w-md rounded-[28px] bg-surface p-6 shadow-card sm:p-8">
            <CheckCircle2 className="h-8 w-8" strokeWidth={1.5} aria-hidden />
            <h1 className="t-display mt-4">Request sent to {artisan.name.split(" ")[0]}</h1>
            <p className="mt-2 text-[16px] text-muted">
              We&apos;ve emailed you the details. You&apos;ll get another email when the booking is confirmed.
            </p>
            <dl className="mt-5 divide-y divide-hairline text-[14px] tracking-[-0.014em]">
              {[
                ["Service", service?.name],
                ["When", `${dayLabel(day).weekday} ${dayLabel(day).date}, ${to12h(slot)}`],
                ["Where", chosenVisit === "home" ? address : studioAddress],
                ["Cancellation", policyLine(artisan.cancelWindowHours, day, slot)],
                ["Reference", booked.id],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted">{k}</dt>
                  <dd className="text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild><Link href="/dashboard">My bookings</Link></Button>
              <Button asChild variant="outline"><Link href="/services">Browse artisans</Link></Button>
            </div>
          </div>
        </Container>
      </SiteShell>
    );
  }

  const summary = (
    <>
      <dl className="divide-y divide-hairline text-[14px] tracking-[-0.014em]">
        {[
          ["Service", service?.name ?? "Choose a service"],
          ["Where", chosenVisit === "home" ? "Your address" : chosenVisit === "studio" ? studioAddress : "Choose where"],
          ["When", dayInfo ? `${dayInfo.weekday} ${dayInfo.date}${slot ? `, ${to12h(slot)}` : ""}` : "Choose a time"],
          ["Cancellation", policyLine(artisan.cancelWindowHours, day, slot)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-[14px] text-muted">Price</span>
        <span className="text-[26px] font-extrabold tracking-[-0.05em] text-brand-deep">{service ? formatNaira(service.priceNGN) : `From ${formatNaira(artisan.fromNGN)}`}</span>
      </div>
    </>
  );

  return (
    // The mobile booking bar would cover the footer, so this page omits it.
    <SiteShell footer={false}>
      <Container className="pb-32 pt-5 md:pt-8 lg:pb-16">
        <Link href="/services" className="inline-flex items-center gap-1 text-[14px] tracking-[-0.014em] text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Artisans
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <div className="min-w-0">
            {/* Profile: cover photo with the artisan's details over it */}
            <div className={cn("relative overflow-hidden rounded-[32px] text-surface", !artisan.imageUrl && "bg-gradient-to-br from-brand-deep to-brand")}>
              {artisan.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artisan.imageUrl} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/5" />
              <div className="relative flex min-h-[280px] flex-col justify-end p-5 sm:min-h-[340px] sm:p-7">
                <h1 className="flex items-center gap-2 text-[32px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[44px]">
                  {artisan.name}
                  {artisan.verified && <BadgeCheck className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" aria-label="Verified" />}
                </h1>
                <p className="mt-1 text-[15px] tracking-[-0.014em] opacity-90">{artisan.craft} · {artisan.studio}</p>
                <div className="mt-3.5 flex flex-wrap gap-2">
                  {artisan.rating > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm" aria-label={`Rated ${artisan.rating.toFixed(1)} out of 5`}>
                      <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden /> {artisan.rating.toFixed(1)}
                      {artisan.bookings > 0 && <span className="opacity-80">({artisan.bookings.toLocaleString("en-NG")})</span>}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {[artisan.area, artisan.city].filter(Boolean).join(", ")}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-surface/20 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">{visitLabel(artisan.serviceMode)}</span>
                </div>
              </div>
            </div>
            {artisan.bio && <p className="mt-5 max-w-2xl text-[16px]">{artisan.bio}</p>}

            {/* Service */}
            <section className="mt-8" aria-label="Service">
              <h2 className="t-sub">Service</h2>
              {artisan.services.length === 0 ? (
                <p className="mt-2 text-[14px] text-muted">No services published yet.</p>
              ) : (
                <div className="mt-3 grid gap-2.5" role="radiogroup" aria-label="Service">
                  {artisan.services.map(s => {
                    const selected = service?.name === s.name;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => pickService(s)}
                        className={cn("flex w-full items-start gap-3 rounded-[22px] px-4 py-3.5 text-left shadow-pill transition-all duration-200", selected ? "bg-brand-wash ring-2 ring-brand" : "bg-surface ring-1 ring-hairline hover:ring-brand/40")}
                      >
                        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-brand" : "border-stone")} aria-hidden>
                          {selected && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="text-[16px] font-semibold tracking-[-0.03em]">{s.name}</span>
                            <span className="shrink-0 text-[15px] font-bold tracking-[-0.02em] text-brand-deep">{formatNaira(s.priceNGN)}</span>
                          </span>
                          <span className="mt-0.5 block text-[14px] tracking-[-0.014em] text-muted">
                            {[duration(s.durationMins), s.description].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Where */}
            <section className="mt-8" aria-label="Where">
              <h2 className="t-sub">Where</h2>
              {offersStudio && offersHome ? (
                <div className="mt-3">
                  <Segmented<"studio" | "home">
                    value={(chosenVisit ?? "") as "studio" | "home"}
                    onChange={setVisit}
                    options={[
                      { value: "studio", label: "At the studio", icon: Store },
                      { value: "home", label: "At my place", icon: Home },
                    ]}
                  />
                </div>
              ) : (
                <p className="mt-2 text-[14px] tracking-[-0.014em] text-muted">
                  {offersHome ? `${artisan.name.split(" ")[0]} comes to you.` : `At the studio: ${studioAddress}.`}
                </p>
              )}
              {chosenVisit === "studio" && offersHome && (
                <p className="mt-2 text-[14px] tracking-[-0.014em] text-muted">{studioAddress}</p>
              )}
              {chosenVisit === "home" && (
                <div className="mt-3 max-w-xl">
                  <Label htmlFor="visit-address">Your address</Label>
                  <Textarea
                    id="visit-address"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    rows={2}
                    autoComplete="street-address"
                    placeholder="House number, street, area and a landmark"
                    className="mt-1.5 min-h-0"
                  />
                </div>
              )}
            </section>

            {/* When */}
            <section className="mt-8" aria-label="When">
              <h2 className="t-sub">When</h2>
              {!service ? (
                <p className="mt-2 text-[14px] tracking-[-0.014em] text-muted">Choose a service to see open times.</p>
              ) : availability.isLoading ? (
                <div className="mt-3 flex gap-2" role="status" aria-busy="true">
                  {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 w-16 rounded-full bg-surface" />)}
                  <span className="sr-only">Loading open times</span>
                </div>
              ) : availability.isError ? (
                <div className="mt-3"><LoadError onRetry={() => availability.refetch()} message="We couldn't load open times." /></div>
              ) : days.length === 0 ? (
                <p className="mt-2 text-[14px] tracking-[-0.014em] text-muted">
                  No open times for this service in the next two weeks. Try a shorter service or check back soon.
                </p>
              ) : (
                <>
                  <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="radiogroup" aria-label="Day">
                    {days.map(d => (
                      <Chip key={d.iso} selected={day === d.iso} onClick={() => { setDay(d.iso); setSlot(""); }} className="flex h-14 w-16 flex-col items-center justify-center px-0">
                        <span className="text-[12px] opacity-70">{d.weekday}</span>
                        <span>{d.date}</span>
                      </Chip>
                    ))}
                  </div>
                  {dayInfo ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Time">
                        {dayInfo.times.map(t => (
                          <Chip key={t} selected={slot === t} onClick={() => setSlot(t)} className="h-10">{to12h(t)}</Chip>
                        ))}
                      </div>
                      {/* The summary sidebar is desktop-only, so the terms are repeated here for phones. */}
                      <p className="mt-3 text-[14px] tracking-[-0.014em] text-muted lg:hidden" data-testid="cancellation-terms">
                        {policyLine(artisan.cancelWindowHours, day, slot)}
                        {artisan.cancelWindowHours > 0 ? ". After that it counts as a late cancellation." : "."}
                      </p>
                    </>
                  ) : (
                    <p className="mt-3 text-[14px] tracking-[-0.014em] text-muted">Pick a day to see times.</p>
                  )}
                </>
              )}
            </section>

            {error && <div className="mt-6"><FieldError>{error}</FieldError></div>}
          </div>

          {/* Desktop summary */}
          <aside className="hidden h-fit rounded-[32px] bg-surface p-6 shadow-float ring-1 ring-brand/10 lg:sticky lg:top-8 lg:block" aria-label="Booking summary">
            <h2 className="t-display mb-3 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-wash text-brand"><CalendarDays className="h-5 w-5" aria-hidden /></span>
              Your booking
            </h2>
            {summary}
            <Button onClick={request} disabled={!ready || createBooking.isPending} size="lg" className="mt-5 w-full">
              {createBooking.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Request booking
            </Button>
            <p className="mt-3 text-[12px] tracking-[-0.017em] text-muted">No payment online. You pay the artisan after your appointment.</p>
          </aside>
        </div>
      </Container>

      {/* Mobile booking bar, above the tab bar */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-hairline bg-surface px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] tracking-[-0.014em]">{service?.name ?? "Choose a service"}</p>
            <p className="text-[12px] text-muted">
              {service ? formatNaira(service.priceNGN) : `From ${formatNaira(artisan.fromNGN)}`}
              {dayInfo && slot ? ` · ${dayInfo.weekday} ${to12h(slot)}` : ""}
            </p>
          </div>
          <Button onClick={request} disabled={!ready || createBooking.isPending} className="shrink-0">
            {createBooking.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Request
          </Button>
        </div>
      </div>
    </SiteShell>
  );
}
