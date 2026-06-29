"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldCheck,
  Star,
  CalendarCheck,
  ShoppingBag,
  Truck,
  Wallet,
  BadgeCheck,
} from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { useArtisans, useProducts } from "@/lib/queries";
import { type Product } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { useToast } from "@/components/ui/slide-in-notifications";
import { Skeleton } from "@/components/ui/skeleton";

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.08 * i, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const marqueeItems = [
  "Lagos", "Knotless Braids", "Abuja", "Owambe Glam", "Port Harcourt", "Gele Artistry",
  "Ibadan", "Skin Therapy", "Bridal Suites", "Barbering", "Nail Art", "Fragrance",
];

export default function Home() {
  const { add } = useCart();
  const { toast } = useToast();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: artisans = [], isLoading: artisansLoading } = useArtisans();

  const featuredProducts = products.slice(0, 3);
  const featuredArtisans = artisans.slice(0, 3);

  const handleQuickAdd = (product: Product) => {
    add(product);
    toast(`${product.name} added to your bag.`, "success");
  };

  return (
    <div className="min-h-dvh">
      <SiteNav />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="aurora-field absolute inset-0 animate-aurora" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 md:pt-28">
          <motion.p
            custom={0} initial="hidden" animate="show" variants={rise}
            className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-300"
          >
            Nigeria&apos;s luxury beauty marketplace
          </motion.p>
          <motion.h1
            custom={1} initial="hidden" animate="show" variants={rise}
            className="mt-6 max-w-4xl font-display text-5xl font-medium leading-[1.05] sm:text-6xl md:text-7xl"
          >
            Beauty, <em className="text-gold-gradient not-italic font-semibold">made for us.</em>
            <br />
            Crafted here. <em className="italic font-normal text-lavender-200">Delivered everywhere.</em>
          </motion.h1>
          <motion.p
            custom={2} initial="hidden" animate="show" variants={rise}
            className="mt-8 max-w-xl text-lg leading-relaxed text-lavender-200"
          >
            Shop NAFDAC-registered skincare and haircare formulated for melanin-rich skin,
            or book vetted artisans, braiders, gele artists, MUAs, barbers, across Lagos,
            Abuja and Port Harcourt. Every payment secured by Paystack.
          </motion.p>
          <motion.div
            custom={3} initial="hidden" animate="show" variants={rise}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 rounded-full bg-royal-500 px-7 py-3.5 text-sm font-semibold transition-all duration-200 hover:bg-royal-400"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden />
              Shop the edit
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link
              href="/services"
              className="inline-flex items-center gap-2 rounded-full border border-gold-400/60 px-7 py-3.5 text-sm font-semibold text-gold-300 transition-colors duration-200 hover:bg-gold-400/10"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Book an artisan
            </Link>
          </motion.div>
          <motion.dl
            custom={4} initial="hidden" animate="show" variants={rise}
            className="mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-velvet-700/60 pt-8"
          >
            {[
              ["6,400+", "bookings completed"],
              ["320+", "verified sellers & artisans"],
              ["4.8★", "average rating"],
            ].map(([num, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="font-display text-3xl font-semibold text-gold-300">{num}</dd>
                <dd className="mt-1 text-sm text-lavender-400">{label}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        {/* marquee */}
        <div className="relative border-y border-velvet-700/60 bg-velvet-900/60 py-4" aria-hidden>
          <div className="flex w-max animate-marquee gap-12 whitespace-nowrap px-6">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="flex items-center gap-12 text-sm font-medium uppercase tracking-[0.25em] text-lavender-400">
                {item} <span className="text-gold-400">✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Two journeys ── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <h2 className="font-display text-3xl font-medium sm:text-4xl">
          Two ways to <em className="italic text-gold-gradient">glow</em>
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Product journey */}
          <Link href="/shop" className="card-velvet group relative overflow-hidden rounded-3xl p-8 transition-colors duration-300 hover:border-royal-400/60 md:p-10">
            <ShoppingBag className="h-8 w-8 text-royal-400" aria-hidden />
            <h3 className="mt-6 font-display text-2xl font-semibold">The Product Side</h3>
            <ol className="mt-6 space-y-4 text-sm text-lavender-200">
              {[
                "Browse the curated edit, skincare, haircare, makeup, fragrance",
                "Add to bag and check out with Paystack (card, transfer or USSD)",
                "Tracked delivery nationwide in 1 to 4 days",
                "Reorder your staples in one tap",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-display font-semibold text-gold-400">{`0${i + 1}`}</span>
                  {step}
                </li>
              ))}
            </ol>
            <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gold-300">
              Start shopping <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>

          {/* Service journey */}
          <Link href="/services" className="card-velvet group relative overflow-hidden rounded-3xl p-8 transition-colors duration-300 hover:border-gold-400/50 md:p-10">
            <CalendarCheck className="h-8 w-8 text-gold-400" aria-hidden />
            <h3 className="mt-6 font-display text-2xl font-semibold">The Service Side</h3>
            <ol className="mt-6 space-y-4 text-sm text-lavender-200">
              {[
                "Discover vetted artisans by craft, city and reviews",
                "Pick a service and a slot that fits your day",
                "Secure your seat with a deposit via Paystack",
                "Show up, get styled, rate your artisan",
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-display font-semibold text-gold-400">{`0${i + 1}`}</span>
                  {step}
                </li>
              ))}
            </ol>
            <span className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gold-300">
              Find your artisan <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Featured products (paper break) ── */}
      <section className="bg-paper-50 py-24 text-paper-ink">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-500">The edit</p>
              <h2 className="mt-3 font-display text-3xl font-medium sm:text-4xl">This week&apos;s shelf</h2>
            </div>
            <Link href="/shop" className="inline-flex items-center gap-2 text-sm font-semibold text-paper-muted transition-colors hover:text-paper-ink">
              View all products <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {productsLoading && featuredProducts.length === 0
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="overflow-hidden rounded-3xl border border-paper-100 bg-white p-6 shadow-sm" role="status" aria-busy="true">
                    <Skeleton className="h-56 w-full bg-paper-100" />
                    <Skeleton className="mt-4 h-5 w-3/4 bg-paper-100" />
                    <Skeleton className="mt-2 h-4 w-1/2 bg-paper-100" />
                  </div>
                ))
              : featuredProducts.map(product => (
              <article key={product.id} className="group overflow-hidden rounded-3xl border border-paper-100 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl">
                <Link href={`/shop/${product.slug}`} className="block">
                  <div
                    className="relative flex h-56 items-end p-6"
                    style={{ background: `linear-gradient(140deg, ${product.tint[0]}, ${product.tint[1]})` }}
                  >
                    {product.badge && (
                      <span className="absolute left-4 top-4 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                        {product.badge}
                      </span>
                    )}
                    <span className="font-display text-2xl font-semibold italic text-white/90">{product.brand}</span>
                  </div>
                </Link>
                <div className="p-6">
                  <div className="flex items-center gap-1 text-sm text-gold-500">
                    <Star className="h-4 w-4 fill-current" aria-hidden />
                    {product.rating} <span className="text-paper-muted">({product.reviews})</span>
                  </div>
                  <h3 className="mt-2 font-display text-lg font-semibold leading-snug">
                    <Link href={`/shop/${product.slug}`} className="hover:underline">{product.name}</Link>
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-paper-muted">{product.blurb}</p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="font-display text-xl font-semibold">{formatNaira(product.priceNGN)}</span>
                    <button
                      onClick={() => handleQuickAdd(product)}
                      className="rounded-full bg-paper-ink px-5 py-2.5 text-sm font-semibold text-paper-50 transition-colors duration-200 hover:bg-royal-600"
                    >
                      Add to bag
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured artisans ── */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">The masters</p>
            <h2 className="mt-3 font-display text-3xl font-medium sm:text-4xl">Artisans worth the waitlist</h2>
          </div>
          <Link href="/services" className="inline-flex items-center gap-2 text-sm font-semibold text-lavender-200 transition-colors hover:text-gold-300">
            Browse all artisans <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {artisansLoading && featuredArtisans.length === 0
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card-velvet overflow-hidden rounded-3xl p-6" role="status" aria-busy="true">
                  <Skeleton className="h-40 w-full bg-velvet-800/60" />
                  <Skeleton className="mt-4 h-5 w-2/3 bg-velvet-800/60" />
                  <Skeleton className="mt-2 h-4 w-1/2 bg-velvet-800/60" />
                </div>
              ))
            : featuredArtisans.map(artisan => (
            <Link
              key={artisan.id}
              href={`/services/${artisan.slug}`}
              className="card-velvet group overflow-hidden rounded-3xl transition-colors duration-300 hover:border-gold-400/50"
            >
              <div
                className="flex h-40 items-center justify-center"
                style={{ background: `linear-gradient(140deg, ${artisan.tint[0]}, ${artisan.tint[1]})` }}
              >
                <span className="font-display text-5xl font-semibold italic text-white/85">
                  {artisan.name.split(" ").map(n => n[0]).join("")}
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">{artisan.name}</h3>
                  {artisan.verified && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-300">
                      <BadgeCheck className="h-4 w-4" aria-hidden /> Verified
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-lavender-400">{artisan.craft} · {artisan.area}, {artisan.city}</p>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-gold-300">
                    <Star className="h-4 w-4 fill-current" aria-hidden /> {artisan.rating}
                    <span className="text-lavender-400">({artisan.bookings} bookings)</span>
                  </span>
                  <span className="font-semibold text-lavender-200">from {formatNaira(artisan.fromNGN)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="border-y border-velvet-700/60 bg-velvet-900/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {[
            { icon: ShieldCheck, title: "Vetted, always", body: "Every seller and artisan passes ID, portfolio and hygiene checks before going live." },
            { icon: Wallet, title: "Paystack secured", body: "Card, bank transfer or USSD. Deposits held in escrow until your appointment holds." },
            { icon: Truck, title: "Nationwide delivery", body: "Lagos same-day available. Everywhere else in Nigeria within 1 to 4 working days." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <Icon className="h-6 w-6 shrink-0 text-gold-400" aria-hidden />
              <div>
                <h3 className="font-display font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-lavender-400">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="relative overflow-hidden py-28 text-center">
        <div className="aurora-field absolute inset-0" aria-hidden />
        <div className="relative mx-auto max-w-2xl px-4">
          <h2 className="font-display text-4xl font-medium leading-tight sm:text-5xl">
            Your next look is <em className="text-gold-gradient italic">already waiting.</em>
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lavender-200">
            Join thousands shopping and booking on LuxeBeau, from Lekki to Maitama to GRA.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/shop" className="rounded-full bg-royal-500 px-8 py-3.5 text-sm font-semibold transition-colors duration-200 hover:bg-royal-400">
              Shop products
            </Link>
            <Link href="/services" className="rounded-full border border-gold-400/60 px-8 py-3.5 text-sm font-semibold text-gold-300 transition-colors duration-200 hover:bg-gold-400/10">
              Book a session
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
