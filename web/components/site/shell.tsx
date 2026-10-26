"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleUser, Home, ShoppingBag, Sparkles, Store, type LucideIcon } from "lucide-react";
import { useAuth, useCart } from "@/lib/store";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { LuxeBeauLogo, LuxeBeauMark } from "@/components/site/logo";
import SiteFooter from "@/components/site/footer";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: p => p === "/" },
  { href: "/shop", label: "Shop", icon: Store, match: p => p.startsWith("/shop") },
  { href: "/services", label: "Artisans", icon: Sparkles, match: p => p.startsWith("/services") },
  { href: "/cart", label: "Bag", icon: ShoppingBag, match: p => p.startsWith("/cart") },
  { href: "/dashboard", label: "Account", icon: CircleUser, match: p => p.startsWith("/dashboard") || p.startsWith("/partnership") },
];

export function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

/* One-shot mount flag so persisted cart/auth state never causes a
   hydration mismatch. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  return mounted;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ink px-1 text-[11px] leading-none text-surface">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SideRail() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { count } = useCart();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center bg-surface py-4 md:flex" aria-label="Primary">
      <Link href="/" aria-label="LuxeBeau home" className="flex h-12 w-12 items-center justify-center">
        <LuxeBeauMark />
      </Link>
      <nav className="mt-4 flex flex-col items-center gap-1">
        {NAV.map(item => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-12 w-12 items-center justify-center rounded-[20px] text-ink transition-colors duration-200",
                active ? "bg-canvas" : "hover:bg-canvas",
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              {item.href === "/cart" && mounted && <CountBadge count={count} />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        {mounted && user ? (
          <Link
            href="/dashboard"
            aria-label={`Your account, ${user.name}`}
            title={user.name}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-[11px] text-ink ring-1 ring-hairline"
          >
            {initials(user.name)}
          </Link>
        ) : (
          <button
            onClick={() => showAuth("signin")}
            aria-label="Sign in"
            title="Sign in"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink ring-1 ring-hairline transition-colors duration-200 hover:bg-canvas"
          >
            <CircleUser className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        )}
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const mounted = useMounted();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-surface/95 px-4 backdrop-blur md:hidden">
      <LuxeBeauLogo textClassName="text-[22px]" />
      {mounted && user ? (
        <Link
          href="/dashboard"
          aria-label={`Your account, ${user.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-[11px] ring-1 ring-hairline"
        >
          {initials(user.name)}
        </Link>
      ) : (
        <button
          onClick={() => showAuth("signin")}
          className="h-9 rounded-full border border-hairline bg-surface px-4 text-[14px] tracking-[-0.014em] shadow-pill"
        >
          Sign in
        </button>
      )}
    </header>
  );
}

function MobileTabBar() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { count } = useCart();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch justify-around bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-faint-border)] md:hidden"
      aria-label="Primary"
    >
      {NAV.map(item => {
        const active = item.match(pathname);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className="flex flex-1 flex-col items-center justify-center gap-0.5"
          >
            <span className={cn("relative flex h-8 w-12 items-center justify-center rounded-[20px] transition-colors duration-200", active && "bg-canvas")}>
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
              {item.href === "/cart" && mounted && <CountBadge count={count} />}
            </span>
            <span className={cn("text-[11px] tracking-[-0.017em]", active ? "text-ink" : "text-muted")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/* Page frame: persistent icon rail (desktop) or top bar + tab bar (mobile),
   with the footer band at the bottom of every page. */
export default function SiteShell({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <SideRail />
      <MobileTopBar />
      <div className="flex min-h-dvh flex-col pb-16 md:pb-0 md:pl-16">
        <div className="flex-1">{children}</div>
        {footer && <SiteFooter />}
      </div>
      <MobileTabBar />
    </div>
  );
}

/* Shared centred content column: 1200px max with a 16px mobile gutter. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}
