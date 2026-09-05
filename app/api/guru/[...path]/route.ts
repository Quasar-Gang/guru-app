type Context = { params: Promise<{ path: string[] }> };

function rewriteFileUrls(value: unknown, upstream: URL, origin: string): unknown {
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      if (url.origin === upstream.origin && url.pathname.startsWith("/v1/files/")) return `${origin}/api/guru${url.pathname}${url.search}`;
    } catch { /* Non-URL strings are ordinary response data. */ }
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteFileUrls(item, upstream, origin));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteFileUrls(item, upstream, origin)]));
  return value;
}

async function forward(request: Request, context: Context) {
  const { path } = await context.params;
  if (path[0] !== "v1" || path.some((part) => !part || part === "." || part === ".." || /[\\/?#]/.test(part))) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  for (const name of ["authorization", "content-type", "accept"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const upstream = new URL(process.env.GURU_API_BASE_URL || "http://localhost:8000");
    const incoming = new URL(request.url);
    const target = new URL(`/${path.map(encodeURIComponent).join("/")}${incoming.search}`, upstream);
    const response = await fetch(target, {
      method: request.method,
      headers,
      ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: await request.arrayBuffer() }),
      redirect: "manual",
      signal: AbortSignal.timeout(60_000),
    });
    const outgoing = new Headers({ "cache-control": "no-store" });
    for (const name of ["content-type", "content-disposition", "retry-after"]) {
      const value = response.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    if (response.status >= 300 && response.status < 400) return new Response("Unexpected upstream redirect", { status: 502, headers: outgoing });
    if (response.headers.get("content-type")?.includes("application/json")) {
      const value = rewriteFileUrls(await response.json(), upstream, incoming.origin);
      return new Response(JSON.stringify(value), { status: response.status, headers: outgoing });
    }
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch {
    return Response.json({ error: { code: "upstream_unavailable", message: "The configured guru service is unavailable." } }, { status: 502, headers: { "cache-control": "no-store" } });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
