"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Brush, CalendarDays, CircleUser, Loader2, Package, ShieldCheck, Store, Wallet } from "lucide-react";
import { PageHeader, Panel, RecordList, RecordRow, StatCard, StatusPill } from "@/components/dashboard/widgets";
import { EmptyState, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import { useMyBookings, useMyOrders, useSubmitKyc, useWallet } from "@/lib/queries";
import { formatNaira } from "@/lib/format";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { useToast } from "@/components/ui/slide-in-notifications";
import { getFriendlyErrorMessage } from "@/lib/errors";

function ListSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const showAuth = useAuthModal(s => s.show);

  /* Partner roles land in their own studio. Buyers and admins stay here. */
  useEffect(() => {
    if (!user) return;
    if (user.role === "artisan") router.replace("/dashboard/artisan");
    else if (user.role === "seller") router.replace("/dashboard/seller");
  }, [user, router]);

  const enabled = Boolean(user);
  const orders = useMyOrders(enabled);
  const bookings = useMyBookings(enabled);
  const wallet = useWallet(enabled);

  const submitKyc = useSubmitKyc();
  const { toast } = useToast();
  const [kycType, setKycType] = useState<"nin" | "bvn">("nin");
  const [kycValue, setKycValue] = useState("");

  if (!user) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <CircleUser className="mx-auto h-8 w-8" strokeWidth={1.5} aria-hidden />
        <h1 className="t-display mt-3">Your LuxeBeau account</h1>
        <p className="mt-2 text-[16px] text-muted">Sign in to see your orders, bookings and wallet.</p>
        <Button onClick={() => showAuth("login")} size="lg" className="mt-5">Sign in</Button>
      </div>
    );
  }

  const ordersList = orders.data ?? [];
  const bookingsList = bookings.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My account"
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        subtitle={<><span className="capitalize">{user.role}</span> · {user.email}</>}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link href="/shop">Shop</Link></Button>
            <Button asChild><Link href="/services">Book a service</Link></Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Account summary">
        <StatCard icon={Package} label="Orders" value={orders.isLoading ? "—" : String(ordersList.length)} />
        <StatCard icon={CalendarDays} label="Bookings" value={bookings.isLoading ? "—" : String(bookingsList.length)} />
        <StatCard icon={Wallet} label="Wallet balance" value={wallet.data ? formatNaira(wallet.data.balanceNGN) : "—"} />
        <StatCard icon={ShieldCheck} label="Identity" value={user.kyc_status ? user.kyc_status : "unverified"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your orders" icon={Package}>
          {orders.isLoading ? (
            <ListSkeleton />
          ) : orders.isError ? (
            <LoadError onRetry={() => orders.refetch()} message="We could not load your orders." />
          ) : ordersList.length === 0 ? (
            <EmptyState>
              No orders yet. <Link href="/shop" className="text-ink underline underline-offset-4">Browse the shelf</Link>
            </EmptyState>
          ) : (
            <RecordList>
              {ordersList.map(o => (
                <RecordRow
                  key={o.id}
                  title={o.id}
                  subtitle={o.itemSummary}
                  meta={`${o.date || "—"} · payment ${o.paymentStatus} · ${o.paymentMethod}`}
                  amount={formatNaira(o.totalNGN)}
                  status={<StatusPill status={o.shippingStatus} />}
                />
              ))}
            </RecordList>
          )}
        </Panel>

        <Panel title="Your bookings" icon={CalendarDays}>
          {bookings.isLoading ? (
            <ListSkeleton />
          ) : bookings.isError ? (
            <LoadError onRetry={() => bookings.refetch()} message="We could not load your bookings." />
          ) : bookingsList.length === 0 ? (
            <EmptyState>
              No bookings yet. <Link href="/services" className="text-ink underline underline-offset-4">Find an artisan</Link>
            </EmptyState>
          ) : (
            <RecordList>
              {bookingsList.map(b => (
                <RecordRow
                  key={b.id}
                  title={b.service}
                  subtitle={b.artisan || b.with}
                  meta={`${b.id} · ${b.date}${b.time ? ` · ${b.time}` : ""}${b.serviceType ? ` · ${b.serviceType}` : ""}`}
                  amount={formatNaira(b.priceNGN)}
                  status={<StatusPill status={b.status} />}
                />
              ))}
            </RecordList>
          )}
        </Panel>
      </div>

      {/* Identity verification (POST /me/kyc, NIN or BVN) */}
      <Panel title="Identity verification" icon={ShieldCheck}>
        {user.kyc_status === "verified" ? (
          <p className="text-[16px]">Your identity is verified.</p>
        ) : user.kyc_status === "pending" ? (
          <p className="text-[16px] text-muted">Your submission is under review.</p>
        ) : (
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!/^\d{11}$/.test(kycValue.trim())) {
                toast(`Enter your 11-digit ${kycType.toUpperCase()}.`, "error");
                return;
              }
              submitKyc.mutate(
                { type: kycType, value: kycValue.trim() },
                {
                  onSuccess: r => {
                    useAuth.getState().updateUser({ kyc_status: r.kyc_status });
                    setKycValue("");
                    toast(r.kyc_status === "verified" ? "Identity verified." : "Submitted. We'll review it shortly.", "success");
                  },
                  onError: err => toast(getFriendlyErrorMessage(err, "Verification failed. Please check the number and try again."), "error"),
                },
              );
            }}
          >
            <p className="text-[14px] tracking-[-0.014em] text-muted">Submit your NIN or BVN. The number is sent to our verification partner and never stored.</p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="w-32">
                <span className="t-meta mb-1.5 block">Document</span>
                <select value={kycType} onChange={e => setKycType(e.target.value as "nin" | "bvn")} className="lb-input h-11">
                  <option value="nin">NIN</option>
                  <option value="bvn">BVN</option>
                </select>
              </label>
              <label className="min-w-48 flex-1">
                <span className="t-meta mb-1.5 block">{kycType.toUpperCase()} number</span>
                <input inputMode="numeric" value={kycValue} onChange={e => setKycValue(e.target.value)} placeholder="11 digits" className="lb-input h-11" />
              </label>
              <Button type="submit" disabled={submitKyc.isPending}>
                {submitKyc.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Verify identity
              </Button>
            </div>
          </form>
        )}
      </Panel>

      {user.role === "buyer" && (
        <section aria-label="Become a partner" className="grid gap-3 md:grid-cols-2">
          {[
            { href: "/partnership/seller", icon: Store, title: "Sell on LuxeBeau", body: "Open a seller studio for your brand." },
            { href: "/partnership/artisan", icon: Brush, title: "Join as an artisan", body: "Publish your services and take bookings." },
          ].map(({ href, icon: Icon, title, body }) => (
            <Link key={href} href={href} className="group flex items-center gap-4 rounded-[28px] bg-surface p-5 shadow-card transition-shadow duration-200 hover:shadow-float">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas"><Icon className="h-4 w-4" aria-hidden /></span>
              <div className="min-w-0 flex-1">
                <p className="t-sub">{title}</p>
                <p className="text-[14px] tracking-[-0.014em] text-muted">{body}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
