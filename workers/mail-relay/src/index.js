// luxebeau-mail-relay: lets the API (which cannot use SMTP ports on Render's free
// plan) send mail over plain HTTPS. The API POSTs a JSON message with a shared
// secret; this Worker delivers it through Gmail's SMTP. Message contents and
// credentials are never logged.
import { WorkerMailer } from "worker-mailer";
import { checkAuth, parseMessage } from "./validate.js";

const json = (obj, status) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/send") return json({ ok: false, error: "not found" }, 404);
    if (request.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);
    if (!env.RELAY_SECRET || !env.SMTP_USER || !env.SMTP_PASS) {
      return json({ ok: false, error: "relay is not configured" }, 503); // fail closed
    }
    if (!checkAuth(request.headers.get("authorization"), env.RELAY_SECRET)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }
    if (Number(request.headers.get("content-length") || 0) > 400_000) {
      return json({ ok: false, error: "request too large" }, 413);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "body must be JSON" }, 400);
    }
    const parsed = parseMessage(body, env.SMTP_USER);
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    const m = parsed.value;
    try {
      await WorkerMailer.send(
        {
          host: env.SMTP_HOST || "smtp.gmail.com",
          port: 465,
          secure: true,
          credentials: { username: env.SMTP_USER, password: env.SMTP_PASS },
          authType: "plain",
        },
        { from: m.from, to: m.to, subject: m.subject, text: m.text, html: m.html },
      );
      return json({ ok: true }, 200);
    } catch (err) {
      console.error("smtp send failed:", err instanceof Error ? err.name : "unknown");
      return json({ ok: false, error: "delivery failed" }, 502);
    }
  },
};
