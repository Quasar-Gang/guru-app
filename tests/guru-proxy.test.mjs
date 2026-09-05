import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/api/guru/[...path]/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const route = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("same-origin proxy forwards only intended headers and rewrites signed file URLs", async () => {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.GURU_API_BASE_URL;
  process.env.GURU_API_BASE_URL = "http://core.example:8000";
  let outgoing;
  globalThis.fetch = async (url, init) => {
    outgoing = { url: String(url), init };
    return Response.json({ upload_url: "http://core.example:8000/v1/files/context.pdf?sig=abc", authorize_url: "https://accounts.google.com/oauth?state=kept" }, { status: 201 });
  };
  try {
    const result = await route.POST(new Request("https://guru.example/api/guru/v1/imports?format=pdf", { method: "POST", headers: { authorization: "Bearer user-token", "content-type": "application/json", cookie: "private=value" }, body: '{"filename":"context.pdf"}' }), { params: Promise.resolve({ path: ["v1", "imports"] }) });
    assert.equal(outgoing.url, "http://core.example:8000/v1/imports?format=pdf");
    assert.equal(outgoing.init.headers.get("authorization"), "Bearer user-token");
    assert.equal(outgoing.init.headers.get("cookie"), null);
    assert.equal(new TextDecoder().decode(outgoing.init.body), '{"filename":"context.pdf"}');
    assert.equal(result.status, 201);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.deepEqual(await result.json(), { upload_url: "https://guru.example/api/guru/v1/files/context.pdf?sig=abc", authorize_url: "https://accounts.google.com/oauth?state=kept" });
    globalThis.fetch = async () => new Response(null, { status: 204 });
    const empty = await route.DELETE(new Request("https://guru.example/api/guru/v1/plans/id", { method: "DELETE" }), { params: Promise.resolve({ path: ["v1", "plans", "id"] }) });
    assert.equal(empty.status, 204);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBase === undefined) delete process.env.GURU_API_BASE_URL;
    else process.env.GURU_API_BASE_URL = originalBase;
  }
});

test("proxy rejects paths outside the API without contacting an upstream", async () => {
  for (const path of [["admin"], ["v1", ".."], ["v1", "https://other.example"], ["v1", "plans?other=1"]]) {
    const response = await route.GET(new Request("https://guru.example/api/guru/test"), { params: Promise.resolve({ path }) });
    assert.equal(response.status, 404);
  }
});
