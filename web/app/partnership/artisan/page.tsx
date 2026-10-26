"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Loader2, Sparkles, Star } from "lucide-react";
import SiteShell from "@/components/site/shell";
import { AlreadyPartner, PartnerFrame, SignInPrompt } from "@/components/site/partner";
import { FieldError } from "@/components/site/states";
import { useAuth } from "@/lib/store";
import { useOnboardArtisan } from "@/lib/queries";
import { useToast } from "@/components/ui/slide-in-notifications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getFriendlyErrorMessage } from "@/lib/errors";

const SPECIALTIES = ["Haircare", "Skincare", "Makeup", "Nails", "Grooming"] as const;
const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan"] as const;

const PERKS = [
  { icon: Sparkles, title: "A public profile", body: "Clients discover you by craft and city, with your rating and studio." },
  { icon: CalendarCheck, title: "Booking requests", body: "Clients reserve open slots; you confirm them from your artisan studio." },
  { icon: Star, title: "Reputation that compounds", body: "Every completed job adds to the count clients see on your card." },
];

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

export default function ArtisanOnboarding() {
  const router = useRouter();
  const user = useAuth(s => s.user);
  const updateUser = useAuth(s => s.updateUser);
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
    if (!craft.trim()) errs.craft = "Name your main craft, like Knotless Braids or Owambe Glam.";
    if (!/^\d+$/.test(priceFrom.trim()) || Number(priceFrom) <= 0) errs.price_from = "Enter your starting price in whole Naira.";
    if (!location.trim()) errs.location = "Enter your studio address.";
    if (!area.trim()) errs.area = "Enter your neighbourhood, for example Lekki or Wuse II.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* POST /me/artisan-onboard: price_from is whole Naira; the API converts to
     kobo (booking/handler.go OnboardArtisan). */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;
    onboardArtisan.mutate(
      {
        specialty,
        craft: craft.trim(),
        studio: studio.trim(),
        price_from: Number(priceFrom),
        location: location.trim(),
        city,
        area: area.trim(),
        bio: bio.trim(),
      },
      {
        onSuccess: () => {
          toast("Your artisan profile is live. Welcome to LuxeBeau.", "success");
          updateUser({ role: "artisan" });
          router.push("/dashboard/artisan");
        },
        onError: err => toast(getFriendlyErrorMessage(err, "We couldn't submit your application. Please try again."), "error"),
      },
    );
  };

  return (
    <SiteShell>
      <PartnerFrame
        eyebrow="Partners"
        title="Join LuxeBeau as an artisan"
        body="Braiders, gele artists, makeup artists, barbers, nail techs and estheticians."
        perks={PERKS}
      >
        {!user ? (
          <SignInPrompt what="create your artisan profile" />
        ) : user.role === "artisan" ? (
          <AlreadyPartner title="Your artisan studio is ready" body="Confirm bookings and keep your profile up to date." href="/dashboard/artisan" cta="Open artisan studio" />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-[28px] bg-surface p-5 shadow-card sm:p-6">
            <div>
              <h2 className="t-display">Artisan profile</h2>
              <p className="mt-1 text-[14px] tracking-[-0.014em] text-muted">Signed in as {user.name}. Clients see this on your public profile.</p>
            </div>
            <Field id="studio" label="Studio or business name" error={errors.studio}>
              <Input id="studio" value={studio} onChange={e => setStudio(e.target.value)} placeholder="The Braid Atelier" aria-invalid={Boolean(errors.studio)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="specialty" label="Specialty">
                <select id="specialty" value={specialty} onChange={e => setSpecialty(e.target.value)} className="lb-input h-11">
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field id="craft" label="Main craft" error={errors.craft}>
                <Input id="craft" value={craft} onChange={e => setCraft(e.target.value)} placeholder="Knotless braids" aria-invalid={Boolean(errors.craft)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field id="price_from" label="Starting price (₦)" error={errors.price_from}>
                <Input id="price_from" inputMode="numeric" value={priceFrom} onChange={e => setPriceFrom(e.target.value)} placeholder="15000" aria-invalid={Boolean(errors.price_from)} />
              </Field>
              <Field id="city" label="City">
                <select id="city" value={city} onChange={e => setCity(e.target.value)} className="lb-input h-11">
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field id="area" label="Area" error={errors.area}>
                <Input id="area" value={area} onChange={e => setArea(e.target.value)} placeholder="Lekki Phase 1" aria-invalid={Boolean(errors.area)} />
              </Field>
            </div>
            <Field id="location" label="Studio address" error={errors.location}>
              <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Suite 4B, Admiralty Way, Lekki" aria-invalid={Boolean(errors.location)} />
            </Field>
            <Field id="bio" label="Bio (optional)">
              <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Your specialty, training and experience." />
            </Field>
            <Button type="submit" disabled={onboardArtisan.isPending} size="lg" className="w-full">
              {onboardArtisan.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {onboardArtisan.isPending ? "Creating your profile" : "Create artisan profile"}
            </Button>
          </form>
        )}
      </PartnerFrame>
    </SiteShell>
  );
}
