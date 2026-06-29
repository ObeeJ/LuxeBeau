"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Brush,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Package,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { StatCard, StatusPill } from "@/components/dashboard/widgets";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/store";
import { useMyBookings, useMyOrders, useSubmitKyc } from "@/lib/queries";
import { formatNaira } from "@/lib/format";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { useToast } from "@/components/ui/slide-in-notifications";

const workspaces = [
  { href: "/dashboard/seller", icon: Store, title: "Seller studio", body: "Track orders, payouts and product performance for your beauty brand.", roles: ["seller", "admin"] },
  { href: "/dashboard/artisan", icon: Brush, title: "Artisan studio", body: "Manage your calendar, confirm bookings and watch your craft earn.", roles: ["artisan", "admin"] },
  { href: "/dashboard/admin", icon: Shield, title: "Admin console", body: "Verify partners, monitor marketplace health and resolve disputes.", roles: ["admin"] },
];

const titleCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "Pending");

export default function DashboardHome() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);

  /* Auto-redirect partner roles to their workspace. Buyers stay here. */
  useEffect(() => {
    if (!user) return;
    if (user.role === "artisan") router.replace("/dashboard/artisan");
    else if (user.role === "seller") router.replace("/dashboard/seller");
  }, [user, router]);

  // Orders/bookings are only meaningful for a signed-in person.
  const enabled = Boolean(user);
  const orders = useMyOrders(enabled);
  const bookings = useMyBookings(enabled);

  const submitKyc = useSubmitKyc();
  const { toast } = useToast();
  const [kycType, setKycType] = useState<"nin" | "bvn">("nin");
  const [kycValue, setKycValue] = useState("");

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl py-20 text-center">
        <Sparkles className="mx-auto h-10 w-10 text-gold-400" aria-hidden />
        <h1 className="mt-6 font-display text-3xl font-medium">Your LuxeBeau account</h1>
        <p className="mt-3 text-lavender-200">
          Sign in to see your orders, track deliveries and manage your bookings.
        </p>
        <button
          onClick={() => showAuth("login")}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-royal-500 px-7 py-3 text-sm font-semibold transition-colors hover:bg-royal-400"
        >
          Sign in <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </main>
    );
  }

  const ordersList = orders.data ?? [];
  const bookingsList = bookings.data ?? [];
  const totalSpend = ordersList.reduce((s, o) => s + o.totalNGN, 0);
  const isArtisan = user.role === "artisan";

  return (
    <main className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">
            {isArtisan ? "Artisan account" : "My account"}
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium">
            Welcome back, <em className="text-gold-gradient italic">{user.name.split(" ")[0]}</em>
          </h1>
          <p className="mt-1 text-sm text-lavender-400">
            {titleCase(user.role)} · {user.email}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/shop" className="rounded-full border border-velvet-700 px-5 py-2.5 text-sm font-semibold text-lavender-200 transition-colors hover:border-gold-400/60">
            Shop
          </Link>
          <Link href="/services" className="rounded-full bg-royal-500 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-royal-400">
            Book a service
          </Link>
        </div>
      </header>

      {/* Stats */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Account summary">
        <StatCard icon={Package} label="Orders" value={String(ordersList.length)} />
        <StatCard icon={CalendarDays} label={isArtisan ? "Incoming bookings" : "Bookings"} value={String(bookingsList.length)} />
        <StatCard icon={Banknote} label={isArtisan ? "Booking value" : "Total spend"} value={formatNaira(isArtisan ? bookingsList.reduce((s, b) => s + b.priceNGN, 0) : totalSpend)} />
      </section>

      {/* Identity verification (NIN/BVN via Prembly) */}
      <section className="card-velvet mt-6 rounded-3xl p-6" aria-label="Identity verification">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <ShieldCheck className="h-5 w-5 text-gold-400" aria-hidden /> Identity verification
        </h2>
        {user.kyc_status === "verified" ? (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-4 text-sm text-success">
            <CheckCircle2 className="h-5 w-5" aria-hidden /> Your identity is verified. Thank you for keeping LuxeBeau trusted.
          </p>
        ) : user.kyc_status === "pending" ? (
          <p className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
            Your submission is under review. We will update your status shortly.
          </p>
        ) : (
          <form
            className="mt-4"
            onSubmit={e => {
              e.preventDefault();
              if (kycValue.trim().length < 10) {
                toast("Enter a valid NIN or BVN.", "error");
                return;
              }
              submitKyc.mutate(
                { type: kycType, value: kycValue.trim() },
                {
                  onSuccess: r => toast(r.kyc_status === "verified" ? "Identity verified." : "Submitted for review.", "success"),
                  onError: err => toast(err instanceof Error ? err.message : "Verification failed.", "error"),
                },
              );
            }}
          >
            <p className="text-sm text-lavender-300">
              Every LuxeBeau member verifies their identity. Submit your NIN or BVN; we never store the raw number.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wider text-lavender-400">Document</span>
                <select
                  value={kycType}
                  onChange={e => setKycType(e.target.value as "nin" | "bvn")}
                  className="rounded-lg border border-velvet-700 bg-velvet-900 px-3 py-2.5 text-sm"
                >
                  <option value="nin">NIN</option>
                  <option value="bvn">BVN</option>
                </select>
              </label>
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-xs uppercase tracking-wider text-lavender-400">{kycType.toUpperCase()} number</span>
                <input
                  inputMode="numeric"
                  value={kycValue}
                  onChange={e => setKycValue(e.target.value)}
                  placeholder={kycType === "nin" ? "11-digit NIN" : "11-digit BVN"}
                  className="w-full min-w-40 rounded-lg border border-velvet-700 bg-velvet-900 px-3 py-2.5 text-sm placeholder:text-lavender-400/60"
                />
              </label>
              <button
                type="submit"
                disabled={submitKyc.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-royal-500 px-6 py-2.5 text-sm font-semibold transition-colors hover:bg-royal-400 disabled:opacity-60"
              >
                {submitKyc.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Verify identity
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Orders */}
      {!isArtisan && (
        <section className="card-velvet mt-8 overflow-x-auto rounded-3xl p-6" aria-label="Your orders">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <ShoppingBag className="h-5 w-5 text-gold-400" aria-hidden /> Your orders
          </h2>
          {orders.isLoading ? (
            <div className="mt-5 space-y-3" aria-busy="true" role="status">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-velvet-800/60" />)}
            </div>
          ) : orders.isError ? (
            <LoadError onRetry={() => orders.refetch()} message="We could not load your orders." />
          ) : ordersList.length === 0 ? (
            <div className="mt-6 rounded-xl border border-velvet-700 p-8 text-center text-sm text-lavender-400">
              <p>No orders yet. When you check out, your receipts and delivery tracking show up here.</p>
              <Link href="/shop" className="mt-4 inline-block font-semibold text-gold-300 hover:underline">Browse the shelf</Link>
            </div>
          ) : (
            <table className="mt-5 w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="border-b border-velvet-700/60 text-xs uppercase tracking-wider text-lavender-400">
                  <th scope="col" className="pb-3 pr-4">Ref</th>
                  <th scope="col" className="pb-3 pr-4">Items</th>
                  <th scope="col" className="pb-3 pr-4">Date</th>
                  <th scope="col" className="pb-3 pr-4 text-right">Total</th>
                  <th scope="col" className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordersList.map(o => (
                  <tr key={o.id} className="border-b border-velvet-700/30 last:border-0">
                    <td className="py-4 pr-4 font-semibold text-gold-300">{o.id}</td>
                    <td className="max-w-64 truncate py-4 pr-4 text-lavender-400">{o.itemSummary}</td>
                    <td className="py-4 pr-4 text-lavender-400">{o.date || "—"}</td>
                    <td className="py-4 pr-4 text-right font-semibold tabular-nums">{formatNaira(o.totalNGN)}</td>
                    <td className="py-4"><StatusPill status={titleCase(o.status)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Bookings */}
      <section className="card-velvet mt-6 overflow-x-auto rounded-3xl p-6" aria-label="Your bookings">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <CalendarDays className="h-5 w-5 text-gold-400" aria-hidden /> {isArtisan ? "Incoming bookings" : "Your bookings"}
        </h2>
        {bookings.isLoading ? (
          <div className="mt-5 space-y-3" aria-busy="true" role="status">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-velvet-800/60" />)}
          </div>
        ) : bookings.isError ? (
          <LoadError onRetry={() => bookings.refetch()} message="We could not load your bookings." />
        ) : bookingsList.length === 0 ? (
          <div className="mt-6 rounded-xl border border-velvet-700 p-8 text-center text-sm text-lavender-400">
            <p>{isArtisan ? "No bookings yet. They appear here the moment a client books you." : "No bookings yet. Find a verified artisan and hold your slot."}</p>
            <Link href="/services" className="mt-4 inline-block font-semibold text-gold-300 hover:underline">Browse artisans</Link>
          </div>
        ) : (
          <table className="mt-5 w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-velvet-700/60 text-xs uppercase tracking-wider text-lavender-400">
                <th scope="col" className="pb-3 pr-4">Ref</th>
                <th scope="col" className="pb-3 pr-4">{isArtisan ? "Client" : "Artisan"}</th>
                <th scope="col" className="pb-3 pr-4">Service</th>
                <th scope="col" className="pb-3 pr-4">When</th>
                <th scope="col" className="pb-3 pr-4 text-right">Fee</th>
                <th scope="col" className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookingsList.map(b => (
                <tr key={b.id} className="border-b border-velvet-700/30 last:border-0">
                  <td className="py-4 pr-4 font-semibold text-gold-300">{b.id}</td>
                  <td className="py-4 pr-4">{b.with || "—"}</td>
                  <td className="max-w-48 truncate py-4 pr-4 text-lavender-400">{b.service}</td>
                  <td className="py-4 pr-4 text-lavender-400">{b.date || "—"}{b.time ? ` · ${b.time}` : ""}</td>
                  <td className="py-4 pr-4 text-right font-semibold tabular-nums">{formatNaira(b.priceNGN)}</td>
                  <td className="py-4"><StatusPill status={titleCase(b.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Workspaces for elevated roles */}
      {(() => {
        const available = workspaces.filter(w => w.roles.includes(user.role));
        if (available.length === 0) return null;
        return (
          <section className="mt-10" aria-label="Workspaces">
            <h2 className="font-display text-lg font-semibold">Your workspaces</h2>
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              {available.map(({ href, icon: Icon, title, body }) => (
                <Link key={href} href={href} className="card-velvet group rounded-3xl p-7 transition-colors duration-300 hover:border-gold-400/50">
                  <Icon className="h-7 w-7 text-gold-400" aria-hidden />
                  <h3 className="mt-5 font-display text-xl font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-lavender-400">{body}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-gold-300">
                    Enter <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })()}
    </main>
  );
}
