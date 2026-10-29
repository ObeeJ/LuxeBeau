"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronLeft, Minus, Plus, ShieldCheck } from "lucide-react";
import SiteShell, { Container } from "@/components/site/shell";
import { Photo, ProductCard, Rating, SectionHeader } from "@/components/site/catalog";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/lib/queries";
import { deliveryFeeNGN } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  if (isLoading) {
    return (
      <SiteShell>
        <Container className="pt-8 md:pt-12">
          <div role="status" aria-busy="true" className="grid gap-8 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-[32px] bg-surface" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-1/4 rounded-full" />
              <Skeleton className="h-8 w-3/4 rounded-full" />
              <Skeleton className="h-24 w-full rounded-2xl" />
            </div>
            <span className="sr-only">Loading product</span>
          </div>
        </Container>
      </SiteShell>
    );
  }

  if (isError) {
    return (
      <SiteShell>
        <Container className="pt-8">
          <LoadError onRetry={() => refetch()} message="We couldn't load this product. Please try again." />
        </Container>
      </SiteShell>
    );
  }

  const product = products.find(p => p.slug === slug || p.id === slug);
  if (!product) notFound();

  const sameCategory = products.filter(p => p.category === product.category && p.id !== product.id);
  const more = [...sameCategory, ...products.filter(p => p.category !== product.category)].slice(0, 4);
  const soldOut = product.stock <= 0;
  const lineTotal = product.priceNGN * qty;

  return (
    <SiteShell>
      <Container className="pt-5 md:pt-8 pb-16">
        <Link href="/shop" className="lb-press inline-flex items-center gap-1 text-[14px] font-medium tracking-[-0.014em] text-muted hover:text-ink">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Back to Shop
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          <div className="aspect-square overflow-hidden rounded-[36px] bg-surface p-3 shadow-soft">
            <Photo src={product.imageUrl} alt={product.name} fallback={product.brand} sizes="lg" className="rounded-[28px]" />
          </div>

          <div className="lg:pt-2">
            <p className="text-[14px] font-semibold tracking-[-0.014em] text-muted">{product.brand}</p>
            <h1 className="t-hero text-[32px] sm:text-[40px] mt-1 text-ink">{product.name}</h1>
            <Rating rating={product.rating} count={product.reviews} className="mt-2" />

            <p className="mt-5 text-[24px] font-bold text-ink tracking-[-0.04em]">
              {formatNaira(product.priceNGN)}
            </p>

            {product.blurb && (
              <p className="mt-4 text-[16px] text-muted leading-relaxed">
                {product.blurb}
              </p>
            )}

            {/* Escrow Guarantee Highlight */}
            <div className="mt-6 flex items-center gap-2.5 rounded-2xl bg-brand-wash p-3.5 text-[13px] text-brand-deep">
              <ShieldCheck className="h-5 w-5 shrink-0 text-brand" />
              <span>
                <strong>Held in Escrow:</strong> Your money is protected. The seller is only paid after you inspect and accept your package.
              </span>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-12 shrink-0 items-center rounded-full border border-hairline bg-surface px-1.5 shadow-pill" role="group" aria-label="Quantity">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="lb-press flex h-9 w-9 items-center justify-center rounded-full hover:bg-canvas"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-8 text-center font-bold tabular-nums" aria-live="polite">{qty}</span>
                <button
                  onClick={() => setQty(q => Math.min(product.stock || 1, q + 1))}
                  className="lb-press flex h-9 w-9 items-center justify-center rounded-full hover:bg-canvas"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {added ? (
                <Button asChild size="lg" variant="outline" className="flex-1">
                  <Link href="/cart">
                    <Check aria-hidden className="text-brand" /> Added · View bag
                  </Link>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={soldOut}
                  onClick={() => {
                    add(product, qty);
                    setAdded(true);
                  }}
                >
                  {soldOut ? "Sold out" : `Add to bag · ${formatNaira(lineTotal)}`}
                </Button>
              )}
            </div>

            <p className="mt-3 text-[12px] tracking-[-0.017em] text-muted">
              {deliveryFeeNGN(lineTotal) === 0
                ? "Free delivery on this order."
                : `${formatNaira(1500)} delivery across Nigeria. Free on orders of ${formatNaira(10000)} or more.`}
              {product.stock > 0 && product.stock <= 10 ? ` Only ${product.stock} left in stock.` : ""}
            </p>

            {product.details.length > 0 && (
              <section className="mt-8 border-t border-hairline pt-6" aria-label="Details">
                <h2 className="t-sub font-bold">Product highlights</h2>
                <ul className="mt-3 space-y-2">
                  {product.details.map(detail => (
                    <li key={detail} className="flex gap-2.5 text-[14px] text-muted tracking-[-0.014em]">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                      {detail}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {more.length > 0 && (
          <section className="mt-20 border-t border-hairline pt-10" aria-label="You may also like">
            <SectionHeader title="You may also like" href="/shop" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {more.map(p => <ProductCard key={p.id} product={p} onAdd={add} />)}
            </div>
          </section>
        )}
      </Container>
    </SiteShell>
  );
}
