"use client";

import { useEffect } from "react";

/**
 * FaviconAnimator
 * Cross-browser animated favicon for LuxeBeau.
 * 
 * Animates the signature LuxeBeau twin-ring emblem in the browser tab:
 * - Plays an initial welcoming pulse 400ms after page load so users see it immediately.
 * - Repeats every 10 seconds with a smooth 1.2s twin-ring dance/interlace cycle.
 * - Rests completely idle for the remaining 8.8s (zero CPU/battery impact).
 * - Respects prefers-reduced-motion and document visibility.
 * - Uses a vector SVG Data URI with sizes="any" and type="image/svg+xml" to ensure
 *   instant rendering at retina quality across modern Chrome, Safari, Edge and Firefox.
 */
export function FaviconAnimator() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Respect user's motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    function buildSvgDataUri(offset: number): string {
      const leftCx = (23 + offset).toFixed(1);
      const rightCx = (41 - offset).toFixed(1);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="%238a1fc7"/><circle cx="${leftCx}" cy="32" r="14" fill="none" stroke="%23fff" stroke-width="10"/><circle cx="${rightCx}" cy="32" r="14" fill="none" stroke="%23fff" stroke-width="10" stroke-opacity=".72"/></svg>`;
      return `data:image/svg+xml;utf8,${svg}`;
    }

    function applyFavicon(dataUri: string) {
      if (!dataUri) return;

      let link = document.querySelector<HTMLLinkElement>("#luxe-dynamic-favicon");
      if (!link) {
        // Remove existing static icon tags once so browsers don't compete
        document.querySelectorAll("link[rel*='icon']:not(#luxe-dynamic-favicon)").forEach(el => el.remove());
        link = document.createElement("link");
        link.id = "luxe-dynamic-favicon";
        link.rel = "icon";
        link.type = "image/svg+xml";
        link.sizes = "any";
        document.head.appendChild(link);
      }

      link.href = dataUri;
    }

    // Set initial resting frame
    applyFavicon(buildSvgDataUri(0));

    let timerId: ReturnType<typeof setInterval> | null = null;
    let frameIndex = 0;
    const TOTAL_FRAMES = 18; // 18 frames over ~1.17s (~65ms/frame, ~15fps optimal for browser tab renderers)
    const FRAME_INTERVAL = 65;

    function playAnimation() {
      if (document.hidden) return;
      if (timerId) clearInterval(timerId);

      frameIndex = 0;
      timerId = setInterval(() => {
        frameIndex++;
        const progress = frameIndex / TOTAL_FRAMES;
        if (progress >= 1) {
          if (timerId) clearInterval(timerId);
          timerId = null;
          applyFavicon(buildSvgDataUri(0));
          return;
        }

        // Sine wave displacement: smooth glide inward up to 6px and back to resting position
        const excursion = Math.sin(progress * Math.PI) * 6;
        applyFavicon(buildSvgDataUri(excursion));
      }, FRAME_INTERVAL);
    }

    // Play once right after load (400ms delay) so the user sees it animate immediately
    const initialTimeout = setTimeout(playAnimation, 400);

    // Then repeat every 10 seconds
    const loopInterval = setInterval(playAnimation, 10000);

    // Re-sync on visibility change
    const onVisibilityChange = () => {
      if (!document.hidden) {
        applyFavicon(buildSvgDataUri(0));
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(loopInterval);
      if (timerId) clearInterval(timerId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
