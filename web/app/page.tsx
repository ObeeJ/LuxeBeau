"use client";

import { useMemo } from "react";
import SiteShell, { Container } from "@/components/site/shell";
import {
  ArtisanCard,
  CategoryPill,
  ProductCard,
  ProductRail,
  SearchBar,
  SectionHeader,
  StoreCard,
} from "@/components/site/catalog";
import { HeroCard } from "@/components/site/home/hero-card";
import { EscrowStrip } from "@/components/site/home/escrow-strip";
import { JoinRow } from "@/components/site/home/join-row";
import { CardSkeletonGrid, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Cascade } from "@/components/motion/cascade";
import { useArtisans, useProducts } from "@/lib/queries";
import { type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";

export default function Home() {
  const { add } = useCart();
  const products = useProducts();
  const artisans = useArtisans();
  const list = useMemo(() => products.data ?? [], [products.data]);
  const artisanList = useMemo(() => artisans.data ?? [], [artisans.data]);

  // Floating items for the hero
  const photographed = useMemo(
    () => list.filter((p) => p.imageUrl).slice(0, 5),
    [list],
  );

  // Dynamic categories from actual inventory
  const categories = useMemo(() => {
    const seen = new Map<string, string | undefined>();
    for (const p of list) {
      if (!seen.has(p.category) || (!seen.get(p.category) && p.imageUrl)) {
        seen.set(p.category, p.imageUrl);
      }
    }
    return [...seen].map(([name, image]) => ({ name, image }));
  }, [list]);

  // Derived curated rails from real catalogue
  const topRated = useMemo(
    () => [...list].sort((a, b) => b.rating - a.rating).slice(0, 8),
    [list],
  );

  const newIn = useMemo(() => list.slice(0, 8), [list]);

  // Group real products by brand to showcase stores if data exists
  const stores = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of list) {
      if (!map.has(p.brand)) map.set(p.brand, []);
      map.get(p.brand)!.push(p);
    }
    return [...map.entries()]
      .filter(([_, prods]) => prods.length > 0)
      .slice(0, 3)
      .map(([brand, prods]) => ({
        name: brand,
        subtitle: `${prods[0].category} · Verified Seller`,
        logoUrl: prods[0].imageUrl,
        coverUrl: prods[0].imageUrl,
        products: prods,
      }));
  }, [list]);

  return (
    <SiteShell>
      {/* Top Search & Category Navigation */}
      <section aria-label="Search LuxeBeau" className="pb-6 pt-5 md:pt-6">
        <Container>
          <div className="mx-auto max-w-[540px]">
            <SearchBar placeholder="What are you glowing up with today?" />
          </div>

          {categories.length > 0 && (
            <nav
              aria-label="Categories"
              className="no-scrollbar -mx-4 mt-5 flex gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
            >
              {categories.map((c) => (
                <CategoryPill
                  key={c.name}
                  label={c.name}
                  image={c.image}
                  href={`/shop?category=${encodeURIComponent(c.name)}`}
                />
              ))}
              <CategoryPill label="Book an artisan" href="/services" />
            </nav>
          )}
        </Container>
      </section>

      {/* Hero Showcase Card */}
      <Container className="mb-14">
        <HeroCard floating={photographed} />
      </Container>

      {/* Explore Feed */}
      <Container className="space-y-16 pb-16">
        {/* Explore Heading */}
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <h2 className="text-[32px] sm:text-[40px] font-extrabold tracking-[-0.045em] text-ink">
            Explore
          </h2>
        </div>

        {/* Top Rated Rail */}
        <section aria-label="Top rated beauty">
          <SectionHeader title="Top rated beauty" href="/shop?sort=rating" />
          {products.isLoading ? (
            <CardSkeletonGrid count={4} />
          ) : products.isError ? (
            <LoadError
              onRetry={() => products.refetch()}
              message="We couldn't load top products. Please try again."
            />
          ) : topRated.length === 0 ? (
            <p className="text-[16px] text-muted">New products are on the way.</p>
          ) : (
            <ProductRail label="Top rated beauty">
              {topRated.map((p, idx) => (
                <div key={p.id} className="w-[190px] sm:w-[220px] shrink-0 snap-start">
                  <Cascade index={idx}>
                    <ProductCard product={p} onAdd={add} />
                  </Cascade>
                </div>
              ))}
            </ProductRail>
          )}
        </section>

        {/* Escrow Trust Strip */}
        <section aria-label="Escrow protection">
          <EscrowStrip />
        </section>

        {/* New in / Catalogue Grid */}
        <section aria-label="New arrivals">
          <SectionHeader title="New arrivals" href="/shop" />
          {products.isLoading ? (
            <CardSkeletonGrid count={4} />
          ) : products.isError ? (
            <LoadError
              onRetry={() => products.refetch()}
              message="We couldn't load new arrivals. Please try again."
            />
          ) : newIn.length === 0 ? (
            <p className="text-[16px] text-muted">New products are on the way.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {newIn.map((p, idx) => (
                <Cascade key={p.id} index={idx}>
                  <ProductCard product={p} onAdd={add} />
                </Cascade>
              ))}
            </div>
          )}
        </section>

        {/* Trending Stores (if present in catalogue) */}
        {stores.length > 0 && (
          <section aria-label="Trending stores">
            <SectionHeader title="Trending stores" href="/shop" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {stores.map((s, idx) => (
                <Cascade key={s.name} index={idx}>
                  <StoreCard
                    name={s.name}
                    subtitle={s.subtitle}
                    logoUrl={s.logoUrl}
                    coverUrl={s.coverUrl}
                    products={s.products}
                    href={`/shop?q=${encodeURIComponent(s.name)}`}
                  />
                </Cascade>
              ))}
            </div>
          </section>
        )}

        {/* Book an Artisan Rail */}
        <section aria-label="Book a beauty service">
          <SectionHeader title="Book a beauty artisan" href="/services" />
          {artisans.isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-[300px] w-[260px] shrink-0 rounded-[28px] bg-surface"
                />
              ))}
            </div>
          ) : artisans.isError ? (
            <LoadError
              onRetry={() => artisans.refetch()}
              message="We couldn't load artisans. Please try again."
            />
          ) : artisanList.length === 0 ? (
            <p className="text-[16px] text-muted">Verified artisans will be listed soon.</p>
          ) : (
            <ProductRail label="Beauty artisans">
              {artisanList.map((a, idx) => (
                <div key={a.id} className="w-[250px] shrink-0 snap-start sm:w-[270px]">
                  <Cascade index={idx}>
                    <ArtisanCard artisan={a} />
                  </Cascade>
                </div>
              ))}
            </ProductRail>
          )}
        </section>

        {/* Join Row (Sell / Artisan / Brand partnerships) */}
        <section aria-label="Partner with LuxeBeau">
          <JoinRow />
        </section>
      </Container>
    </SiteShell>
  );
}
