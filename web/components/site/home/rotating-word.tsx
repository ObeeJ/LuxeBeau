"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface RotatingWordProps {
  words?: string[];
  intervalMs?: number;
  className?: string;
}

export function RotatingWord({
  words = ["you", "her", "him", "us"],
  intervalMs = 2400,
  className,
}: RotatingWordProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion || words.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [reducedMotion, words, intervalMs]);

  const currentWord = reducedMotion ? words[0] : words[index];

  return (
    <span
      className={cn(
        "inline-block relative overflow-hidden align-bottom text-brand font-black min-w-[2.1em] text-left",
        className,
      )}
    >
      <span key={currentWord} className="block lb-num-in">
        {currentWord}
      </span>
    </span>
  );
}
