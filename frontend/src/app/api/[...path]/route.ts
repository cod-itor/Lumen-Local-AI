import type { NextRequest } from "next/server";

/**
 * Same-origin proxy to the Spring backend (FRONTEND.md §2.1). A Route Handler (not `rewrites`) so
 * Server-Sent Events stream without buffering or a 30 s proxy timeout, and Set-Cookie passes through.
 * Runs on the Node.js runtime (the default; `runtime` config is not allowed with cacheComponents).
 */
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080";
const DROP = new Set([
  "connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade",
  "proxy-authorization", "proxy-authenticate", "host", "content-length", "content-encoding",
]);
const BACKEND_COOKIES = new Set(["access_token", "refresh_token", "session_hint"]);

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`, BACKEND);

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (DROP.has(k)) return;
    if (k === "cookie") {
      // Browsers share localhost cookies across ports, so other local apps' cookies arrive here too and can push the
      // request past the backend's header limit. Forward only the cookies the backend reads.
      const kept = value.split(";").map((c) => c.trim()).filter((c) => BACKEND_COOKIES.has(c.split("=")[0]));
      if (kept.length) headers.set("cookie", kept.join("; "));
      return;
    }
    headers.set(key, value);
  });

  const init: RequestInit & { duplex?: "half" } = { method: req.method, headers, redirect: "manual", cache: "no-store" };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, { ...init, signal: req.signal });
  } catch {
    return Response.json(
      { status: 503, code: "BACKEND_UNAVAILABLE", message: "The Lumen server is not running." },
      { status: 503 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (!DROP.has(k) && k !== "set-cookie") out.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
