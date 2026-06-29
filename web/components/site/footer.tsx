import Link from "next/link";
import { LuxeBeauMark, LuxeBeauWordmark } from "@/components/site/logo";

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
      { label: "Seller dashboard", href: "/dashboard/seller" },
      { label: "Artisan dashboard", href: "/dashboard/artisan" },
      { label: "Admin console", href: "/dashboard/admin" },
    ],
  },
  {
    title: "Cities",
    links: [
      { label: "Lagos", href: "/services" },
      { label: "Abuja", href: "/services" },
      { label: "Port Harcourt", href: "/services" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-velvet-700/60 bg-velvet-900">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2">
            <LuxeBeauMark size={30} />
            <LuxeBeauWordmark className="text-2xl" />
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-lavender-400">
            Nigeria&apos;s luxury beauty marketplace. Curated products for melanin-rich skin,
            vetted artisans for every occasion. Secured by Paystack.
          </p>
          <p className="mt-6 text-xs text-lavender-400">
            © {new Date().getFullYear()} LuxeBeau Ltd. Lagos · Abuja · Port Harcourt
          </p>
        </div>
        {columns.map(col => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold-300">
              {col.title}
            </h3>
            <ul className="mt-4 space-y-3">
              {col.links.map(link => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-lavender-200 transition-colors duration-200 hover:text-gold-300"
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
