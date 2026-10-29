import Link from "next/link";
import { BadgeCheck, CalendarDays, CircleUser, Clock, ShieldCheck } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { type User } from "@/lib/api";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-[14px] tracking-[-0.014em]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value || <span className="text-muted">Not provided</span>}</dd>
    </div>
  );
}

/* The owner's business profile: who they are on LuxeBeau, the details on
   file, and a link to the public store customers see. Details come from the
   signed-in account; editing happens through onboarding. */
export function BusinessProfile({
  user,
  title,
  publicHref,
  stats,
  editHref,
}: {
  user: User;
  title: string;
  publicHref?: string;
  stats: { label: string; value: string }[];
  editHref: string;
}) {
  const initial = (user.name || "?").slice(0, 1).toUpperCase();
  const since = user.created_at ? new Date(user.created_at).toLocaleDateString("en-NG", { month: "long", year: "numeric" }) : "";
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-brand-deep to-brand p-6 text-surface shadow-glow" aria-label="Business">
        <CircleUser aria-hidden className="pointer-events-none absolute -bottom-10 -right-8 h-52 w-52 text-surface opacity-[0.14] [--lb-icon-2:#fff]" />
        <div className="relative flex items-center gap-4">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-surface text-[34px] font-extrabold text-brand">{initial}</span>
          <div className="min-w-0">
            <h2 className="truncate text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em]">{title}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-[14px] opacity-90">
              {user.verified ? <BadgeCheck className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
              {user.verified ? "Approved" : "Awaiting approval"}
            </p>
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-3 gap-2">
          {stats.map(s => (
            <div key={s.label} className="rounded-2xl bg-surface/15 p-3 backdrop-blur-sm">
              <dd className="text-[20px] font-extrabold tracking-[-0.04em]">{s.value}</dd>
              <dt className="text-[12px] opacity-85">{s.label}</dt>
            </div>
          ))}
        </dl>
        <div className="relative mt-5 flex flex-wrap gap-2">
          {publicHref && (
            <Button asChild variant="secondary"><Link href={publicHref}>View public page</Link></Button>
          )}
          <Button asChild variant="outline"><Link href={editHref}>Update details</Link></Button>
        </div>
      </section>

      <section className="rounded-[32px] bg-surface p-6 shadow-card" aria-label="Details on file">
        <h3 className="flex items-center gap-2.5 text-[18px] font-bold tracking-[-0.03em]">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-wash text-brand"><ShieldCheck className="h-5 w-5" aria-hidden /></span>
          Details on file
        </h3>
        <dl className="mt-3 divide-y divide-hairline">
          <Row label="Account name" value={user.name} />
          <Row label="Email" value={user.email} />
          <Row label="Phone" value={user.phone} />
          <Row label="CAC number" value={user.cac_number} />
          <Row label="Identity check" value={user.kyc_status ? user.kyc_status.replace(/_/g, " ") : ""} />
          <Row label="On LuxeBeau since" value={since ? <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden />{since}</span> : ""} />
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          These details are used for approval and payouts. Customers only see your public page.
        </p>
      </section>
    </div>
  );
}
