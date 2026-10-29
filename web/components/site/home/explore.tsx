"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Photo, tintArt } from "@/components/site/catalog";
import { ArrowUpRight } from "@/components/icons";
import { categoryTint } from "@/lib/category-tint";
import { ARTISAN_COVER, categoryPhotos } from "@/lib/photos";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/motion";
import { type Product } from "@/lib/api";

const EDIT_BACKDROPS = [
  "linear-gradient(150deg,#b65ae8,#3b0a5c)",
  "linear-gradient(150deg,#5a3a2a,#12041f)",
  "linear-gradient(150deg,#e86a92,#8a1fc7)",
];

/* The category's photos fill the card edge to edge and cross-fade every
   4.5s, each card a little behind the last. */
function PhotoCycle({ photos, offset }: { photos: string[]; offset: number }) {
  const reduced = usePrefersReducedMotion();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (reduced || photos.length < 2) return;
    let every: ReturnType<typeof setInterval>;
    const start = setTimeout(() => {
      every = setInterval(() => setCurrent(n => (n + 1) % photos.length), 4500);
    }, offset * 900);
    return () => {
      clearTimeout(start);
      clearInterval(every);
    };
  }, [reduced, photos.length, offset]);

  return (
    <>
      {photos.map((src, k) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-[1100ms] ease-out group-hover:scale-105",
            k === current ? "scale-100 opacity-100" : "scale-[1.06] opacity-0",
          )}
        />
      ))}
    </>
  );
}

export interface EditGroup {
  title: string;
  category: string;
  products: Product[];
}

/* Explore's three large cards: one per busiest category, built from real products. */
export function EditCards({ groups }: { groups: EditGroup[] }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
      {groups.map((g, i) => {
        const photos = categoryPhotos(g.category);
        const count = g.products.length;
        return (
          <Link
            key={g.category}
            href={`/shop?category=${encodeURIComponent(g.category)}`}
            className="lb-press group relative block h-[280px] overflow-hidden rounded-[32px] text-surface sm:h-[360px]"
            style={{ background: EDIT_BACKDROPS[i % EDIT_BACKDROPS.length] }}
          >
            <PhotoCycle photos={photos} offset={i} />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
            <span className="absolute left-4 top-4 rounded-full bg-surface/90 px-3 py-1.5 text-[12px] font-semibold text-ink shadow-pill">
              {g.category}
            </span>
            <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3">
              <h3 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[28px]">
                {g.title}
                <small className="mt-1.5 block text-[13px] font-medium tracking-normal opacity-85">
                  {count} {count === 1 ? "product" : "products"}
                </small>
              </h3>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-float transition-transform duration-200 group-hover:translate-x-1">
                <ArrowUpRight className="h-5 w-5" aria-hidden />
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export interface CategoryEntry {
  name: string;
  image?: string;
}

/* "Browse categories": square art tiles, product photo when there is one. */
export function CategoryGrid({ categories }: { categories: CategoryEntry[] }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
      {[...categories, { name: "Book an artisan" }].map(c => {
        const book = c.name === "Book an artisan";
        const tint = categoryTint(book ? "artisans" : c.name);
        return (
          <Link
            key={c.name}
            href={book ? "/services" : `/shop?category=${encodeURIComponent(c.name)}`}
            className="lb-press group rounded-[24px] bg-surface p-3.5 shadow-[0_2px_12px_rgba(42,11,72,.04)]"
          >
            <div className="relative aspect-square overflow-hidden rounded-2xl">
              <div className="absolute inset-0 transition-transform duration-300 ease-in-out group-hover:scale-[1.06]" style={!(book || c.image) ? { background: tintArt(tint) } : undefined}>
                {(book || c.image) && <Photo src={book ? ARTISAN_COVER : c.image} alt="" fallback={c.name} sizes="sm" className="rounded-none" />}
              </div>
            </div>
            <b className="mt-2.5 block text-[14px] font-semibold tracking-[-0.014em]">{c.name}</b>
          </Link>
        );
      })}
    </div>
  );
}
