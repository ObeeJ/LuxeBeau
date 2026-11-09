import {
  FALLBACK_PLANS, adStatusInfo, canPayFromWallet, createAdResponseSchema, draftSignature, durationLabel,
  formatKobo, isSafeImageUrl, isSafeLinkUrl, myAdsResponseSchema, pricingResponseSchema, toCreateBody,
  validateDraft, waitUntilActive, walletShortfallKobo, type AdDraft, type MyAd,
} from "./ads";

const draft: AdDraft = { type: "storefront", targetId: " shop ", title: " Hi ", tagline: "", imageUrl: "https://x.test/a.png", linkUrl: "", plan: "30_days" };
const ad = (o: Partial<MyAd>): MyAd => ({ id: "a1", type: "product", title: "t", image_url: "", plan: "7_days", amount_kobo: 500000, status: "pending", clicks_count: 0, impressions_count: 0, ...o });

describe("ads pure logic", () => {
  it("formats kobo as naira", () => {
    expect(formatKobo(500000)).toContain("5,000");
    expect(formatKobo(12000000)).toContain("120,000");
  });
  it("lists the three plans in order", () => {
    expect(FALLBACK_PLANS.map(p => p.id)).toEqual(["7_days", "30_days", "annual"]);
    expect(durationLabel(7)).toBe("7 days");
    expect(durationLabel(365)).toBe("1 year");
  });
  it("checks wallet sufficiency", () => {
    expect(canPayFromWallet(500000, 500000)).toBe(true);
    expect(canPayFromWallet(499999, 500000)).toBe(false);
    expect(canPayFromWallet(undefined, 500000)).toBe(false);
    expect(walletShortfallKobo(100, 500)).toBe(400);
    expect(walletShortfallKobo(900, 500)).toBe(0);
  });
  it("maps statuses", () => {
    expect(adStatusInfo("active").label).toBe("Live");
    expect(adStatusInfo("pending").tone).toBe("wait");
    expect(adStatusInfo("expired").label).toBe("Ended");
    expect(adStatusInfo("paused").tone).toBe("off");
  });
  it("accepts only safe urls", () => {
    expect(isSafeImageUrl("https://a.test/x.png")).toBe(true);
    expect(isSafeImageUrl("/images/x.webp")).toBe(true);
    expect(isSafeImageUrl("http://a.test/x.png")).toBe(false);
    expect(isSafeImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeImageUrl("//evil.test/x")).toBe(false);
    expect(isSafeLinkUrl("")).toBe(true);
    expect(isSafeLinkUrl("data:text/html,x")).toBe(false);
  });
  it("validates drafts and builds the body", () => {
    expect(validateDraft(draft)).toEqual({});
    expect(Object.keys(validateDraft({ ...draft, title: "", imageUrl: "" }))).toEqual(["title", "imageUrl"]);
    expect(toCreateBody(draft)).toEqual({ type: "storefront", target_id: "shop", title: "Hi", tagline: undefined, image_url: "https://x.test/a.png", link_url: undefined, plan: "30_days" });
    expect(draftSignature(draft)).toBe(draftSignature({ ...draft, title: "Hi" }));
    expect(draftSignature(draft)).not.toBe(draftSignature({ ...draft, plan: "annual" }));
  });
  it("parses API responses", () => {
    const plans = pricingResponseSchema.parse({ pricing: { annual: { amount_kobo: 12000000, days: 365 }, "7_days": { amount_kobo: 500000, days: 7, tag: "Starter" } } });
    expect(plans.map(p => p.id)).toEqual(["7_days", "annual"]);
    expect(myAdsResponseSchema.parse({ ads: null })).toEqual([]);
    expect(myAdsResponseSchema.parse({ ads: [{ id: "1", type: "product", title: "t", plan: "annual", amount_kobo: 1, status: "active", paid_at: null }] })[0].clicks_count).toBe(0);
    expect(createAdResponseSchema.safeParse({ ad: { id: "1" } }).success).toBe(false);
  });
  it("polls until active", async () => {
    const reads = [[ad({})], [ad({})], [ad({ status: "active" })]];
    const read = jest.fn(async () => reads.shift() ?? []);
    await expect(waitUntilActive(read, "a1", { tries: 5, sleep: async () => {} })).resolves.toBe(true);
    expect(read).toHaveBeenCalledTimes(3);
    await expect(waitUntilActive(async () => [ad({})], "a1", { tries: 2, sleep: async () => {} })).resolves.toBe(false);
  });
});
