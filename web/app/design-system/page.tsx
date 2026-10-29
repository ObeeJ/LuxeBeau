import type { Metadata } from "next";
import SiteShell, { Container } from "@/components/site/shell";
import { LuxeBeauLogo, LuxeBeauMark, LuxeBeauWordmark } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductCard, ProductRail, StoreCard, SearchBar } from "@/components/site/catalog";
import { type Product } from "@/lib/api";

export const metadata: Metadata = {
  title: "Design System & Component Gallery",
  robots: {
    index: false,
    follow: false,
  },
};

const sampleProduct: Product = {
  id: "sample-1",
  slug: "sample-product",
  name: "Pure Shea Radiance Face & Body Glow Elixir",
  brand: "Adunni Organics (Sample)",
  priceNGN: 12500,
  category: "Skincare",
  blurb: "Rich organic cold-pressed shea oil.",
  details: ["100% natural", "Melanin-rich formula"],
  rating: 4.9,
  reviews: 142,
  tint: ["#fff", "#000"],
  stock: 15,
};

export default function DesignSystemGallery() {
  return (
    <SiteShell>
      <Container className="py-12 space-y-16">
        <header className="border-b border-hairline pb-6">
          <span className="rounded-full bg-brand-wash px-3 py-1 text-[12px] font-bold text-brand-deep">
            Internal Component Gallery
          </span>
          <h1 className="t-hero mt-3 text-ink">Design System</h1>
          <p className="mt-2 text-muted max-w-xl text-[16px]">
            Live reference for LuxeBeau tokens, typography, motion primitives, and approved interactive components.
          </p>
        </header>

        {/* 1. Colours */}
        <section aria-labelledby="colours-heading" className="space-y-4">
          <h2 id="colours-heading" className="t-display text-ink">Colours</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <div className="rounded-2xl p-4 bg-brand text-surface shadow-glow">
              <span className="block font-bold">Primary</span>
              <span className="text-[12px] opacity-80">#8A1FC7</span>
            </div>
            <div className="rounded-2xl p-4 bg-brand-deep text-surface">
              <span className="block font-bold">Deep</span>
              <span className="text-[12px] opacity-80">#6F16A3</span>
            </div>
            <div className="rounded-2xl p-4 bg-brand-wash text-brand-deep">
              <span className="block font-bold">Wash</span>
              <span className="text-[12px] opacity-80">#F3E6FB</span>
            </div>
            <div className="rounded-2xl p-4 bg-ink text-surface">
              <span className="block font-bold">Ink</span>
              <span className="text-[12px] opacity-80">#000000</span>
            </div>
            <div className="rounded-2xl p-4 bg-surface text-ink border border-hairline shadow-soft">
              <span className="block font-bold">Surface</span>
              <span className="text-[12px] opacity-80">#FFFFFF</span>
            </div>
            <div className="rounded-2xl p-4 bg-canvas text-ink border border-hairline">
              <span className="block font-bold">Canvas</span>
              <span className="text-[12px] opacity-80">#FAFAFA</span>
            </div>
          </div>
        </section>

        {/* 2. Type */}
        <section aria-labelledby="type-heading" className="space-y-4">
          <h2 id="type-heading" className="t-display text-ink">Type</h2>
          <div className="rounded-[28px] bg-surface p-6 shadow-soft space-y-6">
            <div>
              <p className="text-[12px] text-muted font-mono">.t-hero (Geist 800)</p>
              <p className="t-hero mt-1">Beauty is all about you</p>
            </div>
            <div>
              <p className="text-[12px] text-muted font-mono">.t-display (Geist 800)</p>
              <p className="t-display mt-1">Curated beauty crafted for everyone</p>
            </div>
            <div>
              <p className="text-[12px] text-muted font-mono">Body (Geist 400/500)</p>
              <p className="text-[15px] text-muted mt-1 leading-relaxed max-w-xl">
                Every order is protected by our escrow guarantee. Sellers and beauty artisans only get paid when you receive exactly what you ordered.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Buttons */}
        <section aria-labelledby="buttons-heading" className="space-y-4">
          <h2 id="buttons-heading" className="t-display text-ink">Buttons</h2>
          <div className="rounded-[28px] bg-surface p-6 shadow-soft flex flex-wrap gap-3 items-center">
            <Button variant="default">Primary Action</Button>
            <Button variant="secondary">Secondary (White)</Button>
            <Button variant="dark">Dark (Ink)</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled Pill</Button>
          </div>
        </section>

        {/* 4. Inputs */}
        <section aria-labelledby="inputs-heading" className="space-y-4">
          <h2 id="inputs-heading" className="t-display text-ink">Inputs</h2>
          <div className="rounded-[28px] bg-surface p-6 shadow-soft max-w-md space-y-3">
            <Input placeholder="Sample pill text input" />
            <Input placeholder="Focused input with purple wash glow" />
          </div>
        </section>

        {/* 5. Product card */}
        <section aria-labelledby="product-card-heading" className="space-y-4">
          <h2 id="product-card-heading" className="t-display text-ink">Product card</h2>
          <div className="max-w-[240px]">
            <ProductCard product={sampleProduct} />
          </div>
        </section>

        {/* 6. Rail */}
        <section aria-labelledby="rail-heading" className="space-y-4">
          <h2 id="rail-heading" className="t-display text-ink">Rail</h2>
          <ProductRail label="Sample Component Rail">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-[200px] shrink-0 snap-start">
                <ProductCard product={{ ...sampleProduct, id: `sample-rail-${i}`, name: `Sample Product #${i}` }} />
              </div>
            ))}
          </ProductRail>
        </section>

        {/* 7. Store card */}
        <section aria-labelledby="store-card-heading" className="space-y-4">
          <h2 id="store-card-heading" className="t-display text-ink">Store card</h2>
          <div className="max-w-sm">
            <StoreCard
              name="Adunni Organics (Sample)"
              subtitle="Skincare · Abeokuta"
              products={[
                { ...sampleProduct, id: "sample-store-1" },
                { ...sampleProduct, id: "sample-store-2" },
              ]}
            />
          </div>
        </section>

        {/* 8. Search and Scan */}
        <section aria-labelledby="search-scan-heading" className="space-y-4">
          <h2 id="search-scan-heading" className="t-display text-ink">Search and Scan</h2>
          <div className="max-w-lg">
            <SearchBar placeholder="Search products, brands or scan..." />
          </div>
        </section>

        {/* 9. Toasts */}
        <section aria-labelledby="toasts-heading" className="space-y-4">
          <h2 id="toasts-heading" className="t-display text-ink">Toasts</h2>
          <div className="rounded-[28px] bg-surface p-6 shadow-soft">
            <div className="inline-flex items-center gap-2.5 rounded-full bg-ink px-4 py-2.5 text-[14px] text-surface shadow-float">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold">
                ✓
              </span>
              <span>Added to bag · protected in escrow</span>
            </div>
          </div>
        </section>

        {/* 10. Logo */}
        <section aria-labelledby="logo-heading" className="space-y-4">
          <h2 id="logo-heading" className="t-display text-ink">Logo</h2>
          <div className="rounded-[28px] bg-surface p-6 shadow-soft flex flex-wrap items-center gap-8">
            <div className="flex items-center gap-2">
              <LuxeBeauMark tile size={44} />
              <LuxeBeauWordmark className="text-[28px]" />
            </div>
            <LuxeBeauMark size={40} />
            <LuxeBeauLogo />
          </div>
        </section>
      </Container>
    </SiteShell>
  );
}
