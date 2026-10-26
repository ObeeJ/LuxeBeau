"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import SiteShell from "@/components/site/shell";
import { AlreadyPartner, PartnerFrame, SignInPrompt } from "@/components/site/partner";
import { FieldError } from "@/components/site/states";
import { useAuth } from "@/lib/store";
import { useOnboardSeller } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getFriendlyErrorMessage } from "@/lib/errors";

export default function SellerOnboarding() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const status = useAuth(s => s.status);
  const updateUser = useAuth(s => s.updateUser);
  const onboardSeller = useOnboardSeller();

  const [cacNumber, setCacNumber] = useState("");
  const [error, setError] = useState("");

  /* POST /me/seller-onboard takes only { cac_number }. */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cac = cacNumber.replace(/\s+/g, "").toUpperCase();
    if (!/^(RC|BN|IT)?\d{4,10}$/.test(cac)) {
      setError("Enter your CAC number, for example RC 1234567 or BN 987654.");
      return;
    }
    setError("");
    onboardSeller.mutate(
      { cac_number: cac },
      {
        onSuccess: () => {
          // A new partner role goes to admin review (api-go booking.becomePartner).
          updateUser({ role: "seller", cac_number: cac, ...(user?.role !== "seller" && { verified: false }) });
          router.push("/dashboard/seller");
        },
        onError: err => setError(getFriendlyErrorMessage(err, "We couldn't submit your registration. Please try again.")),
      },
    );
  };

  return (
    <SiteShell>
      <PartnerFrame
        title="Sell on LuxeBeau"
        body="List your beauty, hair or grooming products for buyers across Nigeria."
        points={[
          "List products with photos, prices and stock from your seller studio.",
          "See every order that includes your products.",
          "Sell to buyers outside LuxeBeau with escrow links.",
          "We review your CAC registration before your products go live in the shop.",
        ]}
      >
        {status === "loading" ? (
          <Skeleton className="h-48 w-full rounded-[28px] bg-surface" />
        ) : !user ? (
          <SignInPrompt what="register as a seller" />
        ) : user.role === "seller" || user.role === "admin" ? (
          <AlreadyPartner title="You're set up to sell" body="Manage products and orders from your seller studio." href="/dashboard/seller" cta="Open seller studio" />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="rounded-[28px] bg-surface p-5 shadow-card sm:p-6">
            <h2 className="t-sub">Business registration</h2>
            <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">Signed in as {user.email}</p>
            <div className="mt-5">
              <Label htmlFor="cac">CAC number (RC or BN)</Label>
              <Input id="cac" value={cacNumber} onChange={e => setCacNumber(e.target.value)} placeholder="RC 1234567" autoComplete="off" className="mt-1.5" aria-invalid={Boolean(error)} />
              <FieldError>{error}</FieldError>
            </div>
            <Button type="submit" disabled={onboardSeller.isPending} size="lg" className="mt-6 w-full">
              {onboardSeller.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Start selling
            </Button>
          </form>
        )}
      </PartnerFrame>
    </SiteShell>
  );
}
