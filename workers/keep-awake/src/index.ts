export interface Env {}

export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // /readyz queries the database, so each ping also keeps a free Supabase
    // project from pausing. /healthz would only wake the web process.
    const target = "https://luxebeau-api.onrender.com/readyz";
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": "LuxeBeau-KeepAwake/1.0" }
      });
      console.log(`Keep-awake ping to ${target}: status ${res.status}`);
    } catch (err) {
      console.error(`Keep-awake ping failed:`, err);
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // /readyz queries the database, so each ping also keeps a free Supabase
    // project from pausing. /healthz would only wake the web process.
    const target = "https://luxebeau-api.onrender.com/readyz";
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": "LuxeBeau-KeepAwake/1.0" }
      });
      const data = await res.text();
      return new Response(`LuxeBeau Keep-Awake is active.\nTarget: ${target}\nStatus: ${res.status}\nResponse: ${data}\n`, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } catch (err: any) {
      return new Response(`Keep-awake probe failed: ${err.message}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  },
};
