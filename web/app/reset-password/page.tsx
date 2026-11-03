"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import SiteShell, { Container } from "@/components/site/shell";
import { useAuthModal } from "@/components/auth/auth-dialog";

export default function ResetPasswordPage() {
  const { show } = useAuthModal();
  const router = useRouter();

  useEffect(() => {
    show("reset", () => {
      router.push("/dashboard");
    });
  }, [show, router]);

  return (
    <SiteShell>
      <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Reset Password
        </h1>
        <p className="mt-2 text-sm text-muted">
          Opening secure password reset…
        </p>
      </Container>
    </SiteShell>
  );
}
