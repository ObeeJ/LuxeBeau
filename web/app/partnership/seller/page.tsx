"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, CheckCircle2, ChevronRight, Loader2, Sparkles, UserCheck } from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { useAuth } from "@/lib/store";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { useOnboardSeller } from "@/lib/queries";
import { useToast } from "@/components/ui/slide-in-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    if (!brandName.trim()) errs.brandName = "Brand or company name is required.";
    if (!cacNumber.trim()) {
      errs.cacNumber = "CAC Registration Number is required.";
    } else if (!/^[A-Z0-9]{3,20}$/i.test(cacNumber.replace(/\s+/g, ""))) {
      errs.cacNumber = "Enter a valid Corporate Affairs Commission (CAC) number.";
    }
    if (!phone.trim()) {
      errs.phone = "Contact phone number is required.";
    } else if (!/^0[789][01]\d{8}$/.test(phone.replace(/\s+/g, ""))) {
      errs.phone = "Enter a valid Nigerian phone number.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    onboardSeller.mutate(
      {
        cac_number: cacNumber.trim().toUpperCase(),
      },
      {
        onSuccess: () => {
          toast("Seller application submitted successfully!", "success");
          updateUser({ role: "seller", cac_number: cacNumber.trim().toUpperCase() });
          router.push("/dashboard/seller");
        },
        onError: (err: unknown) => {
          toast(err instanceof Error ? err.message : "Failed to submit application. Please try again.", "error");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0416] text-white">
      <SiteNav />

      {/* Hero section */}
      <section className="relative py-20 overflow-hidden border-b border-purple-900/30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.1),transparent_60%)] pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <span className="text-xs uppercase tracking-[0.25em] text-purple-400 font-bold flex items-center justify-center gap-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" /> Partnership Flow
          </span>
          <h1 className="text-4xl sm:text-5xl font-serif text-white mb-6">
            Sell your products on <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">luxebeau</span>
          </h1>
          <p className="text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Expand your brand reach across Nigeria. Host your beauty, hair, or grooming catalog on a luxury marketplace built for curated merchants.
          </p>
        </div>
      </section>

      {/* Main Form Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        {!user ? (
          <div className="rounded-3xl border border-purple-900/40 bg-purple-950/20 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-purple-900/30 flex items-center justify-center mx-auto mb-6">
              <ShoppingBag className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-2xl font-serif mb-4">Sign in to start your application</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Before submitting your merchant registration, you need to register or log into your LuxeBeau partner account.
            </p>
            <Button
              onClick={() => showAuth("login")}
              className="px-8 h-12 rounded-full font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
            >
              Sign In or Register <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : user.role === "seller" ? (
          <div className="rounded-3xl border border-emerald-900/40 bg-emerald-950/10 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-emerald-900/20 flex items-center justify-center mx-auto mb-6">
              <UserCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-serif mb-4">You are already a Merchant partner!</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Your storefront is active. You can list products, track orders, and view metrics in your dashboard.
            </p>
            <Button
              onClick={() => router.push("/dashboard/seller")}
              className="px-8 h-12 rounded-full font-semibold bg-emerald-600 hover:bg-emerald-500"
            >
              Go to Merchant Dashboard <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border border-purple-900/40 bg-purple-950/10 p-8 sm:p-12 backdrop-blur-md">
            <h3 className="text-2xl font-serif mb-2">Merchant Registration</h3>
            <p className="text-sm text-gray-400 mb-8">
              Verify your corporate registration details to list products, launch your brand catalog, and receive payments.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Brand Name */}
              <div>
                <Label htmlFor="brandName" className="text-gray-300 font-medium">Brand / Company Name</Label>
                <Input
                  id="brandName"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Amina Cosmetics LTD"
                  className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl h-12"
                  aria-invalid={Boolean(errors.brandName)}
                />
                {errors.brandName && <p className="text-xs text-red-400 mt-1.5">{errors.brandName}</p>}
              </div>

              {/* CAC Registration Number */}
              <div>
                <Label htmlFor="cacNumber" className="text-gray-300 font-medium">CAC RC / BN Number</Label>
                <Input
                  id="cacNumber"
                  value={cacNumber}
                  onChange={(e) => setCacNumber(e.target.value)}
                  placeholder="e.g. RC 1234567 or BN 987654"
                  className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl h-12"
                  aria-invalid={Boolean(errors.cacNumber)}
                />
                <p className="text-[10px] text-gray-400 mt-1.5">For corporate verification by our vetting team.</p>
                {errors.cacNumber && <p className="text-xs text-red-400 mt-1.5">{errors.cacNumber}</p>}
              </div>

              {/* Main Product Category */}
              <div>
                <Label htmlFor="category" className="text-gray-300 font-medium">Primary Product Category</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#1b1329] border border-purple-900/50 mt-1.5 px-4 rounded-xl h-12 text-white outline-none focus:border-purple-500"
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
                <Label htmlFor="phone" className="text-gray-300 font-medium">Contact Phone Number</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0803 123 4567"
                  className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl h-12"
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && <p className="text-xs text-red-400 mt-1.5">{errors.phone}</p>}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={onboardSeller.isPending}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 font-semibold"
              >
                {onboardSeller.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting merchant registration...
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
