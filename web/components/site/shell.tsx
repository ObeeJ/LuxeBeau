"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DuotoneHome,
  DuotoneStore,
  DuotoneArtisan,
  DuotoneBag,
  DuotoneUser,
} from "@/components/site/nav-icons";
import { useAuth, useCart } from "@/lib/store";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { LuxeBeauLogo, LuxeBeauMark } from "@/components/site/logo";
import SiteFooter from "@/components/site/footer";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: (props: { className?: string; active?: boolean }) => React.JSX.Element;
  match: (path: string) => boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: DuotoneHome, match: (p) => p === "/" },
  { href: "/shop", label: "Shop", icon: DuotoneStore, match: (p) => p.startsWith("/shop") },
  { href: "/services", label: "Artisans", icon: DuotoneArtisan, match: (p) => p.startsWith("/services") },
  { href: "/cart", label: "Bag", icon: DuotoneBag, match: (p) => p.startsWith("/cart") },
  {
    href: "/dashboard",
    label: "Account",
    icon: DuotoneUser,
    match: (p) => p.startsWith("/dashboard") || p.startsWith("/partnership"),
  },
];

export function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function useMounted() {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-hidden
      className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center overflow-hidden rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-surface"
    >
      <span key={label} className="lb-num-in block">
        {label}
      </span>
    </span>
  );
}

function useBounceOnIncrease(count: number) {
  const [prev, setPrev] = useState(count);
  const [tick, setTick] = useState(0);
  if (count !== prev) {
    if (count > prev) setTick((t) => t + 1);
    setPrev(count);
  }
  return tick;
}

function navLabel(item: NavItem, count: number, mounted: boolean) {
  if (item.href === "/cart" && mounted && count > 0)
    return `${item.label}, ${count} ${count === 1 ? "item" : "items"}`;
  return item.label;
}

function SideRail() {
  const pathname = usePathname();
  const mounted = useMounted();
  const { count } = useCart();
  const user = useAuth((s) => s.user);
  const showAuth = useAuthModal((s) => s.show);
  const bounce = useBounceOnIncrease(count);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-24 flex-col items-center py-5 md:flex"
      aria-label="Primary"
    >
      <Link
        href="/"
        aria-label="LuxeBeau home"
        className="lb-press flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-brand shadow-glow"
      >
        <LuxeBeauMark size={44} className="text-surface" />
      </Link>
      <nav className="my-auto flex flex-col items-center gap-1.5 rounded-full bg-surface p-2 shadow-soft border border-hairline/60">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const isBag = item.href === "/cart";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={navLabel(item, count, mounted)}
              title={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "lb-press group relative flex h-[46px] w-[46px] items-center justify-center rounded-full transition-all duration-150",
                active
                  ? "bg-brand-wash text-brand shadow-sm"
                  : "text-muted hover:text-ink hover:bg-canvas",
              )}
            >
              <Icon
                key={isBag ? `bag-${bounce}` : undefined}
                active={active}
                className={cn(
                  "h-[22px] w-[22px] transition-transform duration-150 group-hover:scale-110",
                  isBag && bounce > 0 && "lb-bounce",
                )}
                aria-hidden
              />
              {isBag && mounted && <CountBadge count={count} />}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col items-center rounded-full bg-surface p-2 shadow-soft border border-hairline/60">
        {mounted && user ? (
          <Link
            href="/dashboard"
            aria-label={`Your account, ${user.name}`}
            title={user.name}
            className="lb-press flex h-[46px] w-[46px] items-center justify-center rounded-full bg-brand-wash text-[12px] font-semibold text-brand-deep"
          >
            {initials(user.name)}
          </Link>
        ) : (
          <button
            onClick={() => showAuth("signin")}
            aria-label="Sign in"
            title="Sign in"
            className="lb-press flex h-[46px] w-[46px] items-center justify-center rounded-full text-muted transition-colors duration-150 hover:text-ink"
          >
            <DuotoneUser className="h-[22px] w-[22px]" />
          </button>
        )}
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const mounted = useMounted();
  const user = useAuth((s) => s.user);
  const showAuth = useAuthModal((s) => s.show);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-canvas/90 px-4 backdrop-blur md:hidden">
      <LuxeBeauLogo textClassName="text-[22px]" />
      {mounted && user ? (
        <Link
          href="/dashboard"
          aria-label={`Your account, ${user.name}`}
          className="lb-press flex h-11 w-11 items-center justify-center rounded-full bg-brand-wash text-[12px] font-semibold text-brand-deep"
        >
          {initials(user.name)}
        </Link>
      ) : (
        <button
          onClick={() => showAuth("signin")}
          className="lb-press h-11 rounded-full bg-surface px-4 text-[14px] font-semibold tracking-[-0.014em] shadow-soft"
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
  const bounce = useBounceOnIncrease(count);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--color-faint-border)] md:hidden"
      aria-label="Primary mobile"
    >
      <div className="flex h-16 items-stretch justify-around">
        {NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const isBag = item.href === "/cart";
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={navLabel(item, count, mounted)}
              aria-current={active ? "page" : undefined}
              className="lb-press flex flex-1 flex-col items-center justify-center gap-0.5"
            >
              <span
                className={cn(
                  "relative flex h-8 w-12 items-center justify-center rounded-full transition-colors duration-150",
                  active && "bg-brand-wash",
                )}
              >
                <Icon
                  key={isBag ? `bag-${bounce}` : undefined}
                  active={active}
                  className={cn(
                    "h-[22px] w-[22px]",
                    active ? "text-brand" : "text-ink",
                    isBag && bounce > 0 && "lb-bounce",
                  )}
                  aria-hidden
                />
                {isBag && mounted && <CountBadge count={count} />}
              </span>
              <span
                className={cn(
                  "text-[11px] tracking-[-0.017em]",
                  active ? "font-semibold text-brand-deep" : "text-muted",
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default function SiteShell({
  children,
  footer = true,
}: {
  children: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-canvas">
      <SideRail />
      <MobileTopBar />
      <div className="flex min-h-dvh flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-24">
        <div className="flex-1">{children}</div>
        {footer && <SiteFooter />}
      </div>
      <MobileTabBar />
    </div>
  );
}

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
