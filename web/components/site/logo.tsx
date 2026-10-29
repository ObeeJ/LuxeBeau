import Link from "next/link";
import { cn } from "@/lib/utils";

/* ── "Pair" logo ────────────────────────────────────────────────
   Two interlinked rings (her + him); the second ring sits at 60% opacity.
   Lowercase "luxebeau" wordmark in Geist 900. Colours come from tokens:
   rings use currentColor, the tile uses the brand purple. */

export function LuxeBeauWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={cn("font-black leading-none tracking-[-0.065em] text-brand", className)}>
      luxebeau
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
      className={cn("shrink-0", tile ? "text-surface" : "text-brand", className)}
    >
      {tile && <rect width="64" height="64" rx="18" className="fill-brand" />}
      <circle cx="24" cy="32" r="13" fill="none" stroke="currentColor" strokeWidth="7.5" />
      <circle cx="40" cy="32" r="13" fill="none" stroke="currentColor" strokeWidth="7.5" strokeOpacity="0.6" />
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
    <Link href={href} aria-label="LuxeBeau home" className={cn("inline-flex items-center gap-2", className)}>
      <LuxeBeauMark tile size={markSize} />
      <LuxeBeauWordmark className={textClassName} />
    </Link>
  );
}
