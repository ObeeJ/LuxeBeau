"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface RotatingWordProps {
  words?: string[];
  intervalMs?: number;
  className?: string;
}

/* The headline word: the new word slides up into place while the old one
   slides up and out (shop.com's count/word slide, .45s). */
export function RotatingWord({
  words = ["you", "her", "him", "us"],
  intervalMs = 2400,
  className,
}: RotatingWordProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    if (reducedMotion || words.length <= 1) return;
    let clear: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      setIndex(prev => {
        setLeaving(words[prev]);
        return (prev + 1) % words.length;
      });
      clear = setTimeout(() => setLeaving(null), 460);
    }, intervalMs);
    return () => {
      clearInterval(interval);
      clearTimeout(clear);
    };
  }, [reducedMotion, words, intervalMs]);

  const current = reducedMotion ? words[0] : words[index];

  return (
    <span
      className={cn(
        "relative inline-block h-[0.98em] min-w-[2.1em] overflow-hidden whitespace-nowrap align-bottom font-extrabold leading-[0.98] text-brand",
        className,
      )}
    >
      {leaving && (
        <span aria-hidden className="lb-num-out block">
          {leaving}
        </span>
      )}
      <span key={current} className="lb-word-in block">
        {current}
      </span>
    </span>
  );
}
