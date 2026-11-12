import { Suspense } from "react";
import SiteShell from "@/components/site/shell";
import { fetchArtisansServer, fetchedAtNow } from "@/lib/server-api";
import ServicesContent from "./services-content";

// Static, pre-built page: artisans are fetched here at build time.
// ?q= and ?city= in the address bar are handled in the browser.
export default async function ServicesPage() {
  const artisans = await fetchArtisansServer();
  return (
    <SiteShell>
      <Suspense fallback={null}>
        <ServicesContent initialArtisans={artisans ?? undefined} fetchedAt={fetchedAtNow()} />
      </Suspense>
    </SiteShell>
  );
}
