"use client";

import { useSyncExternalStore } from "react";

/* Shared motion language, measured from shop.com and named once so every
   animation in the app uses the same curves and timings (seconds). */
export const EASE = {
  /** Entrances: fast start, long settle. */
  out: [0.22, 1, 0.36, 1],
  /** Playful overshoot (cart bounce). */
  spring: [0.34, 1.56, 0.64, 1],
  /** Standard material-like curve (image stacks). */
  std: [0.2, 0, 0, 1],
} as const;

export const DURATION = {
  press: 0.15,
  cascade: 0.35,
  bounce: 0.4,
  stack: 0.52,
  rail: 0.18,
  word: 0.4,
  toast: 0.3,
} as const;

/** Delay between siblings in a cascade. */
export const STAGGER = 0.045;

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener?.("change", onChange);
  return () => mq.removeEventListener?.("change", onChange);
}

function getSnapshot() {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;
}

/** True when the OS asks for reduced motion. False on the server. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
