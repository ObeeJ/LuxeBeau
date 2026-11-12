/** @jest-environment node */
jest.mock("server-only", () => ({}), { virtual: true });

import { fetchArtisansServer, fetchProductsServer } from "./server-api";

const product = {
  id: 1, name: "Black soap", brand: "Adunni", price: 850000, category: "Skincare", stock: 5,
  rating: 4.5, reviews_count: 3, seller_id: "s1", description: "x", image_url: "", slug: "black-soap",
};
const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

describe("server-side catalogue fetch", () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    (global as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  it("returns the catalogue and lets Next cache it for a minute", async () => {
    fetchMock.mockResolvedValue(ok({ products: [product] }));
    const out = await fetchProductsServer();
    expect(out).toHaveLength(1);
    expect(out?.[0].name).toBe("Black soap");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/products?limit=100");
    expect(init.next).toEqual({ revalidate: 60 });
    expect(Object.keys(init.headers)).toEqual(["Accept"]); // no cookies, no custom headers
  });

  it("passes a search through", async () => {
    fetchMock.mockResolvedValue(ok({ products: [] }));
    await fetchProductsServer("soap");
    expect(String(fetchMock.mock.calls[0][0])).toContain("search=soap");
  });

  // If the API is asleep, slow or broken, the page must still be built: it falls
  // back to fetching in the browser instead of hanging or showing an error page.
  it("returns null, never throws, when the API fails in any way", async () => {
    for (const failure of [
      () => Promise.reject(new TypeError("fetch failed")),
      () => Promise.resolve({ ok: false, status: 502, json: async () => ({}) }),
      () => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: false }) }),
      () => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, data: { products: "not a list" } }) }),
      () => Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error("bad json"); } }),
    ]) {
      fetchMock.mockReset();
      fetchMock.mockImplementation(failure);
      await expect(fetchProductsServer()).resolves.toBeNull();
      await expect(fetchArtisansServer()).resolves.toBeNull();
    }
  });

  it("gives up on a slow API after the timeout instead of hanging the page", async () => {
    fetchMock.mockImplementation((_url: string, init: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const started = Date.now();
    await expect(fetchProductsServer("", 60)).resolves.toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);
  });
});
