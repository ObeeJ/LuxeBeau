"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import SiteShell, { Container } from "@/components/site/shell";
import { CategoryPill, ProductCard, SearchBar } from "@/components/site/catalog";
import { CardSkeletonGrid, EmptyState, LoadError } from "@/components/site/states";
import { PageHeader } from "@/components/dashboard/widgets";
import { useProducts } from "@/lib/queries";
import { type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";

type Sort = "featured" | "price-asc" | "price-desc" | "rating";

function ShopContent() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();
  // Seed the category from the URL once, during render (no setState-in-effect).
  const [category, setCategory] = useState<string>(searchParams.get("category") ?? "All");
  const [sort, setSort] = useState<Sort>("featured");
  const { add } = useCart();

  const all = useProducts();
  const results = useProducts(q);

  const categories = useMemo(() => {
    const seen = new Map<string, string | undefined>();
    for (const p of all.data ?? []) if (!seen.has(p.category) || (!seen.get(p.category) && p.imageUrl)) seen.set(p.category, p.imageUrl);
    return [...seen].map(([name, image]) => ({ name, image }));
  }, [all.data]);

  const visible = useMemo(() => {
    const source = results.data ?? [];
    let list: Product[] = category === "All" ? source : source.filter(p => p.category === category);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.priceNGN - b.priceNGN);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.priceNGN - a.priceNGN);
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [results.data, category, sort]);

  return (
    <Container className="pt-8 md:pt-12">
      <PageHeader title={q ? `Results for “${q}”` : "Shop"} />

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchBar key={q} defaultValue={q} placeholder="Search products or brands" className="md:max-w-[480px]" />
        <label className="flex items-center gap-2 md:ml-auto">
          <span className="t-meta shrink-0 text-muted">Sort</span>
          <select value={sort} onChange={e => setSort(e.target.value as Sort)} className="lb-input h-11 md:w-52">
            <option value="featured">Featured</option>
            <option value="rating">Top rated</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </label>
      </div>

      <div role="group" aria-label="Filter by category" className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:px-0">
        <CategoryPill label="All" active={category === "All"} onClick={() => setCategory("All")} />
        {categories.map(c => (
          <CategoryPill key={c.name} label={c.name} image={c.image} active={category === c.name} onClick={() => setCategory(c.name)} />
        ))}
      </div>

      <div className="mt-6">
        {results.isLoading ? (
          <CardSkeletonGrid />
        ) : results.isError ? (
          <LoadError onRetry={() => results.refetch()} message="We could not load the shelf. Please try again." />
        ) : visible.length === 0 ? (
          <EmptyState>
            {q ? `Nothing matches “${q}” yet. Try another product or brand.` : "Nothing in this category yet. Check back after our next drop."}
          </EmptyState>
        ) : (
          <>
            <p className="mb-3 text-[12px] tracking-[-0.017em] text-muted" aria-live="polite">
              {visible.length} product{visible.length === 1 ? "" : "s"}
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {visible.map(p => <ProductCard key={p.id} product={p} onAdd={add} />)}
            </div>
          </>
        )}
      </div>
    </Container>
  );
}

export default function ShopPage() {
  return (
    <SiteShell>
      <Suspense fallback={<Container className="pt-12"><CardSkeletonGrid /></Container>}>
        <ShopContent />
      </Suspense>
    </SiteShell>
  );
}
