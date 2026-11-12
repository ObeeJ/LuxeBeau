import { fetchProductsServer, fetchArtisansServer } from "@/lib/server-api";
import HomeContent from "./home-content";

// Built ahead of time and refreshed about once a minute (the fetches below are
// cached for 60 s). If the API is slow or down, the fetches return null and the
// browser loads the data itself, so the page always renders.
export default async function Home() {
  const [products, artisans] = await Promise.all([fetchProductsServer(), fetchArtisansServer()]);
  return <HomeContent initialProducts={products ?? undefined} initialArtisans={artisans ?? undefined} />;
}
