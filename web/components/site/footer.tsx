import Link from "next/link";
import { LuxeBeauLogo } from "@/components/site/logo";

const columns = [
  {
    title: "Learn more",
    links: [
      { label: "What is LuxeBeau?", href: "/shop" },
      { label: "How escrow works", href: "/dashboard/escrow" },
      { label: "Book artisans", href: "/services" },
    ],
  },
  {
    title: "Get started",
    links: [
      { label: "Sell on LuxeBeau", href: "/partnership/seller" },
      { label: "Join as an artisan", href: "/partnership/artisan" },
      { label: "Brand partnerships", href: "/partnership/seller#brands" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of use", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Buyer protection", href: "/buyer-protection" },
    ],
  },
];

/* Frameless footer: no box, border or band, it sits directly on the page background
   (no cities, no app stores, clean brand mark). */
export default function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 text-ink overflow-hidden">


      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 pt-12 pb-14 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div>
          <LuxeBeauLogo textClassName="text-[24px]" markSize={32} className="gap-2.5" />

          <p className="mt-4 max-w-sm text-[14px] text-muted leading-relaxed">
            Beauty designed around everyone. Curated products and artisans, with payments held in escrow until you confirm delivery.
          </p>

          <p className="mt-6 text-[12px] text-muted">
            © {currentYear} LuxeBeau. All rights reserved.
          </p>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-[13px] font-bold uppercase tracking-wider text-ink">
              {col.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[14px] text-muted transition-colors duration-150 hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 pb-6 text-[12px] text-muted sm:flex-row sm:px-6 lg:px-8">
        <span>Curated for her, him and everyone.</span>
        <span>Payments held in escrow until delivery</span>
      </div>

      {/* Glass wordmark: translucent purple glass with a slow shimmer; "luxe" and "beau" come together. */}
      <div aria-hidden className="pointer-events-none mx-auto max-w-[1200px] select-none overflow-hidden px-4 pb-2 pt-4 sm:px-6 lg:px-8">
        <p className="lb-glass-wm text-center text-[clamp(72px,19vw,260px)]">
          <span className="lb-wm-l">luxe</span>
          <span className="lb-wm-r">beau</span>
        </p>
      </div>
    </footer>
  );
}
