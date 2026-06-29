"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Lock,
  Scale,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { SampleDataBadge, StatCard } from "@/components/dashboard/widgets";
import { LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/store";
import { useAdminEscrows, useAdminUsers, useDeleteUser, useResolveEscrow, useUpdateUser, useVerifyUser } from "@/lib/queries";
import { type User } from "@/lib/api";
import { formatNaira } from "@/lib/format";
import { useToast } from "@/components/ui/slide-in-notifications";

const roleTone: Record<string, string> = {
  admin: "bg-gold-400/15 text-gold-300",
  seller: "bg-royal-500/20 text-royal-400",
  artisan: "bg-royal-500/20 text-royal-300",
  buyer: "bg-velvet-700 text-lavender-200",
};

function Pill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tone}`}>{children}</span>;
}

export default function AdminDashboard() {
  const user = useAuth(s => s.user);
  const { toast } = useToast();

  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  const isAdmin = user?.role === "admin";
  const usersQuery = useAdminUsers({ role, status, search });
  const updateUser = useUpdateUser();
  const verifyUser = useVerifyUser();
  const deleteUser = useDeleteUser();

  const [escrowState, setEscrowState] = useState("all");
  const escrowsQuery = useAdminEscrows(isAdmin ? escrowState : "all");
  const resolveEscrow = useResolveEscrow();

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const pendingVerification = users.filter(
    u => (u.role === "seller" || u.role === "artisan") && !u.verified,
  );

  // Admin is internal-only. Enforce on the client too (backend already gates it).
  if (!user || !isAdmin) {
    return (
      <main className="mx-auto max-w-xl py-24 text-center">
        <Lock className="mx-auto h-10 w-10 text-danger" aria-hidden />
        <h1 className="mt-6 font-display text-3xl font-medium">Restricted area</h1>
        <p className="mt-3 text-lavender-200">
          The admin console is internal-only. {user ? "Your account does not have access." : "Please sign in with an administrator account."}
        </p>
        <Link href="/dashboard" className="mt-8 inline-block rounded-full bg-royal-500 px-7 py-3 text-sm font-semibold transition-colors hover:bg-royal-400">
          Back to your account
        </Link>
      </main>
    );
  }

  const toggleSuspend = (u: User) => {
    const next = u.status === "suspended" ? "active" : "suspended";
    updateUser.mutate(
      { id: u.id, patch: { status: next } },
      {
        onSuccess: () => toast(`${u.name} ${next === "suspended" ? "suspended" : "reactivated"}.`, "success"),
        onError: e => toast(e instanceof Error ? e.message : "Update failed.", "error"),
      },
    );
  };

  const verify = (u: User) => {
    const cac = u.role === "seller" || u.role === "artisan" ? window.prompt(`CAC / business reg number for ${u.name} (optional):`) ?? "" : "";
    verifyUser.mutate(
      { id: u.id, cac_number: cac || undefined },
      {
        onSuccess: () => toast(`${u.name} verified.`, "success"),
        onError: e => toast(e instanceof Error ? e.message : "Verification failed.", "error"),
      },
    );
  };

  const remove = (u: User) => {
    if (!window.confirm(`Permanently remove ${u.name}? This cannot be undone.`)) return;
    deleteUser.mutate(u.id, {
      onSuccess: () => toast(`${u.name} removed.`, "success"),
      onError: e => toast(e instanceof Error ? e.message : "Delete failed.", "error"),
    });
  };

  const changeRole = (u: User, newRole: string) => {
    if (newRole === u.role) return;
    updateUser.mutate(
      { id: u.id, patch: { role: newRole } },
      {
        onSuccess: () => toast(`${u.name} is now a ${newRole}.`, "success"),
        onError: e => toast(e instanceof Error ? e.message : "Role change failed.", "error"),
      },
    );
  };

  const counts = {
    total: users.length,
    sellers: users.filter(u => u.role === "seller").length,
    artisans: users.filter(u => u.role === "artisan").length,
    pending: pendingVerification.length,
  };

  return (
    <main className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-gold-300">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Admin console
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium">Marketplace governance</h1>
          <p className="mt-1 text-sm text-lavender-400">
            Signed in as {user.name} · internal access only
          </p>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Marketplace metrics">
        <StatCard icon={Users} label="Total users" value={String(counts.total)} />
        <StatCard icon={Store} label="Sellers" value={String(counts.sellers)} />
        <StatCard icon={BadgeCheck} label="Artisans" value={String(counts.artisans)} />
        <StatCard icon={UserCheck} label="Awaiting verification" value={String(counts.pending)} />
      </section>

      {/* Verification queue */}
      <section className="card-velvet mt-8 rounded-3xl p-6" aria-label="Verification queue">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <UserCheck className="h-5 w-5 text-gold-400" aria-hidden /> Verification queue
        </h2>
        {usersQuery.isLoading ? (
          <Skeleton className="mt-5 h-16 w-full bg-velvet-800/60" />
        ) : pendingVerification.length === 0 ? (
          <p className="mt-5 rounded-xl border border-velvet-700 p-6 text-center text-sm text-lavender-400">
            No sellers or artisans awaiting verification. All caught up.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {pendingVerification.map(u => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
                <div>
                  <p className="font-semibold">{u.name} <Pill tone={roleTone[u.role]}>{u.role}</Pill></p>
                  <p className="mt-0.5 text-xs text-lavender-400">{u.email}{u.jurisdiction ? ` · ${u.jurisdiction}` : ""} · KYC: {u.kyc_status ?? "unverified"}</p>
                </div>
                <button
                  onClick={() => verify(u)}
                  disabled={verifyUser.isPending}
                  className="inline-flex items-center gap-2 rounded-full bg-gold-400 px-5 py-2 text-sm font-bold text-velvet-950 transition-colors hover:bg-gold-300 disabled:opacity-60"
                >
                  <BadgeCheck className="h-4 w-4" aria-hidden /> Approve & verify
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* User management */}
      <section className="card-velvet mt-6 rounded-3xl p-6" aria-label="User management">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Users className="h-5 w-5 text-gold-400" aria-hidden /> Users
          </h2>
          <div className="flex flex-wrap gap-2">
            <label className="relative">
              <span className="sr-only">Search users</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lavender-400" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="w-56 rounded-full border border-velvet-700 bg-velvet-900 py-2 pl-9 pr-4 text-sm placeholder:text-lavender-400/60"
              />
            </label>
            <select value={role} onChange={e => setRole(e.target.value)} aria-label="Filter by role" className="rounded-lg border border-velvet-700 bg-velvet-900 px-3 py-2 text-sm">
              <option value="all">All roles</option>
              <option value="buyer">Buyers</option>
              <option value="seller">Sellers</option>
              <option value="artisan">Artisans</option>
              <option value="admin">Admins</option>
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Filter by status" className="rounded-lg border border-velvet-700 bg-velvet-900 px-3 py-2 text-sm">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>

        {usersQuery.isLoading ? (
          <div className="mt-5 space-y-3" aria-busy="true" role="status">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-velvet-800/60" />)}
          </div>
        ) : usersQuery.isError ? (
          <LoadError onRetry={() => usersQuery.refetch()} message="We could not load users." />
        ) : users.length === 0 ? (
          <p className="mt-6 rounded-xl border border-velvet-700 p-8 text-center text-sm text-lavender-400">No users match these filters.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b border-velvet-700/60 text-xs uppercase tracking-wider text-lavender-400">
                  <th scope="col" className="pb-3 pr-4">User</th>
                  <th scope="col" className="pb-3 pr-4">Role</th>
                  <th scope="col" className="pb-3 pr-4">Status</th>
                  <th scope="col" className="pb-3 pr-4">Verified</th>
                  <th scope="col" className="pb-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-velvet-700/30 last:border-0">
                    <td className="py-4 pr-4">
                      <p className="font-semibold">{u.name}</p>
                      <p className="text-xs text-lavender-400">{u.email}</p>
                    </td>
                    <td className="py-4 pr-4">
                      {u.role === "admin" ? (
                        <Pill tone={roleTone.admin}>admin</Pill>
                      ) : (
                        <select
                          value={u.role}
                          onChange={e => changeRole(u, e.target.value)}
                          aria-label={`Role for ${u.name}`}
                          className="rounded-lg border border-velvet-700 bg-velvet-900 px-2 py-1 text-xs capitalize"
                        >
                          <option value="buyer">buyer</option>
                          <option value="seller">seller</option>
                          <option value="artisan">artisan</option>
                        </select>
                      )}
                    </td>
                    <td className="py-4 pr-4">
                      <Pill tone={u.status === "suspended" ? "bg-danger/15 text-danger" : "bg-success/15 text-success"}>
                        {u.status ?? "active"}
                      </Pill>
                    </td>
                    <td className="py-4 pr-4">
                      {u.verified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-300"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Yes</span>
                      ) : (
                        <span className="text-xs text-lavender-400">No</span>
                      )}
                    </td>
                    <td className="py-4">
                      {u.role !== "admin" && (
                        <div className="flex items-center justify-end gap-1.5">
                          {!u.verified && (
                            <button onClick={() => verify(u)} title="Verify" aria-label={`Verify ${u.name}`} className="rounded-full p-2 text-lavender-300 transition-colors hover:bg-velvet-800 hover:text-gold-300">
                              <BadgeCheck className="h-4 w-4" aria-hidden />
                            </button>
                          )}
                          <button onClick={() => toggleSuspend(u)} title={u.status === "suspended" ? "Reactivate" : "Suspend"} aria-label={`${u.status === "suspended" ? "Reactivate" : "Suspend"} ${u.name}`} className="rounded-full p-2 text-lavender-300 transition-colors hover:bg-velvet-800 hover:text-warning">
                            <Ban className="h-4 w-4" aria-hidden />
                          </button>
                          <button onClick={() => remove(u)} title="Remove" aria-label={`Remove ${u.name}`} className="rounded-full p-2 text-lavender-300 transition-colors hover:bg-velvet-800 hover:text-danger">
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Escrow oversight */}
      <section className="card-velvet mt-6 rounded-3xl p-6" aria-label="Escrow oversight">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Scale className="h-5 w-5 text-gold-400" aria-hidden /> Escrow oversight
          </h2>
          <select value={escrowState} onChange={e => setEscrowState(e.target.value)} aria-label="Filter escrows by state" className="rounded-lg border border-velvet-700 bg-velvet-900 px-3 py-2 text-sm">
            <option value="all">All states</option>
            <option value="pending">Pending</option>
            <option value="funded">Funded</option>
            <option value="disputed">Disputed</option>
            <option value="released">Released</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>

        {escrowsQuery.isLoading ? (
          <div className="mt-5 space-y-3" aria-busy="true" role="status">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full bg-velvet-800/60" />)}
          </div>
        ) : escrowsQuery.isError ? (
          <LoadError onRetry={() => escrowsQuery.refetch()} message="We could not load escrows." />
        ) : (escrowsQuery.data ?? []).length === 0 ? (
          <p className="mt-6 rounded-xl border border-velvet-700 p-8 text-center text-sm text-lavender-400">No escrows in this state.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {(escrowsQuery.data ?? []).map(e => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-velvet-700/60 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {e.title} <Pill tone={e.state === "disputed" ? "bg-danger/15 text-danger" : e.state === "funded" ? "bg-royal-500/20 text-royal-300" : "bg-velvet-700 text-lavender-200"}>{e.state}</Pill>
                  </p>
                  <p className="mt-0.5 text-xs text-lavender-400">
                    {e.id} · {e.kind}{e.disputeReason ? ` · dispute: ${e.disputeReason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-semibold text-gold-300">{formatNaira(e.amountNGN)}</span>
                  {(e.state === "disputed" || e.state === "funded") && (
                    <>
                      <button
                        onClick={() => resolveEscrow.mutate({ id: e.id, decision: "release" }, { onSuccess: () => toast("Released to payee.", "success"), onError: err => toast(err instanceof Error ? err.message : "Failed.", "error") })}
                        disabled={resolveEscrow.isPending}
                        className="rounded-full bg-success/90 px-4 py-2 text-xs font-bold text-velvet-950 transition-colors hover:bg-success disabled:opacity-60"
                      >Release</button>
                      <button
                        onClick={() => resolveEscrow.mutate({ id: e.id, decision: "refund" }, { onSuccess: () => toast("Refunded to buyer.", "success"), onError: err => toast(err instanceof Error ? err.message : "Failed.", "error") })}
                        disabled={resolveEscrow.isPending}
                        className="rounded-full border border-danger/50 px-4 py-2 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
                      >Refund</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 flex items-center gap-2 text-xs text-lavender-400">
        <SampleDataBadge /> GMV and revenue analytics are not yet wired to a backend endpoint.
      </p>
    </main>
  );
}
