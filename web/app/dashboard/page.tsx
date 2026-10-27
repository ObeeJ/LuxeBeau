"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Panel, RecordList, Tabs } from "@/components/dashboard/widgets";
import { OrderRow } from "@/components/dashboard/order-row";
import { BookingRow } from "@/components/dashboard/booking-row";
import { EmptyState, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import { useMyBookings, useMyOrders, useWallet } from "@/lib/queries";
import { formatNaira, lagosToday } from "@/lib/format";
import { type MyBooking, type MyOrder } from "@/lib/api";
import { useAuthModal } from "@/components/auth/auth-dialog";

type Tab = "orders" | "bookings" | "account";

function ListSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-busy="true">
      {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );
}

const paymentLabel = (s: string) => (s === "paid" ? "Paid" : s === "failed" ? "Payment failed" : "Awaiting payment");
/* Orders can span sellers, so items ship separately. The order's own status
   is its slowest item; say so when some items are ahead. */
function orderProgress(o: MyOrder) {
  const moved = o.items.filter(i => i.stage === "shipped" || i.stage === "delivered").length;
  const partly = moved > 0 && moved < o.items.length;
  const status = partly ? "partly shipped" : o.shippingStatus === "pending" ? "processing" : o.shippingStatus;
  const notes = [partly ? `${moved} of ${o.items.length} items on the way` : "", o.trackingNote ? `Tracking: ${o.trackingNote}` : ""];
  return { status, subtitle: notes.filter(Boolean).join(" · ") };
}

function BookingGroup({ title, list }: { title: string; list: MyBooking[] }) {
  if (list.length === 0) return null;
  return (
    <Panel title={title}>
      <RecordList>
        {list.map(b => <BookingRow key={b.id} booking={b} viewer="client" />)}
      </RecordList>
    </Panel>
  );
}

export default function DashboardHome() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const status = useAuth(s => s.status);
  const showAuth = useAuthModal(s => s.show);
  const [tab, setTab] = useState<Tab>("orders");

  /* Partners land in their own studio; buyers and admins stay here. */
  useEffect(() => {
    if (user?.role === "artisan") router.replace("/dashboard/artisan");
    else if (user?.role === "seller") router.replace("/dashboard/seller");
  }, [user, router]);

  const enabled = Boolean(user);
  const orders = useMyOrders(enabled);
  const bookings = useMyBookings(enabled);
  const wallet = useWallet(enabled);

  if (status === "loading") return <ListSkeleton />;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <h1 className="t-display">Your account</h1>
        <p className="mt-2 text-[16px] text-muted">Sign in to see your orders and bookings.</p>
        <Button onClick={() => showAuth("signin")} size="lg" className="mt-5">Sign in</Button>
      </div>
    );
  }

  const ordersList = orders.data ?? [];
  const bookingsList = bookings.data ?? [];
  const today = lagosToday();
  const upcoming = bookingsList.filter(b => b.date >= today && (b.status === "pending" || b.status === "confirmed"));
  const past = bookingsList.filter(b => !upcoming.includes(b));

  return (
    <div className="space-y-5">
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} subtitle={user.email} />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "orders", label: "Orders", count: orders.data?.length },
          { id: "bookings", label: "Bookings", count: bookings.data?.length },
          { id: "account", label: "Account" },
        ]}
      />

      {tab === "orders" && (
        <Panel aria-label="Orders">
          {orders.isLoading ? (
            <ListSkeleton />
          ) : orders.isError ? (
            <LoadError onRetry={() => orders.refetch()} message="We couldn't load your orders." />
          ) : ordersList.length === 0 ? (
            <EmptyState>
              No orders yet. <Link href="/shop" className="text-ink underline underline-offset-4">Start shopping</Link>
            </EmptyState>
          ) : (
            <RecordList>
              {ordersList.map(o => {
                const progress = orderProgress(o);
                return (
                  <OrderRow
                    key={o.id}
                    order={o}
                    status={progress.status}
                    subtitle={progress.subtitle || undefined}
                    paymentLabel={paymentLabel(o.paymentStatus)}
                  />
                );
              })}
            </RecordList>
          )}
        </Panel>
      )}

      {tab === "bookings" && (
        <div className="space-y-5">
          {bookings.isLoading ? (
            <Panel><ListSkeleton /></Panel>
          ) : bookings.isError ? (
            <Panel><LoadError onRetry={() => bookings.refetch()} message="We couldn't load your bookings." /></Panel>
          ) : bookingsList.length === 0 ? (
            <Panel>
              <EmptyState>
                No bookings yet. <Link href="/services" className="text-ink underline underline-offset-4">Find an artisan</Link>
              </EmptyState>
            </Panel>
          ) : (
            <>
              <BookingGroup title="Upcoming" list={upcoming} />
              <BookingGroup title="Past" list={past} />
            </>
          )}
        </div>
      )}

      {tab === "account" && (
        <Panel aria-label="Account details">
          <dl className="divide-y divide-hairline text-[14px] tracking-[-0.014em]">
            {[
              ["Name", user.name],
              ["Email", user.email],
              ["Phone", user.phone || "Not added"],
              ["Wallet balance", wallet.data ? formatNaira(wallet.data.balanceNGN) : "Unavailable"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
          {user.role === "buyer" && (
            <p className="mt-5 text-[14px] tracking-[-0.014em] text-muted">
              Selling beauty products or offering services?{" "}
              <Link href="/partnership/seller" className="text-ink underline underline-offset-4">Sell on LuxeBeau</Link> or{" "}
              <Link href="/partnership/artisan" className="text-ink underline underline-offset-4">join as an artisan</Link>.
            </p>
          )}
        </Panel>
      )}
    </div>
  );
}
