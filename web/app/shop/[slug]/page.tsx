"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus, Plus, Truck } from "lucide-react";
import SiteShell, { Container } from "@/components/site/shell";
import { ProductCard, ProductImage, SectionHeader, Stars } from "@/components/site/catalog";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/lib/queries";
import { deliveryFeeNGN, type Product } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/slide-in-notifications";

function BackLink() {
  return (
    <Link href="/shop" className="inline-flex h-9 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[14px] tracking-[-0.014em] shadow-pill transition-shadow duration-200 hover:shadow-card">
      <ArrowLeft className="h-4 w-4" aria-hidden /> Shop
    </Link>
  );
}

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const { add } = useCart();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);

  if (isLoading) {
    return (
      <SiteShell>
        <Container className="pt-8 md:pt-12" >
          <div role="status" aria-busy="true" className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-[28px] bg-surface" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-full rounded-full" />
            </div>
            <span className="sr-only">Loading product…</span>
          </div>
        </Container>
      </SiteShell>
    );
  }

  if (isError) {
    return (
      <SiteShell>
        <Container className="pt-8"><LoadError onRetry={() => refetch()} message="We could not load this product. Please try again." /></Container>
      </SiteShell>
    );
  }

  const product = products.find(p => p.slug === slug || p.id === slug);
  if (!product) notFound();

  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 4);
  const fill = related.length < 4 ? products.filter(p => p.id !== product.id && !related.includes(p)).slice(0, 4 - related.length) : [];
  const more: Product[] = [...related, ...fill];

  const handleAdd = (p: Product, n = 1) => {
    add(p, n);
    toast(`${n > 1 ? `${n} × ` : ""}${p.name} added to your bag.`, "success");
  };

  return (
    <SiteShell>
      <Container className="pt-6 md:pt-10">
        <BackLink />

        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div className="rounded-[28px] bg-surface p-2 shadow-card">
            <ProductImage product={product} size="lg" label={product.badge} className="aspect-square w-full" />
          </div>

          <div className="lg:py-4">
            <p className="t-sub">{product.brand}</p>
            <h1 className="t-display mt-1">{product.name}</h1>
            <Stars rating={product.rating} count={product.reviews} className="mt-2" />
            <p className="mt-5 text-[20px] tracking-[-0.05em]">{formatNaira(product.priceNGN)}</p>

            {product.blurb && <p className="mt-5 text-[16px] text-muted">{product.blurb}</p>}

            {product.details.length > 0 && (
              <ul className="mt-5 space-y-2.5">
                {product.details.map(detail => (
                  <li key={detail} className="flex gap-3 text-[14px] tracking-[-0.014em]">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    {detail}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <div className="flex h-12 items-center gap-1 rounded-full border border-hairline bg-surface px-1.5 shadow-pill" role="group" aria-label="Quantity">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 hover:bg-canvas" aria-label="Decrease quantity">
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-8 text-center tabular-nums" aria-live="polite">{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 hover:bg-canvas" aria-label="Increase quantity">
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <Button size="lg" className="flex-1" onClick={() => handleAdd(product, qty)}>
                Add to bag · {formatNaira(product.priceNGN * qty)}
              </Button>
            </div>

            <p className="mt-4 flex items-center gap-2 text-[14px] tracking-[-0.014em] text-muted">
              <Truck className="h-4 w-4 shrink-0" aria-hidden />
              {deliveryFeeNGN(product.priceNGN * qty) === 0
                ? "Free delivery on this order."
                : `${formatNaira(1500)} delivery, free on orders of ${formatNaira(10000)} or more.`}
            </p>
          </div>
        </div>

        {more.length > 0 && (
          <section className="mt-16" aria-label="Pairs well with">
            <SectionHeader title="Pairs well with" href="/shop" />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {more.map(p => <ProductCard key={p.id} product={p} onAdd={handleAdd} />)}
            </div>
          </section>
        )}
      </Container>
    </SiteShell>
  );
}
