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
