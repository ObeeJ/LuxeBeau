"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Heart, ScanLine, Search, Star } from "@/components/icons";
import { type Artisan, type Product } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ScanDialog } from "@/components/site/scan-dialog";

/* ── Photography ───────────────────────────────────────────────
   Product and artisan photos come from Cloudflare Images. Until a seller
   uploads one, a quiet neutral tile stands in: no colour, no fake art. */
/* Tinted art: the product's own two colours as a soft radial wash. */
export const tintArt = (tint: [string, string]) =>
  `radial-gradient(circle at 50% 38%, ${tint[1]}, ${tint[0]} 72%)`;

export function Photo({
  src,
  alt,
  fallback,
  className,
  sizes = "md",
  tint,
}: {
  src?: string;
  alt: string;
  fallback: string;
  className?: string;
  sizes?: "sm" | "md" | "lg";
  tint?: [string, string];
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
        className={cn("block h-full w-full rounded-[20px] bg-canvas object-cover transition-transform duration-200 group-hover:scale-[1.04]", className)}
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={alt}
      style={tint ? { background: tintArt(tint) } : undefined}
      className={cn("flex h-full w-full items-center justify-center rounded-[20px] bg-canvas p-3 text-center transition-transform duration-200 group-hover:scale-[1.04]", className)}
    >
      {sizes !== "sm" && !tint && (
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
      <Star className="h-3 w-3 fill-brand text-brand" strokeWidth={0} aria-hidden />
      <span aria-hidden>
        <span className="font-semibold text-ink">{rating.toFixed(1)}</span>
        {count ? ` (${count.toLocaleString("en-NG")})` : ""}
      </span>
    </span>
  );
}

/* ── Product card ──────────────────────────────────────────────
   28px card, 20px image inset by 8px. Quick add confirms in place. */
export function ProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd?: (p: Product) => void;
}) {
  const [added, setAdded] = useState(false);
  const [favourite, setFavourite] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1600);
    return () => clearTimeout(t);
  }, [added]);

  const soldOut = product.stock <= 0;

  return (
    <article className="group relative flex flex-col">
      <div className="relative block aspect-square overflow-hidden rounded-[22px] bg-[#f2f2f2]">
        <Link href={`/shop/${product.slug}`} tabIndex={-1} aria-hidden className="block h-full w-full">
          <Photo src={product.imageUrl} alt={product.name} fallback={product.brand} tint={product.tint} className="rounded-[22px]" />
        </Link>

        {/* Add: always visible on phones, slides in over the photo on hover elsewhere; purple once added. */}
        <button
          type="button"
          disabled={soldOut}
          onClick={(e) => {
            e.stopPropagation();
            if (soldOut) return;
            if (onAdd) onAdd(product);
            setAdded(true);
          }}
          aria-label={soldOut ? `${product.name} is sold out` : `Add ${product.name} to bag`}
          className={cn(
            "lb-press absolute bottom-2 right-2 z-10 flex h-[34px] items-center justify-center rounded-full px-3.5 text-[13px] font-semibold shadow-float transition-all duration-200",
            added
              ? "bg-brand text-surface opacity-100"
              : cn(
                  "bg-surface opacity-100 sm:translate-y-1.5 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:focus-visible:translate-y-0 sm:focus-visible:opacity-100",
                  soldOut ? "cursor-not-allowed text-muted" : "text-ink",
                ),
          )}
        >
          {added ? (
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" aria-hidden /> Added</span>
          ) : soldOut ? (
            "Sold out"
          ) : (
            "Add"
          )}
        </button>

        {product.badge && (
          <span className="absolute left-2 top-2 rounded-full bg-surface/90 px-2.5 py-1 text-[12px] font-medium tracking-[-0.017em] shadow-pill">
            {product.badge}
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFavourite(!favourite);
          }}
          aria-label={favourite ? "Remove from favourites" : "Save to favourites"}
          aria-pressed={favourite}
          className={cn(
            "lb-press absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 shadow-pill transition-all duration-150 sm:opacity-0 sm:group-hover:opacity-100",
            favourite && "opacity-100",
          )}
        >
          <Heart
            className={cn(
              "h-4 w-4 transition-colors",
              favourite ? "lb-pop fill-brand text-brand" : "text-muted hover:text-ink",
            )}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col pt-3">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[12px] font-medium tracking-[-0.017em] text-muted">{product.brand}</p>
          <Rating rating={product.rating} count={product.reviews} className="shrink-0 text-ink" />
        </div>
        <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-[1.25] tracking-[-0.02em]">
          <Link href={`/shop/${product.slug}`} className="after:absolute after:inset-0 hover:underline hover:underline-offset-2">
            {product.name}
          </Link>
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-[17px] font-extrabold tracking-[-0.035em]">{formatNaira(product.priceNGN)}</p>
          {!soldOut && product.stock <= 5 && (
            <span className="shrink-0 rounded-full bg-brand-wash px-2 py-0.5 text-[11px] font-semibold text-brand-deep">
              Only {product.stock} left
            </span>
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
        "lb-press group flex flex-col rounded-[28px] bg-surface p-2 shadow-card transition-all duration-200 hover:shadow-float",
        className,
      )}
    >
      <div className="aspect-[4/3] overflow-hidden rounded-[20px]">
        <Photo src={artisan.imageUrl} alt={artisan.name} fallback={artisan.craft || artisan.name} />
      </div>
      <div className="flex flex-1 flex-col px-2 pb-1.5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="t-sub font-semibold group-hover:underline group-hover:underline-offset-2">{artisan.name}</h3>
          <Rating rating={artisan.rating} count={artisan.bookings} className="shrink-0" />
        </div>
        <p className="text-[14px] tracking-[-0.014em] text-muted">{artisan.craft}</p>
        <p className="mt-2 truncate text-[12px] tracking-[-0.017em] text-muted">
          {[artisan.area, artisan.city].filter(Boolean).join(", ")} · {visitLabel(artisan.serviceMode)}
        </p>
        <p className="mt-auto pt-2 text-[14px] font-bold tracking-[-0.014em]">From {formatNaira(artisan.fromNGN)}</p>
      </div>
    </Link>
  );
}

/* ── Horizontal product / generic rail with scroll arrows ── */
export function ProductRail({
  children,
  label,
  className,
}: {
  children: React.ReactNode;
  label: string;
  className?: string;
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  const scroll = (direction: "left" | "right") => {
    if (!el) return;
    const offset = el.clientWidth * 0.75 * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <div className={cn("group/rail relative", className)}>
      <div
        ref={setEl}
        role="region"
        aria-label={label}
        tabIndex={0}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
      >
        {children}
      </div>

      <button
        type="button"
        aria-label={`Scroll ${label} backward`}
        onClick={() => scroll("left")}
        className="lb-press absolute -left-3 top-[40%] z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-float transition-all duration-200 hover:scale-105 group-hover/rail:flex"
      >
        <ChevronLeft className="h-5 w-5 text-ink" aria-hidden />
      </button>

      <button
        type="button"
        aria-label={`Scroll ${label} forward`}
        onClick={() => scroll("right")}
        className="lb-press absolute -right-3 top-[40%] z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface shadow-float transition-all duration-200 hover:scale-105 group-hover/rail:flex"
      >
        <ChevronRight className="h-5 w-5 text-ink" aria-hidden />
      </button>
    </div>
  );
}

export const Rail = ProductRail;

/* ── Store card (large merchant card) ── */
export function StoreCard({
  name,
  subtitle,
  logoUrl,
  coverUrl,
  products = [],
  href = "/shop",
}: {
  name: string;
  subtitle: string;
  logoUrl?: string;
  coverUrl?: string;
  products?: Product[];
  href?: string;
}) {
  return (
    <Link
      href={href}
      className="lb-press group flex flex-col overflow-hidden rounded-[28px] bg-surface shadow-card transition-all duration-200 hover:shadow-float"
    >
      <div
        className="relative h-[170px] overflow-hidden bg-gradient-to-tr from-brand-deep/30 to-brand-wash"
        style={!coverUrl && products[0] ? { background: `linear-gradient(135deg, ${products[0].tint[1]}, ${products[0].tint[0]})` } : undefined}
      >
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-center gap-3 text-surface">
          <Avatar src={logoUrl} name={name} className="h-10 w-10 ring-2 ring-surface" />
          <div className="min-w-0">
            <h4 className="truncate text-[16px] font-bold leading-tight">{name}</h4>
            <p className="truncate text-[12px] opacity-85">{subtitle}</p>
          </div>
        </div>
      </div>

      {products.length > 0 && (
        <div className={cn("grid gap-2 p-3", products.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
          {products.slice(0, 2).map((p, idx) => (
            <div key={p.id} className="overflow-hidden rounded-2xl bg-canvas p-1.5">
              <div
                className={cn(
                  products.length > 1 ? "aspect-square overflow-hidden rounded-xl" : "aspect-[2/1] overflow-hidden rounded-xl",
                  idx === 0 ? "group-hover:lb-float-a" : "group-hover:lb-float-b",
                )}
              >
                <Photo src={p.imageUrl} alt={p.name} fallback={p.brand} sizes="sm" tint={p.tint} />
              </div>
              <p className="mt-1.5 truncate text-[12px] font-semibold">{formatNaira(p.priceNGN)}</p>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}

/* ── Section header with chevron affordance ── */
export function SectionHeader({ title, href, action }: { title: string; href?: string; action?: React.ReactNode }) {
  const heading = (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[22px] font-bold tracking-[-0.03em]">{title}</span>
      {href && <ChevronRight className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </span>
  );
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2>{href ? <Link href={href} className="group hover:opacity-80">{heading}</Link> : heading}</h2>
      {action}
    </div>
  );
}

/* ── Category pill: a small round product photo when one exists ── */
export function CategoryPill({
  label,
  image,
  tint,
  active,
  onClick,
  href,
}: {
  label: string;
  image?: string;
  /** Two colours for the round swatch when there is no photo. */
  tint?: [string, string];
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const hasIcon = Boolean(image || tint);
  const cls = cn(
    "lb-press group inline-flex h-10 shrink-0 items-center gap-2.5 rounded-full text-[14px] font-medium tracking-[-0.014em] transition-all duration-150",
    hasIcon ? "pr-3" : "px-3",
    active ? "text-brand" : "text-ink",
  );
  const swatch = "h-8 w-8 rounded-full object-cover transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:rotate-[-8deg] group-hover:scale-[1.12]";
  const icon = image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" className={swatch} loading="lazy" />
  ) : tint ? (
    <span aria-hidden className={swatch} style={{ background: `radial-gradient(circle at 40% 35%, ${tint[1]}, ${tint[0]})` }} />
  ) : null;
  if (href) return <Link href={href} className={cls}>{icon}{label}</Link>;
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cls}>
      {icon}
      {label}
    </button>
  );
}

/* ── Search input with Scan affordance and submit button ── */
export function SearchBar({
  placeholder = "Search products and brands",
  defaultValue = "",
  action = "/shop",
  param = "q",
  className,
  onScan,
}: {
  placeholder?: string;
  defaultValue?: string;
  action?: string;
  param?: string;
  className?: string;
  onScan?: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [scanOpen, setScanOpen] = useState(false);
  const id = `search${action.replace(/\W/g, "-")}`;

  return (
    <>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = value.trim();
          router.push(q ? `${action}?${param}=${encodeURIComponent(q)}` : action);
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-full border border-black/10 bg-surface py-1 pl-5 pr-1.5 shadow-soft transition-all duration-200 focus-within:shadow-float focus-within:border-brand/40",
          className,
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <label className="sr-only" htmlFor={id}>{placeholder}</label>
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="h-10 min-w-0 flex-1 bg-transparent text-[16px] tracking-[-0.031em] text-ink outline-none placeholder:text-muted"
        />

        <button
          type="button"
          onClick={() => {
            if (onScan) onScan();
            setScanOpen(true);
          }}
          aria-label="Scan a product to search"
          title="Scan a product"
          className="lb-press lb-scan-btn relative flex h-10 items-center gap-1.5 overflow-hidden rounded-full bg-brand-wash pl-3 pr-3.5 text-[14px] font-semibold text-brand-deep hover:bg-brand-wash/80"
        >
          <ScanLine className="h-5 w-5" strokeWidth={2.2} aria-hidden />
          <i aria-hidden className="lb-scan-line pointer-events-none absolute left-3 top-1/2 h-0.5 w-5 rounded bg-brand opacity-0" />
          <span className="hidden sm:inline">Scan</span>
        </button>

        <button
          type="submit"
          aria-label="Search"
          className="lb-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-surface shadow-glow transition-opacity hover:opacity-90"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </form>

      <ScanDialog open={scanOpen} onOpenChange={setScanOpen} />
    </>
  );
}
