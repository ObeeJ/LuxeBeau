"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, CheckCircle2, ChevronRight, Loader2, Sparkles, UserCheck } from "lucide-react";
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
    if (!studio.trim()) errs.studio = "Studio or business name is required.";
    if (!craft.trim()) errs.craft = "Specify your main craft/service (e.g. Knotless Braids).";
    if (!priceFrom.trim() || isNaN(Number(priceFrom)) || Number(priceFrom) <= 0) {
      errs.price_from = "Enter a valid minimum price in Naira.";
    }
    if (!location.trim()) errs.location = "Location address is required.";
    if (!area.trim()) errs.area = "Area or neighborhood is required (e.g. Lekki).";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
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
          toast("Artisan registration submitted successfully!", "success");
          updateUser({ role: "artisan" });
          router.push("/dashboard/artisan");
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
            Offer your services on <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">luxebeau</span>
          </h1>
          <p className="text-base text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Join Nigeria&apos;s premier curated marketplace for luxury beauty. Connect with premium clients in Lagos, Abuja, and Port Harcourt who value exceptional craftsmanship.
          </p>
        </div>
      </section>

      {/* Main Form Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-12">
        {!user ? (
          <div className="rounded-3xl border border-purple-900/40 bg-purple-950/20 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-purple-900/30 flex items-center justify-center mx-auto mb-6">
              <Calendar className="w-8 h-8 text-purple-400" />
            </div>
            <h3 className="text-2xl font-serif mb-4">Sign in to start your application</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Before submitting your artisan profile, you need to register or log into your LuxeBeau partner account.
            </p>
            <Button
              onClick={() => showAuth("login")}
              className="px-8 h-12 rounded-full font-semibold bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90"
            >
              Sign In or Register <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : user.role === "artisan" ? (
          <div className="rounded-3xl border border-emerald-900/40 bg-emerald-950/10 p-8 sm:p-12 text-center backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-emerald-900/20 flex items-center justify-center mx-auto mb-6">
              <UserCheck className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-serif mb-4">You are already an Artisan partner!</h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Your profile is active. You can manage your calendar, pricing, and bookings inside your artisan workspace.
            </p>
            <Button
              onClick={() => router.push("/dashboard/artisan")}
              className="px-8 h-12 rounded-full font-semibold bg-emerald-600 hover:bg-emerald-500"
            >
              Go to Artisan Studio <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border border-purple-900/40 bg-purple-950/10 p-8 sm:p-12 backdrop-blur-md">
            <h3 className="text-2xl font-serif mb-2">Artisan Partnership Profile</h3>
            <p className="text-sm text-gray-400 mb-8">
              Complete your business &amp; styling profile. This information will showcase your workspace and minimum procedure pricing to LuxeBeau clients.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Studio Name */}
              <div>
                <Label htmlFor="studio" className="text-gray-300 font-medium">Studio / Business Name</Label>
                <Input
                  id="studio"
                  value={studio}
                  onChange={(e) => setStudio(e.target.value)}
                  placeholder="e.g. The Braid Atelier, Hair by Amaka"
                  className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl h-12"
                  aria-invalid={Boolean(errors.studio)}
                />
                {errors.studio && <p className="text-xs text-red-400 mt-1.5">{errors.studio}</p>}
              </div>

              {/* Specialty & Craft */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="specialty" className="text-gray-300 font-medium">Specialty</Label>
                  <select
                    id="specialty"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full bg-[#1b1329] border border-purple-900/50 mt-1.5 px-4 rounded-xl h-12 text-white outline-none focus:border-purple-500"
                  >
                    {specialties.map((spec) => (
                      <option key={spec} value={spec}>
                        {spec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="craft" className="text-gray-300 font-medium">Main Craft / Sub-specialty</Label>
                  <Input
                    id="craft"
                    value={craft}
                    onChange={(e) => setCraft(e.target.value)}
                    placeholder="e.g. Micro-knotless Braids, Frontal Lace Installs"
                    className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl h-12"
                    aria-invalid={Boolean(errors.craft)}
                  />
                  {errors.craft && <p className="text-xs text-red-400 mt-1.5">{errors.craft}</p>}
                </div>
              </div>

              {/* Minimum price (Naira) */}
              <div>
                <Label htmlFor="price_from" className="text-gray-300 font-medium">Starting Service Price (₦)</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold font-serif">₦</span>
                  <Input
                    id="price_from"
                    type="number"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                    placeholder="15000"
                    className="bg-purple-950/20 border-purple-900/50 pl-8 focus:border-purple-500 text-white rounded-xl h-12"
                    aria-invalid={Boolean(errors.price_from)}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">Your base starting price for services. Higher fees can be customized for specific services in your dashboard.</p>
                {errors.price_from && <p className="text-xs text-red-400 mt-1.5">{errors.price_from}</p>}
              </div>

              {/* City & Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="city" className="text-gray-300 font-medium">City</Label>
                  <select
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#1b1329] border border-purple-900/50 mt-1.5 px-4 rounded-xl h-12 text-white outline-none focus:border-purple-500"
                  >
                    {cities.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="area" className="text-gray-300 font-medium">Area / Neighborhood</Label>
                  <Input
                    id="area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="e.g. Lekki Phase 1, Wuse II"
                    className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl h-12"
                    aria-invalid={Boolean(errors.area)}
                  />
                  {errors.area && <p className="text-xs text-red-400 mt-1.5">{errors.area}</p>}
                </div>
              </div>

              {/* Studio Address */}
              <div>
                <Label htmlFor="location" className="text-gray-300 font-medium">Full Studio Address</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Suite 4B, Admiralty Way, Lekki, Lagos"
                  className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl h-12"
                  aria-invalid={Boolean(errors.location)}
                />
                {errors.location && <p className="text-xs text-red-400 mt-1.5">{errors.location}</p>}
              </div>

              {/* Professional Bio */}
              <div>
                <Label htmlFor="bio" className="text-gray-300 font-medium">Professional Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell clients about your specialty, styling certifications, and experience..."
                  className="bg-purple-950/20 border-purple-900/50 mt-1.5 focus:border-purple-500 text-white rounded-xl min-h-[100px]"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={onboardArtisan.isPending}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 font-semibold"
              >
                {onboardArtisan.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting application...
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
