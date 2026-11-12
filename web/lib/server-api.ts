import "server-only";
import { z } from "zod";
import {
  productsResponseSchema,
  artisansResponseSchema,
  toProduct,
  toArtisan,
  type Product,
  type Artisan,
} from "@/lib/api";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

// If the API is asleep or slow we give up quickly and let the browser fetch the
// data itself (through the edge cache), rather than holding the whole page up.
const SERVER_FETCH_TIMEOUT_MS = 3500;

/* Public catalogue reads for server rendering. Fetched once when the page is built
   (fully static: a background refresh, ISR, hangs about 40% of page loads on this
   Cloudflare setup), no cookies, no custom headers. The browser refreshes anything
   old right after the page appears, so a static page never shows stale data for long. Returns null on ANY failure (network, timeout,
   bad status, bad body) so a page is always built and the browser takes over. */
async function serverFetch<T>(path: string, schema: z.ZodType<T>, timeoutMs: number): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      cache: "force-cache",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const envelope = z.object({ success: z.boolean(), data: z.unknown() }).parse(await res.json());
    if (!envelope.success) return null;
    return schema.parse(envelope.data);
  } catch {
    return null;
  }
}

export async function fetchProductsServer(search = "", timeoutMs = SERVER_FETCH_TIMEOUT_MS): Promise<Product[] | null> {
  const qs = new URLSearchParams({ limit: "100" });
  if (search) qs.set("search", search);
  const data = await serverFetch(`/products?${qs}`, productsResponseSchema, timeoutMs);
  return data ? data.products.map(toProduct) : null;
}

export async function fetchArtisansServer(timeoutMs = SERVER_FETCH_TIMEOUT_MS): Promise<Artisan[] | null> {
  const data = await serverFetch("/artisans", artisansResponseSchema, timeoutMs);
  return data ? data.artisans.map(toArtisan) : null;
}

/** When the data above was fetched. Pages are static, so this is the build time and
    tells the browser how old the data in the HTML is. */
export function fetchedAtNow(): number {
  return Date.now();
}
