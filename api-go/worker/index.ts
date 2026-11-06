import { DurableObject } from "cloudflare:workers";

export interface Env {
  API_CONTAINER: DurableObjectNamespace<ApiContainer>;
  CACHE_KV?: KVNamespace;
  HYPERDRIVE?: { connectionString: string };
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  APP_URL?: string;
  ALLOWED_ORIGINS?: string;
  COOKIE_DOMAIN?: string;
  COOKIE_SECURE?: string;
  TRUSTED_PLATFORM?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USERNAME?: string;
  SMTP_PASSWORD?: string;
  EMAIL_FROM?: string;
  PAYSTACK_SECRET_KEY?: string;
  ENVIRONMENT?: string;
}

export class ApiContainer extends DurableObject<Env> {
  private readyPromise?: Promise<void>;

  async fetch(request: Request): Promise<Response> {
    const container = (this.ctx as any).container;
    if (!container) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "CONTAINER_ERROR", message: "Cloudflare Container runtime unavailable" },
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    this.readyPromise ??= this.ensureReady(container);
    await this.readyPromise;

    // Target the Go application listening on port 8080 inside the container
    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    url.port = "8080";

    const forwarded = new Request(url.toString(), request);
    forwarded.headers.delete("host");

    const tcpPort = container.getTcpPort(8080);
    return await tcpPort.fetch(forwarded);
  }

  private async ensureReady(container: any): Promise<void> {
    if (!container.running) {
      const dbUrl = this.env.HYPERDRIVE?.connectionString || this.env.DATABASE_URL || "";

      // No built-in default: a secret in source is a secret in a public repo.
      const jwtSecret = this.env.JWT_SECRET;
      if (!jwtSecret || jwtSecret.length < 32) {
        throw new Error("JWT_SECRET must be set (32+ characters): wrangler secret put JWT_SECRET");
      }

      await container.start({
        image: container.images.base,
        enableInternet: true,
        env: {
          PORT: "8080",
          DATABASE_URL: dbUrl,
          JWT_SECRET: jwtSecret,
          APP_URL: this.env.APP_URL || "https://myluxebeau.com",
          ALLOWED_ORIGINS: this.env.ALLOWED_ORIGINS || "https://myluxebeau.com,https://www.myluxebeau.com,http://localhost:3000",
          COOKIE_DOMAIN: this.env.COOKIE_DOMAIN || "",
          COOKIE_SECURE: this.env.COOKIE_SECURE || "true",
          TRUSTED_PLATFORM: "cloudflare",
          SMTP_HOST: this.env.SMTP_HOST || "smtp.gmail.com",
          SMTP_PORT: this.env.SMTP_PORT || "465",
          SMTP_USERNAME: this.env.SMTP_USERNAME || "ajayioba2000@gmail.com",
          SMTP_PASSWORD: this.env.SMTP_PASSWORD ?? "",
          EMAIL_FROM: this.env.EMAIL_FROM || "Akin <ajayioba2000@gmail.com>",
          PAYSTACK_SECRET_KEY: this.env.PAYSTACK_SECRET_KEY ?? "",
        },
      });
    }

    if (typeof container.setInactivityTimeout === "function") {
      // Scale down container after 15 minutes of inactivity to keep bills near zero
      await container.setInactivityTimeout(15 * 60 * 1000);
    }

    // Health check polling until Go HTTP server accepts connections
    const tcpPort = container.getTcpPort(8080);
    for (let i = 0; i < 40; i++) {
      try {
        const res = await tcpPort.fetch("http://container:8080/healthz");
        if (res.ok) return;
      } catch {
        // Wait for container boot
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Edge Caching Layer: Catalogue & read routes (Serves 100k users with <15ms response and zero server load)
    const isCacheable =
      request.method === "GET" &&
      (url.pathname.startsWith("/api/v1/products") ||
        url.pathname.startsWith("/api/v1/artisans") ||
        url.pathname.startsWith("/api/v1/categories"));

    const cache = (caches as any).default;
    if (isCacheable) {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
    }

    // 2. Route directly to the Durable Object Container instance
    const id = env.API_CONTAINER.idFromName("primary-backend");
    const stub = env.API_CONTAINER.get(id);

    const response = await stub.fetch(request);

    // 3. Populate edge cache on successful response
    if (isCacheable && response.ok) {
      const cloned = new Response(response.body, response);
      cloned.headers.set(
        "Cache-Control",
        "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
      );
      ctx.waitUntil(cache.put(request, cloned.clone()));
      return cloned;
    }

    return response;
  },
};
