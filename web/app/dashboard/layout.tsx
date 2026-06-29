"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Brush,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Package,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/store";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  section?: "seller" | "artisan";
  show: (role?: string) => boolean;
}

const allNav: NavItem[] = [
  /* ── Common ── */
  { href: "/dashboard", label: "Account", icon: LayoutDashboard, exact: true, show: () => true },
  { href: "/dashboard/escrow", label: "Escrow", icon: ShieldCheck, show: () => true },

  /* ── Seller workspace ── */
  { href: "/dashboard/seller", label: "Seller Studio", icon: Store, exact: true, section: "seller", show: (r) => r === "seller" || r === "admin" },
  { href: "/dashboard/seller#products", label: "Products", icon: Package, section: "seller", show: (r) => r === "seller" || r === "admin" },
  { href: "/dashboard/seller#sales", label: "Orders & Sales", icon: ShoppingBag, section: "seller", show: (r) => r === "seller" || r === "admin" },
  { href: "/dashboard/seller#payouts", label: "Payouts", icon: Wallet, section: "seller", show: (r) => r === "seller" || r === "admin" },

  /* ── Artisan workspace ── */
  { href: "/dashboard/artisan", label: "Artisan Studio", icon: Brush, exact: true, section: "artisan", show: (r) => r === "artisan" || r === "admin" },
  { href: "/dashboard/artisan#bookings", label: "Bookings", icon: CalendarDays, section: "artisan", show: (r) => r === "artisan" || r === "admin" },
  { href: "/dashboard/artisan#schedule", label: "Schedule", icon: ClipboardList, section: "artisan", show: (r) => r === "artisan" || r === "admin" },
  { href: "/dashboard/artisan#payouts", label: "Payouts", icon: Wallet, section: "artisan", show: (r) => r === "artisan" || r === "admin" },

  /* ── Admin console ── */
  { href: "/dashboard/admin", label: "Admin", icon: Shield, show: (r) => r === "admin" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const userRole = useAuth((s) => s.user?.role);
  const items = allNav.filter((r) => r.show(userRole));

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="flex shrink-0 flex-col border-b border-velvet-700/60 bg-velvet-900 md:min-h-dvh md:w-60 md:border-b-0 md:border-r">
        <Link href="/" className="flex items-center gap-2 px-6 py-5" aria-label="LuxeBeau home">
          <Sparkles className="h-5 w-5 text-gold-400" aria-hidden />
          <span className="font-display text-lg font-semibold">
            Luxe<span className="text-gold-gradient italic">Beau</span>
          </span>
          <span className="ml-1 rounded-full border border-velvet-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-lavender-400">
            Studio
          </span>
        </Link>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0" aria-label="Dashboard navigation">
          {items.map((item, i) => {
            const basePath = item.href.split("#")[0];
            const active = item.exact
              ? pathname === basePath
              : pathname.startsWith(basePath);
            const isSubItem = item.href.includes("#");
            const prevSection = i > 0 ? items[i - 1].section : undefined;
            const showDivider = item.section && item.section !== prevSection && !isSubItem;
            const Icon = item.icon;

            return (
              <div key={`${item.href}-${item.label}`}>
                {showDivider && (
                  <div className="my-2 hidden border-t border-velvet-700/40 md:block" />
                )}
                <Link
                  href={item.href}
                  aria-current={active && !isSubItem ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                    isSubItem ? "md:pl-9 text-[13px]" : ""
                  } ${
                    active && !isSubItem
                      ? "bg-royal-500/20 text-gold-300"
                      : active && isSubItem
                        ? "text-lavender-100"
                        : "text-lavender-300 hover:bg-velvet-800 hover:text-lavender-100"
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isSubItem ? "opacity-60" : ""}`} aria-hidden />
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>

        <Link
          href="/"
          className="mt-auto hidden items-center gap-2 px-6 py-5 text-sm text-lavender-400 transition-colors hover:text-gold-300 md:flex"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to marketplace
        </Link>
      </aside>

      <div className="flex-1 px-4 py-8 sm:px-8">{children}</div>
    </div>
  );
}
