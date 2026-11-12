// Pure request checks for the mail relay. No imports, so they can be unit tested
// with plain `node --test`.

const MAX_SUBJECT = 200;
const MAX_HTML = 200_000;
const MAX_TEXT = 100_000;

/** Constant-time comparison of the bearer secret, failing closed if none is set. */
export function checkAuth(header, secret) {
  if (typeof secret !== "string" || secret === "") return false;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const enc = new TextEncoder();
  const a = enc.encode(header.slice(7));
  const b = enc.encode(secret);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

const BARE = /^[^\s,;<>@"]+@[^\s,;<>@"]+\.[^\s,;<>@"]+$/;
const NAMED = /^\s*"?([^"<>\r\n]*?)"?\s*<([^\s,;<>@"]+@[^\s,;<>@"]+\.[^\s,;<>@"]+)>\s*$/;

/** "Name <a@b.com>" or "a@b.com" -> { name, email }; anything else (or a list) -> null. */
export function parseAddress(value) {
  if (typeof value !== "string" || /[\r\n]/.test(value)) return null;
  const v = value.trim();
  if (BARE.test(v)) return { name: "", email: v };
  const m = NAMED.exec(v);
  return m ? { name: m[1].trim(), email: m[2] } : null;
}

const fail = (error) => ({ ok: false, error });

/** Validates a send request. The sender must be the relay owner's own address. */
export function parseMessage(body, ownerEmail) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) return fail("body must be a JSON object");
  const { from, to, subject, html, text } = body;
  for (const v of [from, to, subject]) {
    if (typeof v !== "string" || /[\r\n]/.test(v)) return fail("invalid header value");
  }
  const f = parseAddress(from);
  if (!f) return fail("invalid sender address");
  if (f.email.toLowerCase() !== String(ownerEmail || "").toLowerCase()) return fail("sender must be the relay owner's address");
  const t = parseAddress(to);
  if (!t) return fail("invalid recipient address");
  if (subject === "" || subject.length > MAX_SUBJECT) return fail("subject is required and at most 200 characters");
  for (const [v, max] of [[html, MAX_HTML], [text, MAX_TEXT]]) {
    if (v !== undefined && typeof v !== "string") return fail("html and text must be strings");
    if (typeof v === "string" && v.length > max) return fail("message body too large");
  }
  if (!html && !text) return fail("html or text is required");
  return { ok: true, value: { from: f, to: t, subject, html: html || undefined, text: text || undefined } };
}
