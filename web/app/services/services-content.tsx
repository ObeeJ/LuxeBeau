"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Container } from "@/components/site/shell";
import { ArtisanCard, SearchBar } from "@/components/site/catalog";
import { Segmented } from "@/components/site/filters";
import { Home, LayoutGrid, MapPin, Store } from "@/components/icons";
import { EmptyState, LoadError } from "@/components/site/states";
import { PageHeader } from "@/components/dashboard/widgets";
import { Skeleton } from "@/components/ui/skeleton";
import { useArtisans } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { type Artisan } from "@/lib/api";

type Visit = "any" | "studio" | "home";

interface Props {
  initialArtisans?: Artisan[];
  fetchedAt?: number;
}

export default function ServicesContent({ initialArtisans, fetchedAt }: Props) {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();
  const [city, setCity] = useState(searchParams.get("city") ?? "");
  const [visit, setVisit] = useState<Visit>("any");

  // Seed React Query with server data — no client fetch on first load.
  const { data: artisans = [], isLoading, isError, refetch } =
    useArtisans(initialArtisans, fetchedAt);

  const cities = useMemo(() => {
    const live = artisans.map((a) => a.city).filter(Boolean) as string[];
    return Array.from(new Set(live));
  }, [artisans]);

  const visible = useMemo(
    () =>
      artisans.filter((a) => {
        const cityOk = !city || a.city?.toLowerCase() === city.toLowerCase();
        const visitOk =
          visit === "any" || a.serviceMode === "both" || a.serviceMode === visit;
        const queryOk =
          !q ||
          [a.name, a.craft, a.studio, ...a.services.map((s) => s.name)].some((v) =>
            v?.toLowerCase().includes(q),
          );
        return cityOk && visitOk && queryOk;
      }),
    [artisans, city, visit, q],
  );

  return (
    <Container className="pt-8 md:pt-12">
      <PageHeader title={q ? `Artisans for "${q}"` : "Book an artisan"} />

      <div className="mt-5 max-w-[480px]">
        <SearchBar
          key={q}
          defaultValue={searchParams.get("q") ?? ""}
          action="/services"
          placeholder="Braids, gele, makeup, nails…"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Segmented<Visit>
          value={visit}
          onChange={setVisit}
          options={[
            { value: "any", label: "Anywhere", icon: LayoutGrid },
            { value: "home", label: "Comes to me", icon: Home },
            { value: "studio", label: "In studio", icon: Store },
          ]}
        />

        <button
          type="button"
          aria-pressed={!city}
          onClick={() => setCity("")}
          className={cn(
            "lb-press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium tracking-[-0.014em] shadow-pill ring-1 transition-colors duration-150 cursor-pointer",
            !city
              ? "bg-brand-wash text-brand-deep ring-brand font-semibold"
              : "bg-surface text-ink ring-hairline hover:bg-canvas",
          )}
        >
          All cities
        </button>

        {cities.map((c) => {
          const on = city.toLowerCase() === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => setCity(on ? "" : c)}
              className={cn(
                "lb-press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium tracking-[-0.014em] shadow-pill ring-1 transition-colors duration-150 cursor-pointer",
                on
                  ? "bg-brand-wash text-brand-deep ring-brand font-semibold"
                  : "bg-surface text-ink ring-hairline hover:bg-canvas",
              )}
            >
              <MapPin className="h-4 w-4" aria-hidden />
              {c}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {isLoading && artisans.length === 0 ? (
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            role="status"
            aria-busy="true"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[320px] w-full rounded-[28px] bg-surface" />
            ))}
          </div>
        ) : isError ? (
          <LoadError
            onRetry={() => refetch()}
            message="We couldn't load artisans. Please try again."
          />
        ) : visible.length === 0 ? (
          <EmptyState>
            {artisans.length === 0
              ? "Artisans are joining soon."
              : "No artisans match these filters."}
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((a) => (
              <ArtisanCard key={a.id} artisan={a} />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
