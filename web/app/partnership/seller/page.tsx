"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Building2 } from "@/components/icons";
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
  const user = useAuth((s) => s.user);
  const status = useAuth((s) => s.status);
  const updateUser = useAuth((s) => s.updateUser);
  const onboardSeller = useOnboardSeller();

  const [cacNumber, setCacNumber] = useState("");
  const [error, setError] = useState("");

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
          updateUser({
            role: "seller",
            cac_number: cac,
            ...(user?.role !== "seller" && { verified: false }),
          });
          router.push("/dashboard/seller");
        },
        onError: (err) =>
          setError(
            getFriendlyErrorMessage(
              err,
              "We couldn't submit your registration. Please try again.",
            ),
          ),
      },
    );
  };

  return (
    <SiteShell>
      <PartnerFrame
        title="Sell on LuxeBeau"
        body="List your beauty, hair or grooming products for buyers across Nigeria."
        points={[
          "List products with photos, prices and inventory from your seller studio.",
          "Automatic escrow settlements paid straight into your bank on delivery.",
          "Sell to customers anywhere with direct escrow payment links.",
          "Verified badge after CAC registration review for instant buyer trust.",
        ]}
      >
        {status === "loading" ? (
          <Skeleton className="h-48 w-full rounded-[32px] bg-surface" />
        ) : !user ? (
          <SignInPrompt what="register as a seller" />
        ) : user.role === "seller" || user.role === "admin" ? (
          <AlreadyPartner
            title="You're set up to sell"
            body="Manage products and orders from your seller studio."
            href="/dashboard/seller"
            cta="Open seller studio"
          />
        ) : (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-[32px] bg-surface p-6 shadow-soft sm:p-8"
          >
            <h2 className="t-sub font-bold">Business registration</h2>
            <p className="mt-1 text-[14px] text-muted">
              Signed in as {user.email}
            </p>

            <div className="mt-5">
              <Label htmlFor="cac">CAC Registration Number (RC or BN)</Label>
              <Input
                id="cac"
                value={cacNumber}
                onChange={(e) => setCacNumber(e.target.value)}
                placeholder="RC 1234567"
                autoComplete="off"
                className="mt-1.5"
                aria-invalid={Boolean(error)}
              />
              <FieldError>{error}</FieldError>
            </div>

            <Button
              type="submit"
              disabled={onboardSeller.isPending}
              size="lg"
              className="mt-6 w-full"
            >
              {onboardSeller.isPending && (
                <Loader2 className="animate-spin" aria-hidden />
              )}
              Start selling
            </Button>
          </form>
        )}

        {/* Brand Partnerships Section */}
        <section
          id="brands"
          className="mt-10 rounded-[32px] bg-brand-wash p-6 text-brand-deep shadow-soft sm:p-8"
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-brand" />
            <h2 className="text-[20px] font-bold">Brand Partnerships</h2>
          </div>
          <p className="mt-2 text-[14px] opacity-90 leading-relaxed">
            Are you an established cosmetic manufacturer, skincare brand, or fragrance house? Partner with LuxeBeau for launch showcases, verified merchant status, and creator collaborations.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="default" size="sm">
              <a href="mailto:partnerships@luxebeau.com?subject=Brand%20Partnership%20Inquiry">
                Inquire about brand partnership
              </a>
            </Button>
          </div>
        </section>
      </PartnerFrame>
    </SiteShell>
  );
}
