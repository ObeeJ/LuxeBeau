"use client";

import Link from "next/link";
import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { CardSkeletonGrid, EmptyState, LoadError } from "@/components/site/states";
import { useArtisans } from "@/lib/queries";
import { formatNaira } from "@/lib/format";

const cities = ["All cities", "Lagos", "Abuja", "Port Harcourt", "Ibadan"] as const;

function ServicesContent() {
  const searchParams = useSearchParams();
  // Seed filters from the URL once during render (no setState-in-effect).
  const urlCity = searchParams.get("city");
  const [city, setCity] = useState<(typeof cities)[number]>(
    urlCity && cities.includes(urlCity as (typeof cities)[number]) ? (urlCity as (typeof cities)[number]) : "All cities",
  );
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  const { data: artisans = [], isLoading, isError, refetch } = useArtisans();

  const visible = useMemo(() => {
    return artisans.filter(a => {
      const cityOk = city === "All cities" || a.city === city;
      const q = query.trim().toLowerCase();
      const queryOk =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.craft.toLowerCase().includes(q) ||
        a.studio.toLowerCase().includes(q) ||
        a.services.some(s => s.name.toLowerCase().includes(q));
      return cityOk && queryOk;
    });
  }, [artisans, city, query]);

  return (
    <div className="min-h-dvh">
      <SiteNav />

      <header className="relative overflow-hidden border-b border-velvet-700/60">
        <div className="aurora-field absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">The service side</p>
          <h1 className="mt-4 font-display text-4xl font-medium sm:text-5xl">
            Book the hands <em className="text-gold-gradient italic">Lagos talks about</em>
          </h1>
          <p className="mt-4 max-w-lg text-lavender-200">
            Braiders, gele artists, MUAs, barbers, nail techs and estheticians, every artisan is
            ID-verified with a vetted portfolio. Hold your slot with a Paystack deposit.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <label className="flex-1 min-w-56">
              <span className="sr-only">Search artisans or services</span>
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search braids, gele, glam…"
                className="w-full rounded-full border border-velvet-700 bg-velvet-900/80 px-5 py-3 text-sm placeholder:text-lavender-400/60"
              />
            </label>
            <div role="group" aria-label="Filter by city" className="flex flex-wrap gap-2">
              {cities.map(c => (
                <button
                  key={c}
                  onClick={() => setCity(c)}
                  aria-pressed={city === c}
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    city === c
                      ? "bg-royal-500 text-lavender-100"
                      : "border border-velvet-700 text-lavender-200 hover:border-royal-400/60"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {isLoading ? (
          <CardSkeletonGrid />
        ) : isError ? (
          <LoadError onRetry={() => refetch()} message="We could not load our artisans. Please try again." />
        ) : artisans.length === 0 ? (
          <EmptyState>
            <p>We are onboarding artisans in your area. Check back soon.</p>
          </EmptyState>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-lavender-200">No artisans match that search yet.</p>
            <button onClick={() => { setQuery(""); setCity("All cities"); }} className="mt-4 text-sm font-semibold text-gold-300 hover:underline">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(artisan => (
              <Link
                key={artisan.id}
                href={`/services/${artisan.slug}`}
                className="card-velvet group overflow-hidden rounded-3xl transition-colors duration-300 hover:border-gold-400/50"
              >
                <div
                  className="flex h-44 items-center justify-center"
                  style={{ background: `linear-gradient(140deg, ${artisan.tint[0]}, ${artisan.tint[1]})` }}
                >
                  <span className="font-display text-5xl font-semibold italic text-white/85">
                    {artisan.name.split(" ").map(n => n[0]).join("")}
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-lg font-semibold">{artisan.name}</h2>
                    {artisan.verified && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-gold-300">
                        <BadgeCheck className="h-4 w-4" aria-hidden /> Verified
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-royal-400">{artisan.studio}</p>
                  <p className="mt-2 text-sm text-lavender-400">{artisan.craft}</p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-lavender-400">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {artisan.area}, {artisan.city}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-velvet-700/60 pt-4 text-sm">
                    <span className="flex items-center gap-1 text-gold-300">
                      <Star className="h-4 w-4 fill-current" aria-hidden /> {artisan.rating}
                      <span className="text-lavender-400">({artisan.bookings})</span>
                    </span>
                    <span className="font-semibold">from {formatNaira(artisan.fromNGN)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-dvh bg-velvet-950 text-lavender-100 flex flex-col justify-between">
        <div>
          <SiteNav />
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <CardSkeletonGrid />
          </div>
        </div>
        <SiteFooter />
      </div>
    }>
      <ServicesContent />
    </Suspense>
  );
}
