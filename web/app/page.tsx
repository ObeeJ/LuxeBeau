import { fetchProductsServer, fetchArtisansServer, fetchedAtNow } from "@/lib/server-api";
import HomeContent from "./home-content";

// Built ahead of time (fully static). If the API is slow or down at build time the
// fetches return null and the browser loads the data itself. Data older than a few
// minutes is refreshed by the browser as soon as the page appears.
export default async function Home() {
  const [products, artisans] = await Promise.all([fetchProductsServer(), fetchArtisansServer()]);
  return <HomeContent initialProducts={products ?? undefined} initialArtisans={artisans ?? undefined} fetchedAt={fetchedAtNow()} />;
}
