import Link from "next/link";
import { LuxeBeauMark, LuxeBeauWordmark } from "@/components/site/logo";

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
      { label: "Terms of Service", href: "#terms" },
      { label: "Privacy Policy", href: "#privacy" },
      { label: "Buyer Escrow Protection", href: "/dashboard/escrow" },
    ],
  },
];

/* White footer band conforming to the redesign spec (no cities, no app stores, clean brand mark). */
export default function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-20 border-t border-hairline bg-surface py-14 text-ink">
      <div className="mx-auto grid w-full max-w-[1200px] gap-10 px-4 sm:px-6 md:grid-cols-[1.5fr_repeat(3,1fr)] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <LuxeBeauMark tile size={32} />
            <LuxeBeauWordmark className="text-[24px]" />
          </div>

          <p className="mt-4 max-w-sm text-[14px] text-muted leading-relaxed">
            Beauty designed around everyone. Curated products, vetted artisans, and zero scams with our escrow guarantee.
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

      <div className="mx-auto mt-10 max-w-[1200px] border-t border-hairline px-4 pt-6 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-muted">
        <span>Curated for her, him and everyone across Nigeria.</span>
        <span>Secure Escrow Protection Guaranteed</span>
      </div>
    </footer>
  );
}
