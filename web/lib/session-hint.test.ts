import { hasSessionHint, markSessionHint, clearSessionHint } from "./session-hint";

describe("session hint (skips the sign-in check once we know they are signed out)", () => {
  beforeEach(() => localStorage.clear());

  it("a browser never checked before gets one real check (keeps existing sessions working)", () => {
    expect(hasSessionHint()).toBe(true);
  });

  it("after a check found them signed out, later visits skip the failing requests", () => {
    clearSessionHint();
    expect(hasSessionHint()).toBe(false);
  });

  it("is set after sign-in and cleared after sign-out", () => {
    clearSessionHint();
    markSessionHint();
    expect(hasSessionHint()).toBe(true);
    clearSessionHint();
    expect(hasSessionHint()).toBe(false);
  });

  it("never throws when storage is blocked (private mode), and then asks the server to be safe", () => {
    const spy = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    const set = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(() => markSessionHint()).not.toThrow();
    expect(() => clearSessionHint()).not.toThrow();
    expect(hasSessionHint()).toBe(true); // cannot tell, so do the real check
    spy.mockRestore(); set.mockRestore();
  });
});
