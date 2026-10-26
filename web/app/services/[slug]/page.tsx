"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, CheckCircle2, Clock, Loader2, MapPin } from "lucide-react";
import SiteShell, { Container } from "@/components/site/shell";
import { Stars } from "@/components/site/catalog";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/slide-in-notifications";
import { useAuth } from "@/lib/store";
import { useArtisan, useCreateBooking } from "@/lib/queries";
import { type ArtisanService, type BookingResult } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { cn } from "@/lib/utils";

/* Slot times match the availability the API seeds per artisan
   (api-go/internal/seed/seed.go). The value sent is 24h; the label is 12h. */
const SLOT_TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00"];
const SERVICE_TYPES = [
  { id: "studio", label: "At the studio" },
  { id: "home", label: "Home service" },
] as const;

function to12h(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function nextSevenDays() {
  const fmt = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short" });
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return { iso: d.toISOString().slice(0, 10), label: fmt.format(d) };
  });
}

function duration(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return [h ? `${h}h` : "", m ? `${m}m` : ""].filter(Boolean).join(" ") || "—";
}

function ChoiceChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "h-10 shrink-0 rounded-full border px-4 text-[14px] tracking-[-0.014em] shadow-pill transition-colors duration-200",
        selected ? "border-ink bg-ink text-surface" : "border-hairline bg-surface text-ink hover:bg-canvas",
      )}
    >
      {children}
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[12px] shadow-pill">{n}</span>
        <span className="t-display">{title}</span>
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function ArtisanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: artisan, isLoading, isError, refetch } = useArtisan(slug);
  const { toast } = useToast();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);
  const createBooking = useCreateBooking();

  const days = useMemo(() => nextSevenDays(), []);
  const [service, setService] = useState<ArtisanService | null>(null);
  const [serviceType, setServiceType] = useState<"studio" | "home">("studio");
  const [day, setDay] = useState("");
  const [slot, setSlot] = useState("");
  const [booked, setBooked] = useState<BookingResult | null>(null);

  if (isLoading) {
    return (
      <SiteShell>
        <Container className="pt-8 md:pt-12">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]" role="status" aria-busy="true">
            <Skeleton className="aspect-[16/9] w-full rounded-[28px] bg-surface" />
            <Skeleton className="h-80 w-full rounded-[28px] bg-surface" />
            <span className="sr-only">Loading artisan…</span>
          </div>
        </Container>
      </SiteShell>
    );
  }

  if (isError) {
    return (
      <SiteShell>
        <Container className="pt-8"><LoadError onRetry={() => refetch()} message="We could not load this artisan. Please try again." /></Container>
      </SiteShell>
    );
  }

  if (!artisan) notFound();

  const ready = Boolean(service && day && slot);
  const dayLabel = days.find(d => d.iso === day)?.label;

  const submitBooking = () => {
    if (!service || !day || !slot) return;
    createBooking.mutate(
      {
        artisan_id: Number(artisan.id),
        service_name: service.name,
        date: day,
        slot_time: slot,
        service_type: serviceType,
      },
      {
        onSuccess: result => {
          setBooked(result);
          toast("Booking request sent. The artisan will confirm your slot.", "success");
        },
        onError: err => toast(getFriendlyErrorMessage(err, "We couldn't reserve that slot. Please pick another time."), "error"),
      },
    );
  };

  const handleConfirm = () => {
    if (!user) {
      toast("Please sign in to request a booking.", "info");
      showAuth("login", submitBooking);
      return;
    }
    submitBooking();
  };

  return (
    <SiteShell>
      <Container className="pt-6 md:pt-10">
        <Link href="/services" className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[14px] tracking-[-0.014em] shadow-pill transition-shadow duration-200 hover:shadow-card">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Artisans
        </Link>

        {booked ? (
          <div className="mx-auto mt-8 max-w-lg rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
            <CheckCircle2 className="mx-auto h-10 w-10" strokeWidth={1.5} aria-hidden />
            <h1 className="t-display mt-4">Booking requested</h1>
            <p className="mt-3 text-[16px] text-muted">
              Reference <span className="text-ink">{booked.id}</span>. {service?.name} with {artisan.name} on {dayLabel} at {to12h(slot)}.
              Status: <span className="text-ink">{booked.status}</span>. {artisan.name.split(" ")[0]} will confirm your slot from their studio dashboard.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild><Link href="/dashboard">View my bookings</Link></Button>
              <Button asChild variant="outline"><Link href="/services">Book another artisan</Link></Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:gap-10">
            <div className="min-w-0">
              {/* Hero image: the tile IS the card */}
              <div className="relative flex aspect-[16/10] flex-col justify-between overflow-hidden rounded-[28px] p-5 text-surface shadow-card sm:aspect-[16/8] sm:p-6" style={{ backgroundColor: artisan.tint[0] }}>
                <div>
                  <h1 className="text-[32px] font-medium leading-[1.05] tracking-[-0.05em] sm:text-[44px]">{artisan.name}</h1>
                  <p className="mt-1 text-[16px] opacity-85">{artisan.studio}</p>
                  <Stars rating={artisan.rating} count={artisan.bookings} tone="white" className="mt-2 [&_.t-micro]:text-[14px] [&_.t-micro]:tracking-[-0.014em]" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-[12px] bg-surface/85 px-3 py-1.5 text-[14px] font-medium tracking-[-0.014em] text-ink">{artisan.craft}</span>
                  {artisan.verified && (
                    <span className="inline-flex items-center gap-1 rounded-[12px] bg-surface/85 px-3 py-1.5 text-[14px] font-medium tracking-[-0.014em] text-ink">
                      <BadgeCheck className="h-4 w-4" aria-hidden /> Verified
                    </span>
                  )}
                </div>
              </div>

              <p className="mt-5 flex items-center gap-1.5 text-[14px] tracking-[-0.014em] text-muted">
                <MapPin className="h-4 w-4" aria-hidden /> {[artisan.area, artisan.city].filter(Boolean).join(", ")}
              </p>
              {artisan.bio && <p className="mt-3 max-w-2xl text-[16px]">{artisan.bio}</p>}

              <Step n={1} title="Choose a service">
                {artisan.services.length === 0 ? (
                  <p className="text-[14px] text-muted">This artisan has not published services yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose a service">
                    {artisan.services.map(s => {
                      const selected = service?.name === s.name;
                      return (
                        <button
                          key={s.name}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setService(s)}
                          className={cn(
                            "rounded-[20px] bg-surface p-4 text-left shadow-card transition-shadow duration-200 hover:shadow-float",
                            selected && "ring-2 ring-ink",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="t-sub">{s.name}</p>
                            <span className="shrink-0 text-[14px] tracking-[-0.014em]">{formatNaira(s.priceNGN)}</span>
                          </div>
                          {s.description && <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">{s.description}</p>}
                          <p className="t-meta mt-2 flex items-center gap-1 font-normal text-muted">
                            <Clock className="h-3.5 w-3.5" aria-hidden /> {duration(s.durationMins)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Step>

              <Step n={2} title="Where">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Service location">
                  {SERVICE_TYPES.map(t => (
                    <ChoiceChip key={t.id} selected={serviceType === t.id} onClick={() => setServiceType(t.id)}>{t.label}</ChoiceChip>
                  ))}
                </div>
              </Step>

              <Step n={3} title="Pick a day">
                <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0" role="radiogroup" aria-label="Pick a date">
                  {days.map(d => (
                    <ChoiceChip key={d.iso} selected={day === d.iso} onClick={() => setDay(d.iso)}>{d.label}</ChoiceChip>
                  ))}
                </div>
              </Step>

              <Step n={4} title="Pick a time">
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Pick a time slot">
                  {SLOT_TIMES.map(s => (
                    <ChoiceChip key={s} selected={slot === s} onClick={() => setSlot(s)}>{to12h(s)}</ChoiceChip>
                  ))}
                </div>
              </Step>
            </div>

            {/* Booking summary */}
            <aside className="h-fit rounded-[28px] bg-surface p-5 shadow-card sm:p-6 lg:sticky lg:top-8" aria-label="Booking summary">
              <h2 className="t-display">Your booking</h2>
              <dl className="mt-4 divide-y divide-hairline text-[14px] tracking-[-0.014em]">
                {[
                  ["Service", service?.name ?? "Not selected"],
                  ["Where", serviceType === "home" ? "Home service" : `${artisan.studio}, ${artisan.area}`],
                  ["When", day ? `${dayLabel}${slot ? ` · ${to12h(slot)}` : ""}` : "Not selected"],
                  ["Service price", service ? formatNaira(service.priceNGN) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              <Button onClick={handleConfirm} disabled={!ready || createBooking.isPending} size="lg" className="mt-5 w-full">
                {createBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {createBooking.isPending ? "Reserving your slot" : ready ? "Request booking" : "Choose service, day and time"}
              </Button>
              <p className="t-meta mt-3 font-normal text-muted">
                No payment is taken online. Your slot is held and the artisan confirms it from their studio.
              </p>
            </aside>
          </div>
        )}
      </Container>
    </SiteShell>
  );
}
