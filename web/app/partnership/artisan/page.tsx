"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import SiteShell from "@/components/site/shell";
import { PartnerFrame, SignInPrompt } from "@/components/site/partner";
import { ImageField } from "@/components/dashboard/image-field";
import { FieldError } from "@/components/site/states";
import { useAuth } from "@/lib/store";
import { useMyArtisanProfile, useOnboardArtisan } from "@/lib/queries";
import { type Artisan } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { getFriendlyErrorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const SPECIALTIES = ["Haircare", "Skincare", "Makeup", "Nails", "Grooming"] as const;
const CITIES = ["Lagos", "Abuja", "Port Harcourt", "Ibadan"] as const;
const MODES = [
  { id: "studio", label: "At my studio" },
  { id: "home", label: "At the client's place" },
  { id: "both", label: "Both" },
] as const;

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5">{children}</div>
      <FieldError>{error}</FieldError>
    </div>
  );
}

function ArtisanForm({ existing }: { existing?: Artisan }) {
  const router = useRouter();
  const updateUser = useAuth(s => s.updateUser);
  const currentRole = useAuth(s => s.user?.role);
  const onboard = useOnboardArtisan();

  const [specialty, setSpecialty] = useState<string>(SPECIALTIES[0]);
  const [craft, setCraft] = useState(existing?.craft ?? "");
  const [studio, setStudio] = useState(existing?.studio ?? "");
  const [priceFrom, setPriceFrom] = useState(existing ? String(existing.fromNGN) : "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [city, setCity] = useState<string>(existing?.city || CITIES[0]);
  const [area, setArea] = useState(existing?.area ?? "");
  const [bio, setBio] = useState(existing?.bio ?? "");
  const [mode, setMode] = useState<Artisan["serviceMode"]>(existing?.serviceMode ?? "studio");
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!studio.trim()) errs.studio = "Enter your studio or business name.";
    if (!craft.trim()) errs.craft = "Name your main craft, like knotless braids or bridal makeup.";
    if (!/^\d+$/.test(priceFrom.trim()) || Number(priceFrom) <= 0) errs.price_from = "Enter your starting price in naira.";
    if (!location.trim()) errs.location = mode === "home" ? "Enter the area you work from." : "Enter your studio address.";
    if (!area.trim()) errs.area = "Enter your neighbourhood, for example Lekki or Wuse II.";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    onboard.mutate(
      {
        specialty,
        craft: craft.trim(),
        studio: studio.trim(),
        price_from: Number(priceFrom),
        location: location.trim(),
        city,
        area: area.trim(),
        bio: bio.trim(),
        service_mode: mode,
        image_url: imageUrl || undefined,
      },
      {
        onSuccess: () => {
          // A new partner role goes to admin review (api-go booking.becomePartner).
          updateUser({ role: "artisan", ...(currentRole !== "artisan" && { verified: false }) });
          router.push("/dashboard/artisan");
        },
        onError: err => setErrors({ form: getFriendlyErrorMessage(err, "We couldn't save your profile. Please try again.") }),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-[28px] bg-surface p-5 shadow-card sm:p-6">
      <h2 className="t-sub">{existing ? "Edit your profile" : "Your artisan profile"}</h2>
      <ImageField label="Profile photo" value={imageUrl} onChange={setImageUrl} round />
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

      <fieldset>
        <legend className="t-meta mb-1.5">Where do you work?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup">
          {MODES.map(m => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "h-10 rounded-full border px-4 text-[14px] tracking-[-0.014em] transition-colors duration-200",
                mode === m.id ? "border-ink bg-ink text-surface" : "border-hairline bg-surface hover:bg-canvas",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </fieldset>

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
      <Field id="location" label={mode === "home" ? "Area you work from" : "Studio address"} error={errors.location}>
        <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="Suite 4B, Admiralty Way, Lekki" aria-invalid={Boolean(errors.location)} />
      </Field>
      <Field id="bio" label="About you (optional)">
        <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} rows={3} placeholder="Your specialty, training and experience." />
      </Field>
      <FieldError>{errors.form}</FieldError>
      <Button type="submit" disabled={onboard.isPending} size="lg" className="w-full">
        {onboard.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {existing ? "Save profile" : "Create profile"}
      </Button>
    </form>
  );
}

export default function ArtisanOnboarding() {
  const user = useAuth(s => s.user);
  const status = useAuth(s => s.status);
  const isArtisan = user?.role === "artisan";
  const profile = useMyArtisanProfile(Boolean(isArtisan));

  return (
    <SiteShell>
      <PartnerFrame
        title={isArtisan ? "Your artisan profile" : "Join LuxeBeau as an artisan"}
        body="Braiders, gele artists, makeup artists, barbers, nail techs and estheticians."
        points={[
          "Clients find you by craft, city and whether you visit them at home.",
          "Set your services and weekly hours; clients request open times and you confirm them.",
          "We review new artisans before your profile goes live.",
          "Every confirmed job adds to the count clients see on your profile.",
        ]}
      >
        {status === "loading" || (isArtisan && profile.isLoading) ? (
          <Skeleton className="h-96 w-full rounded-[28px] bg-surface" />
        ) : !user ? (
          <SignInPrompt what="create an artisan profile" />
        ) : (
          <ArtisanForm key={profile.data?.id ?? "new"} existing={profile.data} />
        )}
      </PartnerFrame>
    </SiteShell>
  );
}
