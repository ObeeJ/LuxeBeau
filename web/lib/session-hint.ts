/* The sign-in cookie is HttpOnly, so the page cannot see whether it exists.
   Without a hint, every first-time visitor pays for two failing requests
   (/auth/me, then the automatic /auth/refresh) just to learn they are signed
   out. This flag only records "someone signed in on this browser". It grants
   nothing: the server still checks the cookie on every request. If storage is
   blocked, or this browser has never been checked (people already signed in
   before this existed), we cannot tell, so we ask the server once. */
const KEY = "lb_session_hint";

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0"; // only a recorded "signed out" skips the check
  } catch {
    return true;
  }
}

export function markSessionHint(): void {
  try { localStorage.setItem(KEY, "1"); } catch { /* storage blocked: harmless */ }
}

export function clearSessionHint(): void {
  try { localStorage.setItem(KEY, "0"); } catch { /* storage blocked: harmless */ }
}
