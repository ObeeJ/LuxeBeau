"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  Star,
} from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/slide-in-notifications";
import { useAuth } from "@/lib/store";
import { useArtisan, useCreateBooking } from "@/lib/queries";
import { type ArtisanService } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";

const DEPOSIT_RATE = 0.5;

/* Slot times mirror the availability the API seeds for every artisan. The
   value sent to the backend is 24h ("09:00"); the label shown is 12h. */
const SLOT_TIMES = ["09:00", "11:00", "13:00", "15:00", "17:00"];

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

export default function ArtisanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: artisan, isLoading, isError, refetch } = useArtisan(slug);
  const { toast } = useToast();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);
  const createBooking = useCreateBooking();

  const days = useMemo(() => nextSevenDays(), []);
  const [service, setService] = useState<ArtisanService | null>(null);
  const [day, setDay] = useState<string>("");
  const [slot, setSlot] = useState<string>("");
  const [confirmedRef, setConfirmedRef] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-dvh">
        <SiteNav />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-busy="true" role="status">
          <Skeleton className="h-4 w-28 bg-velvet-800/60" />
          <div className="mt-8 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            <div className="space-y-5">
              <Skeleton className="h-56 w-full rounded-3xl bg-velvet-800/60" />
              <Skeleton className="h-8 w-1/2 bg-velvet-800/60" />
              <Skeleton className="h-20 w-full bg-velvet-800/60" />
            </div>
            <Skeleton className="h-80 w-full rounded-3xl bg-velvet-800/60" />
          </div>
          <span className="sr-only">Loading artisan…</span>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-dvh">
        <SiteNav />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <LoadError onRetry={() => refetch()} message="We could not load this artisan. Please try again." />
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (!artisan) notFound();

  const deposit = service ? Math.round(service.priceNGN * DEPOSIT_RATE) : 0;
  const readyToPay = Boolean(service && day && slot);

  const submitBooking = () => {
    if (!service || !day || !slot) return;
    createBooking.mutate(
      {
        artisan_id: Number(artisan.id) || 1,
        service_name: service.name,
        date: day,
        slot_time: slot,
        service_type: "studio",
      },
      {
        onSuccess: result => {
          setConfirmedRef(result.reference ?? `BK-${result.id}`);
          toast("Appointment secured! Your deposit was received and your slot is locked in.", "success");
        },
        onError: err => toast(getFriendlyErrorMessage(err, "We couldn't secure your slot. Please try again in a few moments."), "error"),
      },
    );
  };

  const handleConfirm = () => {
    if (!user) {
      toast("Please sign in to secure your booking slot.", "info");
      showAuth("login", submitBooking);
      return;
    }
    submitBooking();
  };

  return (
    <div className="min-h-dvh">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Link href="/services" className="inline-flex items-center gap-2 text-sm text-lavender-400 transition-colors hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden /> All artisans
        </Link>

        {confirmedRef ? (
          <div className="mx-auto max-w-lg py-20 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
            <h1 className="mt-6 font-display text-3xl font-medium">You&apos;re booked!</h1>
            <p className="mt-3 text-lavender-200">
              Reference <span className="font-semibold text-gold-300">{confirmedRef}</span>.{" "}
              {service?.name} with {artisan.name} on{" "}
              <span className="text-lavender-100">{days.find(d => d.iso === day)?.label} at {slot ? to12h(slot) : ""}</span>.
              The remaining {formatNaira((service?.priceNGN ?? 0) - deposit)} is due at the studio.
            </p>
            <p className="mt-3 text-sm text-lavender-400">
              {artisan.studio}, {artisan.area}, {artisan.city}. Reschedule free up to 24 hours before.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link href="/services" className="rounded-full bg-royal-500 px-7 py-3 text-sm font-semibold transition-colors hover:bg-royal-400">
                Book another artisan
              </Link>
              <Link href="/" className="rounded-full border border-velvet-700 px-7 py-3 text-sm font-semibold text-lavender-200 transition-colors hover:border-gold-400/60">
                Back home
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            {/* Profile */}
            <div>
              <div
                className="flex h-56 items-center justify-center rounded-3xl"
                style={{ background: `linear-gradient(150deg, ${artisan.tint[0]}, ${artisan.tint[1]})` }}
              >
                <span className="font-display text-7xl font-semibold italic text-white/85">
                  {artisan.name.split(" ").map(n => n[0]).join("")}
                </span>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-3xl font-medium sm:text-4xl">{artisan.name}</h1>
                {artisan.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-gold-400/60 px-3 py-1 text-xs font-semibold text-gold-300">
                    <BadgeCheck className="h-4 w-4" aria-hidden /> LuxeBeau Verified
                  </span>
                )}
              </div>
              <p className="mt-1 font-medium text-royal-400">{artisan.studio}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-lavender-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" aria-hidden /> {artisan.area}, {artisan.city}
                </span>
                <span className="flex items-center gap-1.5 text-gold-300">
                  <Star className="h-4 w-4 fill-current" aria-hidden /> {artisan.rating}
                  <span className="text-lavender-400">· {artisan.bookings} bookings</span>
                </span>
              </div>
              <p className="mt-6 max-w-xl leading-relaxed text-lavender-200">{artisan.bio}</p>

              {/* Service selection */}
              <h2 className="mt-12 font-display text-2xl font-medium">
                <span className="text-gold-300">01.</span> Choose a service
              </h2>
              <div className="mt-6 space-y-4" role="radiogroup" aria-label="Choose a service">
                {artisan.services.map(s => {
                  const selected = service?.name === s.name;
                  return (
                    <button
                      key={s.name}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setService(s)}
                      className={`card-velvet w-full rounded-2xl p-5 text-left transition-colors duration-200 ${
                        selected ? "border-gold-400/70" : "hover:border-royal-400/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-display font-semibold">{s.name}</h3>
                          <p className="mt-1 text-sm text-lavender-400">{s.description}</p>
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-lavender-400">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {Math.floor(s.durationMins / 60)}h{s.durationMins % 60 ? ` ${s.durationMins % 60}m` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 font-display text-lg font-semibold text-gold-300">
                          {formatNaira(s.priceNGN)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Date + slot */}
              <h2 className="mt-12 font-display text-2xl font-medium">
                <span className="text-gold-300">02.</span> Pick your day
              </h2>
              <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Pick a date">
                {days.map(d => (
                  <button
                    key={d.iso}
                    role="radio"
                    aria-checked={day === d.iso}
                    onClick={() => setDay(d.iso)}
                    className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                      day === d.iso
                        ? "bg-royal-500 text-lavender-100"
                        : "border border-velvet-700 text-lavender-200 hover:border-royal-400/60"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <h2 className="mt-12 font-display text-2xl font-medium">
                <span className="text-gold-300">03.</span> Pick your time
              </h2>
              <div className="mt-6 flex flex-wrap gap-2" role="radiogroup" aria-label="Pick a time slot">
                {SLOT_TIMES.map(s => (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={slot === s}
                    onClick={() => setSlot(s)}
                    className={`rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200 ${
                      slot === s
                        ? "bg-royal-500 text-lavender-100"
                        : "border border-velvet-700 text-lavender-200 hover:border-royal-400/60"
                    }`}
                  >
                    {to12h(s)}
                  </button>
                ))}
              </div>
            </div>

            {/* Booking summary */}
            <aside className="card-velvet sticky top-24 h-fit rounded-3xl p-6" aria-label="Booking summary">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <CalendarCheck className="h-5 w-5 text-gold-400" aria-hidden /> Your booking
              </h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-lavender-400">Service</dt>
                  <dd className="mt-0.5 font-semibold">{service ? service.name : "Not selected yet"}</dd>
                </div>
                <div>
                  <dt className="text-lavender-400">When</dt>
                  <dd className="mt-0.5 font-semibold">
                    {day ? days.find(d => d.iso === day)?.label : "—"}{slot ? ` · ${to12h(slot)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-lavender-400">Where</dt>
                  <dd className="mt-0.5 font-semibold">{artisan.studio}, {artisan.area}</dd>
                </div>
                <div className="border-t border-velvet-700/60 pt-4">
                  <div className="flex justify-between">
                    <dt className="text-lavender-400">Service total</dt>
                    <dd className="font-semibold">{service ? formatNaira(service.priceNGN) : "—"}</dd>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <dt className="text-lavender-400">Deposit due now (50%)</dt>
                    <dd className="font-display font-semibold text-gold-300">{service ? formatNaira(deposit) : "—"}</dd>
                  </div>
                </div>
              </dl>
              <Button
                onClick={handleConfirm}
                disabled={!readyToPay || createBooking.isPending}
                className="mt-6 h-12 w-full rounded-full bg-gold-400 text-sm font-bold text-velvet-950 hover:bg-gold-300"
              >
                {createBooking.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {createBooking.isPending
                  ? "Contacting Paystack"
                  : readyToPay
                    ? `Pay ${formatNaira(deposit)} deposit`
                    : "Select service, day and time"}
              </Button>
              <p className="mt-4 flex items-center gap-2 text-xs text-lavender-400">
                <Lock className="h-3.5 w-3.5" aria-hidden />
                Deposit held in escrow by Paystack. Full refund if the artisan cancels.
              </p>
            </aside>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
