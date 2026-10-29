"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { DURATION, EASE, STAGGER, usePrefersReducedMotion } from "@/lib/motion";

/* Cascade-in: each item rises 8px and fades in, staggered by index.
   Under reduced motion the content renders immediately visible. */
export function Cascade({
  index = 0,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.cascade, ease: EASE.out, delay: Math.min(index, 12) * STAGGER }}
    >
      {children}
    </motion.div>
  );
}
