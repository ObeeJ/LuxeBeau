import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// Pre-built (static) pages are stored in the R2 bucket bound as
// NEXT_INC_CACHE_R2_BUCKET and served from there. Without this, every "static"
// page was rendered from scratch on each request on the Worker, which is slow
// and, on the free plan's tiny CPU budget, intermittently hangs or errors.
// The cache is filled at deploy time: see the `cache:populate` script.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
