import { FlaskConical, type LucideIcon } from "lucide-react";
import { formatCompactNaira } from "@/lib/format";

/* Honest labelling: these studio views still run on sample figures because the
   seller-orders / verification-queue / weekly-revenue endpoints do not exist
   yet. The badge keeps demo data from being mistaken for live data. */
export function SampleDataBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/40 bg-gold-400/10 px-3 py-1 text-xs font-semibold text-gold-300">
      <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Sample data
    </span>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div className="card-velvet rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-lavender-400">{label}</span>
        <Icon className="h-4 w-4 text-gold-400" aria-hidden />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
      {delta && <p className="mt-1 text-xs font-medium text-success">{delta} vs last week</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    {
      Paid: "bg-royal-500/20 text-royal-400",
      Shipped: "bg-gold-400/15 text-gold-300",
      Delivered: "bg-success/15 text-success",
      Completed: "bg-success/15 text-success",
      Confirmed: "bg-royal-500/20 text-royal-400",
      Approved: "bg-success/15 text-success",
      Pending: "bg-warning/15 text-warning",
      "Awaiting review": "bg-warning/15 text-warning",
      "Docs requested": "bg-gold-400/15 text-gold-300",
      Refunded: "bg-danger/15 text-danger",
      Cancelled: "bg-danger/15 text-danger",
    }[status] ?? "bg-velvet-700 text-lavender-200";

  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}

/* Pure-CSS grouped bar chart: no chart library needed at this data size. */
export function RevenueBars({
  data,
  seriesA,
  seriesB,
}: {
  data: { day: string; productNGN: number; serviceNGN: number }[];
  seriesA: string;
  seriesB: string;
}) {
  const max = Math.max(...data.flatMap(d => [d.productNGN, d.serviceNGN]));

  return (
    <div>
      <div className="flex items-end gap-3 sm:gap-5" role="img" aria-label={`Weekly revenue chart. ${data.map(d => `${d.day}: ${seriesA} ${formatCompactNaira(d.productNGN)}, ${seriesB} ${formatCompactNaira(d.serviceNGN)}`).join(". ")}`}>
        {data.map(d => (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end justify-center gap-1.5">
              <div
                className="w-3 rounded-t bg-royal-500 sm:w-4"
                style={{ height: `${(d.productNGN / max) * 100}%` }}
                title={`${d.day} ${seriesA}: ${formatCompactNaira(d.productNGN)}`}
              />
              <div
                className="w-3 rounded-t bg-gold-400 sm:w-4"
                style={{ height: `${(d.serviceNGN / max) * 100}%` }}
                title={`${d.day} ${seriesB}: ${formatCompactNaira(d.serviceNGN)}`}
              />
            </div>
            <span className="text-xs text-lavender-400">{d.day}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-6 text-xs text-lavender-400">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-royal-500" aria-hidden /> {seriesA}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-gold-400" aria-hidden /> {seriesB}
        </span>
      </div>
    </div>
  );
}
