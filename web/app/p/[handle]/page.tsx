import { Suspense } from "react";
import SiteShell, { Container } from "@/components/site/shell";
import { ProfilePage } from "@/components/social/profile-page";

export default function PublicProfileRoute({ params }: { params: { handle: string } }) {
  return (
    <SiteShell>
      <Container className="py-8">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfilePage handle={params.handle} />
        </Suspense>
      </Container>
    </SiteShell>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-[935px] animate-pulse space-y-6">
      <div className="flex gap-8">
        <div className="h-20 w-20 rounded-full bg-hairline sm:h-36 sm:w-36" />
        <div className="flex-1 space-y-3 pt-2">
          <div className="h-5 w-40 rounded-full bg-hairline" />
          <div className="h-4 w-64 rounded-full bg-hairline" />
        </div>
      </div>
    </div>
  );
}
