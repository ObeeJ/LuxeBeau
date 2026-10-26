"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteShell, { Container } from "@/components/site/shell";
import { ArtisanCard, CategoryPill, SearchBar } from "@/components/site/catalog";
import { EmptyState, LoadError } from "@/components/site/states";
import { PageHeader } from "@/components/dashboard/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { useArtisans } from "@/lib/queries";

type Visit = "any" | "studio" | "home";

function ServicesContent() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  // Seed filters from the URL once during render (no setState-in-effect).
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [visit, setVisit] = useState<Visit>("any");

  const { data: artisans = [], isLoading, isError, refetch } = useArtisans();

  const cities = useMemo(() => [...new Set(artisans.map(a => a.city).filter(Boolean))], [artisans]);

  const visible = useMemo(
    () =>
      artisans.filter(a => {
        const cityOk = !city || a.city === city;
        const visitOk = visit === "any" || a.serviceMode === "both" || a.serviceMode === visit;
        const queryOk =
          !q ||
          [a.name, a.craft, a.studio, ...a.services.map(s => s.name)].some(v => v.toLowerCase().includes(q));
        return cityOk && visitOk && queryOk;
      }),
    [artisans, city, visit, q],
  );

  return (
    <Container className="pt-8 md:pt-12">
      <PageHeader title={q ? `Artisans for “${q}”` : "Book an artisan"} />

      <div className="mt-5 max-w-[480px]">
        <SearchBar key={q} defaultValue={searchParams.get("q") ?? ""} action="/services" placeholder="Braids, gele, makeup, nails…" />
      </div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
        <div role="group" aria-label="Where" className="flex gap-2">
          <CategoryPill label="Anywhere" active={visit === "any"} onClick={() => setVisit("any")} />
          <CategoryPill label="Comes to me" active={visit === "home"} onClick={() => setVisit("home")} />
          <CategoryPill label="In studio" active={visit === "studio"} onClick={() => setVisit("studio")} />
        </div>
        <span className="mx-1 hidden w-px self-stretch bg-hairline sm:block" aria-hidden />
        <div role="group" aria-label="City" className="flex gap-2">
          <CategoryPill label="All cities" active={!city} onClick={() => setCity("")} />
          {cities.map(c => <CategoryPill key={c} label={c} active={city === c} onClick={() => setCity(c)} />)}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[320px] w-full rounded-[28px] bg-surface" />)}
          </div>
        ) : isError ? (
          <LoadError onRetry={() => refetch()} message="We couldn't load artisans. Please try again." />
        ) : visible.length === 0 ? (
          <EmptyState>{artisans.length === 0 ? "Artisans are joining soon." : "No artisans match these filters."}</EmptyState>
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
