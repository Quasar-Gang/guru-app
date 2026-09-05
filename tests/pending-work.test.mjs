import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/lib/pending-work.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { readPendingWork, writePendingWork } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("pending work is isolated by account and completing one operation preserves the other", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  writePendingWork(storage, "account-a", { sessionId: "session-1" });
  writePendingWork(storage, "account-a", { revision: { planId: "plan-2", id: "revision-2" } });
  assert.deepEqual(readPendingWork(storage, "account-b"), {});
  writePendingWork(storage, "account-a", { sessionId: undefined });
  assert.deepEqual(readPendingWork(storage, "account-a"), { revision: { planId: "plan-2", id: "revision-2" } });
  writePendingWork(storage, "account-a", { revision: undefined });
  assert.deepEqual(readPendingWork(storage, "account-a"), {});
});

test("malformed or restricted session storage does not interrupt the workspace", () => {
  assert.deepEqual(readPendingWork({ getItem: () => "{broken" }, "key"), {});
  assert.deepEqual(readPendingWork({ getItem: () => '{"sessionId":42,"revision":null}' }, "key"), {});
  const restricted = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } };
  assert.doesNotThrow(() => writePendingWork(restricted, "key", { sessionId: "session-1" }));
});
