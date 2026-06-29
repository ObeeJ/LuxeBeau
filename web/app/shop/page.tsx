"use client";

import Link from "next/link";
import { useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Star, SlidersHorizontal } from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { CardSkeletonGrid, EmptyState, LoadError } from "@/components/site/states";
import { useProducts } from "@/lib/queries";
import { type Product } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/slide-in-notifications";

const categories = ["All", "Skincare", "Haircare", "Makeup", "Fragrance", "Body"] as const;
type Category = (typeof categories)[number];

function ShopContent() {
  const searchParams = useSearchParams();
  // Derive the initial category from the URL once, during render, instead of
  // syncing it in via an effect (which triggers cascading renders).
  const urlCategory = searchParams.get("category") as Category | null;
  const [category, setCategory] = useState<Category>(
    urlCategory && categories.includes(urlCategory) ? urlCategory : "All",
  );

  const [sort, setSort] = useState<"featured" | "price-asc" | "price-desc">("featured");
  const { add } = useCart();
  const { toast } = useToast();

  const { data: products = [], isLoading, isError, refetch } = useProducts();

  const visible = useMemo(() => {
    let list: Product[] = category === "All" ? products : products.filter(p => p.category === category);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.priceNGN - b.priceNGN);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.priceNGN - a.priceNGN);
    return list;
  }, [products, category, sort]);

  return (
    <div className="min-h-dvh">
      <SiteNav />

      <header className="relative overflow-hidden border-b border-velvet-700/60">
        <div className="aurora-field absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">The product side</p>
          <h1 className="mt-4 font-display text-4xl font-medium sm:text-5xl">
            The <em className="text-gold-gradient italic">curated</em> shelf
          </h1>
          <p className="mt-4 max-w-lg text-lavender-200">
            Every product is NAFDAC-checked and formulated with melanin-rich skin in mind.
            Pay with Paystack, delivered nationwide.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  category === cat
                    ? "bg-royal-500 text-lavender-100"
                    : "border border-velvet-700 text-lavender-200 hover:border-royal-400/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-lavender-400">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="sr-only">Sort products</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as typeof sort)}
              className="rounded-lg border border-velvet-700 bg-velvet-900 px-3 py-2 text-sm text-lavender-100"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </label>
        </div>

        {/* Grid / states */}
        {isLoading ? (
          <CardSkeletonGrid />
        ) : isError ? (
          <LoadError onRetry={() => refetch()} message="We could not load the shelf. Please try again." />
        ) : products.length === 0 ? (
          <EmptyState>
            <p>The shelf is being restocked. Check back shortly for our next drop.</p>
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState>
            <p>Nothing in this category yet, check back after our next drop.</p>
          </EmptyState>
        ) : (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(product => (
              <article key={product.id} className="card-velvet group overflow-hidden rounded-3xl transition-colors duration-300 hover:border-royal-400/60">
                <Link href={`/shop/${product.slug}`} className="block">
                  <div
                    className="relative flex h-52 items-end p-6"
                    style={{ background: `linear-gradient(140deg, ${product.tint[0]}, ${product.tint[1]})` }}
                  >
                    {product.badge && (
                      <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                        {product.badge}
                      </span>
                    )}
                    <span className="font-display text-xl font-semibold italic text-white/90">{product.brand}</span>
                  </div>
                </Link>
                <div className="p-6">
                  <div className="flex items-center justify-between text-xs text-lavender-400">
                    <span className="rounded-full border border-velvet-700 px-2.5 py-1">{product.category}</span>
                    <span className="flex items-center gap-1 text-gold-300">
                      <Star className="h-3.5 w-3.5 fill-current" aria-hidden /> {product.rating} ({product.reviews})
                    </span>
                  </div>
                  <h2 className="mt-3 font-display text-lg font-semibold leading-snug">
                    <Link href={`/shop/${product.slug}`} className="hover:text-gold-300">{product.name}</Link>
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm text-lavender-400">{product.blurb}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="font-display text-xl font-semibold text-gold-300">{formatNaira(product.priceNGN)}</span>
                    <button
                      onClick={() => {
                        add(product);
                        toast(`${product.name} added to your bag.`, "success");
                      }}
                      className="rounded-full bg-royal-500 px-5 py-2.5 text-sm font-semibold transition-colors duration-200 hover:bg-royal-400"
                    >
                      Add to bag
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

export default function ShopPage() {
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
      <ShopContent />
    </Suspense>
  );
}
