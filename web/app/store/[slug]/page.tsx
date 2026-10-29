"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Package, ShieldCheck, Star } from "@/components/icons";
import SiteShell, { Container } from "@/components/site/shell";
import { ProductCard } from "@/components/site/catalog";
import { Segmented } from "@/components/site/filters";
import { ReviewFeed } from "@/components/site/reviews";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/lib/queries";
import { useCart } from "@/lib/cart";
import { brandSlug } from "@/lib/slug";
import { categoryPhotos } from "@/lib/photos";

type Tab = "shop" | "about" | "reviews";

/* A brand's public store: profile header with real stats, its catalogue, an
   About tab, and a Reviews tab laid out like a feed. */
export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { add } = useCart();
  const { data: all, isLoading, isError, refetch } = useProducts();
  const [tab, setTab] = useState<Tab>("shop");

  const products = useMemo(() => (all ?? []).filter(p => brandSlug(p.brand) === slug), [all, slug]);
  const stats = useMemo(() => {
    const ratings = products.filter(p => p.rating > 0);
    const count = products.reduce((sum, p) => sum + p.reviews, 0);
    const avg = count > 0 ? products.reduce((sum, p) => sum + p.rating * p.reviews, 0) / count : ratings.length ? ratings.reduce((s, p) => s + p.rating, 0) / ratings.length : 0;
    return { count, avg };
  }, [products]);

  if (isLoading) {
    return (
      <SiteShell>
        <Container className="pt-8"><Skeleton className="h-72 w-full rounded-[32px] bg-surface" /></Container>
      </SiteShell>
    );
  }
  if (isError) {
    return (
      <SiteShell>
        <Container className="pt-8"><LoadError onRetry={() => refetch()} message="We couldn't load this store. Please try again." /></Container>
      </SiteShell>
    );
  }
  if (products.length === 0) notFound();

  const brand = products[0].brand;
  const categories = [...new Set(products.map(p => p.category))];
  const cover = products.find(p => p.imageUrl)?.imageUrl ?? categoryPhotos(categories[0])[0];

  return (
    <SiteShell>
      <Container className="pb-16 pt-5 md:pt-8">
        <Link href="/shop" className="inline-flex items-center gap-1 text-[14px] tracking-[-0.014em] text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Shop
        </Link>

        <section className="relative mt-4 overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-deep to-brand text-surface" aria-label="Store profile">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/45 to-ink/10" />
          <div className="relative flex min-h-[280px] flex-col justify-end gap-4 p-5 sm:min-h-[340px] sm:p-7">
            <div className="flex items-end gap-4">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-surface text-[30px] font-extrabold text-brand shadow-float sm:h-24 sm:w-24 sm:text-[36px]">
                {brand.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <h1 className="text-[32px] font-extrabold leading-[1.02] tracking-[-0.045em] sm:text-[44px]">{brand}</h1>
                <p className="mt-1 text-[15px] opacity-90">{categories.join(" · ")}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">
                <Package className="h-3.5 w-3.5" aria-hidden /> {products.length} {products.length === 1 ? "product" : "products"}
              </span>
              {stats.avg > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">
                  <Star className="h-3.5 w-3.5 fill-current" strokeWidth={0} aria-hidden /> {stats.avg.toFixed(1)}
                  <span className="opacity-80">({stats.count.toLocaleString("en-NG")})</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/20 px-3 py-1.5 text-[13px] font-medium backdrop-blur-sm">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Payments held in escrow
              </span>
            </div>
          </div>
        </section>

        <div className="mt-6">
          <Segmented<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "shop", label: "Shop" },
              { value: "about", label: "About" },
              { value: "reviews", label: "Reviews" },
            ]}
          />
        </div>

        <div className="mt-6">
          {tab === "shop" && (
            <div className="grid grid-cols-2 gap-x-3.5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {products.map(p => <ProductCard key={p.id} product={p} onAdd={add} />)}
            </div>
          )}
          {tab === "about" && (
            <div className="max-w-2xl space-y-4 rounded-[28px] bg-surface p-6 text-[15px] leading-relaxed shadow-card">
              <p>
                {brand} sells {categories.join(", ").toLowerCase()} on LuxeBeau, with {products.length}{" "}
                {products.length === 1 ? "product" : "products"} in the catalogue.
              </p>
              <p>
                Every order from this store is paid into escrow. {brand} is paid after you confirm delivery, or on the
                release date shown on your order.
              </p>
            </div>
          )}
          {tab === "reviews" && <ReviewFeed reviews={[]} rating={stats.avg} count={stats.count} />}
        </div>
      </Container>
    </SiteShell>
  );
}
