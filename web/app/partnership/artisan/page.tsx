"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight, Loader2, Sparkles, UserCheck } from "lucide-react";
import SiteNav from "@/components/site/nav";
import SiteFooter from "@/components/site/footer";
import { useAuth } from "@/lib/store";
import { useAuthModal } from "@/components/auth/auth-dialog";
import { useOnboardArtisan } from "@/lib/queries";
import { useToast } from "@/components/ui/slide-in-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors";

const specialties = ["Haircare", "Skincare", "Makeup", "Nails", "Grooming"] as const;
const cities = ["Lagos", "Abuja", "Port Harcourt", "Ibadan"] as const;

export default function ArtisanOnboarding() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const updateUser = useAuth((s) => s.updateUser);
  const showAuth = useAuthModal((s) => s.show);
  const { toast } = useToast();
  const onboardArtisan = useOnboardArtisan();

  const [specialty, setSpecialty] = useState<string>("Haircare");
  const [craft, setCraft] = useState("");
  const [studio, setStudio] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState<string>("Lagos");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!studio.trim()) errs.studio = "Enter your studio or business name.";
    if (!craft.trim()) errs.craft = "Specify your main craft, like Knotless Braids or Owambe Glam.";
    if (!priceFrom.trim() || isNaN(Number(priceFrom)) || Number(priceFrom) <= 0) {
      errs.price_from = "Enter a valid starting price in Naira.";
    }
    if (!location.trim()) errs.location = "Enter your studio address.";
    if (!area.trim()) errs.area = "Enter your neighborhood or area, for example Lekki or Wuse II.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    onboardArtisan.mutate(
      {
        specialty,
        craft,
        studio,
        price_from: Math.round(Number(priceFrom)),
        location,
        city,
        area,
        bio,
      },
      {
        onSuccess: () => {
          toast("Artisan registration submitted successfully! Welcome to LuxeBeau.", "success");
          updateUser({ role: "artisan" });
          router.push("/dashboard/artisan");
        },
        onError: (err: unknown) => {
          toast(
            getFriendlyErrorMessage(err, "We couldn't submit your application. Please check your fields and try again."),
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
            Offer your services on{" "}
            <span className="text-gold-gradient italic">LuxeBeau</span>
          </h1>
          <p className="text-base text-lavender-400 max-w-2xl mx-auto leading-relaxed">
            Join Nigeria's premier curated marketplace for luxury beauty. Connect with premium
            clients in Lagos, Abuja, and Port Harcourt who value exceptional craftsmanship.
          </p>
        </div>
      </section>

      {/* Main Form Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        {!user ? (
          /* Unauthenticated state */
          <div className="rounded-3xl border border-velvet-700/50 bg-velvet-800/30 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-velvet-800 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-royal-400" aria-hidden />
            </div>
            <h3 className="font-display text-2xl font-semibold mb-4">
              Sign in to start your application
            </h3>
            <p className="text-lavender-400 mb-8 max-w-md mx-auto">
              Before submitting your artisan profile, you need to register or log into your
              LuxeBeau partner account.
            </p>
            <Button
              onClick={() => showAuth("login")}
              className="px-8 h-12 rounded-full font-semibold bg-gradient-to-r from-royal-600 to-royal-400 hover:opacity-90"
            >
              Sign in or register <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
            </Button>
          </div>
        ) : user.role === "artisan" ? (
          /* Already an artisan */
          <div className="rounded-3xl border border-success/25 bg-success/8 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-6">
              <UserCheck className="w-8 h-8 text-success" aria-hidden />
            </div>
            <h3 className="font-display text-2xl font-semibold mb-4">
              You are already an Artisan partner!
            </h3>
            <p className="text-lavender-400 mb-8 max-w-md mx-auto">
              Your profile is active. Manage your calendar, pricing, and bookings inside your
              artisan workspace.
            </p>
            <Button
              onClick={() => router.push("/dashboard/artisan")}
              className="px-8 h-12 rounded-full font-semibold bg-success hover:opacity-90 text-velvet-950"
            >
              Go to Artisan Studio <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
            </Button>
          </div>
        ) : (
          /* Onboarding form */
          <div className="rounded-3xl border border-velvet-700/50 bg-velvet-800/20 p-8 sm:p-12 backdrop-blur-md">
            <h3 className="font-display text-2xl font-semibold mb-2">
              Artisan Partnership Profile
            </h3>
            <p className="text-sm text-lavender-400 mb-8">
              Complete your business and styling profile. This information will showcase your
              workspace and minimum procedure pricing to LuxeBeau clients.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Studio Name */}
              <div>
                <Label htmlFor="studio" className="text-lavender-200 font-medium">
                  Studio / Business Name
                </Label>
                <Input
                  id="studio"
                  value={studio}
                  onChange={(e) => setStudio(e.target.value)}
                  placeholder="e.g. The Braid Atelier, Hair by Amaka"
                  className="lb-input mt-1.5"
                  aria-invalid={Boolean(errors.studio)}
                />
                {errors.studio && (
                  <p className="text-xs text-danger mt-1.5" role="alert">
                    {errors.studio}
                  </p>
                )}
              </div>

              {/* Specialty & Craft */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="specialty" className="text-lavender-200 font-medium">
                    Specialty
                  </Label>
                  <select
                    id="specialty"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="lb-input mt-1.5"
                  >
                    {specialties.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="craft" className="text-lavender-200 font-medium">
                    Main Craft / Sub-specialty
                  </Label>
                  <Input
                    id="craft"
                    value={craft}
                    onChange={(e) => setCraft(e.target.value)}
                    placeholder="e.g. Micro-knotless Braids, Frontal Lace Installs"
                    className="lb-input mt-1.5"
                    aria-invalid={Boolean(errors.craft)}
                  />
                  {errors.craft && (
                    <p className="text-xs text-danger mt-1.5" role="alert">
                      {errors.craft}
                    </p>
                  )}
                </div>
              </div>

              {/* Starting Price */}
              <div>
                <Label htmlFor="price_from" className="text-lavender-200 font-medium">
                  Starting Service Price (₦)
                </Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lavender-400 font-semibold font-display text-sm">
                    ₦
                  </span>
                  <Input
                    id="price_from"
                    type="number"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    placeholder="15000"
                    className="lb-input pl-7"
                    aria-invalid={Boolean(errors.price_from)}
                  />
                </div>
                <p className="text-[11px] text-lavender-400 mt-1.5">
                  Your base starting price. Higher fees can be configured per service in your
                  dashboard.
                </p>
                {errors.price_from && (
                  <p className="text-xs text-danger mt-1" role="alert">
                    {errors.price_from}
                  </p>
                )}
              </div>

              {/* City & Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="city" className="text-lavender-200 font-medium">
                    City
                  </Label>
                  <select
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="lb-input mt-1.5"
                  >
                    {cities.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="area" className="text-lavender-200 font-medium">
                    Area / Neighborhood
                  </Label>
                  <Input
                    id="area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Lekki Phase 1, Wuse II"
                    className="lb-input mt-1.5"
                    aria-invalid={Boolean(errors.area)}
                  />
                  {errors.area && (
                    <p className="text-xs text-danger mt-1.5" role="alert">
                      {errors.area}
                    </p>
                  )}
                </div>
              </div>

              {/* Studio Address */}
              <div>
                <Label htmlFor="location" className="text-lavender-200 font-medium">
                  Full Studio Address
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Suite 4B, Admiralty Way, Lekki, Lagos"
                  className="lb-input mt-1.5"
                  aria-invalid={Boolean(errors.location)}
                />
                {errors.location && (
                  <p className="text-xs text-danger mt-1.5" role="alert">
                    {errors.location}
                  </p>
                )}
              </div>

              {/* Professional Bio */}
              <div>
                <Label htmlFor="bio" className="text-lavender-200 font-medium">
                  Professional Bio
                </Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell clients about your specialty, styling certifications, and experience..."
                  className="lb-input mt-1.5 min-h-[100px] resize-none"
                />
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={onboardArtisan.isPending}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-royal-600 to-royal-400 hover:opacity-90 font-semibold text-lavender-100"
              >
                {onboardArtisan.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> Submitting
                    application...
                  </>
                ) : (
                  "Submit Partnership Application"
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
