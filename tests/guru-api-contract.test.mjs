import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadClient() {
  const source = await readFile(new URL("../app/lib/guru-api.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("guru client matches date, profile, check-in, and answer request contracts", async () => {
  const { GuruApiClient } = await loadClient();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ items: [], total: 0 });
  };
  try {
    const client = new GuruApiClient("https://core.example/", "secret");
    await client.listTasks("plan-id", "2026-09-01", "2026-09-07");
    await client.updateProfile({ horizon: "12 weeks" }, "Asia/Taipei");
    await client.submitCheckin("plan-id", "2026-09-05", [{ task_id: "task-id", status: "done" }]);
    await client.submitAnswers("session-id", [{ question_id: "q1", choice: "four", skipped: false }]);

    assert.equal(calls[0].url, "https://core.example/v1/plans/plan-id/tasks?from=2026-09-01&to=2026-09-07");
    assert.deepEqual(JSON.parse(calls[1].init.body), { answers: { horizon: "12 weeks" }, timezone: "Asia/Taipei" });
    assert.deepEqual(JSON.parse(calls[2].init.body), {
      checkin_date: "2026-09-05",
      results: [{ task_id: "task-id", status: "done" }],
    });
    assert.deepEqual(JSON.parse(calls[3].init.body), {
      answers: [{ question_id: "q1", choice: "four", skipped: false }],
    });
    assert.equal(calls[3].init.headers.Authorization, "Bearer secret");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("guru client accepts empty 204 responses and exposes the API error envelope", async () => {
  const { GuruApiClient, GuruApiError } = await loadClient();
  const originalFetch = globalThis.fetch;
  let response = new Response(null, { status: 204 });
  globalThis.fetch = async () => response;
  try {
    const client = new GuruApiClient("https://core.example", "secret");
    assert.equal(await client.deletePlan("plan-id"), undefined);
    response = jsonResponse({ error: { code: "plan_conflict", message: "Plan is not active" } }, 409);
    await assert.rejects(
      client.requestExport("plan-id", "markdown"),
      (error) => error instanceof GuruApiError && error.status === 409 && error.code === "plan_conflict" && error.message === "Plan is not active",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
