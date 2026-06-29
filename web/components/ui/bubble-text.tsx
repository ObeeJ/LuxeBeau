"use client";

import React, { useEffect, useRef } from "react";

interface BubbleTextProps {
  text: string;
  className?: string;
}

export default function BubbleText({ text, className = "" }: BubbleTextProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const spans = container.querySelectorAll("span");

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLSpanElement;
      target.style.fontWeight = "900";
      target.style.color = "rgb(107, 63, 160)";
      target.style.transform = "scale(1.2)";

      const left = target.previousElementSibling as HTMLSpanElement;
      const right = target.nextElementSibling as HTMLSpanElement;

      if (left) {
        left.style.fontWeight = "600";
        left.style.color = "rgb(142, 84, 178)";
        left.style.transform = "scale(1.1)";
      }
      if (right) {
        right.style.fontWeight = "600";
        right.style.color = "rgb(142, 84, 178)";
        right.style.transform = "scale(1.1)";
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLSpanElement;
      target.style.fontWeight = "300";
      target.style.color = "inherit";
      target.style.transform = "scale(1)";

      const left = target.previousElementSibling as HTMLSpanElement;
      const right = target.nextElementSibling as HTMLSpanElement;

      if (left) {
        left.style.fontWeight = "300";
        left.style.color = "inherit";
        left.style.transform = "scale(1)";
      }
      if (right) {
        right.style.fontWeight = "300";
        right.style.color = "inherit";
        right.style.transform = "scale(1)";
      }
    };

    spans.forEach((span) => {
      span.addEventListener("mouseenter", handleMouseEnter);
      span.addEventListener("mouseleave", handleMouseLeave);
    });

    return () => {
      spans.forEach((span) => {
        span.removeEventListener("mouseenter", handleMouseEnter);
        span.removeEventListener("mouseleave", handleMouseLeave);
      });
    };
  }, [text]);

  return (
    <h2
      ref={containerRef}
      className={`hover-text flex flex-wrap justify-center font-light cursor-default ${className}`}
    >
      {text.split("").map((char, idx) => (
        <span
          key={idx}
          className="inline-block transition-all duration-300 origin-center"
          style={{ fontWeight: 300, transition: "0.25s all ease" }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </h2>
  );
}
