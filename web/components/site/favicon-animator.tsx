"use client";

import { useEffect } from "react";

/**
 * FaviconAnimator
 * Animates the LuxeBeau signature twin-ring emblem in the browser tab favicon
 * every 10 seconds with a smooth 1.2s cycle, resting idle for the remaining 8.8s.
 */
export function FaviconAnimator() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) return;

    // Get or create favicon link tag
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    if (typeof canvas.getContext !== "function") return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;

    function drawFavicon(offset: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, 64, 64);

      // LuxeBeau Brand Purple Rounded Square
      const r = 16;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(64 - r, 0);
      ctx.quadraticCurveTo(64, 0, 64, r);
      ctx.lineTo(64, 64 - r);
      ctx.quadraticCurveTo(64, 64, 64 - r, 64);
      ctx.lineTo(r, 64);
      ctx.quadraticCurveTo(0, 64, 0, 64 - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fillStyle = "#8a1fc7";
      ctx.fill();

      // Circle 1 (Left White Ring)
      ctx.beginPath();
      ctx.arc(23 + offset, 32, 14, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 9;
      ctx.stroke();

      // Circle 2 (Right Translucent White Ring)
      ctx.beginPath();
      ctx.arc(41 - offset, 32, 14, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
      ctx.lineWidth = 9;
      ctx.stroke();

      if (link) {
        link.href = canvas.toDataURL("image/png");
      }
    }

    // Initial draw
    drawFavicon(0);

    let animationFrameId: number | null = null;
    let animStartTime = 0;
    const ANIMATION_DURATION = 1200; // 1.2 seconds animation

    function step(timestamp: number) {
      if (!animStartTime) animStartTime = timestamp;
      const elapsed = timestamp - animStartTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      // Smooth sine wave offset: peaks at ~5px excursion and returns to 0
      const offset = Math.sin(progress * Math.PI * 2) * 5;
      drawFavicon(offset);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        drawFavicon(0);
        animationFrameId = null;
      }
    }

    function triggerAnimation() {
      // Don't run when tab is hidden to save battery
      if (document.hidden) return;
      animStartTime = 0;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(step);
    }

    // Trigger every 10 seconds
    const intervalId = window.setInterval(triggerAnimation, 10000);

    return () => {
      window.clearInterval(intervalId);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return null;
}
