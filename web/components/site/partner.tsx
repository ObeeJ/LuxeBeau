"use client";

import Link from "next/link";
import { Container } from "@/components/site/shell";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/components/auth/auth-dialog";

/* Shared frame for the seller / artisan onboarding pages. */
export function PartnerFrame({
  title,
  body,
  points,
  children,
}: {
  title: string;
  body: string;
  points: string[];
  children: React.ReactNode;
}) {
  return (
    <Container className="pt-8 md:pt-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:gap-14">
        <div className="lg:pt-2">
          <h1 className="t-display">{title}</h1>
          <p className="mt-2 max-w-md text-[16px] text-muted">{body}</p>
          <ul className="mt-6 max-w-md divide-y divide-hairline border-y border-hairline">
            {points.map(p => (
              <li key={p} className="py-3 text-[14px] tracking-[-0.014em]">{p}</li>
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
    <div className="rounded-[28px] bg-surface p-6 shadow-card sm:p-8">
      <h2 className="t-display">Sign in first</h2>
      <p className="mt-2 text-[16px] text-muted">You need a LuxeBeau account to {what}.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button onClick={() => showAuth("register")}>Create an account</Button>
        <Button variant="outline" onClick={() => showAuth("signin")}>Sign in</Button>
      </div>
    </div>
  );
}

export function AlreadyPartner({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="rounded-[28px] bg-surface p-6 shadow-card sm:p-8">
      <h2 className="t-display">{title}</h2>
      <p className="mt-2 text-[16px] text-muted">{body}</p>
      <Button asChild className="mt-5"><Link href={href}>{cta}</Link></Button>
    </div>
  );
}
