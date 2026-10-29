"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { EASE, usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface HeroSlide {
  id: string;
  src: string;
  alt: string;
  tag: string;
  subtitle: string;
  tone: string;
  eager?: boolean;
}

const SLIDES: HeroSlide[] = [
  {
    id: "slide-her",
    src: "/images/hero/hero-woman.webp",
    alt: "Radiant woman with glowing skin and protective braided styling",
    tag: "Her & You",
    subtitle: "Organic African botanicals, raw shea & lit-from-within glow",
    tone: "Radiant Skin",
    eager: true,
  },
  {
    id: "slide-him",
    src: "/images/hero/hero-man.webp",
    alt: "Sharp modern man with clean skin, neat hair and earring",
    tag: "Him & Us",
    subtitle: "Precision barbering, beard elixirs & smoky amber oud",
    tone: "Clean Grooming",
    eager: false,
  },
];

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 1.06,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { duration: 0.75, ease: EASE.out },
      opacity: { duration: 0.65, ease: EASE.out },
      scale: { duration: 0.9, ease: EASE.out },
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 0.96,
    transition: {
      x: { duration: 0.7, ease: EASE.out },
      opacity: { duration: 0.5, ease: EASE.out },
      scale: { duration: 0.7, ease: EASE.out },
    },
  }),
};

const reducedVariants = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.4 } },
  exit: { opacity: 0, transition: { duration: 0.3 } },
};

export function HeroSlider({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const reduce = usePrefersReducedMotion();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const paginate = useCallback((newDirection: number) => {
    setDirection(newDirection);
    setIndex((prev) => (prev + newDirection + SLIDES.length) % SLIDES.length);
  }, []);

  const goToSlide = useCallback((targetIndex: number) => {
    if (targetIndex === index) return;
    setDirection(targetIndex > index ? 1 : -1);
    setIndex(targetIndex);
  }, [index]);

  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(() => {
      paginate(1);
    }, 5500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paginate, isPaused]);

  const slide = SLIDES[index];

  return (
    <div
      role="region"
      aria-label="Featured beauty showcases"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        "group/slider relative overflow-hidden rounded-[30px] shadow-card bg-surface select-none",
        className,
      )}
    >
      {/* Background slide frame */}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={slide.id}
          custom={direction}
          variants={reduce ? reducedVariants : variants}
          initial="enter"
          animate="center"
          exit="exit"
          className="absolute inset-0 h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide.src}
            alt={slide.alt}
            loading={slide.eager ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={slide.eager ? "high" : "auto"}
            className="h-full w-full object-cover object-top transition-transform duration-700 ease-out"
          />

          {/* Vignette & contrast scrims */}
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/30 via-transparent to-transparent hidden md:block" />
        </motion.div>
      </AnimatePresence>

      {/* Slide Badge & Label (Bottom overlay) */}
      <div className="absolute bottom-4 left-4 right-4 z-20 flex flex-col gap-1.5 sm:bottom-6 sm:left-6 sm:right-6">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1 text-[12px] font-bold text-ink shadow-soft backdrop-blur-md">
            <Sparkles className="h-3 w-3 text-brand" />
            <span>{slide.tag}</span>
            <span className="opacity-40">·</span>
            <span className="text-brand font-semibold">{slide.tone}</span>
          </span>

          {/* Slide dots */}
          <div className="flex items-center gap-1.5 rounded-full bg-surface/80 px-2.5 py-1 backdrop-blur-md">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSlide(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-5 bg-brand" : "w-1.5 bg-ink/30 hover:bg-ink/60",
                )}
              />
            ))}
          </div>
        </div>

        <p className="text-[13px] text-surface font-medium leading-tight drop-shadow-sm line-clamp-1">
          {slide.subtitle}
        </p>
      </div>

      {/* Manual Slide Arrows */}
      <button
        type="button"
        onClick={() => paginate(-1)}
        aria-label="Previous slide"
        className="lb-press absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-ink shadow-soft backdrop-blur-md transition-all duration-200 hover:bg-surface hover:scale-105 opacity-0 group-hover/slider:opacity-100 focus:opacity-100"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => paginate(1)}
        aria-label="Next slide"
        className="lb-press absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-surface/80 text-ink shadow-soft backdrop-blur-md transition-all duration-200 hover:bg-surface hover:scale-105 opacity-0 group-hover/slider:opacity-100 focus:opacity-100"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
