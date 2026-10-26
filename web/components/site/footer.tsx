import Link from "next/link";
import { LuxeBeauWordmark } from "@/components/site/logo";

const columns = [
  {
    title: "Marketplace",
    links: [
      { label: "Shop products", href: "/shop" },
      { label: "Book artisans", href: "/services" },
      { label: "Your bag", href: "/cart" },
    ],
  },
  {
    title: "Partners",
    links: [
      { label: "Sell on LuxeBeau", href: "/partnership/seller" },
      { label: "Join as an artisan", href: "/partnership/artisan" },
      { label: "Escrow payments", href: "/dashboard/escrow" },
    ],
  },
  {
    title: "Cities",
    links: [
      { label: "Lagos", href: "/services?city=Lagos" },
      { label: "Abuja", href: "/services?city=Abuja" },
      { label: "Port Harcourt", href: "/services?city=Port%20Harcourt" },
    ],
  },
];

/* Dark footer band with columnar link groups. */
export default function SiteFooter() {
  return (
    <footer className="mt-16 bg-ink text-surface">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)] lg:px-8">
        <div>
          <LuxeBeauWordmark className="text-[22px]" />
          <p className="mt-3 max-w-xs text-[14px] tracking-[-0.014em] text-stone">
            Nigeria&apos;s beauty marketplace. Curated products for melanin-rich skin and vetted artisans for every occasion.
          </p>
          <p className="mt-6 text-[12px] tracking-[-0.017em] text-fog">
            © {new Date().getFullYear()} LuxeBeau. Lagos · Abuja · Port Harcourt
          </p>
        </div>
        {columns.map(col => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="t-meta text-fog">{col.title}</h2>
            <ul className="mt-4 space-y-3">
              {col.links.map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[14px] tracking-[-0.014em] text-surface transition-opacity duration-200 hover:opacity-70"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </footer>
  );
}
