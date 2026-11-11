import {
  adminUserDetailResponseSchema, consequenceText, deleteConfirmed, kycLabel, memberSince, roleLabel, userActionRules,
} from "./admin-user-detail";

describe("memberSince", () => {
  it("formats and guards", () => {
    expect(memberSince("2026-11-05T10:00:00Z")).toBe("Nov 2026");
    expect(memberSince(null)).toBe("Unknown");
    expect(memberSince("junk")).toBe("Unknown");
  });
});

describe("labels", () => {
  it("maps role and kyc", () => {
    expect(roleLabel("seller")).toBe("Seller");
    expect(roleLabel("")).toBe("Unknown");
    expect(kycLabel("verified")).toBe("Identity verified");
    expect(kycLabel("")).toBe("Not checked");
    expect(kycLabel("failed")).toBe("Check failed");
  });
});

describe("action rules", () => {
  it("locks down admins", () => {
    expect(userActionRules({ role: "admin", status: "active", verified: false })).toMatchObject({
      canChangeRole: false, canSuspend: false, canDelete: false, canVerify: false,
    });
  });
  it("offers verify only to unverified partners", () => {
    expect(userActionRules({ role: "seller", status: "active", verified: false }).canVerify).toBe(true);
    expect(userActionRules({ role: "seller", status: "active", verified: true }).canVerify).toBe(false);
    expect(userActionRules({ role: "buyer", status: "active", verified: false }).canVerify).toBe(false);
  });
  it("reports suspension", () => {
    expect(userActionRules({ role: "buyer", status: "suspended", verified: false }).isSuspended).toBe(true);
  });
});

describe("delete confirm", () => {
  const u = { name: "Ada Obi", email: "Ada@Example.com" };
  it("needs the email typed, ignoring case and spaces", () => {
    expect(deleteConfirmed("ada@example.com ", u)).toBe(true);
    expect(deleteConfirmed("ada", u)).toBe(false);
    expect(deleteConfirmed("", u)).toBe(false);
  });
  it("falls back to name and never matches an empty target", () => {
    expect(deleteConfirmed("ada obi", { name: "Ada Obi", email: "" })).toBe(true);
    expect(deleteConfirmed("", { name: "", email: "" })).toBe(false);
  });
});

describe("consequences", () => {
  it("names the user", () => {
    expect(consequenceText("delete", "Ada")).toContain("Ada");
  });
});

describe("schema", () => {
  it("accepts nulls", () => {
    const r = adminUserDetailResponseSchema.parse({ user: { id: "u", name: "A", email: "a@b.c", phone: null, kyc_status: null, created_at: null, verified: null } });
    expect(r.user).toMatchObject({ phone: "", kyc_status: "", created_at: null, verified: false });
  });
});
