"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  Clock,
  MapPin,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from "@/components/icons";
import { ProductCard } from "@/components/site/catalog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicStorefront } from "@/lib/queries";
import { useCart } from "@/lib/store";
import { formatNaira } from "@/lib/format";
import { toProduct } from "@/lib/api";

export default function PublicStorefrontPage() {
  const params = useParams();
  const router = useRouter();
  const handle = typeof params?.handle === "string" ? params.handle : "";
  const { data, isLoading, isError } = usePublicStorefront(handle);
  const { count: cartCount } = useCart();

  // Redirect if handle was renamed (301 history mapping)
  useEffect(() => {
    if (data?.redirect_handle) {
      router.replace(`/s/${data.redirect_handle}`);
    }
  }, [data, router]);

  const sf = data?.storefront;
  const owner = data?.owner;
  const isOwner = Boolean(data?.is_owner);

  // Products transformed to the format expected by ProductCard
  const products = useMemo(() => {
    return (data?.products || []).map(toProduct);
  }, [data?.products]);

  const artisan = data?.artisan;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface px-4 py-12 max-w-6xl mx-auto space-y-8">
        <Skeleton className="h-48 w-full rounded-[32px]" />
        <div className="flex gap-4 items-center">
          <Skeleton className="h-20 w-20 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 rounded-[24px]" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || (!sf && !data?.redirect_handle)) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted/20 flex items-center justify-center text-muted mb-4">
          <Store className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Storefront Not Found</h1>
        <p className="mt-2 text-sm text-muted max-w-md">
          The storefront you are looking for does not exist, has been claimed by another brand, or is currently in draft mode.
        </p>
        <Link href="/" className="mt-6">
          <Button variant="outline" className="rounded-full">
            Back to LuxeBeau
          </Button>
        </Link>
      </div>
    );
  }

  if (!sf) return null;

  const accent = sf.accent_hex || "#C5A880";
  const onAccent = sf.on_accent_hex || "#000000";
  const soft = sf.soft_hex || "#DFCDAF";
  const deep = sf.deep_hex || "#8F724D";

  const template = sf.template_id || "editorial";

  return (
    <div
      className="min-h-screen flex flex-col bg-surface transition-colors"
      style={
        {
          "--sf-accent": accent,
          "--sf-on-accent": onAccent,
          "--sf-soft": soft,
          "--sf-deep": deep,
        } as React.CSSProperties
      }
    >
      {/* ── Minimal Brand Nav ── */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-surface/90 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            {sf.logo_url ? (
              <img
                src={sf.logo_url}
                alt={owner?.name || sf.handle}
                className="h-9 w-9 rounded-xl object-cover shadow-sm border border-border/40"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center font-black text-sm shadow-sm"
                style={{ backgroundColor: accent, color: onAccent }}
              >
                {owner?.name?.slice(0, 1).toUpperCase() || "B"}
              </div>
            )}
            <span className="font-extrabold tracking-tight text-base sm:text-lg">
              {owner?.name || sf.handle}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {isOwner && (
              <Link href="/dashboard/seller">
                <span className="hidden sm:inline-flex rounded-full bg-brand/10 text-brand px-3 py-1 text-xs font-semibold">
                  Storefront Owner (Edit)
                </span>
              </Link>
            )}
            <Link
              href="/cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-surface/80 hover:bg-muted/20 transition-all text-foreground"
              aria-label="View Shopping Bag"
            >
              <ShoppingBag className="h-4 w-4" />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black"
                  style={{ backgroundColor: accent, color: onAccent }}
                >
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ── Storefront Body (Rendered by Template) ── */}
      <main className="flex-1">
        {template === "editorial" && (
          <EditorialTemplate sf={sf} owner={owner} products={products} accent={accent} onAccent={onAccent} />
        )}
        {template === "split" && (
          <SplitTemplate sf={sf} owner={owner} products={products} accent={accent} onAccent={onAccent} />
        )}
        {template === "minimal" && (
          <MinimalTemplate sf={sf} owner={owner} products={products} accent={accent} onAccent={onAccent} />
        )}
        {template === "hero" && (
          <HeroTemplate sf={sf} owner={owner} products={products} accent={accent} onAccent={onAccent} />
        )}
        {template === "studio" && (
          <StudioTemplate sf={sf} owner={owner} artisan={artisan} accent={accent} onAccent={onAccent} />
        )}
      </main>

      {/* ── Brand Trust Footer (Mandatory in Phase 1) ── */}
      <footer className="mt-auto border-t border-border/40 bg-surface/60 py-8 px-4 text-center">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span>Escrow protected · Verified merchant payment guarantee</span>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium hover:text-foreground transition-colors"
          >
            Powered by <strong className="font-extrabold text-foreground">LuxeBeau</strong>
          </Link>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Template 1: Editorial (Magazine hero banner & product grid)
// ─────────────────────────────────────────────────────────────
function EditorialTemplate({ sf, owner, products, accent, onAccent }: any) {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero Banner */}
      <div
        className="relative min-h-[340px] sm:min-h-[420px] w-full bg-neutral-900 bg-cover bg-center flex items-end p-6 sm:p-12 overflow-hidden"
        style={{
          backgroundImage: sf.banner_url ? `url(${sf.banner_url})` : undefined,
          backgroundColor: !sf.banner_url ? accent : undefined,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
        <div className="relative max-w-3xl space-y-3 text-white">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-widest uppercase">
            {owner?.verified && (
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full">
                <BadgeCheck className="h-3.5 w-3.5 text-amber-300" /> Verified Merchant
              </span>
            )}
            {owner?.jurisdiction && <span>· {owner.jurisdiction}</span>}
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.08]">
            {owner?.name || sf.handle}
          </h1>
          {sf.bio && <p className="text-sm sm:text-base text-neutral-200 line-clamp-3 max-w-xl">{sf.bio}</p>}
        </div>
      </div>

      {/* Catalogue Grid */}
      <div className="mx-auto max-w-6xl px-4 sm:px-8 space-y-6">
        <div className="flex items-center justify-between border-b border-border/40 pb-4">
          <h2 className="text-lg font-bold tracking-tight">Collection ({products.length})</h2>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">No products are currently available in this collection.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Template 2: Split (Sticky brand sidebar & catalogue stream)
// ─────────────────────────────────────────────────────────────
function SplitTemplate({ sf, owner, products, accent, onAccent }: any) {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-8 py-8 sm:py-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Sticky Sidebar */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 space-y-6 rounded-[28px] border border-border/60 bg-surface/80 p-6 shadow-sm">
          {sf.banner_url && (
            <div
              className="h-28 w-full rounded-2xl bg-cover bg-center overflow-hidden"
              style={{ backgroundImage: `url(${sf.banner_url})` }}
            />
          )}

          <div className="flex items-center gap-3">
            {sf.logo_url && (
              <img
                src={sf.logo_url}
                alt={owner?.name}
                className="h-16 w-16 rounded-2xl object-cover border border-border/60 shadow-sm"
              />
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{owner?.name || sf.handle}</h1>
              {owner?.verified && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" /> Verified Brand
                </span>
              )}
            </div>
          </div>

          {sf.bio && <p className="text-xs sm:text-sm text-muted leading-relaxed">{sf.bio}</p>}

          <div className="pt-4 border-t border-border/40 text-xs text-muted space-y-2">
            {owner?.jurisdiction && (
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                <span>Operating from {owner.jurisdiction}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" style={{ color: accent }} />
              <span>{products.length} Products Curated</span>
            </div>
          </div>
        </aside>

        {/* Right Product Grid */}
        <div className="lg:col-span-8 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {products.map((p: any) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Template 3: Minimal (Centered clean mark & catalog-first)
// ─────────────────────────────────────────────────────────────
function MinimalTemplate({ sf, owner, products, accent, onAccent }: any) {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-12 sm:py-16 space-y-12 text-center">
      <div className="max-w-md mx-auto space-y-4">
        {sf.logo_url ? (
          <img
            src={sf.logo_url}
            alt={owner?.name}
            className="h-20 w-20 mx-auto rounded-3xl object-cover shadow-md border border-border/60"
          />
        ) : (
          <div
            className="h-16 w-16 mx-auto rounded-3xl flex items-center justify-center font-extrabold text-2xl shadow-md"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            {owner?.name?.slice(0, 1).toUpperCase() || "B"}
          </div>
        )}

        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{owner?.name || sf.handle}</h1>
          {owner?.verified && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified
            </span>
          )}
        </div>

        {sf.bio && <p className="text-xs sm:text-sm text-muted">{sf.bio}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 text-left">
        {products.map((p: any) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Template 4: Hero (High impact headline banner + CTA)
// ─────────────────────────────────────────────────────────────
function HeroTemplate({ sf, owner, products, accent, onAccent }: any) {
  return (
    <div className="space-y-12 pb-16">
      <div
        className="px-6 py-16 sm:py-24 text-center rounded-b-[40px] shadow-sm relative overflow-hidden"
        style={{
          backgroundColor: accent,
          color: onAccent,
        }}
      >
        <div className="relative mx-auto max-w-2xl space-y-4">
          <h1 className="text-3xl sm:text-6xl font-black tracking-tight leading-[1.05]">
            {owner?.name || sf.handle}
          </h1>
          {sf.bio && <p className="text-sm sm:text-base opacity-90 max-w-lg mx-auto">{sf.bio}</p>}
          <div className="pt-2">
            <a href="#catalogue">
              <button
                type="button"
                className="px-6 py-3 rounded-full text-xs font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
                style={{ backgroundColor: onAccent, color: accent }}
              >
                Explore Collection ({products.length})
              </button>
            </a>
          </div>
        </div>
      </div>

      <div id="catalogue" className="mx-auto max-w-6xl px-4 sm:px-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((p: any) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Template 5: Studio (Tailored for Artisans: services menu & booking)
// ─────────────────────────────────────────────────────────────
function StudioTemplate({ sf, owner, artisan, accent, onAccent }: any) {
  const services = artisan?.services || [];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-8 py-10 space-y-10">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 rounded-[32px] border border-border/60 bg-surface/80 p-6 sm:p-8 shadow-sm">
        {sf.logo_url ? (
          <img
            src={sf.logo_url}
            alt={owner?.name}
            className="h-24 w-24 rounded-3xl object-cover shadow-sm border border-border/60 shrink-0"
          />
        ) : (
          <div
            className="h-24 w-24 rounded-3xl flex items-center justify-center font-extrabold text-3xl shadow-sm shrink-0"
            style={{ backgroundColor: accent, color: onAccent }}
          >
            {owner?.name?.slice(0, 1).toUpperCase() || "A"}
          </div>
        )}

        <div className="space-y-2 text-center sm:text-left flex-1">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{owner?.name || sf.handle}</h1>
            {owner?.verified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600">
                <BadgeCheck className="h-4 w-4" /> Verified Artisan
              </span>
            )}
          </div>

          {artisan?.specialty && (
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {artisan.specialty} {artisan.location ? `· ${artisan.location}` : ""}
            </p>
          )}

          {sf.bio && <p className="text-sm text-muted leading-relaxed max-w-2xl">{sf.bio}</p>}
        </div>
      </div>

      {/* Services Menu */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight">Services & Appointments</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((s: any, idx: number) => (
            <div
              key={s.name || idx}
              className="flex flex-col justify-between rounded-2xl border border-border/60 bg-surface p-5 shadow-sm space-y-4"
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-bold text-base">{s.name}</h3>
                  <span className="font-black text-base whitespace-nowrap" style={{ color: accent }}>
                    {formatNaira(s.priceNGN || 0)}
                  </span>
                </div>
                {s.durationMinutes && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                    <Clock className="h-3.5 w-3.5" /> {s.durationMinutes} minutes
                  </p>
                )}
                {s.description && <p className="mt-2 text-xs text-muted line-clamp-2">{s.description}</p>}
              </div>

              <Link href={artisan ? `/services/${artisan.slug || artisan.id}` : "/services"}>
                <Button
                  size="sm"
                  className="w-full rounded-xl text-xs font-bold"
                  style={{ backgroundColor: accent, color: onAccent }}
                >
                  <CalendarDays className="h-3.5 w-3.5 mr-1.5" /> Book Consultation
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
