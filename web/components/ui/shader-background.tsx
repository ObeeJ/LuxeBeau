"use client";

import React from "react";

interface ShaderBackgroundProps {
  children: React.ReactNode;
}

export default function ShaderBackground({ children }: ShaderBackgroundProps) {
  return (
    <div className="w-full relative overflow-hidden bg-gradient-to-br from-[#0F051C] via-[#1B0A2E] to-[#2A1045]">
      {/* Lavender Ambient Orbs */}
      <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-gradient-to-tr from-purple-800/25 to-violet-500/15 blur-[140px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-gradient-to-bl from-purple-400/12 to-fuchsia-800/10 blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute top-[25%] left-[35%] w-[35vw] h-[35vw] rounded-full bg-gradient-to-r from-violet-500/8 to-purple-300/8 blur-[100px] pointer-events-none" />
      
      {/* Subtle bloom accent — top right corner */}
      <div className="absolute top-[5%] right-[15%] w-[20vw] h-[20vw] rounded-full bg-gradient-to-bl from-lavender-300/10 to-purple-600/5 blur-[80px] pointer-events-none animate-pulse-slow" style={{ animationDelay: "2s" }} />

      {/* Refined grid overlay — subtle diamond pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#a78bd208_1px,transparent_1px),linear-gradient(to_bottom,#a78bd208_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />
      
      {/* Top edge glow */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-purple-400/20 to-transparent" />

      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
