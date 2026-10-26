"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteShell, { Container } from "@/components/site/shell";
import { ArtisanCard, CategoryPill, SearchBar } from "@/components/site/catalog";
import { EmptyState, LoadError } from "@/components/site/states";
import { PageHeader } from "@/components/dashboard/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { useArtisans } from "@/lib/queries";

function ServicesContent() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  // Seed the city filter from the URL once during render (no setState-in-effect).
  const [city, setCity] = useState(searchParams.get("city") ?? "All cities");

  const { data: artisans = [], isLoading, isError, refetch } = useArtisans();

  const cities = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of artisans) if (a.city && !seen.has(a.city)) seen.set(a.city, a.tint[0]);
    return [...seen].map(([name, color]) => ({ name, color }));
  }, [artisans]);

  const visible = useMemo(
    () =>
      artisans.filter(a => {
        const cityOk = city === "All cities" || a.city === city;
        const queryOk =
          !q ||
          a.name.toLowerCase().includes(q) ||
          a.craft.toLowerCase().includes(q) ||
          a.studio.toLowerCase().includes(q) ||
          a.services.some(s => s.name.toLowerCase().includes(q));
        return cityOk && queryOk;
      }),
    [artisans, city, q],
  );

  return (
    <Container className="pt-8 md:pt-12">
      <PageHeader
        eyebrow="Artisans"
        title="Book the hands Lagos talks about"
        subtitle="Braiders, gele artists, makeup artists, barbers, nail techs and estheticians."
      />

      <div className="mt-6 max-w-[480px]">
        <SearchBar key={q} defaultValue={searchParams.get("q") ?? ""} action="/services" placeholder="Search braids, gele, glam…" />
      </div>

      <div role="group" aria-label="Filter by city" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
        <CategoryPill label="All cities" active={city === "All cities"} onClick={() => setCity("All cities")} />
        {cities.map(c => (
          <CategoryPill key={c.name} label={c.name} color={c.color} active={city === c.name} onClick={() => setCity(c.name)} />
        ))}
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-full rounded-[28px] bg-surface" />)}
          </div>
        ) : isError ? (
          <LoadError onRetry={() => refetch()} message="We could not load our artisans. Please try again." />
        ) : visible.length === 0 ? (
          <EmptyState>
            {artisans.length === 0 ? "We are onboarding artisans in your area. Check back soon." : "No artisans match that search yet."}
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(a => <ArtisanCard key={a.id} artisan={a} />)}
          </div>
        )}
      </div>
    </Container>
  );
}

export default function ServicesPage() {
  return (
    <SiteShell>
      <Suspense fallback={null}>
        <ServicesContent />
      </Suspense>
    </SiteShell>
  );
}
