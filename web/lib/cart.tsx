"use client";

/* Cart now lives in the Zustand store (lib/store). This re-export keeps the
   `import { useCart } from "@/lib/cart"` call sites working unchanged. */
export { useCart } from "@/lib/store";
