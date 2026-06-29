"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShoppingBag, Menu, X, LogOut, LayoutDashboard, Sun, Moon } from "lucide-react";
import { useCart, useAuth, useTheme } from "@/lib/store";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import ShiftingDropDown from "@/components/ui/shifting-dropdown";
import { LuxeBeauLogo } from "@/components/site/logo";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/services", label: "Artisans" },
  { href: "/dashboard", label: "Sell on LuxeBeau" },
];

export default function SiteNav() {
  const pathname = usePathname();
  const { count } = useCart();
  const user = useAuth(s => s.user);
  const signOut = useAuth(s => s.signOut);
  const showAuth = useAuthModal(s => s.show);
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* Avoid a hydration mismatch on the cart badge and account state.
     A one-shot mount flag is the intended pattern here. */
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-50 border-b border-velvet-700/60 bg-velvet-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <LuxeBeauLogo size={26} textSize="text-xl" />

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          <ShiftingDropDown />
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="rounded-full border border-velvet-700 p-2.5 text-lavender-400 transition-colors duration-200 hover:border-gold-400/60 hover:text-gold-400"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden />
            ) : (
              <Moon className="h-4 w-4" aria-hidden />
            )}
          </button>

          <Link
            href="/cart"
            className="relative rounded-full border border-velvet-700 p-2.5 transition-colors duration-200 hover:border-gold-400/60"
            aria-label={`Shopping bag, ${count} item${count === 1 ? "" : "s"}`}
          >
            <ShoppingBag className="h-4 w-4 text-lavender-200" aria-hidden />
            {mounted && count > 0 && (
              <motion.span
                key={count}
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-royal-500 text-[11px] font-bold text-lavender-100"
              >
                {count}
              </motion.span>
            )}
          </Link>

          {mounted && user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-royal-500/30 text-sm font-semibold text-gold-300"
                title={user.name}
                aria-hidden
              >
                {user.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </span>
              <button
                onClick={signOut}
                className="rounded-full border border-velvet-700 p-2.5 text-lavender-200 transition-colors hover:border-danger/60 hover:text-danger"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </div>
          ) : (
            <Button
              onClick={() => showAuth("login")}
              className="hidden h-10 rounded-full px-5 text-sm font-semibold md:inline-flex"
            >
              Sign in
            </Button>
          )}

          <button
            className="rounded-full border border-velvet-700 p-2.5 md:hidden"
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-velvet-700/60 bg-velvet-900 px-6 py-4 md:hidden" aria-label="Mobile">
          <ul className="flex flex-col gap-1">
            {links.map(link => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-medium text-lavender-200 hover:bg-velvet-800"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="mt-2">
              {mounted && user ? (
                <div className="flex items-center justify-between rounded-lg bg-velvet-800 px-3 py-3">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <LayoutDashboard className="h-4 w-4 text-gold-300" aria-hidden />
                    {user.name}
                  </span>
                  <button onClick={() => { signOut(); setOpen(false); }} className="text-sm font-semibold text-danger">
                    Sign out
                  </button>
                </div>
              ) : (
                <Button
                  onClick={() => { showAuth("login"); setOpen(false); }}
                  className="w-full rounded-full text-sm font-semibold"
                >
                  Sign in
                </Button>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
