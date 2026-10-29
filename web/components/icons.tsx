import * as React from "react";

/* LuxeBeau's own icon set. Signature: every icon carries a faded "echo" of
   itself, nudged down and right like the Pair logo's second ring. On hover the
   echo slides into place, so icons come together the way the rings do. The echo and the soft fill are always brand purple (white on a purple
   surface), never grey, over a rounded 1.9px line in the current colour, on a 24px grid. Plain utility icons (spinners,
   chevrons, alerts) fall through to the stock set below; anything defined here
   wins over a stock icon of the same name. */

type IconProps = Omit<React.SVGProps<SVGSVGElement>, "ref"> & { size?: number | string; strokeWidth?: number | string };

function duo(name: string, soft: React.ReactNode, line: React.ReactNode) {
  const Icon = React.forwardRef<SVGSVGElement, IconProps>(function Icon({ size = 24, strokeWidth = 1.9, ...props }, ref) {
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        overflow="visible"
        {...props}
      >
        <g fill="var(--lb-icon-2, var(--color-brand-purple))" fillOpacity={0.24} stroke="none">{soft}</g>
        <g className="lb-echo" stroke="var(--lb-icon-2, var(--color-brand-purple))" strokeOpacity={0.7}>{line}</g>
        {line}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}

const disc = <circle cx="12" cy="12" r="9" />;
const ring = <circle cx="12" cy="12" r="9" />;

export const Home = duo("Home",
  <path d="M4 11.5 12 4.5l8 7V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />,
  <><path d="M3.5 11.5 12 4l8.5 7.5" /><path d="M6 10v9.5h12V10" /><path d="M10 19.5v-4.5h4v4.5" /></>);

export const LayoutGrid = duo("LayoutGrid",
  <><rect x="4" y="4" width="7" height="7" rx="2.2" /><rect x="13" y="13" width="7" height="7" rx="2.2" /></>,
  <><rect x="4" y="4" width="7" height="7" rx="2.2" /><rect x="13" y="4" width="7" height="7" rx="2.2" /><rect x="4" y="13" width="7" height="7" rx="2.2" /><rect x="13" y="13" width="7" height="7" rx="2.2" /></>);

export const CalendarDays = duo("CalendarDays",
  <rect x="4" y="5.5" width="16" height="14.5" rx="3.5" />,
  <><rect x="4" y="5.5" width="16" height="14.5" rx="3.5" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /><path d="M8 14h.01M12 14h.01M16 14h.01" strokeWidth={2.4} /></>);

export const ShoppingBag = duo("ShoppingBag",
  <path d="M5.2 8.5h13.6l.9 10.7a1.2 1.2 0 0 1-1.2 1.3H5.5a1.2 1.2 0 0 1-1.2-1.3z" />,
  <><path d="M5.2 8.5h13.6l.9 10.7a1.2 1.2 0 0 1-1.2 1.3H5.5a1.2 1.2 0 0 1-1.2-1.3z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></>);

export const Package = duo("Package",
  <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />,
  <><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></>);

export const CircleUser = duo("CircleUser",
  disc,
  <>{ring}<circle cx="12" cy="10" r="3" /><path d="M6.4 18.3a6.5 6.5 0 0 1 11.2 0" /></>);

export const Search = duo("Search",
  <circle cx="11" cy="11" r="7" />,
  <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>);

export const ScanLine = duo("ScanLine",
  <rect x="7" y="7" width="10" height="10" rx="2" />,
  <><path d="M3 8V6a3 3 0 0 1 3-3h2M16 3h2a3 3 0 0 1 3 3v2M21 16v2a3 3 0 0 1-3 3h-2M8 21H6a3 3 0 0 1-3-3v-2" /><path d="M7 12h10" /></>);

export const ArrowRight = duo("ArrowRight",
  <circle cx="12" cy="12" r="9" />,
  <path d="M6 12h12m-5-5 5 5-5 5" />);

export const ArrowUpRight = duo("ArrowUpRight",
  <circle cx="12" cy="12" r="9" />,
  <path d="M8 16 16 8M9 8h7v7" />);

export const ShieldCheck = duo("ShieldCheck",
  <path d="M12 3 19.5 6v5.5c0 4.5-3 7.8-7.5 9.5-4.5-1.7-7.5-5-7.5-9.5V6z" />,
  <><path d="M12 3 19.5 6v5.5c0 4.5-3 7.8-7.5 9.5-4.5-1.7-7.5-5-7.5-9.5V6z" /><path d="m8.8 12 2.4 2.4 4.2-4.6" /></>);

export const BadgeCheck = duo("BadgeCheck",
  disc,
  <>{ring}<path d="m8.4 12.2 2.5 2.5 4.7-5" /></>);

export const CheckCircle2 = duo("CheckCircle2",
  disc,
  <>{ring}<path d="m8.4 12.2 2.5 2.5 4.7-5" /></>);

export const CircleHelp = duo("CircleHelp",
  disc,
  <>{ring}<path d="M9.6 9.6a2.5 2.5 0 0 1 4.9.6c0 1.7-2.5 2.2-2.5 3.7" /><path d="M12 17.2h.01" strokeWidth={2.4} /></>);

export const Info = duo("Info",
  disc,
  <>{ring}<path d="M12 11v5.5" /><path d="M12 7.8h.01" strokeWidth={2.4} /></>);

export const Heart = duo("Heart",
  <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />,
  <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z" />);

export const Star = duo("Star",
  <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />,
  <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />);

export const Play = duo("Play",
  <path d="M7 4.5v15l12-7.5z" />,
  <path d="M7 4.5v15l12-7.5z" />);

export const MapPin = duo("MapPin",
  <path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />,
  <><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></>);

export const Clock = duo("Clock",
  disc,
  <>{ring}<path d="M12 7.5V12l3 2" /></>);

export const Check = duo("Check", null, <path d="m5 12.5 4.5 4.5L19 7.5" />);
export const Plus = duo("Plus", null, <path d="M12 5v14M5 12h14" />);
export const Minus = duo("Minus", null, <path d="M5 12h14" />);

/* Brand-only glyphs */
export const Naira = duo("Naira",
  disc,
  <>{ring}<path d="M9.2 7.5v9M14.8 7.5v9M9.2 7.5l5.6 9M7.5 10.6h9M7.5 13.4h9" strokeWidth={1.7} /></>);

export * from "lucide-react";
