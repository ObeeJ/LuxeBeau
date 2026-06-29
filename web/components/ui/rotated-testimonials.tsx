"use client";

import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  rating: number;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "My absolute favorite marketplace in Lagos. I get skincare products and book premium nail appointments all in one place.",
    author: "Chioma N.",
    role: "Verified Buyer",
    rating: 5,
  },
  {
    quote: "LuxeBeau has completely streamlined my hair-styling business. Clients book online, and payouts are instant.",
    author: "Femi A.",
    role: "Luxe Stylist Partner",
    rating: 5,
  },
  {
    quote: "Top-tier customer support. My orders arrive on time and their vetted artisans are incredibly professional.",
    author: "Zainab O.",
    role: "Regular Customer",
    rating: 5,
  },
  {
    quote: "The interface is gorgeous and booking takes less than 30 seconds. Highly recommend the Shea Butter line!",
    author: "Amara K.",
    role: "Skincare Blogger",
    rating: 5,
  },
];

export default function RotatedTestimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardOffset, setCardOffset] = useState(260);

  useEffect(() => {
    const handleResize = () => {
      setCardOffset(window.innerWidth < 640 ? 240 : 320);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % TESTIMONIALS.length);
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length);
  };

  return (
    <div className="relative w-full overflow-hidden bg-purple-50/40 py-20 flex flex-col items-center justify-center min-h-[480px] rounded-3xl">
      <div className="relative w-full max-w-4xl mx-auto h-[320px] flex items-center justify-center px-4">
        {TESTIMONIALS.map((t, idx) => {
          const offset = idx - activeIndex;
          const isActive = idx === activeIndex;
          
          let translateX = offset * cardOffset;
          const translateY = isActive ? -16 : 8;
          const rotation = isActive ? 0 : offset * 2.5;
          const zIndex = isActive ? 20 : 10 - Math.abs(offset);
          const opacity = isActive ? 1 : 0.4;
          const scale = isActive ? 1 : 0.92;

          if (offset < -1) {
            translateX += TESTIMONIALS.length * cardOffset;
          } else if (offset > 1) {
            translateX -= TESTIMONIALS.length * cardOffset;
          }

          return (
            <div
              key={idx}
              className={`absolute p-8 flex flex-col justify-between transition-all duration-500 ease-out rounded-2xl border ${
                isActive 
                  ? "bg-gradient-to-br from-[#1B0A2E] to-[#2A1045] text-white shadow-2xl shadow-purple-500/15 border-purple-500/20" 
                  : "bg-white text-purple-900 border-purple-200/40 shadow-lg shadow-purple-100/30"
              }`}
              style={{
                width: "min(420px, 85vw)",
                height: "280px",
                left: "50%",
                transform: `translate(calc(-50% + ${translateX}px), ${translateY}px) rotate(${rotation}deg) scale(${scale})`,
                zIndex,
                opacity,
              }}
            >
              <div>
                <div className="flex gap-1 mb-3">
                  {[...Array(t.rating)].map((_, i) => (
                    <Star key={i} className={`w-4 h-4 fill-current ${isActive ? "text-purple-300" : "text-purple-400"}`} />
                  ))}
                </div>
                <h3 className="text-base sm:text-lg font-serif font-medium leading-relaxed italic">
                  &quot;{t.quote}&quot;
                </h3>
              </div>
              <div className="pt-2">
                <p className="font-semibold text-sm">{t.author}</p>
                <p className={`text-xs ${isActive ? "text-purple-300" : "text-gray-500"}`}>
                  {t.role}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={handlePrev}
          className="grid h-11 w-11 place-content-center rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-700 hover:text-white hover:border-purple-700 transition-all duration-300 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleNext}
          className="grid h-11 w-11 place-content-center rounded-full border-2 border-purple-300 text-purple-700 hover:bg-purple-700 hover:text-white hover:border-purple-700 transition-all duration-300 cursor-pointer"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
