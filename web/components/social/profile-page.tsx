"use client";

import Link from "next/link";
import Image from "next/image";
import { BadgeCheck, ExternalLink, MessageCircle } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadError } from "@/components/site/states";
import { usePublicProfile } from "@/lib/social";
import { useAuth } from "@/lib/store";
import { cn } from "@/lib/utils";

/* ── Avatar ─────────────────────────────────────────────────── */
function Avatar({ src, name, size }: { src?: string; name: string; size: "sm" | "lg" }) {
  const dim = size === "lg" ? "h-20 w-20 sm:h-36 sm:w-36" : "h-11 w-11";
  const text = size === "lg" ? "text-[28px] sm:text-[40px]" : "text-[16px]";
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

  if (src) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden rounded-full bg-canvas", dim)}>
        <Image src={src} alt={name} fill className="object-cover" sizes="144px" />
      </div>
    );
  }
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand-wash font-semibold text-brand-deep", dim, text)}>
      {initials}
    </div>
  );
}

/* ── Stat pill ──────────────────────────────────────────────── */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-1.5">
      <span className="text-[16px] font-bold tabular-nums text-ink">{value.toLocaleString("en-NG")}</span>
      <span className="text-[13px] text-muted">{label}</span>
    </div>
  );
}

/* ── Role badge ─────────────────────────────────────────────── */
function RoleBadge({ role }: { role: string }) {
  if (role === "buyer") return null;
  return (
    <span className="inline-flex h-5 items-center rounded-full bg-brand-wash px-2 text-[11px] font-semibold uppercase tracking-wider text-brand-deep">
      {role}
    </span>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export function ProfilePage({ handle }: { handle: string }) {
  const q = usePublicProfile(handle);
  const me = useAuth(s => s.user);

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-[935px] animate-pulse space-y-6">
        <div className="flex gap-6 sm:gap-10">
          <Skeleton className="h-20 w-20 shrink-0 rounded-full sm:h-36 sm:w-36" />
          <div className="flex-1 space-y-3 pt-2">
            <Skeleton className="h-5 w-40 rounded-full" />
            <Skeleton className="h-4 w-64 rounded-full" />
            <Skeleton className="h-4 w-48 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (q.isError || !q.data) {
    return <LoadError onRetry={() => q.refetch()} message="We couldn't load this profile." />;
  }

  const p = q.data;
  const isMe = me?.id === p.user_id;

  return (
    <div className="mx-auto max-w-[935px]">
      {/* ── Header ── */}
      <div className="flex gap-6 sm:gap-10">
        <Avatar src={p.avatar_url || undefined} name={p.name} size="lg" />

        <div className="min-w-0 flex-1">
          {/* Name row */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">{p.name}</h1>
            {p.verified && <BadgeCheck className="h-5 w-5 text-brand" aria-label="Verified" />}
            <RoleBadge role={p.role} />
          </div>

          {/* Handle */}
          {p.social_handle && (
            <p className="mt-0.5 text-[14px] text-muted">@{p.social_handle}</p>
          )}

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            {isMe ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">Edit profile</Link>
              </Button>
            ) : me ? (
              <Button asChild size="sm">
                <Link href={`/messages?to=${p.user_id}`}>
                  <MessageCircle className="h-4 w-4" aria-hidden /> Message
                </Link>
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href="/signin">Sign in to message</Link>
              </Button>
            )}
            {p.website.startsWith("https://") && (
              <Button asChild variant="outline" size="sm">
                <a href={p.website} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" aria-hidden /> Website
                </a>
              </Button>
            )}
          </div>

          {/* Stats — desktop inline, mobile hidden (shown below) */}
          <div className="mt-4 hidden gap-8 sm:flex">
            <Stat value={p.stats.reviews} label="reviews" />
          </div>

          {/* Bio */}
          {p.bio && (
            <p className="mt-3 max-w-[400px] text-[14px] leading-relaxed text-ink">{p.bio}</p>
          )}
        </div>
      </div>

      {/* Stats — mobile only */}
      <div className="mt-4 flex justify-around border-y border-hairline py-3 sm:hidden">
        <Stat value={p.stats.reviews} label="reviews" />
      </div>

      {/* ── Activity grid placeholder ── */}
      <div className="mt-8">
        <div className="mb-4 flex items-center gap-2 border-t border-hairline pt-4">
          <span className="text-[13px] font-semibold uppercase tracking-wider text-ink">Activity</span>
        </div>
        <p className="text-[14px] text-muted">
          {isMe ? "Your public activity will appear here." : `${p.name.split(" ")[0]}'s public activity will appear here.`}
        </p>
      </div>
    </div>
  );
}
