"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

const R = 23;
const CIRC = 2 * Math.PI * R;

/* Back to top. A purple ring around the Pair mark fills as you scroll down the
   page. On hover the two rings slide together; on click they launch upward
   while the page glides to the top. Appears after 400px of scrolling. */
export function ScrollTop() {
  const reduced = usePrefersReducedMotion();
  // The artisan booking page has its own sticky bar on phones; sit above it.
  const hasStickyBar = /^\/services\/[^/]+/.test(usePathname() ?? "");
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const y = window.scrollY;
      setVisible(y > 400);
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const goTop = () => {
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    if (reduced) return;
    setLaunching(true);
    setTimeout(() => setLaunching(false), 900);
  };

  return (
    <button
      type="button"
      onClick={goTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      className={cn(
        "group fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-float transition-[opacity,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-1 active:scale-90 md:bottom-8 md:right-8",
        hasStickyBar ? "bottom-[156px]" : "bottom-[88px]",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
      )}
    >
      <svg viewBox="0 0 56 56" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--color-brand-purple-wash)" strokeWidth="3" />
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke="var(--color-brand-purple)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - progress)}
          style={{ transition: "stroke-dashoffset 0.15s linear" }}
        />
      </svg>

      <svg
        viewBox="0 0 64 64"
        width="26"
        height="26"
        aria-hidden
        className={cn("relative text-brand", launching && "lb-launch")}
      >
        <circle cx="24" cy="32" r="13" fill="none" stroke="currentColor" strokeWidth="7.5" className="lb-ring-l" />
        <circle cx="40" cy="32" r="13" fill="none" stroke="currentColor" strokeWidth="7.5" strokeOpacity="0.6" className="lb-ring-r" />
      </svg>

      {/* A small chevron rises from the ring on hover to say "up". */}
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        aria-hidden
        className="pointer-events-none absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-brand p-[3px] text-surface opacity-0 shadow-glow transition-all duration-300 group-hover:-top-3.5 group-hover:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 14 6-6 6 6" />
      </svg>
    </button>
  );
}
