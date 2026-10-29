import React from "react";
import { cn } from "@/lib/utils";

interface DuotoneIconProps extends React.SVGProps<SVGSVGElement> {
  active?: boolean;
}

export function DuotoneHome({ className, active, ...props }: DuotoneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform duration-150", className)}
      {...props}
    >
      {/* Secondary accent fill on roof/back */}
      <path
        d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        className={cn(active ? "fill-brand/20 text-brand" : "fill-brand/10 text-current")}
      />
      {/* Primary door contour */}
      <path
        d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
        className={active ? "text-brand" : "text-current"}
      />
    </svg>
  );
}

export function DuotoneStore({ className, active, ...props }: DuotoneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform duration-150", className)}
      {...props}
    >
      {/* Store awning fill */}
      <path
        d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"
        className={cn(active ? "fill-brand/20" : "fill-brand/10")}
      />
      <path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5" />
      <path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244" />
    </svg>
  );
}

export function DuotoneArtisan({ className, active, ...props }: DuotoneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform duration-150", className)}
      {...props}
    >
      {/* Palette / Mirror artisan symbol with duotone fill */}
      <path
        d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.15-1.1-1.46-1.1-1.46-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10.02 10.02 0 0 0 22 12c0-5.52-4.48-10-10-10z"
        className="hidden"
      />
      {/* Scissors and comb or beauty artisan badge */}
      <circle
        cx="12"
        cy="12"
        r="9"
        className={cn(active ? "fill-brand/20 stroke-brand" : "fill-brand/10 stroke-current")}
      />
      <path d="M12 8v8" className={active ? "stroke-brand" : "stroke-current"} />
      <path d="M8 12h8" className={active ? "stroke-brand" : "stroke-current"} />
      <circle cx="9" cy="9" r="1.2" className="fill-current" />
      <circle cx="15" cy="15" r="1.2" className="fill-current" />
    </svg>
  );
}

export function DuotoneBag({ className, active, ...props }: DuotoneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform duration-150", className)}
      {...props}
    >
      {/* Bag base filled */}
      <path
        d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"
        className={cn(active ? "fill-brand/20 stroke-brand" : "fill-brand/10 stroke-current")}
      />
      <path d="M16 10a4 4 0 0 1-8 0" className={active ? "stroke-brand" : "stroke-current"} />
      <path d="M3.103 6.034h17.794" />
    </svg>
  );
}

export function DuotoneUser({ className, active, ...props }: DuotoneIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2.25 : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("transition-transform duration-150", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        className={cn(active ? "fill-brand/20 stroke-brand" : "fill-brand/10 stroke-current")}
      />
      <circle cx="12" cy="10" r="3" className={active ? "fill-brand/30 stroke-brand" : "fill-brand/15 stroke-current"} />
      <path d="M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662" />
    </svg>
  );
}
