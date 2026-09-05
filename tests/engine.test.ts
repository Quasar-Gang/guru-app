import assert from "node:assert/strict";
import { test } from "vitest";

import type { Branch, ReconcileStatus, ScheduleDraft, Trace } from "../lib/contracts";

/**
 * Engine tests. They assert the four reconciliation outcomes, the scheduler's
 * chain-break rule and the dispatch decision, because those are the product's
 * actual claims — everything else on a page is presentation.
 *
 * The modules are imported as TypeScript directly; Node strips the types.
 */

import { attribute, attributeAll, autoAttributionRate } from "../lib/attribution";
import { dispatch } from "../lib/dispatch";
import { buildHorizons, horizonById } from "../lib/horizon";
import { diagnose, reconcile } from "../lib/reconcile";
import { summarize, toggleSlot } from "../lib/scheduler";
import { SNAPSHOT } from "../lib/mock/snapshot";

test("attribution books traces by keyword and flags nothing that matched no rule", () => {
  const booked = attribute({
    id: "t-1",
    source: "calendar",
    ts: "2026-07-02",
    title: "shadowing",
    durationMin: 15,
    raw: "英文口說",
  });
  assert.equal(booked.branchId, "branch-speaking");
  assert.equal(booked.crossBranch, false);

  const orphan = attribute({
    id: "t-2",
    source: "calendar",
    ts: "2026-07-03",
    title: "與 A 公司窗口碰面",
    durationMin: 90,
    raw: "A 公司相關往來",
  });
  assert.equal(orphan.branchId, null);

  const rate = autoAttributionRate(attributeAll([]));
  assert.equal(rate, 0);
});

test("reconcile separates attendance from effect", () => {
  const base: Omit<Branch, "id" | "title" | "type" | "baseline" | "retests"> = {
    layer: "quarter",
    parentId: null,
    unitAction: "一次",
    durationMin: 15,
    energy: "low",
    minWeekly: 2,
    anchor: null,
    effectHypothesis: null,
    falsificationCondition: null,
    quarterIndicator: null,
    retestMethod: null,
    slot: "cumulative",
    slotRationale: null,
    progressPercent: null,
    milestonePercent: null,
  };

  const stalled: Branch = {
    ...base,
    id: "b-stalled",
    title: "stalled",
    type: "cumulative",
    baseline: { metric: "m", value: "5", takenAt: "2026-06-28" },
    retests: [{ value: "5", takenAt: "2026-09-04" }],
  };
  const moving: Branch = {
    ...base,
    id: "b-moving",
    title: "moving",
    type: "cumulative",
    baseline: { metric: "m", value: "5", takenAt: "2026-06-28" },
    retests: [{ value: "8", takenAt: "2026-09-04" }],
  };
  const idle: Branch = { ...base, id: "b-idle", title: "idle", type: "project", baseline: null, retests: [] };

  const traces: Trace[] = [
    { id: "t-1", source: "calendar", ts: "2026-07-01", title: "x", durationMin: 30, raw: "" },
    { id: "t-2", source: "calendar", ts: "2026-07-02", title: "y", durationMin: 30, raw: "" },
  ];
  const attributions = [
    { traceId: "t-1", branchId: "b-stalled", rule: "test", crossBranch: false },
    { traceId: "t-2", branchId: "b-moving", rule: "test", crossBranch: false },
  ];

  const results = reconcile({ branches: [stalled, moving, idle], traces, attributions });
  const byId = Object.fromEntries(results.map((result) => [result.branchId, result]));

  assert.equal(byId["b-stalled"].status, "noEffect");
  assert.equal(byId["b-moving"].status, "active");
  assert.equal(byId["b-idle"].status, "dormant");
});

test("diagnosis reports the anchor gap and keeps the constraint criterion disabled", () => {
  const branch: Branch = {
    id: "b-1",
    layer: "quarter",
    title: "anchorless",
    parentId: null,
    type: "project",
    unitAction: "一次",
    durationMin: 60,
    energy: "high",
    minWeekly: 1,
    anchor: null,
    effectHypothesis: null,
    falsificationCondition: null,
    baseline: null,
    retests: [],
    quarterIndicator: null,
    retestMethod: null,
    slot: "project",
    slotRationale: null,
    progressPercent: 15,
    milestonePercent: 60,
  };

  const diagnosis = diagnose([branch], []);
  assert.equal(diagnosis.anchorGap.length, 1);
  assert.equal(diagnosis.lagging.length, 1);
  assert.equal(diagnosis.constraint[0].severity, "unavailable");
});

test("the weekly draft warns when a cumulative branch drops below its minimum", () => {
  const draft: ScheduleDraft = {
    capacityHours: 8,
    optimismCoefficient: null,
    minWeekly: [{ branchId: "b-1", title: "shadowing", unit: "", required: 2 }],
    slots: [
      { id: "s-1", day: "一", branchId: "b-1", title: "a", note: "", durationMin: 15, energy: "low", fixed: false, removed: false },
      { id: "s-2", day: "三", branchId: "b-1", title: "b", note: "", durationMin: 15, energy: "low", fixed: true, removed: false },
    ],
  };

  assert.equal(summarize(draft).brokenChains.length, 0);

  const afterDelete = toggleSlot(draft, "s-1");
  assert.equal(summarize(afterDelete).brokenChains.length, 1);

  // Fixed slots are existing strong anchors; they are not ours to move.
  const afterFixedDelete = toggleSlot(afterDelete, "s-2");
  assert.equal(afterFixedDelete.slots[1].removed, false);
});

test("gap dispatch answers from time flow and money flow, never from a mood", () => {
  assert.equal(dispatch({ hours: 4, energy: "low", cash: "ok" }).pick, "shadowing");
  assert.equal(dispatch({ hours: 0.5, energy: "high", cash: "ok" }).pick, "shadowing");
  assert.equal(dispatch({ hours: 4, energy: "high", cash: "tight" }).pick, "接案作品集");
  assert.equal(dispatch({ hours: 4, energy: "high", cash: "ok" }).pick, "HCI 作品集");
  assert.ok(dispatch({ hours: 2, energy: "mid", cash: "ok" }).why.length >= 3);
});

test("the horizon sets the scale of everything after it", () => {
  const year = horizonById("2026-07-01", "1y");
  assert.equal(year.start, "2026-07-01");
  assert.equal(year.end, "2027-06-30");
  assert.equal(year.quarters.length, 4);
  assert.equal(year.quarters[0].end, "2026-09-30");
  assert.equal(year.firstReconcileAt, "2026-09-30");
  assert.equal(year.slotCap, 3);

  // Closed options stay visible. A narrowed scope is a trade-off, not a secret.
  const options = buildHorizons("2026-07-01");
  assert.equal(options.length, 4);
  assert.equal(options.filter((option) => option.available).length, 1);
});

test("the demonstration snapshot is internally consistent", () => {
  const statuses = new Set(SNAPSHOT.results.map((result) => result.status));
  // All four outcomes must be visible, including the one every tracker hides.
  const expectedStatuses: ReconcileStatus[] = ["active", "dormant", "unattributed", "noEffect"];
  for (const expected of expectedStatuses) {
    assert.ok(statuses.has(expected), `missing outcome: ${expected}`);
  }

  assert.equal(SNAPSHOT.period.traceCount, SNAPSHOT.traces.length);
  assert.ok(SNAPSHOT.period.autoAttributionRate > 90);
  assert.ok(SNAPSHOT.period.slotsUsed <= SNAPSHOT.period.slotCap);
  assert.equal(SNAPSHOT.period.daysToQuarterBoundary, 26);

  // Vision and the five-year layer are empty on purpose: intake cannot reach them.
  assert.equal(SNAPSHOT.goalTree.vision, null);
  assert.ok(SNAPSHOT.diagnosis.anchorGap.length > 0);
});
