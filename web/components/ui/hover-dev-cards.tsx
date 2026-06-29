"use client";

import React from "react";
import { Gem, BadgeCheck, Zap, Heart, LucideIcon } from "lucide-react";

interface CardItem {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  href: string;
}

const ITEMS: CardItem[] = [
  {
    title: "Vetted Artisans",
    subtitle: "Highly skilled, certified local experts.",
    href: "#",
    Icon: BadgeCheck,
  },
  {
    title: "100% Authentic",
    subtitle: "Sourced directly from verified brands.",
    href: "#",
    Icon: Gem,
  },
  {
    title: "Swift Delivery",
    subtitle: "Express shipping options across Lagos.",
    href: "#",
    Icon: Zap,
  },
  {
    title: "Premium Care",
    subtitle: "Tailored treatments & wellness routines.",
    href: "#",
    Icon: Heart,
  },
];

export default function HoverDevCards() {
  return (
    <div className="py-12 w-full max-w-6xl mx-auto px-4">
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item, idx) => (
          <Card
            key={idx}
            title={item.title}
            subtitle={item.subtitle}
            href={item.href}
            Icon={item.Icon}
          />
        ))}
      </div>
    </div>
  );
}

interface CardProps {
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  href: string;
}

const Card = ({ title, subtitle, Icon, href }: CardProps) => {
  return (
    <a
      href={href}
      className="w-full p-6 rounded-2xl border border-purple-100 relative overflow-hidden group bg-white shadow-sm flex flex-col justify-between min-h-[160px] transition-all duration-300 hover:shadow-lg hover:shadow-purple-200/30"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#6B3FA0] via-[#8E54B2] to-[#1B0A2E] translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-500 ease-out" />

      <Icon className="absolute z-10 -top-12 -right-12 text-9xl text-purple-100 opacity-30 group-hover:text-purple-300/15 group-hover:rotate-12 transition-transform duration-500" />
      
      <div className="relative z-10">
        <Icon className="mb-4 text-3xl text-purple-600 group-hover:text-purple-200 transition-colors duration-300" />
        <h3 className="font-serif font-semibold text-lg text-purple-900 group-hover:text-white transition-colors duration-300 mb-1">
          {title}
        </h3>
        <p className="text-sm text-gray-500 group-hover:text-purple-200 transition-colors duration-300 leading-relaxed">
          {subtitle}
        </p>
      </div>
    </a>
  );
};
