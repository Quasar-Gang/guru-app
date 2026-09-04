import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the guru application shell and product metadata", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html[^>]+lang="zh-Hant"/i);
  assert.match(html, new RegExp("guru — \\u628a\\u76ee\\u6a19\\u8b8a\\u6210\\u4eca\\u5929\\u505a\\u5f97\\u5230\\u7684\\u4e8b"));
  assert.match(html, new RegExp("\\u4eca\\u5929\\u7684\\u5b89\\u6392"));
  assert.match(html, new RegExp("\\u5efa\\u7acb\\u65b0\\u76ee\\u6a19"));
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
