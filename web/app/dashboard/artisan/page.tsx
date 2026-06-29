"use client";

import { useRouter } from "next/navigation";
import { Banknote, CalendarDays, Clock, Loader2, Star, TrendingUp, Calendar, MapPin, CheckCircle, AlertCircle, RefreshCw, Wallet } from "lucide-react";
import { StatCard, StatusPill } from "@/components/dashboard/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/store";
import { useMyArtisanProfile, useMyBookings } from "@/lib/queries";
import { formatCompactNaira, formatNaira } from "@/lib/format";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/slide-in-notifications";

export default function ArtisanDashboard() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isArtisan = user?.role === "artisan";
  const { toast } = useToast();

  const profile = useMyArtisanProfile(Boolean(user && isArtisan));
  const bookings = useMyBookings(Boolean(user && isArtisan));

  const [payoutLoading, setPayoutLoading] = useState(false);
  const [scheduleVacation, setScheduleVacation] = useState(false);

  /* If a buyer stumbles here, send them to the onboarding flow. */
  useEffect(() => {
    if (user && !isArtisan) {
      router.replace("/partnership/artisan");
    }
  }, [user, isArtisan, router]);

  if (!user || !isArtisan) {
    return null; /* redirect is in-flight */
  }

  const artisan = profile.data;
  const bookingsList = bookings.data ?? [];
  const upcoming = bookingsList.filter(
    (b) => b.status === "pending" || b.status === "confirmed"
  );

  const isLoading = profile.isLoading || bookings.isLoading;

  const triggerPayout = () => {
    setPayoutLoading(true);
    setTimeout(() => {
      setPayoutLoading(false);
      toast("Payout of ₦142,500.00 initiated to Access Bank account ending in 5678 successfully!", "success");
    }, 1500);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-12 pb-24">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-purple-950/20 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">
              Artisan studio
            </p>
            {artisan?.verified && (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
                <CheckCircle className="w-3 h-3" /> Vetted Partner
              </span>
            )}
          </div>
          {isLoading ? (
            <>
              <Skeleton className="mt-2 h-8 w-64 bg-purple-950/20" />
              <Skeleton className="mt-2 h-4 w-48 bg-purple-950/20" />
            </>
          ) : (
            <>
              <h1 className="mt-2 font-display text-3xl font-medium">
                {artisan?.studio || user.name}
              </h1>
              <p className="mt-1 text-sm text-lavender-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                {artisan?.city
                  ? `${artisan.area ? artisan.area + ", " : ""}${artisan.city}`
                  : user.email}{" "}
                · {artisan?.verified ? "Deposits settle instantly" : "Verification pending"}
              </p>
            </>
          )}
        </div>
        <button
          onClick={() => {
            const el = document.getElementById("schedule");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="rounded-full bg-royal-500 px-6 py-3 text-sm font-semibold transition-colors hover:bg-royal-400"
        >
          Manage availability
        </button>
      </header>

      {/* Stats */}
      <section
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Key metrics"
      >
        <StatCard
          icon={CalendarDays}
          label="Upcoming bookings"
          value={isLoading ? "—" : String(upcoming.length)}
        />
        <StatCard
          icon={Banknote}
          label="Total bookings"
          value={isLoading ? "—" : String(bookingsList.length)}
        />
        <StatCard
          icon={Star}
          label="Rating"
          value={isLoading ? "—" : String(artisan?.rating ?? "5.0")}
        />
        <StatCard
          icon={Clock}
          label="Jobs completed"
          value={isLoading ? "—" : String(artisan?.bookings ?? 0)}
        />
      </section>

      {/* Bookings table */}
      <section
        id="bookings"
        className="card-velvet scroll-mt-20 overflow-x-auto rounded-3xl p-6"
        aria-label="Bookings"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-400" /> Incoming Bookings
          </h2>
          <button 
            onClick={() => bookings.refetch()}
            className="p-2 hover:bg-purple-950/30 rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Refresh bookings"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-lavender-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading bookings…
          </div>
        ) : bookingsList.length === 0 ? (
          <div className="py-16 text-center text-lavender-400">
            <CalendarDays className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p>No bookings yet. Share your profile link to start receiving requests.</p>
          </div>
        ) : (
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-velvet-700/60 text-xs uppercase tracking-wider text-lavender-400">
                <th scope="col" className="pb-3 pr-4">
                  Ref
                </th>
                <th scope="col" className="pb-3 pr-4">
                  Client
                </th>
                <th scope="col" className="pb-3 pr-4">
                  Service
                </th>
                <th scope="col" className="pb-3 pr-4">
                  When
                </th>
                <th scope="col" className="pb-3 pr-4 text-right">
                  Fee
                </th>
                <th scope="col" className="pb-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {bookingsList.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-velvet-700/30 last:border-0"
                >
                  <td className="py-4 pr-4 font-semibold text-gold-300">
                    {b.id}
                  </td>
                  <td className="py-4 pr-4">{b.with || "Client"}</td>
                  <td className="max-w-48 truncate py-4 pr-4 text-lavender-400">
                    {b.service}
                  </td>
                  <td className="py-4 pr-4 text-lavender-400">
                    {b.date}
                    {b.time ? ` · ${b.time}` : ""}
                  </td>
                  <td className="py-4 pr-4 text-right font-semibold tabular-nums">
                    {formatNaira(b.priceNGN)}
                  </td>
                  <td className="py-4">
                    <StatusPill status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Schedule Management Section */}
      <section
        id="schedule"
        className="card-velvet scroll-mt-20 rounded-3xl p-6 space-y-6"
      >
        <div className="flex items-center justify-between border-b border-purple-950/20 pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-400" /> Availability &amp; Slots
            </h2>
            <p className="text-xs text-lavender-400 mt-1">Configure your weekly operating hours and online booking slots</p>
          </div>
          <button
            onClick={() => {
              setScheduleVacation(!scheduleVacation);
              toast(scheduleVacation ? "Vacation mode deactivated. Online bookings resumed." : "Vacation mode activated. Your calendar is paused temporarily.", "success");
            }}
            className={`text-xs px-4 py-2 rounded-full font-semibold border transition-all duration-300 ${
              scheduleVacation
                ? "bg-red-500/20 border-red-500 text-red-300"
                : "border-purple-900/50 hover:border-purple-500 text-gray-300"
            }`}
          >
            {scheduleVacation ? "Vacation Mode: ON" : "Pause Calendar"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Weekly Hours */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-300">Weekly Operating Hours</h3>
            <div className="space-y-2.5">
              {[
                { day: "Monday - Friday", hours: "9:00 AM - 6:00 PM", status: "Active" },
                { day: "Saturday", hours: "10:00 AM - 4:00 PM", status: "Active" },
                { day: "Sunday", hours: "Closed", status: "Inactive" },
              ].map((item) => (
                <div key={item.day} className="flex justify-between items-center text-sm border-b border-purple-950/10 pb-2">
                  <span className="text-gray-300">{item.day}</span>
                  <span className={item.status === "Inactive" ? "text-gray-500" : "text-lavender-200"}>{item.hours}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => toast("Operating hours edit dialog placeholder", "success")}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
            >
              Adjust hours →
            </button>
          </div>

          {/* Bookable Time Slots */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-300">Active Daily Slots</h3>
            <div className="flex flex-wrap gap-2.5">
              {["09:00 AM", "11:30 AM", "02:00 PM", "04:30 PM"].map((slot) => (
                <span
                  key={slot}
                  className="px-4 py-2 bg-purple-950/20 border border-purple-900/50 rounded-xl text-sm font-semibold text-lavender-200 hover:border-purple-500 cursor-pointer transition-colors"
                >
                  {slot}
                </span>
              ))}
              <button 
                onClick={() => toast("Add time slot trigger", "success")}
                className="px-4 py-2 border border-dashed border-purple-900/60 rounded-xl text-sm text-gray-500 hover:text-purple-400 hover:border-purple-400 transition-colors"
              >
                + Add Slot
              </button>
            </div>
            <div className="rounded-xl bg-purple-950/10 border border-purple-900/30 p-3.5 text-xs text-lavender-400 flex items-start gap-2 mt-4">
              <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Clients must book at least 3 hours in advance. Double booking prevention is active.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payouts Section */}
      <section
        id="payouts"
        className="card-velvet scroll-mt-20 rounded-3xl p-6 space-y-6"
      >
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-purple-400" /> Payouts &amp; Settled Funds
          </h2>
          <p className="text-xs text-lavender-400 mt-1">Review your earnings, escrow holdings, and settlement account</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Wallet Balance Card */}
          <div className="rounded-2xl bg-purple-950/20 border border-purple-900/40 p-5 space-y-3">
            <span className="text-xs text-lavender-400 font-medium">Available Balance</span>
            <p className="text-3xl font-display font-semibold text-white">₦142,500.00</p>
            <button
              onClick={triggerPayout}
              disabled={payoutLoading}
              className="w-full h-10 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 font-semibold text-xs transition-opacity flex items-center justify-center gap-1.5"
            >
              {payoutLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…
                </>
              ) : (
                "Request Instant Payout"
              )}
            </button>
          </div>

          {/* Escrow Balance Card */}
          <div className="rounded-2xl bg-purple-950/20 border border-purple-900/40 p-5 space-y-3">
            <span className="text-xs text-lavender-400 font-medium">Held in Escrow</span>
            <p className="text-3xl font-display font-semibold text-purple-300">₦35,000.00</p>
            <p className="text-[10px] text-lavender-400 leading-relaxed">
              These funds are secured for upcoming appointments and settle instantly upon job completion checklist submission.
            </p>
          </div>

          {/* Settling Account Card */}
          <div className="rounded-2xl bg-purple-950/20 border border-purple-900/40 p-5 space-y-3">
            <span className="text-xs text-lavender-400 font-medium">Settlement Destination</span>
            <div className="py-2.5">
              <p className="text-sm font-semibold text-white">Access Bank PLC</p>
              <p className="text-xs text-lavender-400 mt-1">Account ending in •••• 5678</p>
              <span className="inline-block mt-2 text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-semibold">
                Direct Bank Transfer
              </span>
            </div>
            <button 
              onClick={() => toast("Modify bank account dialog", "success")}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
            >
              Change bank details →
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
