import { ApiError } from "./api";
import {
  adminReviewsResponseSchema, mergeReviews, moderationErrorMessage, nextRating, pageCount, publicReviewsResponseSchema,
  reviewableResponseSchema, reviewErrorMessage, reviewKey, toCreateBody, toFeedReview, validateReview,
} from "./reviews";

const pub = (o: object) => publicReviewsResponseSchema.parse(o);

describe("review schemas", () => {
  it("tolerates nulls", () => {
    expect(pub({ reviews: null, count: null, average: null })).toEqual({ reviews: [], count: 0, average: 0 });
    expect(reviewableResponseSchema.parse({ items: null })).toEqual([]);
    expect(adminReviewsResponseSchema.parse({ reviews: null, total: null })).toEqual({ reviews: [], total: 0 });
  });
  it("fills missing review fields and stringifies ids", () => {
    const r = pub({ reviews: [{ id: 7, author: null, rating: 4 }], count: 1, average: 4 }).reviews[0];
    expect(r).toMatchObject({ id: "7", author: "LuxeBeau customer", verified_buyer: false, text: "", item: "" });
  });
  it("rejects a reviewable item with a bad type", () => {
    expect(() => reviewableResponseSchema.parse({ items: [{ target_type: "x", target_id: "1", name: "n" }] })).toThrow();
  });
  it("parses admin rows", () => {
    const p = adminReviewsResponseSchema.parse({ reviews: [{ id: "a", author: "Ada", rating: 5, body: "Nice", status: "hidden" }], total: 1 });
    expect(p.reviews[0]).toMatchObject({ status: "hidden", target_name: "" });
  });
});

describe("mapping and merging", () => {
  it("maps to the feed Review", () => {
    const r = toFeedReview(pub({ reviews: [{ id: "1", author: "Ada", verified_buyer: true, rating: 5, date: "1 Nov", text: "Great", item: "Wig" }], count: 1, average: 5 }).reviews[0]);
    expect(r).toEqual({ id: "1", author: "Ada", verifiedBuyer: true, rating: 5, date: "1 Nov", text: "Great", item: "Wig" });
    expect(toFeedReview(pub({ reviews: [{ id: "2" }] }).reviews[0]).item).toBeUndefined();
  });
  it("merges newest first with a weighted average", () => {
    const a = pub({ reviews: [{ id: "old", created_at: "2026-01-01T00:00:00Z" }], count: 1, average: 5 });
    const b = pub({ reviews: [{ id: "new", created_at: "2026-06-01T00:00:00Z" }], count: 3, average: 3 });
    const m = mergeReviews([a, b]);
    expect(m.reviews.map(r => r.id)).toEqual(["new", "old"]);
    expect(m.count).toBe(4);
    expect(m.average).toBeCloseTo(3.5);
  });
  it("handles empty input", () => {
    expect(mergeReviews([])).toEqual({ reviews: [], count: 0, average: 0 });
  });
});

describe("form helpers", () => {
  it("moves stars with the keyboard", () => {
    expect(nextRating(0, "ArrowRight")).toBe(1);
    expect(nextRating(5, "ArrowRight")).toBe(1);
    expect(nextRating(1, "ArrowLeft")).toBe(5);
    expect(nextRating(3, "ArrowDown")).toBe(2);
    expect(nextRating(3, "Home")).toBe(1);
    expect(nextRating(3, "End")).toBe(5);
    expect(nextRating(3, "a")).toBeNull();
  });
  it("validates", () => {
    expect(validateReview(0, "")).not.toBe("");
    expect(validateReview(6, "")).not.toBe("");
    expect(validateReview(4, "x".repeat(501))).not.toBe("");
    expect(validateReview(4, "x".repeat(500))).toBe("");
  });
  it("builds the request body", () => {
    const item = { target_type: "product" as const, target_id: "9", name: "n" };
    expect(toCreateBody(item, 5, "  hi ")).toEqual({ target_type: "product", target_id: "9", rating: 5, body: "hi" });
    expect(toCreateBody(item, 5, "  ").body).toBeUndefined();
    expect(reviewKey(item)).toBe("product:9");
  });
  it("words errors", () => {
    expect(reviewErrorMessage(new ApiError("NOT_ELIGIBLE", "x", 403))).toMatch(/delivered/);
    expect(reviewErrorMessage(new ApiError("CONFLICT", "x", 409))).toMatch(/already/);
    expect(reviewErrorMessage(new ApiError("BAD", "Too long", 400))).toBe("Too long");
    expect(reviewErrorMessage(new Error("boom"))).toMatch(/couldn't save/);
    expect(moderationErrorMessage(new ApiError("FORBIDDEN", "x", 403))).toMatch(/admins/);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(41)).toBe(3);
  });
});
