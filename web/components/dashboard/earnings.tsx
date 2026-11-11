"use client";

import { useMemo } from "react";
import { Figures, Panel, Table } from "@/components/dashboard/widgets";
import { EmptyState, LoadError } from "@/components/site/states";
import { Skeleton } from "@/components/ui/skeleton";
import { computeEarnings, monthChangeText } from "@/lib/earnings";
import { formatNaira } from "@/lib/format";
import { useMyBookings, useWallet } from "@/lib/queries";
import { useNow } from "@/lib/use-now";

/* The artisan's recorded income from completed bookings. Clients pay the
   artisan directly, so this is NOT wallet money; the wallet is shown apart. */
export function Earnings({ onWithdraw }: { onWithdraw: () => void }) {
  const bookings = useMyBookings(true);
  const wallet = useWallet(true);
  const now = useNow();
  const e = useMemo(() => computeEarnings(bookings.data ?? [], now), [bookings.data, now]);

  if (bookings.isLoading) return <Panel aria-label="Earnings"><div role="status" aria-busy="true" aria-label="Loading earnings"><Skeleton className="h-40 w-full" /></div></Panel>;
  if (bookings.isError) return <Panel aria-label="Earnings"><LoadError onRetry={() => bookings.refetch()} message="We couldn't load your earnings." /></Panel>;

  const change = monthChangeText(e.thisMonthNGN, e.lastMonthNGN);

  return (
    <div className="space-y-5">
      <Panel title="Recorded value of completed jobs">
        <p className="text-[14px] tracking-[-0.014em] text-muted">
          Clients pay you directly, because bookings take no online payment. These figures add up the price of the jobs you marked as complete.
          They are a record of your work, not money in your LuxeBeau wallet.
        </p>
      </Panel>

      {e.completedJobs === 0 && e.upcomingJobs === 0 ? (
        <Panel><EmptyState>Nothing recorded yet. Jobs you mark as complete after the appointment will show up here.</EmptyState></Panel>
      ) : (
        <>
          <Figures
            items={[
              { label: "All completed jobs", value: formatNaira(e.totalNGN) },
              { label: "This month", value: formatNaira(e.thisMonthNGN) },
              { label: "Last month", value: formatNaira(e.lastMonthNGN) },
              { label: "Jobs completed", value: String(e.completedJobs) },
            ]}
          />
          <p className="px-1 text-[14px] tracking-[-0.014em] text-muted" aria-live="polite">
            This month: {e.thisMonthJobs} job{e.thisMonthJobs === 1 ? "" : "s"}. Last month: {e.lastMonthJobs} job{e.lastMonthJobs === 1 ? "" : "s"}. {change}
          </p>

          <Panel title="Coming up">
            <p className="text-[16px] tracking-[-0.031em]">
              <span className="font-bold tabular-nums">{formatNaira(e.upcomingNGN)}</span>
              <span className="text-muted"> across {e.upcomingJobs} confirmed upcoming job{e.upcomingJobs === 1 ? "" : "s"}</span>
            </p>
            <p className="mt-1 text-[12px] tracking-[-0.017em] text-muted">Counted as earnings only once you mark the job complete.</p>
          </Panel>

          <Panel title="By service">
            {e.byService.length === 0 ? (
              <EmptyState>No completed jobs yet.</EmptyState>
            ) : (
              <Table head={["Service", "Jobs", "Value"]} minWidth={360}>
                {e.byService.map(s => (
                  <tr key={s.service}>
                    <td className="py-3 pr-4">{s.service}</td>
                    <td className="py-3 pr-4 tabular-nums">{s.jobs}</td>
                    <td className="py-3 text-right tabular-nums">{formatNaira(s.valueNGN)}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Panel>
        </>
      )}

      <Panel title="Your LuxeBeau wallet">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[16px] tracking-[-0.031em]">
            <span className="font-bold tabular-nums">{wallet.data ? formatNaira(wallet.data.balanceNGN) : wallet.isError ? "Unavailable" : "…"}</span>
            <span className="text-muted"> available to withdraw</span>
          </p>
          <button type="button" onClick={onWithdraw} className="inline-flex h-10 items-center rounded-full border border-hairline bg-surface px-5 text-[14px] font-semibold tracking-[-0.014em] shadow-pill transition-shadow duration-200 hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            Go to Withdraw
          </button>
        </div>
      </Panel>
    </div>
  );
}
