import { Clock } from "lucide-react";

/* Shown in a partner studio until an admin approves the account. Until then
   the API keeps the seller's products / artisan's profile out of public view. */
export function PendingApproval({ kind }: { kind: "seller" | "artisan" }) {
  const what =
    kind === "seller"
      ? "You can add products now. They appear in the shop once we approve your account."
      : "Set up your services and hours now. Your profile appears to clients once we approve your account.";
  return (
    <div role="status" className="flex items-start gap-3 rounded-[20px] border border-hairline bg-surface p-4">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
      <div>
        <p className="text-[16px] tracking-[-0.031em]">Your application is being reviewed</p>
        <p className="mt-0.5 text-[14px] tracking-[-0.014em] text-muted">{what} We&apos;ll email you when you&apos;re approved.</p>
      </div>
    </div>
  );
}
