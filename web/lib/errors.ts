import { ApiError } from "./api";

/**
 * Translates raw error responses, network disconnects, or unexpected failure
 * payloads into warm, reassuring, and clear copywriting.
 */
export function getFriendlyErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "NETWORK":
        return "Connection lost. Please check your internet connection and try again.";
      case "BAD_RESPONSE":
        return "We are experiencing temporary system issues. Please try again in a few moments.";
      case "UNAUTHORIZED":
        // A wrong password is also a 401. The server's own words for that are
        // accurate ("Invalid email or password."), so keep them; any other 401
        // means the session is gone.
        if (/email or password/i.test(err.message)) return err.message;
        return "Your session has expired. Please sign in again.";
      case "FORBIDDEN":
        return err.message || "You do not have permission to perform this action.";
      case "NOT_FOUND":
        return err.message || "We could not find the requested record.";
      case "CONFLICT":
        return err.message || "An account with this email already exists. Sign in instead.";
      default:
        return err.message || fallback;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
