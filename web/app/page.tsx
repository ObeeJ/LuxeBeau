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
import { CategoryGrid, EditCards } from "@/components/site/home/explore";
import { CardSkeletonGrid, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Cascade } from "@/components/motion/cascade";
import { useArtisans, useProducts } from "@/lib/queries";
import { categoryTint } from "@/lib/category-tint";
import { brandSlug } from "@/lib/slug";
import { ARTISAN_COVER } from "@/lib/photos";
import { type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";

/* Six across on wide screens, like the approved mockup; a swipeable rail on phones. */
const RAIL_ITEM = "w-[44vw] max-w-[190px] shrink-0 snap-start sm:w-[170px] lg:w-[calc((100%-70px)/6)] lg:max-w-none";

export default function Home() {
  const { add } = useCart();
  const products = useProducts();
  const artisans = useArtisans();
  const list = useMemo(() => products.data ?? [], [products.data]);
  const artisanList = useMemo(() => artisans.data ?? [], [artisans.data]);


  // Categories come from the real inventory, busiest first.
  const categories = useMemo(() => {
    const groups = new Map<string, { image?: string; products: Product[] }>();
    for (const p of list) {
      const g = groups.get(p.category) ?? { products: [] };
      g.products.push(p);
      if (!g.image && p.imageUrl) g.image = p.imageUrl;
      groups.set(p.category, g);
    }
    return [...groups]
      .map(([name, g]) => ({ name, image: g.image, products: g.products }))
      .sort((a, b) => b.products.length - a.products.length);
  }, [list]);

  const editGroups = useMemo(
    () =>
      categories.slice(0, 3).map(c => ({
        title: `The ${c.name.toLowerCase()} edit`,
        category: c.name,
        products: c.products,
      })),
    [categories],
  );

  const topRated = useMemo(() => [...list].sort((a, b) => b.rating - a.rating).slice(0, 8), [list]);
  const newIn = useMemo(() => list.slice(0, 8), [list]);
  const loved = useMemo(() => [...list].sort((a, b) => b.reviews - a.reviews).slice(0, 8), [list]);

  // Group real products by brand to showcase stores.
  const stores = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of list) {
      if (!map.has(p.brand)) map.set(p.brand, []);
      map.get(p.brand)!.push(p);
    }
    // Ranked by total reviews across the brand's products, a real signal.
    const reviews = (prods: Product[]) => prods.reduce((sum, p) => sum + p.reviews, 0);
    return [...map.entries()]
      .sort((a, b) => reviews(b[1]) - reviews(a[1]))
      .slice(0, 3)
      .map(([brand, prods]) => ({
      name: brand,
      subtitle: `${prods[0].category} · ${prods.length} ${prods.length === 1 ? "product" : "products"}`,
      logoUrl: prods[0].imageUrl,
      coverUrl: prods[0].imageUrl,
      products: prods,
    }));
  }, [list]);

  const rail = (label: string, items: Product[]) => (
    <ProductRail label={label}>
      {items.map((p, idx) => (
        <div key={p.id} className={RAIL_ITEM}>
          <Cascade index={idx}>
            <ProductCard product={p} onAdd={add} />
          </Cascade>
        </div>
      ))}
    </ProductRail>
  );

  const railState = (message: string, items: Product[], label: string) =>
    products.isLoading ? (
      <CardSkeletonGrid count={4} />
    ) : products.isError ? (
      <LoadError onRetry={() => products.refetch()} message={message} />
    ) : items.length === 0 ? (
      <p className="text-[16px] text-muted">New products are on the way.</p>
    ) : (
      rail(label, items)
    );

  return (
    <SiteShell>
      {/* Search and round-swatch category pills */}
      <section aria-label="Search LuxeBeau" className="pb-5 pt-5 md:pt-5">
        <Container>
          <div className="mx-auto max-w-[540px]">
            <SearchBar placeholder="What are you glowing up with today?" />
          </div>

          {categories.length > 0 && (
            <nav
              aria-label="Categories"
              className="no-scrollbar -mx-4 mt-4 flex items-center gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:gap-5 sm:px-0"
            >
              {categories.map(c => (
                <CategoryPill
                  key={c.name}
                  label={c.name}
                  image={c.image}
                  tint={categoryTint(c.name)}
                  href={`/shop?category=${encodeURIComponent(c.name)}`}
                />
              ))}
              <CategoryPill label="Artisans" image={ARTISAN_COVER} tint={categoryTint("artisans")} href="/services" />
            </nav>
          )}
        </Container>
      </section>

      {/* Hero */}
      <Container className="mb-12">
        <HeroCard />
      </Container>

      {/* Explore feed */}
      <Container className="space-y-10 pb-16">
        <h2 className="text-[32px] font-extrabold tracking-[-0.045em] text-ink sm:text-[40px]">Explore</h2>

        {editGroups.length > 0 && (
          <section aria-label="Edits">
            <EditCards groups={editGroups} />
          </section>
        )}

        {categories.length > 0 && (
          <section aria-label="Browse categories">
            <SectionHeader title="Browse categories" />
            <CategoryGrid categories={categories.slice(0, 5)} />
          </section>
        )}

        <section aria-label="Top rated beauty">
          <SectionHeader title="Top rated beauty" href="/shop?sort=rating" />
          {railState("We couldn't load top products. Please try again.", topRated, "Top rated beauty")}
        </section>

        <section aria-label="Escrow protection">
          <EscrowStrip />
        </section>

        {stores.length > 0 && (
          <section aria-label="Popular stores">
            <SectionHeader title="Popular stores" href="/shop" />
            <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0">
              {stores.map((s, idx) => (
                <div key={s.name} className="w-[82%] shrink-0 snap-start md:w-auto">
                <Cascade index={idx}>
                  <StoreCard
                    name={s.name}
                    subtitle={s.subtitle}
                    logoUrl={s.logoUrl}
                    coverUrl={s.coverUrl}
                    products={s.products}
                    href={`/store/${brandSlug(s.name)}`}
                  />
                </Cascade>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-label="New arrivals">
          <SectionHeader title="New arrivals" href="/shop" />
          {railState("We couldn't load new arrivals. Please try again.", newIn, "New arrivals")}
        </section>

        {loved.length > 0 && (
          <section aria-label="Loved by everyone">
            <SectionHeader title="Loved by everyone" href="/shop" />
            {rail("Loved by everyone", loved)}
          </section>
        )}

        <section aria-label="Book a beauty service">
          <SectionHeader title="Book a beauty artisan" href="/services" />
          {artisans.isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[300px] w-[260px] shrink-0 rounded-[28px] bg-surface" />
              ))}
            </div>
          ) : artisans.isError ? (
            <LoadError onRetry={() => artisans.refetch()} message="We couldn't load artisans. Please try again." />
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

        <section aria-label="Partner with LuxeBeau">
          <JoinRow />
        </section>
      </Container>
    </SiteShell>
  );
}
