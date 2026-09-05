import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { JSDOM } from "jsdom";

async function withWorkspace(scenario, setup = () => {}) {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: "https://guru.example/", pretendToBeVisual: true });
  const saved = new Map();
  for (const key of ["window", "document", "HTMLElement", "Node", "navigator", "localStorage", "sessionStorage", "requestAnimationFrame", "fetch"]) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    if (key !== "fetch") Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: key === "requestAnimationFrame" ? dom.window.requestAnimationFrame.bind(dom.window) : dom.window[key] });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  setup();
  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const encode = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const apiUrl = encode(compile(await readFile(new URL("../app/lib/guru-api.ts", import.meta.url), "utf8")));
  let source = compile(await readFile(new URL("../app/components/GuruApp.tsx", import.meta.url), "utf8"));
  for (const specifier of ["react", "react/jsx-runtime", "lucide-react"]) source = source.replaceAll(`from "${specifier}"`, `from "${import.meta.resolve(specifier)}"`);
  source = source.replaceAll('from "../lib/guru-api"', `from "${apiUrl}"`);
  const pendingUrl = encode(compile(await readFile(new URL("../app/lib/pending-work.ts", import.meta.url), "utf8")));
  source = source.replaceAll('from "../lib/pending-work"', `from "${pendingUrl}"`);
  const { default: App } = await import(encode(source));
  const root = createRoot(document.getElementById("root"));
  const click = async (element) => { assert.ok(element); await React.act(async () => { element.click(); }); };
  try {
    await React.act(async () => { root.render(React.createElement(App)); });
    await React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    await scenario({ React, click });
  } finally {
    await React.act(async () => root.unmount());
    dom.window.close();
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
}

test("sample workspace supports task review, navigation and a dismissible goal form", async () => {
  await withWorkspace(async ({ React, click }) => {
    assert.equal(document.querySelectorAll(".task-card").length, 2);
    assert.ok(document.querySelector(".sample-banner"));
    assert.equal(document.querySelector(".checkin-row button").disabled, true);
    await click(document.querySelector(".check"));
    assert.equal(document.querySelector(".check").getAttribute("aria-pressed"), "true");
    assert.equal(document.querySelector(".checkin-row button").disabled, false);
    await click(document.querySelector(".checkin-row button"));
    assert.ok(document.querySelector(".toast"));
    await click(document.querySelectorAll(".sidebar .nav-item")[1]);
    assert.equal(window.location.hash, "#plan");
    assert.ok(document.querySelector(".phase-list"));
    await click(document.querySelectorAll(".sidebar .nav-item")[2]);
    assert.equal(window.location.hash, "#progress");
    assert.equal(document.querySelectorAll(".chart-value").length, 7);
    const trigger = document.querySelector(".new-goal");
    trigger.focus();
    await click(trigger);
    const dialog = document.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.equal(document.querySelector("main").inert, true);
    assert.equal(document.body.style.overflow, "hidden");
    assert.equal(dialog.querySelector("details").open, false);
    assert.equal(dialog.querySelector("textarea").required, true);
    assert.ok(document.activeElement === dialog.querySelector("textarea"), "goal input receives focus");
    await React.act(async () => document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    assert.ok(document.querySelector('[role="dialog"]') === null, "Escape closes the dialog");
    assert.equal(document.body.style.overflow, "");
    assert.ok(document.activeElement === trigger, "focus returns to the trigger");
    assert.notEqual(document.querySelector("main").inert, true);
  });
});

test("authenticated workspace preserves other goals when a resumed generation is activated", async () => {
  const makePlan = (id, difficulty = "hard", status = "active") => ({ id, title: `Goal ${id}`, difficulty, status, duration_weeks: 12, start_date: "2026-09-01", deadline: "2026-11-24", goal_statement: `Complete ${id}`, sessions_per_week: 3, total_minutes_per_week: 120, completion_rate: 0 });
  let plans = [makePlan("existing-a"), makePlan("existing-b")];
  const candidates = [makePlan("new-easy", "easy", "draft"), makePlan("new-hard", "hard", "draft"), makePlan("new-extreme", "extremely_hard", "draft")];
  const requests = [];
  await withWorkspace(async ({ React, click }) => {
    const settle = () => React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    await settle();
    assert.equal(document.querySelectorAll("#workspace-plan option").length, 2);
    assert.equal(document.querySelector(".task-content h3").textContent, "Task existing-a");
    await React.act(async () => {
      const select = document.querySelector("#workspace-plan");
      select.value = "existing-b";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await settle();
    assert.equal(document.querySelector(".task-content h3").textContent, "Task existing-b");
    await click(document.querySelector(".generation-banner button"));
    assert.equal(document.querySelectorAll(".compare-card").length, 3);
    assert.equal(document.querySelectorAll("#workspace-plan option").length, 5);
    await click(document.querySelectorAll(".compare-card button")[1]);
    await settle();
    assert.equal(document.querySelector("#workspace-plan").value, "new-hard");
    assert.equal(document.querySelector(".task-content h3").textContent, "Task new-hard");
    assert.equal(plans.find((plan) => plan.id === "existing-a").status, "active");
    assert.equal(plans.find((plan) => plan.id === "existing-b").status, "active");
    assert.equal(plans.find((plan) => plan.id === "new-easy").status, "draft");
    assert.equal(requests.filter((request) => request.method === "PATCH").length, 1);
    assert.equal(sessionStorage.getItem("guru_pending:/api/guru:fixture-user"), "{}");
  }, () => {
    localStorage.setItem("guru_api_base", "/api/guru");
    localStorage.setItem("guru_token", "fixture-token");
    sessionStorage.setItem("guru_pending:/api/guru:fixture-user", JSON.stringify({ sessionId: "new-session" }));
    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(url, "https://guru.example").pathname.replace("/api/guru/v1", "");
      const method = init.method || "GET";
      requests.push({ path, method });
      if (path === "/me") return Response.json({ user_id: "fixture-user", email: "fixture@example.com" });
      if (path === "/plans") return Response.json(plans);
      if (path === "/role-models") return Response.json([]);
      if (path === "/plan-sessions/new-session") { plans = [...plans.filter((plan) => !plan.id.startsWith("new-")), ...candidates]; return Response.json({ id: "new-session", status: "done", plans: candidates, questions: [] }); }
      const id = path.split("/")[2];
      if (method === "PATCH") {
        plans = plans.map((plan) => plan.id.startsWith("new-") ? { ...plan, status: plan.id === id ? "active" : "draft" } : plan);
      }
      if (path.endsWith("/tasks")) return Response.json({ items: [{ id: `task-${id}`, title: `Task ${id}`, description: "Fixture instructions", start_at: "2026-09-05T10:00:00Z", end_at: "2026-09-05T10:30:00Z", all_day: false, task_type: "session", status: "pending" }] });
      if (path.endsWith("/checkins")) return Response.json({ items: [], daily_rates: [] });
      const plan = plans.find((plan) => plan.id === id);
      if (plan) return Response.json({ ...plan, session_id: id.startsWith("new-") ? "new-session" : id, phases: [], success_criteria: [], assumptions: [], exports: [], progress: { total: 1, done: 0, missed: 0, skipped: 0, pending: 1, completion_rate: 0, phase_rates: [], checkpoints: [] } });
      throw new Error(`Unexpected fixture request: ${method} ${path}`);
    };
  });
});

test("a recovered revision shows every change and stays bound to its plan after switching", async () => {
  const plans = ["plan-a", "plan-b"].map((id) => ({ id, title: id, status: "active", difficulty: "hard", goal_statement: id, duration_weeks: 12, start_date: "2026-09-01", deadline: "2026-11-24", sessions_per_week: 3, total_minutes_per_week: 120, completion_rate: 0 }));
  const decisions = [];
  const revision = { id: "revision-a", plan_id: "plan-a", status: "proposed", rationale: "Fixture rationale", diff: Array.from({ length: 12 }, (_, index) => ({ template_key: `task-${index}`, week_index: index, occurrence: 0, kind: "moved", title: `Change ${index}`, before: { start_at: "2026-09-05T10:00:00Z" }, after: { start_at: "2026-09-06T10:00:00Z" } })) };
  await withWorkspace(async ({ React, click }) => {
    const settle = () => React.act(async () => { await new Promise((resolve) => setTimeout(resolve, 30)); });
    await settle();
    await click(document.querySelector(".sample-banner button"));
    assert.equal(document.querySelectorAll(".question-list fieldset").length, 12);
    await click(document.querySelector(".modal-close"));
    assert.ok(!document.querySelector('[role="dialog"]'));
    await React.act(async () => {
      const select = document.querySelector("#workspace-plan");
      select.value = "plan-b";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    await settle();
    await click(document.querySelector(".sample-banner button"));
    await click(document.querySelector(".modal .form-grid .primary"));
    assert.deepEqual(decisions, ["/plans/plan-a/revisions/revision-a/accept"]);
    assert.equal(document.querySelector("#workspace-plan").value, "plan-b");
    assert.ok(!document.querySelector('[role="dialog"]'));
    assert.equal(sessionStorage.getItem("guru_pending:/api/guru:revision-user"), "{}");
  }, () => {
    localStorage.setItem("guru_api_base", "/api/guru");
    localStorage.setItem("guru_token", "fixture-token");
    sessionStorage.setItem("guru_pending:/api/guru:revision-user", JSON.stringify({ revision: { planId: "plan-a", id: "revision-a" } }));
    globalThis.fetch = async (url, init = {}) => {
      const path = new URL(url, "https://guru.example").pathname.replace("/api/guru/v1", "");
      if (path === "/me") return Response.json({ user_id: "revision-user", email: "revision@example.com" });
      if (path === "/plans") return Response.json(plans);
      if (path === "/role-models") return Response.json([]);
      if (path.endsWith("/accept") && init.method === "POST") { decisions.push(path); return Response.json({ ...revision, status: "accepted" }); }
      if (path.includes("/revisions/")) return Response.json(revision);
      if (path.endsWith("/tasks")) return Response.json({ items: [] });
      if (path.endsWith("/checkins")) return Response.json({ items: [], daily_rates: [] });
      const plan = plans.find((item) => path === `/plans/${item.id}`);
      if (plan) return Response.json({ ...plan, phases: [], success_criteria: [], progress: { total: 0, done: 0, missed: 0, completion_rate: 0, phase_rates: [] } });
      throw new Error(`Unexpected revision request: ${path}`);
    };
  });
});
