import Link from "next/link";
import { ArrowUpRight, BadgeCheck, CalendarDays, ShoppingBag } from "@/components/icons";

const CARD =
  "lb-press group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[32px] p-6 text-surface shadow-soft transition-shadow duration-200 hover:shadow-float sm:min-h-[240px]";
const ARROW =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-brand shadow-pill transition-transform duration-200 group-hover:-translate-y-1 group-hover:translate-x-1";

const CARDS = [
  {
    href: "/partnership/seller",
    icon: ShoppingBag,
    photo: "/images/photos/hair-products.webp",
    shade: "from-brand-deep/95 via-brand/60 to-brand/25",
    title: "Sell on LuxeBeau",
    text: "Open a shop in minutes. Paid as soon as buyers confirm delivery.",
    cta: "Start selling",
  },
  {
    href: "/partnership/artisan",
    icon: CalendarDays,
    photo: "/images/photos/braids-box.webp",
    shade: "from-ink/90 via-ink/50 to-ink/15",
    title: "Fill your calendar",
    text: "Braiders, barbers, MUAs: guaranteed appointments with protected deposits.",
    cta: "Join as an artisan",
  },
  {
    href: "/partnership/seller#brands",
    icon: BadgeCheck,
    photo: "/images/photos/fragrance-black-iris.webp",
    shade: "from-[#4b1466]/95 via-brand-deep/55 to-transparent",
    title: "Brand partnerships",
    text: "Launches and creator campaigns with a community that proudly reps you.",
    cta: "Partner with us",
  },
];

/* Sell, fill a calendar, partner: three photo cards, each with its own duotone
   icon, a tinted overlay for readable text, and an arrow that lifts on hover. */
export function JoinRow() {
  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
      {CARDS.map(({ href, icon: Icon, photo, shade, title, text, cta }) => (
        <Link key={href} href={href} className={CARD}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className={`absolute inset-0 bg-gradient-to-t ${shade}`} />
          <div className="relative flex items-start justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/20 backdrop-blur-sm">
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className={ARROW}>
              <ArrowUpRight className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <div className="relative mt-8">
            <h4 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em]">{title}</h4>
            <p className="mt-2 max-w-[300px] text-[14px] leading-snug opacity-90">{text}</p>
            <span className="mt-4 inline-block text-[14px] font-semibold">{cta}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
