"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { HERO_PHOTOS } from "@/lib/photos";

/* Two portraits that slide past each other every 4.5s: the current photo
   glides out to the left while the next glides in from the right (.9s,
   the same ease-out as the rest of the site). Both load lazily. */
export function HeroSlides({ className = "" }: { className?: string }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setIndex(i => (i + 1) % HERO_PHOTOS.length), 4500);
    return () => clearInterval(t);
  }, [reduced]);

  return (
    <div className={`overflow-hidden bg-brand-wash ${className}`} aria-hidden>
      {HERO_PHOTOS.map((src, i) => {
        const offset = i === index ? 0 : i === (index + 1) % HERO_PHOTOS.length ? 100 : -100;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover object-[50%_22%] transition-transform duration-[900ms] ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ transform: `translateX(${offset}%)` }}
          />
        );
      })}
    </div>
  );
}
