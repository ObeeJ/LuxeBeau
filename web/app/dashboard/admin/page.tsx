"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Search } from "lucide-react";
import { Figures, PageHeader, Panel, StatusPill, Table, Tabs } from "@/components/dashboard/widgets";
import { Photo } from "@/components/site/catalog";
import { EmptyState, FieldError, LoadError } from "@/components/site/states";
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
import { getFriendlyErrorMessage } from "@/lib/errors";

type Tab = "users" | "orders" | "bookings" | "products" | "escrows";

function Loading() {
  return <Skeleton className="h-48 w-full" />;
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} aria-label={label} className="lb-input h-9 w-auto py-0 text-[14px]">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export default function AdminDashboard() {
  const user = useAuth(s => s.user);
  const status = useAuth(s => s.status);
  const isAdmin = user?.role === "admin";

  const [tab, setTab] = useState<Tab>("users");
  const [role, setRole] = useState("all");
  const [userStatus, setUserStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [escrowState, setEscrowState] = useState("all");
  const [error, setError] = useState("");

  const usersQuery = useAdminUsers({ role, status: userStatus, search });
  const allUsers = useAdminUsers({});
  const orders = useAdminOrders(isAdmin);
  const bookings = useAdminBookings(isAdmin);
  const products = useAdminProducts(isAdmin);
  const escrows = useAdminEscrows(isAdmin ? escrowState : "all");

  const updateUser = useUpdateUser();
  const verifyUser = useVerifyUser();
  const deleteUser = useDeleteUser();
  const deleteProduct = useAdminDeleteProduct();
  const resolveEscrow = useResolveEscrow();

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const everyone = useMemo(() => allUsers.data ?? [], [allUsers.data]);
  const awaiting = everyone.filter(u => (u.role === "seller" || u.role === "artisan") && !u.verified);

  if (status === "loading") return <Loading />;
  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-sm rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
        <h1 className="t-display">Restricted</h1>
        <p className="mt-2 text-[16px] text-muted">The admin console is for LuxeBeau staff.</p>
        <Button asChild className="mt-5"><Link href="/dashboard">Back to your account</Link></Button>
      </div>
    );
  }

  const onErr = (fallback: string) => (e: unknown) => setError(getFriendlyErrorMessage(e, fallback));
  const run = (fn: () => void) => {
    setError("");
    fn();
  };

  const verify = (u: User) => {
    const cac = window.prompt(`CAC number for ${u.name} (optional)`, u.cac_number ?? "") ?? "";
    run(() => verifyUser.mutate({ id: u.id, cac_number: cac || undefined }, { onError: onErr("Verification failed.") }));
  };
  const toggleSuspend = (u: User) =>
    run(() => updateUser.mutate({ id: u.id, patch: { status: u.status === "suspended" ? "active" : "suspended" } }, { onError: onErr("Couldn't update the account.") }));
  const changeRole = (u: User, next: string) =>
    next !== u.role && run(() => updateUser.mutate({ id: u.id, patch: { role: next } }, { onError: onErr("Couldn't change the role.") }));
  const removeUser = (u: User) =>
    window.confirm(`Permanently remove ${u.name}?`) && run(() => deleteUser.mutate(u.id, { onError: onErr("Couldn't remove the user.") }));
  const removeProduct = (id: string, name: string) =>
    window.confirm(`Remove "${name}" from the marketplace?`) && run(() => deleteProduct.mutate(id, { onError: onErr("Couldn't remove the product.") }));

  return (
    <div className="space-y-5">
      <PageHeader title="Admin" subtitle={`Signed in as ${user.name}`} />

      <Figures
        items={[
          { label: "Users", value: allUsers.isLoading ? "—" : String(everyone.length) },
          { label: "Awaiting verification", value: allUsers.isLoading ? "—" : String(awaiting.length) },
          { label: "Orders (latest 200)", value: orders.isLoading ? "—" : String(orders.data?.length ?? 0) },
          { label: "Bookings (latest 200)", value: bookings.isLoading ? "—" : String(bookings.data?.length ?? 0) },
        ]}
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "users", label: "Users" },
          { id: "orders", label: "Orders" },
          { id: "bookings", label: "Bookings" },
          { id: "products", label: "Products" },
          { id: "escrows", label: "Escrow" },
        ]}
      />

      <FieldError>{error}</FieldError>

      {tab === "users" && (
        <Panel
          aria-label="Users"
          action={
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              <label className="relative w-full sm:w-56">
                <span className="sr-only">Search users</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or email" className="lb-input h-9 py-0 pl-10 text-[14px]" />
              </label>
              <Filter label="Role" value={role} onChange={setRole} options={[["all", "All roles"], ["buyer", "Buyers"], ["seller", "Sellers"], ["artisan", "Artisans"], ["admin", "Admins"]]} />
              <Filter label="Status" value={userStatus} onChange={setUserStatus} options={[["all", "Any status"], ["active", "Active"], ["suspended", "Suspended"]]} />
            </div>
          }
        >
          {usersQuery.isLoading ? <Loading /> : usersQuery.isError ? (
            <LoadError onRetry={() => usersQuery.refetch()} message="We couldn't load users." />
          ) : users.length === 0 ? (
            <EmptyState>No users match these filters.</EmptyState>
          ) : (
            <Table head={["Name", "Role", "Email verified", "Partner check", "Status", ""]} minWidth={860}>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="py-3 pr-4">
                    <p>{u.name}</p>
                    <p className="text-[12px] text-muted">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4">
                    {u.role === "admin" ? "Admin" : (
                      <Filter label={`Role for ${u.name}`} value={u.role} onChange={v => changeRole(u, v)} options={[["buyer", "Buyer"], ["seller", "Seller"], ["artisan", "Artisan"]]} />
                    )}
                  </td>
                  <td className="py-3 pr-4 text-muted">{u.email_verified ? "Yes" : "No"}</td>
                  <td className="py-3 pr-4">
                    {u.role === "seller" || u.role === "artisan" ? (
                      u.verified ? (
                        <span className="inline-flex items-center gap-1"><BadgeCheck className="h-4 w-4" aria-hidden /> Verified</span>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => verify(u)}>Verify</Button>
                      )
                    ) : <span className="text-muted">Not needed</span>}
                  </td>
                  <td className="py-3 pr-4"><StatusPill status={u.status ?? "active"} /></td>
                  <td className="py-3 text-right">
                    {u.role !== "admin" && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => toggleSuspend(u)}>{u.status === "suspended" ? "Reactivate" : "Suspend"}</Button>
                        <Button size="sm" variant="ghost" onClick={() => removeUser(u)}>Remove</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "orders" && (
        <Panel aria-label="Orders">
          {orders.isLoading ? <Loading /> : orders.isError ? (
            <LoadError onRetry={() => orders.refetch()} message="We couldn't load orders." />
          ) : (orders.data ?? []).length === 0 ? <EmptyState>No orders yet.</EmptyState> : (
            <Table head={["Order", "Items", "Placed", "Payment", "Shipping", "Total"]} minWidth={760}>
              {(orders.data ?? []).map(o => (
                <tr key={o.id}>
                  <td className="py-3 pr-4 tabular-nums">{o.id}</td>
                  <td className="max-w-64 truncate py-3 pr-4 text-muted">{o.itemSummary}</td>
                  <td className="py-3 pr-4 text-muted">{o.date}</td>
                  <td className="py-3 pr-4"><StatusPill status={o.paymentStatus} /> <span className="text-[12px] text-muted">{o.paymentMethod}</span></td>
                  <td className="py-3 pr-4"><StatusPill status={o.shippingStatus} /></td>
                  <td className="py-3 text-right tabular-nums">{formatNaira(o.totalNGN)}</td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "bookings" && (
        <Panel aria-label="Bookings">
          {bookings.isLoading ? <Loading /> : bookings.isError ? (
            <LoadError onRetry={() => bookings.refetch()} message="We couldn't load bookings." />
          ) : (bookings.data ?? []).length === 0 ? <EmptyState>No bookings yet.</EmptyState> : (
            <Table head={["Booking", "Service", "Client", "Artisan", "When", "Where", "Status"]} minWidth={860}>
              {(bookings.data ?? []).map(b => (
                <tr key={b.id}>
                  <td className="py-3 pr-4 tabular-nums">{b.id}</td>
                  <td className="py-3 pr-4">{b.service}</td>
                  <td className="py-3 pr-4 text-muted">{b.client}</td>
                  <td className="py-3 pr-4 text-muted">{b.artisan}</td>
                  <td className="py-3 pr-4 text-muted">{b.date} {b.time}</td>
                  <td className="py-3 pr-4 text-muted">{b.serviceType === "home" ? "Home" : "Studio"}</td>
                  <td className="py-3 text-right"><StatusPill status={b.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "products" && (
        <Panel aria-label="Products">
          {products.isLoading ? <Loading /> : products.isError ? (
            <LoadError onRetry={() => products.refetch()} message="We couldn't load products." />
          ) : (products.data ?? []).length === 0 ? <EmptyState>No products listed.</EmptyState> : (
            <Table head={["Product", "Category", "Price", "Stock", ""]} minWidth={640}>
              {(products.data ?? []).map(p => (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0"><Photo src={p.imageUrl} alt={p.name} fallback="" sizes="sm" className="rounded-[10px]" /></div>
                      <div className="min-w-0">
                        <p className="truncate">{p.name}</p>
                        <p className="text-[12px] text-muted">{p.brand}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted">{p.category}</td>
                  <td className="py-3 pr-4 tabular-nums">{formatNaira(p.priceNGN)}</td>
                  <td className="py-3 pr-4 tabular-nums">{p.stock}</td>
                  <td className="py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => removeProduct(p.id, p.name)}>Remove</Button>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}

      {tab === "escrows" && (
        <Panel
          aria-label="Escrow"
          action={
            <Filter label="Escrow state" value={escrowState} onChange={setEscrowState} options={[["all", "All states"], ["pending", "Pending"], ["funded", "Funded"], ["disputed", "Disputed"], ["released", "Released"], ["refunded", "Refunded"]]} />
          }
        >
          {escrows.isLoading ? <Loading /> : escrows.isError ? (
            <LoadError onRetry={() => escrows.refetch()} message="We couldn't load escrows." />
          ) : (escrows.data ?? []).length === 0 ? <EmptyState>No escrows in this state.</EmptyState> : (
            <Table head={["Escrow", "Title", "State", "Amount", ""]} minWidth={720}>
              {(escrows.data ?? []).map(e => (
                <tr key={e.id}>
                  <td className="py-3 pr-4 tabular-nums">{e.id}</td>
                  <td className="py-3 pr-4">
                    <p>{e.title}</p>
                    {e.disputeReason && <p className="text-[12px] text-muted">Dispute: {e.disputeReason}</p>}
                  </td>
                  <td className="py-3 pr-4"><StatusPill status={e.state} /></td>
                  <td className="py-3 pr-4 tabular-nums">{formatNaira(e.amountNGN)}</td>
                  <td className="py-3 text-right">
                    {(e.state === "disputed" || e.state === "funded") && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" disabled={resolveEscrow.isPending} onClick={() => run(() => resolveEscrow.mutate({ id: e.id, decision: "release" }, { onError: onErr("Couldn't release funds.") }))}>Release</Button>
                        <Button size="sm" variant="outline" disabled={resolveEscrow.isPending} onClick={() => run(() => resolveEscrow.mutate({ id: e.id, decision: "refund" }, { onError: onErr("Couldn't refund.") }))}>Refund</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      )}
    </div>
  );
}
