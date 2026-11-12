import { seedOptions } from "./queries";

describe("seedOptions (server data handed to React Query)", () => {
  it("seeds with real data and uses the time the server fetched it, so old data is refreshed", () => {
    const fetchedAt = Date.now() - 3 * 24 * 3600 * 1000; // baked into a page three days ago
    const opts = seedOptions([{ id: 1 }], fetchedAt) as { initialData?: unknown; initialDataUpdatedAt?: number | (() => number) };
    expect(opts.initialData).toEqual([{ id: 1 }]);
    const t = typeof opts.initialDataUpdatedAt === "function" ? opts.initialDataUpdatedAt() : opts.initialDataUpdatedAt;
    expect(t).toBe(fetchedAt); // older than the stale time, so the browser refetches right away
  });

  it("without a fetch time it counts the data as fresh from now", () => {
    const opts = seedOptions([{ id: 1 }]) as { initialDataUpdatedAt?: () => number };
    expect(Math.abs((opts.initialDataUpdatedAt?.() ?? 0) - Date.now())).toBeLessThan(1000);
  });

  // A failed or empty server fetch must NOT be treated as fresh data, or the shop
  // would show "nothing here" for minutes instead of fetching in the browser.
  it("does not seed with nothing, an empty list, or null", () => {
    for (const none of [undefined, null, []]) expect(seedOptions(none as never, Date.now())).toEqual({});
  });
});
