"use client";

import Link from "next/link";
import { ArrowRight, CircleUser, type LucideIcon } from "lucide-react";
import { Container } from "@/components/site/shell";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/components/auth/auth-dialog";

/* Shared frame for the seller / artisan onboarding pages. */
export function PartnerFrame({
  eyebrow,
  title,
  body,
  perks,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  perks: { icon: LucideIcon; title: string; body: string }[];
  children: React.ReactNode;
}) {
  return (
    <Container className="pt-8 md:pt-12">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <div>
          <p className="t-meta text-muted">{eyebrow}</p>
          <h1 className="t-display mt-1">{title}</h1>
          <p className="mt-3 max-w-md text-[16px] text-muted">{body}</p>
          <ul className="mt-6 space-y-3">
            {perks.map(({ icon: Icon, title: t, body: b }) => (
              <li key={t} className="flex gap-3 rounded-[20px] bg-surface p-4 shadow-pill">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas">
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <p className="t-sub">{t}</p>
                  <p className="text-[14px] tracking-[-0.014em] text-muted">{b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>{children}</div>
      </div>
    </Container>
  );
}

export function SignInPrompt({ what }: { what: string }) {
  const showAuth = useAuthModal(s => s.show);
  return (
    <div className="rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
      <CircleUser className="mx-auto h-8 w-8" strokeWidth={1.5} aria-hidden />
      <h2 className="t-display mt-3">Sign in to continue</h2>
      <p className="mt-2 text-[16px] text-muted">Create or sign in to your LuxeBeau account before you {what}.</p>
      <Button onClick={() => showAuth("login")} size="lg" className="mt-5">Sign in or register</Button>
    </div>
  );
}

export function AlreadyPartner({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="rounded-[28px] bg-surface p-6 text-center shadow-card sm:p-8">
      <h2 className="t-display">{title}</h2>
      <p className="mt-2 text-[16px] text-muted">{body}</p>
      <Button asChild size="lg" className="mt-5">
        <Link href={href}>{cta} <ArrowRight aria-hidden /></Link>
      </Button>
    </div>
  );
}
