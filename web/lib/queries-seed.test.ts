import { seedOptions } from "./queries";

describe("seedOptions (server data handed to React Query)", () => {
  it("seeds with real data and marks it fresh from the moment it is used", () => {
    const opts = seedOptions([{ id: 1 }]) as { initialData?: unknown; initialDataUpdatedAt?: () => number };
    expect(opts.initialData).toEqual([{ id: 1 }]);
    const t = opts.initialDataUpdatedAt?.() ?? 0;
    expect(Math.abs(t - Date.now())).toBeLessThan(1000);
  });

  // A failed or empty server fetch must NOT be treated as fresh data, or the shop
  // would show "nothing here" for minutes instead of fetching in the browser.
  it("does not seed with nothing, an empty list, or null", () => {
    for (const none of [undefined, null, []]) expect(seedOptions(none as never)).toEqual({});
  });
});
