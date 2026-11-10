import SiteShell, { Container } from "@/components/site/shell";
import { AuthPage } from "@/components/auth/auth-page";

export const metadata = { title: "Sign in — LuxeBeau" };

export default function SignInPage() {
  return (
    <SiteShell footer={false}>
      <Container className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center py-12 md:min-h-dvh">
        <AuthPage initialMode="signin" />
      </Container>
    </SiteShell>
  );
}
