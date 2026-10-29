import Link from "next/link";
import { cn } from "@/lib/utils";

/* ── "Pair" logo ────────────────────────────────────────────────
   Two interlinked rings (her + him); the second ring sits at 60% opacity.
   Lowercase "luxebeau" wordmark in Geist 900. Alive on hover and click:
   the rings slide together, the tile grows, and "luxe" and "beau" come
   together (see .lb-wm-* in globals.css). Colours come from tokens. */

export function LuxeBeauWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center font-black leading-none tracking-[-0.065em] text-brand select-none", className)}>
      <span className="lb-wm-l">luxe</span>
      <span className="lb-wm-r">beau</span>
    </span>
  );
}

export function LuxeBeauMark({
  size = 32,
  tile = false,
  className = "",
}: {
  size?: number;
  tile?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn(
        "shrink-0 transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover:scale-110 group-active:scale-90",
        tile ? "text-surface" : "text-brand",
        className,
      )}
    >
      {tile && <rect width="64" height="64" rx="18" className="fill-brand transition-[filter] duration-300 group-hover:brightness-110" />}
      <circle
        cx="24"
        cy="32"
        r="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="7.5"
        className="lb-ring-l"
      />
      <circle
        cx="40"
        cy="32"
        r="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="7.5"
        strokeOpacity="0.6"
        className="lb-ring-r"
      />
    </svg>
  );
}

export function LuxeBeauLogo({
  href = "/",
  className = "",
  textClassName = "text-[22px]",
  markSize = 28,
}: {
  href?: string;
  className?: string;
  textClassName?: string;
  markSize?: number;
}) {
  return (
    <Link href={href} aria-label="LuxeBeau home" className={cn("group inline-flex items-center gap-2", className)}>
      <LuxeBeauMark tile size={markSize} />
      <LuxeBeauWordmark className={textClassName} />
    </Link>
  );
}
