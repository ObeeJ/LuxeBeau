import { Suspense } from "react";
import SiteShell, { Container } from "@/components/site/shell";
import { CardSkeletonGrid } from "@/components/site/states";
import { fetchProductsServer, fetchedAtNow } from "@/lib/server-api";
import ShopContent from "./shop-content";

// Stays a static, pre-built page (it does not read the address): the full
// catalogue is fetched here at build time. Searches and filters in the
// address bar (?q=, ?category=) are handled in the browser by ShopContent.
export default async function ShopPage() {
  const all = await fetchProductsServer();
  return (
    <SiteShell>
      <Suspense
        fallback={
          <Container className="pt-12">
            <CardSkeletonGrid />
          </Container>
        }
      >
        <ShopContent initialAll={all ?? undefined} fetchedAt={fetchedAtNow()} />
      </Suspense>
    </SiteShell>
  );
}
