"use client";

import Link from "next/link";
import { useMemo } from "react";
import SiteShell, { Container } from "@/components/site/shell";
import { ArtisanCard, CategoryPill, Photo, ProductCard, Rail, Rating, SearchBar, SectionHeader } from "@/components/site/catalog";
import { LuxeBeauWordmark } from "@/components/site/logo";
import { CardSkeletonGrid, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useArtisans, useProducts } from "@/lib/queries";
import { type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

/* Desktop constellation: position, tilt and stacking for up to five cards. */
const SLOTS = [
  { left: "0%", top: "26%", rotate: -6, z: 2 },
  { left: "17%", top: "2%", rotate: 3, z: 3 },
  { left: "66%", top: "4%", rotate: -3, z: 3 },
  { left: "83%", top: "28%", rotate: 6, z: 2 },
  { left: "41%", top: "-8%", rotate: 0, z: 1 },
];

function FloatingCard({ product }: { product: Product }) {
  return (
    <Link href={`/shop/${product.slug}`} className="block w-[150px] rounded-[28px] bg-surface p-1.5 shadow-card transition-shadow duration-200 hover:shadow-float">
      <div className="aspect-square">
        <Photo src={product.imageUrl} alt={product.name} fallback={product.brand} />
      </div>
      <div className="px-1.5 pb-1 pt-2">
        <p className="t-sub truncate">{product.brand}</p>
        <Rating rating={product.rating} count={product.reviews} />
      </div>
    </Link>
  );
}

export default function Home() {
  const { add } = useCart();
  const products = useProducts();
  const artisans = useArtisans();
  const list = useMemo(() => products.data ?? [], [products.data]);

  // The floating product constellation only appears once there are real
  // photos to float; grey tiles in a hero read as unfinished.
  const photographed = list.filter(p => p.imageUrl).slice(0, 5);

  const categories = useMemo(() => {
    const seen = new Map<string, string | undefined>();
    for (const p of list) if (!seen.has(p.category) || (!seen.get(p.category) && p.imageUrl)) seen.set(p.category, p.imageUrl);
    return [...seen].map(([name, image]) => ({ name, image }));
  }, [list]);

  return (
    <SiteShell>
      <section aria-label="Search LuxeBeau" className="pb-14 pt-8 md:pb-16 md:pt-12">
        <Container>
          {photographed.length >= 4 && (
            <div className="relative mx-auto mb-2 hidden h-[240px] max-w-[960px] lg:block" aria-hidden>
              {photographed.map((p, i) => (
                <div
                  key={p.id}
                  className="absolute"
                  style={{ left: SLOTS[i].left, top: SLOTS[i].top, zIndex: SLOTS[i].z, transform: `rotate(${SLOTS[i].rotate}deg)` }}
                >
                  <FloatingCard product={p} />
                </div>
              ))}
            </div>
          )}

          <div className="text-center">
            <h1 className="sr-only">LuxeBeau: beauty products and artisans in Nigeria</h1>
            <LuxeBeauWordmark className="text-[56px] leading-none sm:text-[80px]" />
            <p className="mx-auto mt-3 max-w-sm text-[16px] text-muted">
              Skincare, hair and makeup for melanin-rich skin, and the artisans who do it best.
            </p>
          </div>

          <div className="mx-auto mt-6 max-w-[560px]">
            <SearchBar placeholder="What are you shopping for today?" />
          </div>

          <nav aria-label="Categories" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
            {categories.map(c => (
              <CategoryPill key={c.name} label={c.name} image={c.image} href={`/shop?category=${encodeURIComponent(c.name)}`} />
            ))}
            <CategoryPill label="Book an artisan" href="/services" />
          </nav>
        </Container>
      </section>

      <Container className="space-y-16">
        <section aria-label="New in">
          <SectionHeader title="New in" href="/shop" />
          {products.isLoading ? (
            <CardSkeletonGrid count={4} />
          ) : products.isError ? (
            <LoadError onRetry={() => products.refetch()} message="We couldn't load products. Please try again." />
          ) : list.length === 0 ? (
            <p className="text-[16px] text-muted">New products are on the way.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {list.slice(0, 8).map(p => <ProductCard key={p.id} product={p} onAdd={add} />)}
            </div>
          )}
        </section>

        <section aria-label="Book a beauty service">
          <SectionHeader title="Book a beauty service" href="/services" />
          {artisans.isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[300px] w-[260px] shrink-0 rounded-[28px] bg-surface" />)}
            </div>
          ) : artisans.isError ? (
            <LoadError onRetry={() => artisans.refetch()} message="We couldn't load artisans. Please try again." />
          ) : (
            <Rail label="Artisans">
              {(artisans.data ?? []).map(a => (
                <ArtisanCard key={a.id} artisan={a} className={cn("w-[250px] shrink-0 snap-start sm:w-[270px]")} />
              ))}
            </Rail>
          )}
        </section>
      </Container>
    </SiteShell>
  );
}
