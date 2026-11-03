"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Globe,
  Palette,
  Sparkles,
  Store,
  Upload,
  AlertCircle,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/dashboard/image-field";
import {
  CURATED_COLOR_FAMILIES,
  ColorFamily,
  extractDominantColor,
} from "@/lib/color";
import {
  useMyStorefront,
  useSaveStorefront,
  useThemePreview,
} from "@/lib/queries";
import { checkHandleAvailability, type ApiStorefront } from "@/lib/api";
import { useAuth } from "@/lib/store";

interface StorefrontEditorProps {
  role: "seller" | "artisan";
  hasItems: boolean; // has at least 1 product or 1 service
}

const TEMPLATES = [
  { id: "editorial", name: "Editorial", desc: "Full-bleed magazine banner & curated product showcase" },
  { id: "split", name: "Split", desc: "Signature brand profile sidebar with sticky catalogue stream" },
  { id: "minimal", name: "Minimal", desc: "Refined centered branding, concise bio & focused grid" },
  { id: "hero", name: "Hero", desc: "Bold headline visual impact with signature feature highlights" },
  { id: "studio", name: "Studio", desc: "Artisan booking layout with service menu & consultation CTA" },
] as const;

export function StorefrontEditor({ role, hasItems }: StorefrontEditorProps) {
  const user = useAuth((s) => s.user);
  const { data: sf, isLoading } = useMyStorefront();
  const saveMutation = useSaveStorefront();

  // Form State
  const [handle, setHandle] = useState("");
  const [templateId, setTemplateId] = useState<string>("editorial");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [baseHex, setBaseHex] = useState("#C5A880");
  const [themeVariant, setThemeVariant] = useState("true");
  const [bio, setBio] = useState("");
  const [live, setLive] = useState(false);

  // Handle availability state
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "unavailable" | "reserved" | "invalid">("idle");
  const [handleMessage, setHandleMessage] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Populate from existing storefront
  useEffect(() => {
    if (sf) {
      setHandle(sf.handle);
      setTemplateId(sf.template_id || (role === "artisan" ? "studio" : "editorial"));
      setLogoUrl(sf.logo_url || null);
      setBannerUrl(sf.banner_url || null);
      setBaseHex(sf.accent_hex || "#C5A880");
      setThemeVariant(sf.theme_variant || "true");
      setBio(sf.bio || "");
      setLive(sf.live);
    } else if (user) {
      // Suggest default handle based on user name
      const suggested = user.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 30);
      if (suggested.length >= 3) {
        setHandle(suggested);
      }
      if (role === "artisan") {
        setTemplateId("studio");
      }
    }
  }, [sf, user, role]);

  // Handle availability debounced checker
  useEffect(() => {
    const clean = handle.trim().toLowerCase();
    if (!clean || clean.length < 3) {
      setHandleStatus("invalid");
      setHandleMessage("Handle must be at least 3 characters");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(clean)) {
      setHandleStatus("invalid");
      setHandleMessage("Only lowercase letters, numbers, and hyphens (no trailing hyphens)");
      return;
    }

    setHandleStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await checkHandleAvailability(clean);
        if (res.available) {
          setHandleStatus("available");
          setHandleMessage("Handle is available");
        } else {
          setHandleStatus(res.reason === "reserved" ? "reserved" : "unavailable");
          setHandleMessage(res.reason === "reserved" ? "This handle is reserved by the platform" : "Handle is already claimed");
        }
      } catch (err) {
        setHandleStatus("idle");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [handle]);

  // Derived variants query
  const { data: variants } = useThemePreview(baseHex);

  const activeAccent = useMemo(() => {
    if (!variants) return baseHex;
    switch (themeVariant) {
      case "soft": return variants.soft.accent_hex;
      case "deep": return variants.deep.accent_hex;
      case "muted": return variants.muted.accent_hex;
      case "vivid": return variants.vivid.accent_hex;
      default: return variants.true.accent_hex;
    }
  }, [variants, themeVariant, baseHex]);

  const activeOnAccent = useMemo(() => {
    if (!variants) return "#000000";
    switch (themeVariant) {
      case "soft": return variants.soft.on_accent_hex;
      case "deep": return variants.deep.on_accent_hex;
      case "muted": return variants.muted.on_accent_hex;
      case "vivid": return variants.vivid.on_accent_hex;
      default: return variants.true.on_accent_hex;
    }
  }, [variants, themeVariant]);

  // Color extraction from logo
  const handleExtractFromLogo = async () => {
    if (!logoUrl) return;
    try {
      const dominant = await extractDominantColor(logoUrl);
      setBaseHex(dominant);
      setFeedbackMsg({ type: "success", text: `Extracted accent colour ${dominant} from logo` });
    } catch {
      setFeedbackMsg({ type: "error", text: "Could not sample colours from this logo" });
    }
  };

  const handleCopyLink = () => {
    if (!handle) return;
    const url = `${window.location.origin}/s/${handle}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isVerified = user?.verified || user?.kyc_status === "verified";
  const canGoLive = isVerified && hasItems;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMsg(null);

    if (live && !canGoLive) {
      setFeedbackMsg({
        type: "error",
        text: !isVerified
          ? "You must complete business verification before publishing your storefront live."
          : `You must have at least one active ${role === "seller" ? "product" : "service"} before going live.`,
      });
      return;
    }

    try {
      await saveMutation.mutateAsync({
        handle: handle.trim().toLowerCase(),
        template_id: templateId,
        logo_url: logoUrl,
        banner_url: bannerUrl,
        base_hex: baseHex,
        theme_variant: themeVariant,
        bio: bio.trim(),
        live,
      });
      setFeedbackMsg({ type: "success", text: "Storefront configuration saved successfully!" });
    } catch (err: any) {
      setFeedbackMsg({ type: "error", text: err.message || "Failed to save storefront configuration" });
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted">Loading storefront configuration...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Top Banner Status */}
      <div className="flex flex-col gap-4 rounded-[28px] border border-border/60 bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-inner"
            style={{ backgroundColor: activeAccent, color: activeOnAccent }}
          >
            <Store className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Your Digital Storefront</h2>
              {live ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                </span>
              ) : (
                <span className="rounded-full bg-muted/20 px-2.5 py-0.5 text-xs font-semibold text-muted">
                  Draft
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              {handle ? `luxebeau.ng/s/${handle}` : "Claim your brand link and customize your storefront"}
            </p>
          </div>
        </div>

        {handle && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-1.5"
            >
              {isCopied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {isCopied ? "Copied" : "Copy Link"}
            </Button>
            <Link href={`/s/${handle}`} target="_blank">
              <Button type="button" size="sm" className="gap-1.5 bg-brand hover:bg-brand/90 text-surface">
                <ExternalLink className="h-4 w-4" /> View Storefront
              </Button>
            </Link>
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div
          className={`flex items-center gap-2 rounded-2xl p-4 text-sm ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
          }`}
        >
          {feedbackMsg.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <p>{feedbackMsg.text}</p>
        </div>
      )}

      {/* Editor Grid: Settings & Live Preview */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Settings Form */}
        <form onSubmit={handleSubmit} className="space-y-6 lg:col-span-7">
          {/* Section 1: Handle Claim */}
          <div className="rounded-[28px] border border-border/60 bg-surface p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold">1. Brand URL & Handle</h3>
            <p className="text-xs text-muted">
              Your public storefront URL. Once established, changing it redirects visitors automatically for 180 days.
            </p>

            <div className="relative">
              <div className="flex rounded-2xl border border-border/80 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 overflow-hidden">
                <span className="inline-flex items-center bg-muted/15 px-3 text-xs font-medium text-muted">
                  luxebeau.ng/s/
                </span>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="brand-name"
                  required
                  maxLength={50}
                  className="w-full bg-transparent px-3 py-2.5 text-sm font-medium outline-none"
                />
              </div>

              {handleMessage && (
                <p
                  className={`mt-1.5 text-xs font-medium ${
                    handleStatus === "available"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : handleStatus === "checking"
                      ? "text-muted"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {handleStatus === "checking" ? "Checking availability..." : handleMessage}
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Layout Template */}
          <div className="rounded-[28px] border border-border/60 bg-surface p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold">2. Layout Template</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TEMPLATES.map((tmpl) => {
                const disabled = tmpl.id === "studio" && role === "seller";
                const isSelected = templateId === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTemplateId(tmpl.id)}
                    className={`flex flex-col text-left p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? "border-brand bg-brand/5 ring-1 ring-brand"
                        : "border-border/60 hover:border-border"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-sm font-bold">{tmpl.name}</span>
                      {isSelected && <Check className="h-4 w-4 text-brand" />}
                    </div>
                    <span className="mt-1 text-xs text-muted line-clamp-2">{tmpl.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Visual Assets */}
          <div className="rounded-[28px] border border-border/60 bg-surface p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold">3. Brand Assets & Bio</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageField
                label="Brand Logo"
                value={logoUrl || ""}
                onChange={(url) => setLogoUrl(url || null)}
                round
              />
              <ImageField
                label="Storefront Banner"
                value={bannerUrl || ""}
                onChange={(url) => setBannerUrl(url || null)}
              />
            </div>

            {logoUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExtractFromLogo}
                className="gap-1.5 text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Use Colour from Logo
              </Button>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold">Store Bio</label>
                <span className={`text-[11px] ${bio.length > 280 ? "text-red-500 font-bold" : "text-muted"}`}>
                  {bio.length} / 280
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Share your brand story, craftsmanship, or beauty philosophy with your visitors..."
                className="w-full rounded-2xl border border-border/80 bg-transparent p-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 resize-none"
              />
            </div>
          </div>

          {/* Section 4: Colour Palette & Theme Variant */}
          <div className="rounded-[28px] border border-border/60 bg-surface p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">4. Colour System</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-mono">{baseHex}</span>
                <input
                  type="color"
                  value={baseHex}
                  onChange={(e) => setBaseHex(e.target.value.toUpperCase())}
                  className="h-7 w-7 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                />
              </div>
            </div>

            {/* Quick Beauty Families */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted">Curated Beauty Families:</span>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                {CURATED_COLOR_FAMILIES.map((fam) => (
                  <button
                    key={fam.name}
                    type="button"
                    onClick={() => setBaseHex(fam.hex)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      baseHex.toUpperCase() === fam.hex.toUpperCase()
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-border/60 bg-surface/80 hover:border-border"
                    }`}
                  >
                    <span className="h-3 w-3 rounded-full shadow-inner" style={{ backgroundColor: fam.hex }} />
                    {fam.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Derived Theme Variants */}
            {variants && (
              <div className="space-y-2 pt-2 border-t border-border/40">
                <span className="text-xs font-medium text-muted">Derived Theme Variant:</span>
                <div className="grid grid-cols-5 gap-2">
                  {(["true", "soft", "deep", "muted", "vivid"] as const).map((vKey) => {
                    const cfg = variants[vKey];
                    const isSelected = themeVariant === vKey;
                    return (
                      <button
                        key={vKey}
                        type="button"
                        onClick={() => setThemeVariant(vKey)}
                        className={`flex flex-col items-center p-2 rounded-2xl border transition-all ${
                          isSelected ? "border-brand ring-2 ring-brand/30 bg-surface" : "border-border/60 hover:border-border"
                        }`}
                      >
                        <span
                          className="h-8 w-full rounded-xl shadow-inner flex items-center justify-center text-[10px] font-bold"
                          style={{ backgroundColor: cfg.accent_hex, color: cfg.on_accent_hex }}
                        >
                          Aa
                        </span>
                        <span className="mt-1.5 text-[11px] font-semibold capitalize">{vKey}</span>
                        <span className="text-[10px] text-muted">{cfg.contrast}:1</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Publication Safeguards & Submission */}
          <div className="rounded-[28px] border border-border/60 bg-surface p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Storefront Visibility</h3>
                <p className="text-xs text-muted">
                  Toggle whether your storefront is publicly accessible at <code>/s/{handle || "..."}</code>
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={live}
                  onChange={(e) => setLive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            {live && !canGoLive && (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Publication Requirements:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li className={isVerified ? "text-emerald-600" : ""}>
                      Business Identity Verification ({isVerified ? "Passed" : "Required"})
                    </li>
                    <li className={hasItems ? "text-emerald-600" : ""}>
                      At least one active {role === "seller" ? "product" : "service"} ({hasItems ? "Ready" : "Required"})
                    </li>
                  </ul>
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={saveMutation.isPending || handleStatus === "unavailable" || handleStatus === "reserved" || handleStatus === "invalid"}
              className="w-full bg-brand hover:bg-brand/90 text-surface font-semibold py-3 rounded-2xl"
            >
              {saveMutation.isPending ? "Saving..." : "Save Storefront Changes"}
            </Button>
          </div>
        </form>

        {/* Live Device Preview */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 rounded-[32px] border border-border/80 bg-neutral-900 p-4 shadow-xl text-neutral-100">
            <div className="flex items-center justify-between pb-3 px-2 border-b border-neutral-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Live Preview
              </span>
              <span className="text-[11px] font-mono text-neutral-400 capitalize">
                {templateId} Layout
              </span>
            </div>

            {/* Mock Phone / Window Frame */}
            <div
              className="mt-3 rounded-[24px] bg-neutral-950 overflow-hidden border border-neutral-800 shadow-2xl transition-all"
              style={{
                ["--sf-accent" as any]: activeAccent,
                ["--sf-on-accent" as any]: activeOnAccent,
              }}
            >
              {/* Mock Banner */}
              <div
                className="h-28 w-full bg-neutral-800 bg-cover bg-center relative"
                style={{
                  backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
                  backgroundColor: !bannerUrl ? activeAccent : undefined,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/90 via-transparent to-transparent" />
              </div>

              {/* Mock Brand Header */}
              <div className="p-4 -mt-10 relative space-y-3">
                <div className="flex items-end justify-between">
                  <div
                    className="h-16 w-16 rounded-2xl bg-neutral-900 border-2 border-neutral-950 shadow-md flex items-center justify-center overflow-hidden font-extrabold text-xl text-neutral-200"
                    style={{ borderColor: activeAccent }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                    ) : (
                      user?.name?.slice(0, 1).toUpperCase() || "B"
                    )}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-full text-xs font-bold shadow-sm transition-transform active:scale-95"
                    style={{ backgroundColor: activeAccent, color: activeOnAccent }}
                  >
                    {role === "seller" ? "Shop Collection" : "Book Service"}
                  </button>
                </div>

                <div>
                  <h4 className="text-base font-bold text-neutral-100">{user?.name || "Your Brand Name"}</h4>
                  <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                    {bio || "Your bespoke brand statement and luxury beauty collection."}
                  </p>
                </div>

                {/* Mock Template Grid Elements */}
                <div className="pt-2 border-t border-neutral-800/80">
                  <div className="text-[10px] uppercase font-semibold text-neutral-400 mb-2">
                    {role === "seller" ? "Featured Products" : "Available Services"}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="rounded-xl bg-neutral-900 p-2 border border-neutral-800">
                        <div className="h-16 rounded-lg bg-neutral-800 mb-2" />
                        <div className="h-2.5 w-3/4 rounded bg-neutral-700 mb-1" />
                        <div className="h-2 w-1/2 rounded bg-neutral-800" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-3 text-center">
                  <span className="text-[9px] text-neutral-400 uppercase tracking-widest">
                    Powered by LuxeBeau
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
