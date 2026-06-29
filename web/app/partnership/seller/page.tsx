"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, ChevronRight, Loader2, Sparkles, UserCheck } from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { useAuth } from "@/lib/store";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { useOnboardSeller } from "@/lib/queries";
import { useToast } from "@/components/ui/slide-in-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFriendlyErrorMessage } from "@/lib/errors";

const categories = ["Skincare", "Makeup", "Haircare", "Grooming", "Fragrance"] as const;

export default function SellerOnboarding() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);
  const showAuth = useAuthModal((s) => s.show);
  const { toast } = useToast();
  const onboardSeller = useOnboardSeller();

  const [cacNumber, setCacNumber] = useState("");
  const [brandName, setBrandName] = useState("");
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState<string>("Skincare");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!brandName.trim()) errs.brandName = "Enter your brand or company name.";
    if (!cacNumber.trim()) {
      errs.cacNumber = "Enter your Corporate Affairs Commission (CAC) number.";
    } else if (!/^[A-Z0-9]{3,20}$/i.test(cacNumber.replace(/\s+/g, ""))) {
      errs.cacNumber = "Enter a valid CAC registration number, for example RC 1234567.";
    }
    if (!phone.trim()) {
      errs.phone = "Enter your contact phone number.";
    } else if (!/^0[789][01]\d{8}$/.test(phone.replace(/\s+/g, ""))) {
      errs.phone = "Enter a valid Nigerian phone number, for example 0803 123 4567.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    onboardSeller.mutate(
      { cac_number: cacNumber.trim().toUpperCase() },
      {
        onSuccess: () => {
          toast("Seller application submitted successfully! Welcome to LuxeBeau.", "success");
          updateUser({ role: "seller", cac_number: cacNumber.trim().toUpperCase() });
          router.push("/dashboard/seller");
        },
        onError: (err: unknown) => {
          toast(
            getFriendlyErrorMessage(err, "We couldn't submit your registration. Please check your fields and try again."),
            "error",
          );
        },
      },
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteNav />

      {/* Hero */}
      <section className="relative py-20 overflow-hidden border-b border-velvet-700/40 aurora-field">
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="text-xs uppercase tracking-[0.25em] text-royal-400 font-bold flex items-center justify-center gap-1.5 mb-4">
            <Sparkles className="w-4 h-4 animate-pulse" aria-hidden /> Partnership Flow
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-foreground mb-6">
            Sell your products on{" "}
            <span className="text-gold-gradient italic">LuxeBeau</span>
          </h1>
          <p className="text-base text-lavender-400 max-w-2xl mx-auto leading-relaxed">
            Expand your brand reach across Nigeria. Host your beauty, hair, or grooming catalog
            on a luxury marketplace built for curated merchants.
          </p>
        </div>
      </section>

      {/* Main Form Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        {!user ? (
          /* Unauthenticated state */
          <div className="rounded-3xl border border-velvet-700/50 bg-velvet-800/30 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-velvet-800 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-8 h-8 text-royal-400" aria-hidden />
            </div>
            <h3 className="font-display text-2xl font-semibold mb-4">
              Sign in to start your application
            </h3>
            <p className="text-lavender-400 mb-8 max-w-md mx-auto">
              Before submitting your merchant registration, you need to register or log into
              your LuxeBeau partner account.
            </p>
            <Button
              onClick={() => showAuth("login")}
              className="px-8 h-12 rounded-full font-semibold bg-gradient-to-r from-royal-600 to-royal-400 hover:opacity-90"
            >
              Sign in or register <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
            </Button>
          </div>
        ) : user.role === "seller" ? (
          /* Already a seller */
          <div className="rounded-3xl border border-success/25 bg-success/8 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-6">
              <UserCheck className="w-8 h-8 text-success" aria-hidden />
            </div>
            <h3 className="font-display text-2xl font-semibold mb-4">
              You are already a Merchant partner!
            </h3>
            <p className="text-lavender-400 mb-8 max-w-md mx-auto">
              Your storefront is active. List products, track orders, and view metrics in your
              dashboard.
            </p>
            <Button
              onClick={() => router.push("/dashboard/seller")}
              className="px-8 h-12 rounded-full font-semibold bg-success hover:opacity-90 text-velvet-950"
            >
              Go to Merchant Dashboard <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
            </Button>
          </div>
        ) : (
          /* Onboarding form */
          <div className="rounded-3xl border border-velvet-700/50 bg-velvet-800/20 p-8 sm:p-12 backdrop-blur-md">
            <h3 className="font-display text-2xl font-semibold mb-2">Merchant Registration</h3>
            <p className="text-sm text-lavender-400 mb-8">
              Verify your corporate registration details to list products, launch your brand
              catalog, and receive payments.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Brand Name */}
              <div>
                <Label htmlFor="brandName" className="text-lavender-200 font-medium">
                  Brand / Company Name
                </Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Amina Cosmetics Ltd"
                  className="lb-input mt-1.5"
                  aria-invalid={Boolean(errors.brandName)}
                />
                {errors.brandName && (
                  <p className="text-xs text-danger mt-1.5" role="alert">
                    {errors.brandName}
                  </p>
                )}
              </div>

              {/* CAC Number */}
              <div>
                <Label htmlFor="cacNumber" className="text-lavender-200 font-medium">
                  CAC RC / BN Number
                </Label>
                <Input
                  id="cacNumber"
                  value={cacNumber}
                  onChange={(e) => setCacNumber(e.target.value)}
                  placeholder="e.g. RC 1234567 or BN 987654"
                  className="lb-input mt-1.5"
                  aria-invalid={Boolean(errors.cacNumber)}
                />
                <p className="text-[11px] text-lavender-400 mt-1.5">
                  For corporate verification by our vetting team.
                </p>
                {errors.cacNumber && (
                  <p className="text-xs text-danger mt-1" role="alert">
                    {errors.cacNumber}
                  </p>
                )}
              </div>

              {/* Product Category */}
              <div>
                <Label htmlFor="category" className="text-lavender-200 font-medium">
                  Primary Product Category
                </Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="lb-input mt-1.5"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Phone */}
              <div>
                <Label htmlFor="phone" className="text-lavender-200 font-medium">
                  Contact Phone Number
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0803 123 4567"
                  className="lb-input mt-1.5"
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && (
                  <p className="text-xs text-danger mt-1.5" role="alert">
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={onboardSeller.isPending}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-royal-600 to-royal-400 hover:opacity-90 font-semibold text-lavender-100"
              >
                {onboardSeller.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> Submitting
                    merchant registration...
                  </>
                ) : (
                  "Submit Merchant Registration"
                )}
              </Button>
            </form>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
