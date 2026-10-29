"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "@/components/icons";
import SiteShell, { Container } from "@/components/site/shell";
import { useAuth } from "@/lib/store";
import { logout } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  show: (role?: string) => boolean;
}

/* Role-aware workspace switcher. The API enforces roles; this only hides
   destinations a user cannot open. */
const NAV: NavItem[] = [
  { href: "/dashboard", label: "Account", show: () => true },
  { href: "/dashboard/escrow", label: "Escrow", show: () => true },
  { href: "/dashboard/seller", label: "Seller studio", show: r => r === "seller" || r === "admin" },
  { href: "/dashboard/artisan", label: "Artisan studio", show: r => r === "artisan" },
  { href: "/dashboard/admin", label: "Admin", show: r => r === "admin" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth(s => s.user);
  const signOut = useAuth(s => s.signOut);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  /* Revoke the server session (and its cookies) before clearing local state. */
  const handleSignOut = async () => {
    await logout();
    signOut();
    router.push("/");
  };

  const items = NAV.filter(i => i.show(mounted ? user?.role : undefined));

  return (
    <SiteShell footer={false}>
      <Container className="pb-16 pt-6 md:pt-10">
        <div className="flex items-center gap-2">
          <nav
            className="no-scrollbar -mx-4 flex flex-1 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
            aria-label="Dashboard"
          >
            {items.map(item => {
              const active = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[14px] tracking-[-0.014em] shadow-pill transition-colors duration-200",
                    active ? "border-ink bg-ink text-surface" : "border-hairline bg-surface text-ink hover:bg-canvas",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          {mounted && user && (
            <button
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="hidden h-10 shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[14px] tracking-[-0.014em] shadow-pill transition-colors duration-200 hover:bg-canvas sm:inline-flex"
            >
              <LogOut className="h-4 w-4" aria-hidden /> Sign out
            </button>
          )}
        </div>
        <div className="mt-8">{children}</div>
        {mounted && user && (
          <button
            onClick={handleSignOut}
            className="mt-10 inline-flex h-10 items-center gap-2 rounded-full border border-hairline bg-surface px-4 text-[14px] tracking-[-0.014em] shadow-pill sm:hidden"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        )}
      </Container>
    </SiteShell>
  );
}
