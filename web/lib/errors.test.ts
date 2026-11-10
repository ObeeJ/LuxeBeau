import { ApiError } from "./api";
import { getFriendlyErrorMessage } from "./errors";

describe("getFriendlyErrorMessage", () => {
  it("tells someone who mistyped their password exactly that, not that their session expired", () => {
    // The backend answers a wrong login with 401 UNAUTHORIZED and this message.
    const wrongPassword = new ApiError("UNAUTHORIZED", "Invalid email or password.", 401);
    expect(getFriendlyErrorMessage(wrongPassword)).toBe("Invalid email or password.");
  });

  it("still says the session expired when the 401 is about a session", () => {
    for (const message of ["Authentication required", "Invalid or expired token.", "", "Unauthorized"]) {
      const err = new ApiError("UNAUTHORIZED", message, 401);
      expect(getFriendlyErrorMessage(err)).toBe("Your session has expired. Please sign in again.");
    }
  });

  it("keeps the other friendly messages as they were", () => {
    expect(getFriendlyErrorMessage(new ApiError("NETWORK", "x", 0))).toMatch(/Connection lost/);
    expect(getFriendlyErrorMessage(new ApiError("BAD_RESPONSE", "x", 502))).toMatch(/temporary system issues/);
    expect(getFriendlyErrorMessage(new ApiError("FORBIDDEN", "Admins only.", 403))).toBe("Admins only.");
    expect(getFriendlyErrorMessage(new ApiError("FORBIDDEN", "", 403))).toMatch(/do not have permission/);
    expect(getFriendlyErrorMessage(new ApiError("CONFLICT", "", 409))).toMatch(/already exists/);
    expect(getFriendlyErrorMessage(new ApiError("SOMETHING_ELSE", "Custom words.", 400))).toBe("Custom words.");
  });

  it("falls back for errors it does not know", () => {
    expect(getFriendlyErrorMessage(new Error("plain"))).toBe("plain");
    expect(getFriendlyErrorMessage("nonsense", "Try again.")).toBe("Try again.");
  });
});
