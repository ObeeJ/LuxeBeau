"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Ban, CalendarDays, Lock, Package, Scale, Search, ShoppingBag, Store, Trash2, UserCheck, Users } from "lucide-react";
import { PageHeader, Panel, RecordList, RecordRow, StatCard, StatusPill } from "@/components/dashboard/widgets";
import { EmptyState, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/store";
import {
  useAdminBookings,
  useAdminDeleteProduct,
  useAdminEscrows,
  useAdminOrders,
  useAdminProducts,
  useAdminUsers,
  useDeleteUser,
  useResolveEscrow,
  useUpdateUser,
  useVerifyUser,
} from "@/lib/queries";
import { type User } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/slide-in-notifications";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Tab = "users" | "orders" | "bookings" | "products" | "escrows";
const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Users" },
  { id: "orders", label: "Orders" },
  { id: "bookings", label: "Bookings" },
  { id: "products", label: "Products" },
  { id: "escrows", label: "Escrows" },
];

function Loading() {
  return (
    <div className="space-y-2" aria-busy="true" role="status">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className="lb-input h-10 min-w-0 flex-1 py-0 sm:w-auto sm:min-w-36 sm:flex-none">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export default function AdminDashboard() {
  const user = useAuth(s => s.user);
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<Tab>("users");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [escrowState, setEscrowState] = useState("all");

  const usersQuery = useAdminUsers({ role, status, search });
  const allUsers = useAdminUsers({});
  const orders = useAdminOrders(isAdmin);
  const bookings = useAdminBookings(isAdmin);
  const products = useAdminProducts(isAdmin);
  const escrowsQuery = useAdminEscrows(isAdmin ? escrowState : "all");

  const updateUser = useUpdateUser();
  const verifyUser = useVerifyUser();
  const deleteUser = useDeleteUser();
  const deleteProduct = useAdminDeleteProduct();
  const resolveEscrow = useResolveEscrow();

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const everyone = useMemo(() => allUsers.data ?? [], [allUsers.data]);
  const pendingVerification = everyone.filter(u => (u.role === "seller" || u.role === "artisan") && !u.verified);

  // Admin is internal-only. Enforced on the client too (the API gates it).
  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <Lock className="mx-auto h-8 w-8" strokeWidth={1.5} aria-hidden />
        <h1 className="t-display mt-3">Restricted area</h1>
        <p className="mt-2 text-[16px] text-muted">
          The admin console is internal-only. {user ? "Your account does not have access." : "Please sign in with an administrator account."}
        </p>
        <Button asChild size="lg" className="mt-5"><Link href="/dashboard">Back to your account</Link></Button>
      </div>
    );
  }

  const onErr = (msg: string) => (e: unknown) => toast(getFriendlyErrorMessage(e, msg), "error");

  const toggleSuspend = (u: User) => {
    const next = u.status === "suspended" ? "active" : "suspended";
    updateUser.mutate({ id: u.id, patch: { status: next } }, {
      onSuccess: () => toast(`${u.name} ${next === "suspended" ? "suspended" : "reactivated"}.`, "success"),
      onError: onErr("Failed to update user status."),
    });
  };

  const verify = (u: User) => {
    const cac = u.role === "seller" || u.role === "artisan" ? window.prompt(`CAC / business registration number for ${u.name} (optional):`) ?? "" : "";
    verifyUser.mutate({ id: u.id, cac_number: cac || undefined }, {
      onSuccess: () => toast(`${u.name} verified.`, "success"),
      onError: onErr("Verification failed."),
    });
  };

  const remove = (u: User) => {
    if (!window.confirm(`Permanently remove ${u.name}? This cannot be undone.`)) return;
    deleteUser.mutate(u.id, { onSuccess: () => toast(`${u.name} removed.`, "success"), onError: onErr("Failed to remove user.") });
  };

  const changeRole = (u: User, newRole: string) => {
    if (newRole === u.role) return;
    updateUser.mutate({ id: u.id, patch: { role: newRole } }, {
      onSuccess: () => toast(`${u.name} is now a ${newRole}.`, "success"),
      onError: onErr("Failed to change role."),
    });
  };

  const removeProduct = (id: string, name: string) => {
    if (!window.confirm(`Remove "${name}" from the marketplace?`)) return;
    deleteProduct.mutate(id, { onSuccess: () => toast(`${name} removed.`, "success"), onError: onErr("Failed to remove product.") });
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin console" title="Marketplace governance" subtitle={`Signed in as ${user.name} · internal access only`} />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Marketplace metrics">
        <StatCard icon={Users} label="Users" value={allUsers.isLoading ? "—" : String(everyone.length)} />
        <StatCard icon={ShoppingBag} label="Orders (latest 200)" value={orders.isLoading ? "—" : String(orders.data?.length ?? 0)} />
        <StatCard icon={CalendarDays} label="Bookings (latest 200)" value={bookings.isLoading ? "—" : String(bookings.data?.length ?? 0)} />
        <StatCard icon={UserCheck} label="Awaiting verification" value={allUsers.isLoading ? "—" : String(pendingVerification.length)} />
      </section>

      {pendingVerification.length > 0 && (
        <Panel title="Verification queue" icon={UserCheck}>
          <RecordList>
            {pendingVerification.map(u => (
              <RecordRow
                key={u.id}
                title={u.name}
                subtitle={u.email}
                meta={`${u.role} · KYC ${u.kyc_status ?? "unverified"}${u.cac_number ? ` · CAC ${u.cac_number}` : ""}`}
                actions={<Button size="sm" onClick={() => verify(u)} disabled={verifyUser.isPending}><BadgeCheck aria-hidden /> Approve and verify</Button>}
              />
            ))}
          </RecordList>
        </Panel>
      )}

      <div role="tablist" aria-label="Records" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-10 shrink-0 rounded-full border px-4 text-[14px] tracking-[-0.014em] shadow-pill transition-colors duration-200",
              tab === t.id ? "border-ink bg-ink text-surface" : "border-hairline bg-surface hover:bg-canvas",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <Panel
          title="Users"
          icon={Users}
          action={
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <label className="relative w-full sm:w-56">
                <span className="sr-only">Search users</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" className="lb-input h-10 py-0 pl-10" />
              </label>
              <FilterSelect label="Filter by role" value={role} onChange={setRole} options={[["all", "All roles"], ["buyer", "Buyers"], ["seller", "Sellers"], ["artisan", "Artisans"], ["admin", "Admins"]]} />
              <FilterSelect label="Filter by status" value={status} onChange={setStatus} options={[["all", "All statuses"], ["active", "Active"], ["suspended", "Suspended"]]} />
            </div>
          }
        >
          {usersQuery.isLoading ? <Loading /> : usersQuery.isError ? (
            <LoadError onRetry={() => usersQuery.refetch()} message="We could not load users." />
          ) : users.length === 0 ? (
            <EmptyState>No users match these filters.</EmptyState>
          ) : (
            <RecordList>
              {users.map(u => (
                <RecordRow
                  key={u.id}
                  title={<>{u.name}{u.verified && <BadgeCheck className="ml-1 inline h-4 w-4 align-[-2px]" aria-label="Verified" />}</>}
                  subtitle={u.email}
                  meta={`KYC ${u.kyc_status ?? "unverified"}${u.created_at ? ` · joined ${u.created_at.slice(0, 10)}` : ""}`}
                  status={<StatusPill status={u.status ?? "active"} />}
                  actions={
                    u.role === "admin" ? (
                      <span className="t-meta inline-flex h-9 items-center rounded-full bg-canvas px-3">admin</span>
                    ) : (
                      <>
                        <select value={u.role} onChange={e => changeRole(u, e.target.value)} aria-label={`Role for ${u.name}`} className="lb-input h-9 w-auto py-0 text-[14px]">
                          <option value="buyer">buyer</option>
                          <option value="seller">seller</option>
                          <option value="artisan">artisan</option>
                        </select>
                        {!u.verified && (
                          <Button size="sm" variant="outline" onClick={() => verify(u)} aria-label={`Verify ${u.name}`}><BadgeCheck aria-hidden /> Verify</Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => toggleSuspend(u)} aria-label={`${u.status === "suspended" ? "Reactivate" : "Suspend"} ${u.name}`}>
                          <Ban aria-hidden /> {u.status === "suspended" ? "Reactivate" : "Suspend"}
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => remove(u)} aria-label={`Remove ${u.name}`} title="Remove">
                          <Trash2 aria-hidden />
                        </Button>
                      </>
                    )
                  }
                />
              ))}
            </RecordList>
          )}
        </Panel>
      )}

      {tab === "orders" && (
        <Panel title="Orders" icon={ShoppingBag}>
          {orders.isLoading ? <Loading /> : orders.isError ? (
            <LoadError onRetry={() => orders.refetch()} message="We could not load orders." />
          ) : (orders.data ?? []).length === 0 ? (
            <EmptyState>No orders yet.</EmptyState>
          ) : (
            <RecordList>
              {(orders.data ?? []).map(o => (
                <RecordRow
                  key={o.id}
                  title={o.id}
                  subtitle={o.itemSummary}
                  meta={`${o.date}${o.city ? ` · ${o.city}` : ""} · ${o.paymentMethod} · payment ${o.paymentStatus}`}
                  amount={formatNaira(o.totalNGN)}
                  status={<StatusPill status={o.shippingStatus} />}
                />
              ))}
            </RecordList>
          )}
        </Panel>
      )}

      {tab === "bookings" && (
        <Panel title="Bookings" icon={CalendarDays}>
          {bookings.isLoading ? <Loading /> : bookings.isError ? (
            <LoadError onRetry={() => bookings.refetch()} message="We could not load bookings." />
          ) : (bookings.data ?? []).length === 0 ? (
            <EmptyState>No bookings yet.</EmptyState>
          ) : (
            <RecordList>
              {(bookings.data ?? []).map(b => (
                <RecordRow
                  key={b.id}
                  title={b.service}
                  subtitle={`${b.client || "Client"} with ${b.artisan || "artisan"}`}
                  meta={`${b.id} · ${b.date}${b.time ? ` · ${b.time}` : ""}${b.serviceType ? ` · ${b.serviceType}` : ""}`}
                  amount={formatNaira(b.priceNGN)}
                  status={<StatusPill status={b.status} />}
                />
              ))}
            </RecordList>
          )}
        </Panel>
      )}

      {tab === "products" && (
        <Panel title="Products" icon={Package}>
          {products.isLoading ? <Loading /> : products.isError ? (
            <LoadError onRetry={() => products.refetch()} message="We could not load products." />
          ) : (products.data ?? []).length === 0 ? (
            <EmptyState>No products listed.</EmptyState>
          ) : (
            <RecordList>
              {(products.data ?? []).map(p => (
                <RecordRow
                  key={p.id}
                  leading={<span className="h-12 w-12 shrink-0 rounded-[12px]" style={{ backgroundColor: p.tint[0] }} aria-hidden />}
                  title={p.name}
                  subtitle={`${p.brand} · ${p.category}`}
                  amount={formatNaira(p.priceNGN)}
                  actions={
                    <Button size="sm" variant="ghost" onClick={() => removeProduct(p.id, p.name)} disabled={deleteProduct.isPending} aria-label={`Remove ${p.name}`}>
                      <Trash2 aria-hidden /> Remove
                    </Button>
                  }
                />
              ))}
            </RecordList>
          )}
        </Panel>
      )}

      {tab === "escrows" && (
        <Panel
          title="Escrow oversight"
          icon={Scale}
          action={
            <FilterSelect
              label="Filter escrows by state"
              value={escrowState}
              onChange={setEscrowState}
              options={[["all", "All states"], ["pending", "Pending"], ["funded", "Funded"], ["disputed", "Disputed"], ["released", "Released"], ["refunded", "Refunded"]]}
            />
          }
        >
          {escrowsQuery.isLoading ? <Loading /> : escrowsQuery.isError ? (
            <LoadError onRetry={() => escrowsQuery.refetch()} message="We could not load escrows." />
          ) : (escrowsQuery.data ?? []).length === 0 ? (
            <EmptyState>No escrows in this state.</EmptyState>
          ) : (
            <RecordList>
              {(escrowsQuery.data ?? []).map(e => (
                <RecordRow
                  key={e.id}
                  title={e.title}
                  meta={`${e.id} · ${e.kind}${e.disputeReason ? ` · dispute: ${e.disputeReason}` : ""}`}
                  amount={formatNaira(e.amountNGN)}
                  status={<StatusPill status={e.state} />}
                  actions={
                    (e.state === "disputed" || e.state === "funded") && (
                      <>
                        <Button size="sm" disabled={resolveEscrow.isPending} onClick={() => resolveEscrow.mutate({ id: e.id, decision: "release" }, { onSuccess: () => toast("Released to payee.", "success"), onError: onErr("Failed to release funds.") })}>
                          Release
                        </Button>
                        <Button size="sm" variant="outline" disabled={resolveEscrow.isPending} onClick={() => resolveEscrow.mutate({ id: e.id, decision: "refund" }, { onSuccess: () => toast("Refunded to buyer.", "success"), onError: onErr("Failed to refund.") })}>
                          Refund
                        </Button>
                      </>
                    )
                  }
                />
              ))}
            </RecordList>
          )}
        </Panel>
      )}

      <p className="t-meta flex items-center gap-2 font-normal text-muted">
        <Store className="h-3.5 w-3.5" aria-hidden /> Revenue analytics are not yet available from the API.
      </p>
    </div>
  );
}
