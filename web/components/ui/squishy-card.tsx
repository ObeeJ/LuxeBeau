"use client";

import React from "react";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";

interface SquishyCardProps {
  title: string;
  category: string;
  price: string;
  imageUrl?: string;
  onAction?: () => void;
}

export default function SquishyCard({
  title,
  category,
  price,
  imageUrl,
  onAction,
}: SquishyCardProps) {
  return (
    <motion.div
      whileHover="hover"
      transition={{
        duration: 0.6,
        ease: "backInOut",
      }}
      variants={{
        hover: { scale: 1.03 },
      }}
      className="relative h-96 w-full max-w-[288px] overflow-hidden rounded-2xl bg-gradient-to-br from-[#1B0A2E] to-[#2A1045] p-6 flex flex-col justify-between text-white shadow-xl shadow-purple-900/20 border border-purple-500/10"
    >
      <div className="relative z-10">
        <span className="mb-2 block w-fit rounded-full bg-purple-400/15 px-3 py-0.5 text-xs font-light text-purple-200 backdrop-blur-sm border border-purple-400/10">
          {category}
        </span>
        <h3 className="text-xl font-serif font-semibold leading-tight mb-2 tracking-wide">
          {title}
        </h3>
        <p className="text-2xl font-mono font-bold text-purple-300 mt-4">
          ₦{price}
        </p>
      </div>

      {/* Product image overlay */}
      {imageUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-overlay transition-transform duration-700 group-hover:scale-110"
          style={{ backgroundImage: `url(${imageUrl})` }}
        />
      )}

      <button
        onClick={onAction}
        className="relative z-20 w-full rounded-xl border border-purple-300/20 bg-white py-2.5 text-center font-mono text-xs font-black uppercase text-purple-900 tracking-wider transition-all duration-300 hover:bg-purple-100 hover:border-purple-300/40 hover:shadow-lg hover:shadow-purple-500/10 cursor-pointer"
      >
        <div className="flex items-center justify-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5" />
          <span>Add to Bag</span>
        </div>
      </button>

      <Background />
    </motion.div>
  );
}

const Background = () => {
  return (
    <motion.svg
      width="320"
      height="384"
      viewBox="0 0 320 384"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 z-0 pointer-events-none"
      variants={{
        hover: { scale: 1.2, rotate: 5 },
      }}
      transition={{
        duration: 0.8,
        ease: "backInOut",
      }}
    >
      <motion.circle
        variants={{
          hover: {
            scaleY: 0.75,
            y: -15,
          },
        }}
        transition={{
          duration: 0.8,
          ease: "backInOut",
          delay: 0.1,
        }}
        cx="160.5"
        cy="114.5"
        r="110"
        fill="rgba(142, 84, 178, 0.3)"
      />
      <motion.ellipse
        variants={{
          hover: {
            scaleY: 1.8,
            y: -20,
          },
        }}
        transition={{
          duration: 0.8,
          ease: "backInOut",
          delay: 0.1,
        }}
        cx="160.5"
        cy="265.5"
        rx="110"
        ry="50"
        fill="rgba(167, 139, 210, 0.15)"
      />
    </motion.svg>
  );
};
