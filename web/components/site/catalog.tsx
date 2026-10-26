"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronRight, Plus, Search, Star } from "lucide-react";
import { type Artisan, type Product } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ── Photography ───────────────────────────────────────────────
   Product and artisan photos come from Cloudflare Images. Until a seller
   uploads one, a quiet neutral tile stands in: no colour, no fake art. */
export function Photo({
  src,
  alt,
  fallback,
  className,
  sizes = "md",
}: {
  src?: string;
  alt: string;
  fallback: string;
  className?: string;
  sizes?: "sm" | "md" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      // Cloudflare Images already resizes per variant; next/image would add
      // a second optimisation layer we do not need.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={cn("block h-full w-full rounded-[20px] bg-canvas object-cover", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      className={cn("flex h-full w-full items-center justify-center rounded-[20px] bg-canvas p-3 text-center", className)}
    >
      {sizes !== "sm" && (
        <span className={cn("text-muted", sizes === "lg" ? "text-[20px] tracking-[-0.05em]" : "text-[14px] tracking-[-0.014em]")}>
          {fallback}
        </span>
      )}
    </div>
  );
}

/* Round profile picture: the photo, or initials on white when there is none. */
export function Avatar({ src, name, className }: { src?: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface ring-1 ring-hairline", className)}>
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-[0.38em] tracking-[-0.02em] text-ink" aria-label={name}>{initials}</span>
      )}
    </span>
  );
}

export function Rating({ rating, count, className }: { rating: number; count?: number; className?: string }) {
  if (!rating) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-[12px] tracking-[-0.017em] text-muted", className)}
      aria-label={`Rated ${rating.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <Star className="h-3 w-3 fill-ink text-ink" strokeWidth={0} aria-hidden />
      <span aria-hidden>
        <span className="text-ink">{rating.toFixed(1)}</span>
        {count ? ` (${count.toLocaleString("en-NG")})` : ""}
      </span>
    </span>
  );
}

/* ── Product card ──────────────────────────────────────────────
   28px card, 20px image inset by 8px. Quick add confirms in place. */
export function ProductCard({ product, onAdd }: { product: Product; onAdd?: (p: Product) => void }) {
  const [added, setAdded] = useState(false);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

  const soldOut = product.stock <= 0;

  return (
    <article className="group relative flex flex-col rounded-[28px] bg-surface p-2 shadow-card transition-shadow duration-200 hover:shadow-float">
      <Link href={`/shop/${product.slug}`} className="relative block aspect-square" tabIndex={-1} aria-hidden>
        <Photo src={product.imageUrl} alt={product.name} fallback={product.brand} />
        {product.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2.5 py-1 text-[12px] tracking-[-0.017em]">{product.badge}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3">
        <p className="t-meta truncate font-normal text-muted">{product.brand}</p>
        <h3 className="mt-0.5 line-clamp-2 text-[14px] leading-[1.3] tracking-[-0.014em]">
          <Link href={`/shop/${product.slug}`} className="after:absolute after:inset-0 group-hover:underline group-hover:underline-offset-2">
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div>
            <p className="text-[16px] tracking-[-0.031em]">{formatNaira(product.priceNGN)}</p>
            <Rating rating={product.rating} count={product.reviews} />
          </div>
          {onAdd && (
            <button
              disabled={soldOut}
              onClick={e => {
                e.stopPropagation();
                onAdd(product);
                setAdded(true);
              }}
              aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to bag`}
              className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hairline bg-surface shadow-pill transition-colors duration-200 hover:bg-canvas disabled:opacity-40"
            >
              {added ? <Check className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function visitLabel(mode: Artisan["serviceMode"]) {
  return mode === "both" ? "Studio or home" : mode === "home" ? "Comes to you" : "In studio";
}

/* ── Artisan card ── */
export function ArtisanCard({ artisan, className }: { artisan: Artisan; className?: string }) {
  return (
    <Link
      href={`/services/${artisan.slug}`}
      className={cn(
        "group flex flex-col rounded-[28px] bg-surface p-2 shadow-card transition-shadow duration-200 hover:shadow-float",
        className,
      )}
    >
      <div className="aspect-[4/3]">
        <Photo src={artisan.imageUrl} alt={artisan.name} fallback={artisan.craft || artisan.name} />
      </div>
      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="t-sub group-hover:underline group-hover:underline-offset-2">{artisan.name}</h3>
          <Rating rating={artisan.rating} count={artisan.bookings} className="shrink-0" />
        </div>
        <p className="text-[14px] tracking-[-0.014em] text-muted">{artisan.craft}</p>
        <p className="mt-2 truncate text-[12px] tracking-[-0.017em] text-muted">
          {[artisan.area, artisan.city].filter(Boolean).join(", ")} · {visitLabel(artisan.serviceMode)}
        </p>
        <p className="mt-auto pt-2 text-[14px] tracking-[-0.014em]">From {formatNaira(artisan.fromNGN)}</p>
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
        className="absolute -right-3 top-[38%] hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-float transition-transform duration-200 hover:scale-105 lg:flex"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

/* ── Section header with chevron affordance ── */
export function SectionHeader({ title, href, action }: { title: string; href?: string; action?: React.ReactNode }) {
  const heading = (
    <span className="inline-flex items-center gap-1">
      <span className="t-display">{title}</span>
      {href && <ChevronRight className="h-4 w-4" aria-hidden />}
    </span>
  );
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2>{href ? <Link href={href} className="hover:opacity-70">{heading}</Link> : heading}</h2>
      {action}
    </div>
  );
}

/* ── Category pill: a small round product photo when one exists ── */
export function CategoryPill({
  label,
  image,
  active,
  onClick,
  href,
}: {
  label: string;
  image?: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = cn(
    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border text-[14px] tracking-[-0.014em] shadow-pill transition-colors duration-200",
    image ? "pl-1.5 pr-4" : "px-4",
    active ? "border-ink bg-ink text-surface" : "border-hairline bg-surface text-ink hover:bg-canvas",
  );
  const icon = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className="h-6 w-6 rounded-full object-cover" loading="lazy" />
  ) : null;
  if (href) return <Link href={href} className={cls}>{icon}{label}</Link>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {icon}
      {label}
    </button>
  );
}

/* ── Search input with the violet submit ── */
export function SearchBar({
  placeholder = "Search products and brands",
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
  const id = `search${action.replace(/\W/g, "-")}`;

  return (
    <form
      role="search"
      onSubmit={e => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `${action}?${param}=${encodeURIComponent(q)}` : action);
      }}
      className={cn("flex w-full items-center gap-2 rounded-full border border-black/10 bg-surface py-1 pl-5 pr-1 shadow-pill", className)}
    >
      <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      <label className="sr-only" htmlFor={id}>{placeholder}</label>
      <input
        id={id}
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
