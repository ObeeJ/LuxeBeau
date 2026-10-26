"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2, Package, ShieldCheck } from "lucide-react";
import SiteShell from "@/components/site/shell";
import { AlreadyPartner, PartnerFrame, SignInPrompt } from "@/components/site/partner";
import { FieldError } from "@/components/site/states";
import { useAuth } from "@/lib/store";
import { useOnboardSeller } from "@/lib/queries";
import { useToast } from "@/components/ui/slide-in-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFriendlyErrorMessage } from "@/lib/errors";

const PERKS = [
  { icon: Package, title: "Your own seller studio", body: "List products, set stock and see every order that includes your items." },
  { icon: ShieldCheck, title: "Escrow links", body: "Sell to buyers off-platform with funds held until they confirm delivery." },
  { icon: BadgeCheck, title: "Verified badge", body: "Our team reviews your CAC registration and marks your account verified." },
];

export default function SellerOnboarding() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const updateUser = useAuth(s => s.updateUser);
  const { toast } = useToast();
  const onboardSeller = useOnboardSeller();

  const [cacNumber, setCacNumber] = useState("");
  const [error, setError] = useState("");

  /* POST /me/seller-onboard takes only { cac_number } (booking/handler.go). */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cac = cacNumber.replace(/\s+/g, "").toUpperCase();
    if (!/^(RC|BN|IT)?\d{4,10}$/.test(cac)) {
      setError("Enter your CAC registration number, for example RC 1234567 or BN 987654.");
      return;
    }
    setError("");
    onboardSeller.mutate(
      { cac_number: cac },
      {
        onSuccess: () => {
          toast("You're set up as a seller. Welcome to LuxeBeau.", "success");
          updateUser({ role: "seller", cac_number: cac });
          router.push("/dashboard/seller");
        },
        onError: err => toast(getFriendlyErrorMessage(err, "We couldn't submit your registration. Please try again."), "error"),
      },
    );
  };

  return (
    <SiteShell>
      <PartnerFrame
        eyebrow="Partners"
        title="Sell your products on LuxeBeau"
        body="Bring your beauty, hair or grooming brand to buyers across Nigeria."
        perks={PERKS}
      >
        {!user ? (
          <SignInPrompt what="register as a seller" />
        ) : user.role === "seller" || user.role === "admin" ? (
          <AlreadyPartner title="Your seller studio is ready" body="List products, track orders and manage escrow links." href="/dashboard/seller" cta="Open seller studio" />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="rounded-[28px] bg-surface p-5 shadow-card sm:p-6">
            <h2 className="t-display">Seller registration</h2>
            <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">
              Signed in as {user.name}. Your CAC number is used to verify your business.
            </p>
            <div className="mt-5">
              <Label htmlFor="cac">CAC RC / BN number</Label>
              <Input
                id="cac"
                value={cacNumber}
                onChange={e => setCacNumber(e.target.value)}
                placeholder="RC 1234567"
                autoComplete="off"
                className="mt-1.5"
                aria-invalid={Boolean(error)}
              />
              <FieldError>{error}</FieldError>
            </div>
            <Button type="submit" disabled={onboardSeller.isPending} size="lg" className="mt-6 w-full">
              {onboardSeller.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {onboardSeller.isPending ? "Submitting" : "Register as a seller"}
            </Button>
          </form>
        )}
      </PartnerFrame>
    </SiteShell>
  );
}
