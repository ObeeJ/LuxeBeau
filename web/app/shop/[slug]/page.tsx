"use client";

import { use, useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus, Plus, ShieldCheck, Star, Truck } from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/lib/queries";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/slide-in-notifications";

export default function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data: products = [], isLoading, isError, refetch } = useProducts();
  const { add } = useCart();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);

  if (isLoading) {
    return (
      <div className="min-h-dvh">
        <SiteNav />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6" aria-busy="true" role="status">
          <Skeleton className="h-4 w-24 bg-velvet-800/60" />
          <div className="mt-8 grid gap-12 lg:grid-cols-2">
            <Skeleton className="min-h-[24rem] rounded-3xl bg-velvet-800/60" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-3/4 bg-velvet-800/60" />
              <Skeleton className="h-4 w-1/2 bg-velvet-800/60" />
              <Skeleton className="h-24 w-full bg-velvet-800/60" />
              <Skeleton className="h-12 w-full bg-velvet-800/60" />
            </div>
          </div>
          <span className="sr-only">Loading product…</span>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-dvh">
        <SiteNav />
        <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
          <LoadError onRetry={() => refetch()} message="We could not load this product. Please try again." />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const product = products.find(p => p.slug === slug || p.id === slug);
  if (!product) notFound();

  const related = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3);

  return (
    <div className="min-h-dvh">
      <SiteNav />

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <Link href="/shop" className="inline-flex items-center gap-2 text-sm text-lavender-400 transition-colors hover:text-gold-300">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to shop
        </Link>

        <div className="mt-8 grid gap-12 lg:grid-cols-2">
          {/* Visual */}
          <div
            className="flex min-h-[24rem] items-center justify-center rounded-3xl p-10"
            style={{ background: `linear-gradient(150deg, ${product.tint[0]}, ${product.tint[1]})` }}
          >
            <div className="text-center">
              <p className="font-display text-4xl font-semibold italic text-white/90">{product.brand}</p>
              <p className="mt-2 text-sm uppercase tracking-[0.3em] text-white/60">{product.category}</p>
            </div>
          </div>

          {/* Details */}
          <div>
            {product.badge && (
              <span className="rounded-full border border-gold-400/60 px-3 py-1 text-xs font-semibold text-gold-300">
                {product.badge}
              </span>
            )}
            <h1 className="mt-4 font-display text-3xl font-medium leading-tight sm:text-4xl">{product.name}</h1>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1 text-gold-300">
                <Star className="h-4 w-4 fill-current" aria-hidden /> {product.rating}
              </span>
              <span className="text-lavender-400">· {product.reviews} verified reviews</span>
            </div>
            {product.blurb && <p className="mt-6 text-lg leading-relaxed text-lavender-200">{product.blurb}</p>}

            {product.details.length > 0 && (
              <ul className="mt-6 space-y-3">
                {product.details.map(detail => (
                  <li key={detail} className="flex gap-3 text-sm text-lavender-200">
                    <Check className="h-4 w-4 shrink-0 text-gold-400" aria-hidden />
                    {detail}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 flex items-end justify-between border-t border-velvet-700/60 pt-6">
              <div>
                <p className="text-sm text-lavender-400">Price</p>
                <p className="font-display text-3xl font-semibold text-gold-300">{formatNaira(product.priceNGN)}</p>
              </div>
              <div className="flex items-center gap-3" role="group" aria-label="Quantity">
                <button
                  onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="rounded-full border border-velvet-700 p-2.5 transition-colors hover:border-royal-400/60"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </button>
                <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
                <button
                  onClick={() => setQty(q => q + 1)}
                  className="rounded-full border border-velvet-700 p-2.5 transition-colors hover:border-royal-400/60"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                add(product, qty);
                toast(`${qty} × ${product.name} added to your bag. Ready to glow?`, "success");
              }}
              className="mt-6 w-full rounded-full bg-royal-500 py-4 text-sm font-semibold transition-colors duration-200 hover:bg-royal-400"
            >
              Add {qty > 1 ? `${qty} ` : ""}to bag, {formatNaira(product.priceNGN * qty)}
            </button>

            <div className="mt-6 grid gap-3 text-sm text-lavender-400 sm:grid-cols-2">
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gold-400" aria-hidden /> Lagos same-day · nationwide 1 to 4 days
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-gold-400" aria-hidden /> Paystack buyer protection
              </span>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="font-display text-2xl font-medium">Pairs well with</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map(rel => (
                <Link key={rel.id} href={`/shop/${rel.slug}`} className="card-velvet group overflow-hidden rounded-3xl transition-colors duration-300 hover:border-royal-400/60">
                  <div
                    className="flex h-36 items-end p-5"
                    style={{ background: `linear-gradient(140deg, ${rel.tint[0]}, ${rel.tint[1]})` }}
                  >
                    <span className="font-display text-lg font-semibold italic text-white/90">{rel.brand}</span>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display font-semibold leading-snug group-hover:text-gold-300">{rel.name}</h3>
                    <p className="mt-2 font-display text-lg font-semibold text-gold-300">{formatNaira(rel.priceNGN)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
