"use client";

import React, { useRef, useState } from "react";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";

interface EncryptButtonProps {
  targetText: string;
  onClick?: () => void;
  className?: string;
}

const CYCLES_PER_LETTER = 2;
const SHUFFLE_TIME = 40;
const CHARS = "A$#@&%?*{}[]()X!";

export default function EncryptButton({
  targetText,
  onClick,
  className = "",
}: EncryptButtonProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [text, setText] = useState(targetText);

  const scramble = () => {
    let pos = 0;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      const scrambled = targetText
        .split("")
        .map((char, index) => {
          if (pos / CYCLES_PER_LETTER > index) {
            return char;
          }

          const randomCharIndex = Math.floor(Math.random() * CHARS.length);
          return CHARS[randomCharIndex];
        })
        .join("");

      setText(scrambled);
      pos++;

      if (pos >= targetText.length * CYCLES_PER_LETTER) {
        stopScramble();
      }
    }, SHUFFLE_TIME);
  };

  const stopScramble = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setText(targetText);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.025 }}
      whileTap={{ scale: 0.975 }}
      onMouseEnter={scramble}
      onMouseLeave={stopScramble}
      onClick={onClick}
      className={`group relative overflow-hidden rounded-md border border-brand bg-primary px-6 py-2.5 font-mono font-medium uppercase text-white transition-colors hover:bg-brand/10 hover:text-brand ${className}`}
    >
      <div className="relative z-10 flex items-center justify-center gap-2">
        <Lock className="w-4 h-4" />
        <span>{text}</span>
      </div>
      <motion.span
        initial={{ y: "100%" }}
        animate={{ y: "-100%" }}
        transition={{
          repeat: Infinity,
          repeatType: "mirror",
          duration: 1.5,
          ease: "linear",
        }}
        className="absolute inset-0 z-0 scale-125 bg-gradient-to-t from-light/0 via-light/20 to-light/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
    </motion.button>
  );
}
