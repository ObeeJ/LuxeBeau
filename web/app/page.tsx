"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SiteShell, { Container } from "@/components/site/shell";
import {
  ArtisanCard,
  CategoryPill,
  ProductCard,
  ProductImage,
  Rail,
  SearchBar,
  SectionHeader,
  Stars,
} from "@/components/site/catalog";
import { LuxeBeauWordmark } from "@/components/site/logo";
import { CardSkeletonGrid, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useArtisans, useProducts } from "@/lib/queries";
import { type Product } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/slide-in-notifications";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

/* Desktop constellation slots: left/top in %, small tilt, stacking order. */
const SLOTS = [
  { left: "2%", top: "18%", rotate: -6, z: 2 },
  { left: "19%", top: "0%", rotate: 3, z: 3 },
  { left: "64%", top: "2%", rotate: -3, z: 3 },
  { left: "81%", top: "20%", rotate: 6, z: 2 },
  { left: "41%", top: "-6%", rotate: 0, z: 1 },
];

function FloatingCard({ product, className, style }: { product: Product; className?: string; style?: React.CSSProperties }) {
  return (
    <Link
      href={`/shop/${product.slug}`}
      style={style}
      className={cn("block w-[136px] rounded-[28px] bg-surface p-1.5 shadow-card transition-shadow duration-200 hover:shadow-float lg:w-[156px]", className)}
    >
      <ProductImage product={product} className="aspect-square w-full" />
      <div className="px-1.5 pb-1.5 pt-2">
        <p className="t-sub truncate">{product.brand}</p>
        <Stars rating={product.rating} count={product.reviews} />
      </div>
    </Link>
  );
}

function Hero({ products, loading, categories }: { products: Product[]; loading: boolean; categories: { name: string; color: string }[] }) {
  const floating = products.slice(0, 5);

  return (
    <section className="pb-16 pt-8 md:pt-12" aria-label="Discover">
      <Container>
        {/* Constellation: absolute on desktop, an overlapping row on phones */}
        <div className="relative mx-auto hidden h-[230px] max-w-[980px] md:block lg:h-[250px]" aria-hidden={loading}>
          {loading
            ? SLOTS.slice(0, 4).map((s, i) => (
                <Skeleton key={i} className="absolute h-[190px] w-[156px] rounded-[28px] bg-surface shadow-card" style={{ left: s.left, top: s.top }} />
              ))
            : floating.map((p, i) => (
                <motion.div
                  key={p.id}
                  className="absolute"
                  style={{ left: SLOTS[i].left, top: SLOTS[i].top, zIndex: SLOTS[i].z }}
                  initial={{ opacity: 0, y: 16, rotate: SLOTS[i].rotate }}
                  animate={{ opacity: 1, y: 0, rotate: SLOTS[i].rotate }}
                  transition={{ delay: 0.06 * i, duration: 0.3, ease }}
                >
                  <FloatingCard product={p} />
                </motion.div>
              ))}
        </div>
        <div className="flex justify-center md:hidden">
          {loading
            ? <Skeleton className="h-[170px] w-full max-w-[340px] rounded-[28px] bg-surface" />
            : floating.slice(0, 3).map((p, i) => (
                <FloatingCard
                  key={p.id}
                  product={p}
                  className={cn("w-[112px] shrink-0", i === 1 ? "relative z-10 -mx-3 -translate-y-2" : "rotate-[-4deg]", i === 2 && "rotate-[4deg]")}
                />
              ))}
        </div>

        <div className="mt-8 text-center md:mt-4">
          <h1 className="sr-only">LuxeBeau, Nigeria&apos;s beauty marketplace</h1>
          <LuxeBeauWordmark className="text-[64px] leading-none sm:text-[88px]" />
          <p className="mx-auto mt-3 max-w-md text-[16px] text-muted">
            Beauty made for melanin-rich skin, and the artisans who do it best.
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-[560px]">
          <SearchBar />
        </div>

        <div className="no-scrollbar -mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0">
          {categories.map(c => (
            <CategoryPill key={c.name} label={c.name} color={c.color} href={`/shop?category=${encodeURIComponent(c.name)}`} />
          ))}
          <CategoryPill label="Book an artisan" href="/services" />
        </div>
      </Container>
    </section>
  );
}

export default function Home() {
  const { add } = useCart();
  const { toast } = useToast();
  const products = useProducts();
  const artisans = useArtisans();

  const list = useMemo(() => products.data ?? [], [products.data]);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of list) if (!seen.has(p.category)) seen.set(p.category, p.tint[0]);
    return [...seen].map(([name, color]) => ({ name, color }));
  }, [list]);

  const handleAdd = (product: Product) => {
    add(product);
    toast(`${product.name} added to your bag.`, "success");
  };

  const spotlight = list[0];
  const spotlightGrid = list.slice(1, 5);

  return (
    <SiteShell>
      <Hero products={list} loading={products.isLoading} categories={categories} />

      <Container className="space-y-16">
        {/* Hero-and-grid composition */}
        <section aria-label="New on the shelf">
          <SectionHeader title="New on the shelf" href="/shop" />
          {products.isLoading ? (
            <CardSkeletonGrid count={4} />
          ) : products.isError ? (
            <LoadError onRetry={() => products.refetch()} message="We could not load the shelf. Please try again." />
          ) : spotlight ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Link
                href={`/shop/${spotlight.slug}`}
                className="group relative block min-h-[320px] overflow-hidden rounded-[28px] shadow-card transition-shadow duration-200 hover:shadow-float lg:min-h-0"
              >
                <ProductImage product={spotlight} size="lg" className="absolute inset-0 rounded-[28px]" />
                <div className="absolute inset-x-4 bottom-4 flex flex-wrap items-end justify-between gap-3 text-surface">
                  <div>
                    <p className="text-[16px] tracking-[-0.031em]">{spotlight.name}</p>
                    <Stars rating={spotlight.rating} count={spotlight.reviews} tone="white" className="mt-1 [&_.t-micro]:text-[14px] [&_.t-micro]:tracking-[-0.014em]" />
                  </div>
                  <span className="rounded-full bg-surface px-4 py-2 text-[14px] tracking-[-0.014em] text-ink">
                    {formatNaira(spotlight.priceNGN)}
                  </span>
                </div>
              </Link>
              <div className="grid grid-cols-2 gap-3">
                {spotlightGrid.map(p => <ProductCard key={p.id} product={p} onAdd={handleAdd} />)}
              </div>
            </div>
          ) : (
            <p className="text-muted">The shelf is being restocked. Check back shortly.</p>
          )}
        </section>

        {/* Artisans rail */}
        <section aria-label="Book an artisan">
          <SectionHeader title="Book an artisan" href="/services" />
          {artisans.isLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-[260px] shrink-0 rounded-[28px] bg-surface" />)}
            </div>
          ) : artisans.isError ? (
            <LoadError onRetry={() => artisans.refetch()} message="We could not load our artisans." />
          ) : (
            <Rail label="Artisans">
              {(artisans.data ?? []).map(a => (
                <ArtisanCard key={a.id} artisan={a} className="w-[240px] shrink-0 snap-start sm:w-[260px]" />
              ))}
            </Rail>
          )}
        </section>

        {/* Product image tiles: one per category, label chip bottom-left */}
        {categories.length > 0 && (
          <section aria-label="Shop by category">
            <SectionHeader title="Shop by category" href="/shop" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {categories.map(c => {
                const lead = list.find(p => p.category === c.name)!;
                return (
                  <Link
                    key={c.name}
                    href={`/shop?category=${encodeURIComponent(c.name)}`}
                    className="block transition-opacity duration-200 hover:opacity-90"
                  >
                    <ProductImage product={lead} label={c.name} showBrand={false} className="aspect-[4/5] w-full" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Full shelf, 4-column grid */}
        {list.length > 5 && (
          <section aria-label="Everything on the shelf">
            <SectionHeader title="Everything on the shelf" href="/shop" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {list.slice(0, 8).map(p => <ProductCard key={p.id} product={p} onAdd={handleAdd} />)}
            </div>
          </section>
        )}

        {/* Partner entry points */}
        <section aria-label="Partner with LuxeBeau" className="grid gap-3 md:grid-cols-2">
          {[
            { href: "/partnership/seller", title: "Sell on LuxeBeau", body: "List your beauty brand and manage orders from your seller studio." },
            { href: "/partnership/artisan", title: "Join as an artisan", body: "Publish your services and receive bookings from clients near you." },
          ].map(card => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-center justify-between gap-4 rounded-[28px] bg-surface p-6 shadow-card transition-shadow duration-200 hover:shadow-float"
            >
              <div>
                <h2 className="t-display">{card.title}</h2>
                <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">{card.body}</p>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas transition-transform duration-200 group-hover:translate-x-0.5">
                <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          ))}
        </section>
      </Container>
    </SiteShell>
  );
}
