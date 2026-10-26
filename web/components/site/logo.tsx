import Link from "next/link";
import { cn } from "@/lib/utils";

/* The wordmark is one of only two places the violet accent appears
   (the other is the search submit). Lowercase, tight tracking, no weight. */
export function LuxeBeauWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={cn("font-medium tracking-[-0.06em] text-violet", className)}>
      luxebeau
    </span>
  );
}

/* Compact monogram for the 64px rail. */
export function LuxeBeauMark({ className = "" }: { className?: string }) {
  return (
    <span className={cn("text-[20px] font-medium tracking-[-0.06em] text-violet", className)} aria-hidden>
      lb
    </span>
  );
}

export function LuxeBeauLogo({
  href = "/",
  className = "",
  textClassName = "text-[22px]",
}: {
  href?: string;
  className?: string;
  textClassName?: string;
}) {
  return (
    <Link href={href} aria-label="LuxeBeau home" className={cn("inline-flex items-center", className)}>
      <LuxeBeauWordmark className={textClassName} />
    </Link>
  );
}
