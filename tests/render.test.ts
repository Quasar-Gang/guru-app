import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

/**
 * Server-render smoke test. It boots the built Worker bundle and asserts that
 * each station renders the sentence it exists to say. Run `npm run build`
 * first; without a bundle the tests skip rather than fail, so `vitest` alone
 * stays useful during development.
 */

const bundle = new URL("../dist/server/index.js", import.meta.url);
const built = existsSync(fileURLToPath(bundle));

async function render(path: string) {
  const url = new URL(bundle);
  url.searchParams.set("t", `${process.pid}-${Date.now()}`);
  const { default: worker } = (await import(url.href)) as {
    default: { fetch(request: Request, env: unknown, ctx: unknown): Promise<Response> };
  };
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test.skipIf(!built)("station 1 renders the intake shell", async () => {
  const response = await render("/");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-Hant"/i);
  assert.match(html, /class="mist"/);
  // The page must never ask the one question the user cannot answer.
  assert.match(html, /HORIZON/);
  assert.match(html, /ROLE MODEL/);
  assert.match(html, /CROSS-CHECK/);
});

test.skipIf(!built)("station 2 marks the two layers intake cannot reach", async () => {
  const html = await (await render("/plan")).text();
  assert.match(html, /BRANCHES/);
  assert.match(html, /CHALLENGE/);
  assert.match(html, /VISION/);
});

test.skipIf(!built)("station 3 shows the outcome every other tracker hides", async () => {
  const html = await (await render("/ledger")).text();
  assert.match(html, /RECONCILE/);
  assert.match(html, /DIAGNOSE/);
  assert.match(html, /DISPATCH/);
  assert.match(html, /SCHEDULE/);
});
