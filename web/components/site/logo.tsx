/**
 * LuxeBeau brand mark — the "Velvet Blossom" gem.
 *
 * Four curved petals (N/E/S/W teardrops) meet at a central diamond facet,
 * all contained in a thin diamond frame. Uses Tailwind fill/stroke utilities
 * so the mark inherits design-system token colours in both dark and light
 * mode without any SVG gradient ID conflicts.
 */

import Link from "next/link";

export function LuxeBeauMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Outer diamond frame — gives the mark a jewel boundary */}
      <path
        d="M16 1 L31 16 L16 31 L1 16 Z"
        className="stroke-gold-400"
        strokeWidth="0.6"
        strokeOpacity="0.38"
      />

      {/* North petal */}
      <path
        d="M16 3 C8 7 8 14 16 16 C24 14 24 7 16 3 Z"
        className="fill-gold-400"
        fillOpacity="0.82"
      />

      {/* East petal */}
      <path
        d="M29 16 C25 8 18 8 16 16 C18 24 25 24 29 16 Z"
        className="fill-gold-400"
        fillOpacity="0.82"
      />

      {/* South petal */}
      <path
        d="M16 29 C24 25 24 18 16 16 C8 18 8 25 16 29 Z"
        className="fill-gold-400"
        fillOpacity="0.82"
      />

      {/* West petal */}
      <path
        d="M3 16 C7 24 14 24 16 16 C14 8 7 8 3 16 Z"
        className="fill-gold-400"
        fillOpacity="0.82"
      />

      {/* Central diamond facet — the jewel heart */}
      <path d="M16 12 L20 16 L16 20 L12 16 Z" className="fill-gold-300" />

      {/* Inner facet cross-lines for gem depth */}
      <line x1="16" y1="12" x2="16" y2="20" className="stroke-gold-300" strokeWidth="0.4" strokeOpacity="0.5" />
      <line x1="12" y1="16" x2="20" y2="16" className="stroke-gold-300" strokeWidth="0.4" strokeOpacity="0.5" />
    </svg>
  );
}

export function LuxeBeauWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-wide ${className}`}>
      Luxe<span className="text-gold-gradient italic">Beau</span>
    </span>
  );
}

export function LuxeBeauLogo({
  href = "/",
  size = 26,
  textSize = "text-xl",
  className = "",
}: {
  href?: string;
  size?: number;
  textSize?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="LuxeBeau home"
      className={`flex items-center gap-2 ${className}`}
    >
      <LuxeBeauMark size={size} />
      <LuxeBeauWordmark className={textSize} />
    </Link>
  );
}
