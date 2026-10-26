"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, ChevronRight, Plus, Search, Star } from "lucide-react";
import { type Artisan, type Product } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ── Product imagery ──────────────────────────────────────────
   The API has no image URL, so the product's own bg_color stands in for
   photography: a solid tile with the brand overlaid in white display type,
   the "dark product card" treatment. No gradients. */
export function ProductImage({
  product,
  className,
  label,
  size = "md",
  showBrand = true,
}: {
  product: Pick<Product, "brand" | "tint" | "category">;
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  showBrand?: boolean;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-[20px]", className)}
      style={{ backgroundColor: product.tint[0] }}
    >
      {size !== "sm" && showBrand && (
        <span
          className={cn(
            "absolute left-4 top-4 right-4 font-medium text-surface",
            size === "lg" ? "text-[32px] leading-[1.05] tracking-[-0.05em] sm:text-[40px]" : "text-[20px] leading-[1.1] tracking-[-0.05em]",
          )}
        >
          {product.brand}
        </span>
      )}
      {label && size !== "sm" && (
        <span className="absolute bottom-3 left-3 rounded-[12px] bg-surface/85 px-3 py-1.5 text-[14px] font-medium tracking-[-0.014em] text-ink">
          {label}
        </span>
      )}
    </div>
  );
}

export function Stars({ rating, count, tone = "ink", className }: { rating: number; count?: number; tone?: "ink" | "white"; className?: string }) {
  const full = Math.round(rating);
  return (
    <span
      className={cn("inline-flex items-center gap-1", tone === "white" ? "text-surface" : "text-ink", className)}
      aria-label={`Rated ${rating.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ""}`}
    >
      <span className="flex" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={cn("h-2.5 w-2.5", i < full ? "fill-current" : "opacity-30")} strokeWidth={1.5} />
        ))}
      </span>
      <span className="t-micro" aria-hidden>
        {rating.toFixed(1)}{count !== undefined ? ` (${count})` : ""}
      </span>
    </span>
  );
}

/* ── Brand spotlight / product card ───────────────────────────
   28px card around a 20px image: the 8px white frame is intentional. */
export function ProductCard({ product, onAdd }: { product: Product; onAdd?: (p: Product) => void }) {
  return (
    <article className="group flex flex-col rounded-[28px] bg-surface p-2 shadow-card transition-shadow duration-200 hover:shadow-float">
      <Link href={`/shop/${product.slug}`} className="block" aria-label={product.name}>
        <ProductImage product={product} label={product.badge} className="aspect-square w-full" />
      </Link>
      <div className="flex flex-1 flex-col px-2 pb-2 pt-3">
        <p className="t-sub">{product.brand}</p>
        <h3 className="mt-0.5 line-clamp-1 text-[14px] tracking-[-0.014em] text-muted">
          <Link href={`/shop/${product.slug}`} className="hover:text-ink">{product.name}</Link>
        </h3>
        <Stars rating={product.rating} count={product.reviews} className="mt-1.5" />
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <span className="t-body">{formatNaira(product.priceNGN)}</span>
          {onAdd && (
            <button
              onClick={() => onAdd(product)}
              aria-label={`Add ${product.name} to bag`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface shadow-pill transition-shadow duration-200 hover:shadow-card"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

/* ── Artisan tile: the image IS the card ── */
export function ArtisanCard({ artisan, className }: { artisan: Artisan; className?: string }) {
  return (
    <Link
      href={`/services/${artisan.slug}`}
      className={cn(
        "group relative flex aspect-[4/5] flex-col justify-between overflow-hidden rounded-[28px] p-4 text-surface shadow-card transition-shadow duration-200 hover:shadow-float",
        className,
      )}
      style={{ backgroundColor: artisan.tint[0] }}
    >
      <div>
        <h3 className="text-[24px] font-medium leading-[1.05] tracking-[-0.05em]">{artisan.name}</h3>
        <p className="mt-1 text-[14px] tracking-[-0.014em] opacity-85">{artisan.studio}</p>
        <Stars rating={artisan.rating} count={artisan.bookings} tone="white" className="mt-2" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <span className="rounded-[12px] bg-surface/85 px-3 py-1.5 text-[14px] font-medium tracking-[-0.014em] text-ink">
          {artisan.craft}
        </span>
        <span className="text-[14px] tracking-[-0.014em]">
          {artisan.city ? `${artisan.city} · ` : ""}from {formatNaira(artisan.fromNGN)}
        </span>
      </div>
    </Link>
  );
}

/* ── Horizontal rail with a right-edge carousel arrow ── */
export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  return (
    <div className="relative">
      <div
        ref={setEl}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label={`Scroll ${label}`}
        onClick={() => el?.scrollBy({ left: el.clientWidth * 0.8, behavior: "smooth" })}
        className="absolute right-0 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-float transition-transform duration-200 hover:scale-105 md:flex"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/* ── Category section header with chevron affordance ── */
export function SectionHeader({ title, href, action }: { title: string; href?: string; action?: React.ReactNode }) {
  const heading = (
    <span className="inline-flex items-center gap-1">
      <span className="t-display">{title}</span>
      {href && <ChevronRight className="h-4 w-4" aria-hidden />}
    </span>
  );
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <h2>{href ? <Link href={href} className="hover:opacity-70">{heading}</Link> : heading}</h2>
      {action}
    </div>
  );
}

/* ── Category pill: 16px colour dot + label ── */
export function CategoryPill({
  label,
  color,
  active,
  onClick,
  href,
}: {
  label: string;
  color?: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = cn(
    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 text-[16px] tracking-[-0.031em] shadow-pill transition-colors duration-200",
    active ? "border-ink bg-ink text-surface" : "border-hairline bg-surface text-ink hover:bg-canvas",
  );
  const dot = (
    <span
      className={cn("h-6 w-6 rounded-full", !color && "bg-canvas ring-1 ring-hairline")}
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden
    />
  );
  if (href) {
    return <Link href={href} className={cls}>{dot}{label}</Link>;
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {dot}
      {label}
    </button>
  );
}

/* ── Search input with the violet submit ── */
export function SearchBar({
  placeholder = "What are you shopping for today?",
  defaultValue = "",
  action = "/shop",
  param = "q",
  className,
}: {
  placeholder?: string;
  defaultValue?: string;
  action?: string;
  param?: string;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  return (
    <form
      role="search"
      onSubmit={e => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `${action}?${param}=${encodeURIComponent(q)}` : action);
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-full border border-black/10 bg-surface py-1 pl-5 pr-1 shadow-pill",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <label className="sr-only" htmlFor={`search-${action}`}>{placeholder}</label>
      <input
        id={`search-${action}`}
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-10 min-w-0 flex-1 bg-transparent text-[16px] tracking-[-0.031em] text-ink outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        aria-label="Search"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet text-surface shadow-violet transition-opacity duration-200 hover:opacity-90"
      >
        <ArrowRight className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
}
