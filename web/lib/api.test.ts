import { z } from "zod";
import { apiFetch } from "./api";

const ok = (data: unknown) => ({
  status: 200,
  ok: true,
  json: async () => ({ success: true, data }),
});

describe("apiFetch request headers", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(ok({ n: 1 }));
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  const headersOf = () => fetchMock.mock.calls[0][1].headers as Record<string, string>;
  const schema = z.object({ n: z.number() });

  // A custom header on a cross-site request makes the browser send an extra
  // "preflight" round trip to the API first. Reads cannot change anything, so
  // they do not need the anti-forgery header, and skipping it saves that trip.
  it("reads do not carry the custom header, so the browser skips the preflight", async () => {
    await apiFetch("/products", schema);
    expect(headersOf()["X-LuxeBeau-Client"]).toBeUndefined();
    expect(headersOf().Accept).toBe("application/json");
    expect(Object.keys(headersOf()).filter(k => k !== "Accept")).toEqual([]); // nothing that forces a preflight
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include"); // the session cookie still rides along
  });

  it("writes still carry the anti-forgery header, and callers cannot remove or replace it", async () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"] as const) {
      fetchMock.mockClear();
      await apiFetch("/me/profile", schema, { method, body: { a: 1 }, headers: { "X-LuxeBeau-Client": "evil" } });
      expect(headersOf()["X-LuxeBeau-Client"]).toBe("web");
    }
  });

  it("a write without a body still carries it", async () => {
    await apiFetch("/orders/1/verify", schema, { method: "POST" });
    expect(headersOf()["X-LuxeBeau-Client"]).toBe("web");
  });

  it("the session refresh (a POST) still carries it", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce({ status: 401, ok: false, json: async () => ({ success: false, error: { code: "UNAUTHORIZED", message: "x" } }) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({}) })
      .mockResolvedValueOnce(ok({ n: 2 }));
    await apiFetch("/me/orders", schema);
    const refresh = fetchMock.mock.calls.find(c => String(c[0]).endsWith("/auth/refresh"));
    expect(refresh?.[1].headers["X-LuxeBeau-Client"]).toBe("web");
  });
});

/* ── Public reads go through the edge cache when it is configured ── */
describe("apiFetch edge routing for public reads", () => {
  const EDGE = "https://edge.test/api/v1";
  const ORIGIN = "https://api.test/api/v1";
  const fetchMock = jest.fn();
  const schema = z.object({ n: z.number() });

  function load(env: { edge?: string }) {
    jest.resetModules();
    process.env.NEXT_PUBLIC_API_URL = ORIGIN;
    if (env.edge) process.env.NEXT_PUBLIC_EDGE_API_URL = env.edge;
    else delete process.env.NEXT_PUBLIC_EDGE_API_URL;
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./api") as typeof import("./api");
  }
  const urls = () => fetchMock.mock.calls.map(c => String(c[0]));
  const resp = (status: number, data: unknown = { n: 1 }) => ({
    status, ok: status >= 200 && status < 300, json: async () => ({ success: status < 300, data }),
  });
  beforeEach(() => { fetchMock.mockReset(); fetchMock.mockResolvedValue(resp(200)); });

  it("sends public catalogue reads to the edge, without credentials", async () => {
    const { apiFetch } = load({ edge: EDGE });
    for (const path of ["/products?limit=100", "/products/abc-1", "/artisans", "/artisans/7", "/reviews?target_type=product&target_id=1", "/featured-ads/pricing"]) {
      fetchMock.mockClear();
      await apiFetch(path, schema);
      expect(urls()).toEqual([EDGE + path]);
      expect(fetchMock.mock.calls[0][1].credentials).toBe("omit");
      expect(Object.keys(fetchMock.mock.calls[0][1].headers)).toEqual(["Accept"]);
    }
  });

  it("never sends personal, counted or write requests to the edge", async () => {
    const { apiFetch } = load({ edge: EDGE });
    for (const path of ["/auth/me", "/me/orders", "/featured-ads/active?limit=6", "/storefronts/ada", "/artisans/7/availability?date=2026-11-12", "/orders/LB-1"]) {
      fetchMock.mockClear();
      await apiFetch(path, schema);
      expect(urls()).toEqual([ORIGIN + path]);
      expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    }
    fetchMock.mockClear();
    await apiFetch("/products", schema, { method: "POST", body: { a: 1 } });
    expect(urls()).toEqual([ORIGIN + "/products"]);
  });

  it("falls back to the real API when the edge fails, so a problem there never breaks the app", async () => {
    const { apiFetch } = load({ edge: EDGE });
    for (const edgeFailure of [() => Promise.reject(new TypeError("network")), () => Promise.resolve(resp(502)), () => Promise.resolve(resp(404))]) {
      fetchMock.mockReset();
      fetchMock.mockImplementationOnce(edgeFailure).mockResolvedValueOnce(resp(200, { n: 7 }));
      await expect(apiFetch("/products", schema)).resolves.toEqual({ n: 7 });
      expect(urls()).toEqual([EDGE + "/products", ORIGIN + "/products"]);
    }
  });

  it("uses the real API for everything when no edge is configured", async () => {
    const { apiFetch } = load({});
    await apiFetch("/products", schema);
    expect(urls()).toEqual([ORIGIN + "/products"]);
  });

  it("a cancelled request stays cancelled instead of retrying", async () => {
    const { apiFetch } = load({ edge: EDGE });
    const ac = new AbortController();
    ac.abort();
    fetchMock.mockImplementation(() => Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
    await expect(apiFetch("/products", schema, { signal: ac.signal })).rejects.toBeDefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
