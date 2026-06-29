"use client";

import React from "react";

interface DrawOutlineButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
}

export default function DrawOutlineButton({
  children,
  className = "",
  ...rest
}: DrawOutlineButtonProps) {
  return (
    <button
      {...rest}
      className={`group relative px-6 py-2.5 font-medium text-primary transition-colors duration-[400ms] hover:text-brand bg-white border border-transparent overflow-hidden ${className}`}
    >
      <span className="relative z-10">{children}</span>

      {/* TOP */}
      <span className="absolute left-0 top-0 h-[2px] w-0 bg-brand transition-all duration-100 group-hover:w-full" />

      {/* RIGHT */}
      <span className="absolute right-0 top-0 h-0 w-[2px] bg-brand transition-all delay-100 duration-100 group-hover:h-full" />

      {/* BOTTOM */}
      <span className="absolute bottom-0 right-0 h-[2px] w-0 bg-brand transition-all delay-200 duration-100 group-hover:w-full" />

      {/* LEFT */}
      <span className="absolute bottom-0 left-0 h-0 w-[2px] bg-brand transition-all delay-300 duration-100 group-hover:h-full" />
    </button>
  );
}
