"use client";

import React from "react";
import { motion, MotionConfig } from "framer-motion";

interface AnimatedHamburgerButtonProps {
  active: boolean;
  setActive: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function AnimatedHamburgerButton({
  active,
  setActive,
}: AnimatedHamburgerButtonProps) {
  return (
    <MotionConfig
      transition={{
        duration: 0.35,
        ease: "easeInOut",
      }}
    >
      <motion.button
        initial={false}
        animate={active ? "open" : "closed"}
        onClick={() => setActive((pv) => !pv)}
        className="relative h-10 w-10 rounded-full bg-primary/5 transition-colors hover:bg-primary/10 flex items-center justify-center"
      >
        <motion.span
          variants={VARIANTS.top}
          className="absolute h-0.5 w-5 bg-primary"
          style={{ y: "-50%", left: "50%", x: "-50%", top: "35%" }}
        />
        <motion.span
          variants={VARIANTS.middle}
          className="absolute h-0.5 w-5 bg-primary"
          style={{ left: "50%", x: "-50%", top: "50%", y: "-50%" }}
        />
        <motion.span
          variants={VARIANTS.bottom}
          className="absolute h-0.5 w-2.5 bg-primary"
          style={{
            x: "-50%",
            y: "50%",
            bottom: "35%",
            left: "calc(50% + 5px)",
          }}
        />
      </motion.button>
    </MotionConfig>
  );
}

const VARIANTS = {
  top: {
    open: {
      rotate: ["0deg", "0deg", "45deg"],
      top: ["35%", "50%", "50%"],
    },
    closed: {
      rotate: ["45deg", "0deg", "0deg"],
      top: ["50%", "50%", "35%"],
    },
  },
  middle: {
    open: {
      rotate: ["0deg", "0deg", "-45deg"],
      opacity: 0,
    },
    closed: {
      rotate: ["-45deg", "0deg", "0deg"],
      opacity: 1,
    },
  },
  bottom: {
    open: {
      rotate: ["0deg", "0deg", "45deg"],
      bottom: ["35%", "50%", "50%"],
      left: "50%",
      width: "20px",
    },
    closed: {
      rotate: ["45deg", "0deg", "0deg"],
      bottom: ["50%", "50%", "35%"],
      left: "calc(50% + 5px)",
      width: "10px",
    },
  },
};
