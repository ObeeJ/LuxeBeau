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
        return "Your session has expired. Please sign in again.";
      case "FORBIDDEN":
        return "You do not have permission to perform this action.";
      case "NOT_FOUND":
        return "We could not find the requested record.";
      case "CONFLICT":
        return "This record already exists. Please check your details and try again.";
      default:
        return err.message || fallback;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}
