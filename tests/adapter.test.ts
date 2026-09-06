import assert from "node:assert/strict";
import { test } from "vitest";

import { adaptSnapshot } from "../lib/api/snapshot-adapter";
import type { GuruCoreClient } from "../lib/api/guru-core";
import type {
  DirectionRunView,
  ImportView,
  PlanDetail,
  PlanSummary,
  QuestionView,
  RoleModelView,
  TaskView,
} from "../lib/api/guru-core-types";

/**
 * Adapter tests, against payloads shaped like the ones guru-core actually
 * returned during integration (fixture LLM, the full loop through
 * `scripts/smoke.sh`). No network: the point is the mapping, not the transport.
 *
 * Two of these exist because live data broke them first — a task hangs off a
 * leaf milestone while a branch is a root, and a plan can start tomorrow.
 */

const ROLE_MODELS: RoleModelView[] = [
  {
    id: "rm-1",
    code: "S-1",
    name: "The Deep Specialist",
    vision: "Go deep on one thing, be known for it by your peers.",
    five_year_path: "Be the person named for one specific problem.",
    must_accumulate: "Depth, and public traces of it.",
    cost: "Switching tracks gets expensive as depth grows.",
    tags: [],
    author: "system",
  },
];

const RUN: DirectionRunView = {
  id: "run-1",
  status: "ready",
  period_start: "2026-03-01",
  period_end: "2026-09-01",
  readouts: { trajectory: "…", continuity: "…", unclassified: "…" },
  error: null,
  reports: [
    {
      id: "rep-1",
      dimension: "work",
      period_start: "2026-03-01",
      period_end: "2026-09-01",
      metrics: { events: 40, hours: 300, share: 0.7 },
      findings: { headline: "Work took the week." },
    },
    {
      id: "rep-2",
      dimension: "unclassified",
      period_start: "2026-03-01",
      period_end: "2026-09-01",
      metrics: { events: 12, hours: 18.5, share: 0.16 },
      findings: { headline: "Unnamed time, kept visible." },
    },
  ],
  verdicts: [
    {
      id: "v-1",
      role_model_id: "rm-1",
      role_model_code: "S-1",
      role_model_name: "The Deep Specialist",
      cost: "Switching tracks gets expensive as depth grows.",
      fit: "strongly_consistent",
      verdict: "Depth is accumulating, but nobody outside can see it.",
      note: "Consistent means low friction, and it can also mean habit.",
      evidence: [
        { stance: "for", text: "Same field for five years.", cites: { dimension: "work", fact: "…" } },
        { stance: "against", text: "No public work.", cites: { dimension: "unclassified", fact: "…" } },
      ],
      probe: { statement: "Publish one case study.", cost: "About three evenings." },
    },
  ],
};

const PLAN_SUMMARY: PlanSummary = {
  id: "plan-1",
  hypothesis_id: "hyp-1",
  title: "One quarter to run the probe",
  status: "active",
  start_date: "2026-09-07",
  duration_weeks: 12,
  error: null,
};

const PLAN: PlanDetail = {
  ...PLAN_SUMMARY,
  structure: { assumptions: ["Evenings are the only reliable free block."] },
  milestones: [
    {
      id: "ms-root",
      key: "probe",
      title: "Run the probe end to end",
      metric: "Submitted somewhere public",
      target_date: "2026-11-30",
      status: "pending",
      children: [
        {
          id: "ms-leaf",
          key: "draft",
          title: "Draft it",
          metric: "One full draft",
          target_date: "2026-10-15",
          status: "pending",
          children: [],
        },
      ],
    },
  ],
};

function task(overrides: Partial<TaskView> & Pick<TaskView, "id" | "milestone_id">): TaskView {
  return {
    key: "writing_block",
    week_index: 0,
    occurrence: 0,
    area: "career",
    task_type: "session",
    title: "Writing block",
    description: "One section, start to finish.",
    duration_minutes: 60,
    status: "todo",
    completed_at: null,
    start_at: "2026-09-07T19:00:00Z",
    end_at: "2026-09-07T20:00:00Z",
    all_day: false,
    ...overrides,
  };
}

function fakeClient(overrides: Partial<Record<string, unknown>> = {}): GuruCoreClient {
  const base = {
    profile: async () => ({
      timezone: "Asia/Taipei",
      coverage: { events: 448, text_chunks: 12, period_end: "2026-09-01", weeks: 26 },
    }),
    imports: async (): Promise<ImportView[]> => [
      {
        id: "imp-1",
        source: "upload",
        format: "ics",
        filename: "calendar.ics",
        status: "parsed",
        error: null,
        created_at: "2026-09-01T00:00:00Z",
        event_count: 448,
      },
    ],
    integrations: async () => [],
    questions: async (): Promise<QuestionView[]> => [
      {
        key: "q1",
        prompt: "What are you certain you do not want?",
        purpose: "Constrains the five-year candidate set from the outside in.",
        choices: [],
      },
      {
        key: "q3",
        prompt: "If you could only keep two this quarter, which would you let go of first?",
        purpose: "Sets the quota the schedule may spend.",
        choices: ["career", "relationships", "health"],
      },
    ],
    quota: async () => ({ drop_first: "career" as const, weekly_minutes: 300 }),
    roleModels: async () => ROLE_MODELS,
    latestDirectionRun: async () => RUN,
    hypotheses: async () => [
      {
        id: "hyp-1",
        version: 0,
        role_model_id: "rm-1",
        role_model_code: "S-1",
        role_model_name: "The Deep Specialist",
        fit_verdict_id: "v-1",
        source: "verdict",
        evidence_snapshot: {},
        drop_first: "career",
        answers_count: 2,
        review_date: "2026-12-06",
        created_at: "2026-09-06T00:00:00Z",
        plan_id: "plan-1",
      },
    ],
    plans: async () => [PLAN_SUMMARY],
    plan: async () => PLAN,
    tasks: async () => [
      task({ id: "t-1", milestone_id: "ms-leaf", status: "done" }),
      task({ id: "t-2", milestone_id: "ms-leaf" }),
    ],
  };
  return { ...base, ...overrides } as unknown as GuruCoreClient;
}

test("the backend supplies every section it has a concept for", async () => {
  const { origins } = await adaptSnapshot(fakeClient());
  assert.deepEqual(origins, {
    horizon: "backend",
    imports: "backend",
    baselineQuestions: "backend",
    shapes: "backend",
    goalTree: "backend",
    ledger: "backend",
    schedule: "backend",
  });
});

test("a verdict becomes a shape card and its cross-check, keeping both stances", async () => {
  const { snapshot } = await adaptSnapshot(fakeClient());

  const shape = snapshot.shapes[0];
  assert.equal(shape.id, "S-1");
  assert.equal(shape.name, "The Deep Specialist");
  assert.equal(shape.lede, ROLE_MODELS[0].vision);
  assert.equal(shape.cost, ROLE_MODELS[0].cost);
  // Every card must keep its evidence lines; without them it is a poster.
  assert.equal(shape.evidence.length, 2);

  const cross = snapshot.crossChecks["S-1"];
  assert.equal(cross.available, true);
  assert.equal(cross.test, "Publish one case study.");
  assert.deepEqual(
    cross.items.map((item) => item.mark),
    ["supports", "missing"],
  );
});

test("a task on a leaf milestone books to its root branch", async () => {
  const { snapshot } = await adaptSnapshot(fakeClient());

  assert.equal(snapshot.goalTree.branches.length, 1);
  const branch = snapshot.goalTree.branches[0];
  assert.equal(branch.id, "ms-root");
  assert.equal(branch.quarterIndicator, "Submitted somewhere public");

  const result = snapshot.results.find((entry) => entry.branchId === "ms-root");
  assert.ok(result, "the root branch must appear in the ledger");
  assert.equal(result.status, "active");
  assert.equal(result.actionCount, 1);
});

test("the unclassified report becomes the invisible-investment row", async () => {
  const { snapshot } = await adaptSnapshot(fakeClient());
  const row = snapshot.results.find((entry) => entry.status === "unattributed");
  assert.ok(row);
  assert.equal(row.actionCount, 12);
  assert.equal(snapshot.diagnosis.invisible.length, 1);
  // Its complement is the only attribution rate guru-core can support.
  assert.equal(snapshot.period.autoAttributionRate, 84);
});

test("a plan starting tomorrow does not produce a backwards period", async () => {
  const { snapshot } = await adaptSnapshot(fakeClient());
  assert.ok(snapshot.period.end >= snapshot.period.start);
});

test("guru-core models no anchors, so every branch reads as an anchor gap", async () => {
  const { snapshot } = await adaptSnapshot(fakeClient());
  assert.equal(snapshot.goalTree.branches[0].anchor, null);
  assert.equal(snapshot.diagnosis.anchorGap.length, 1);
});

test("the quota becomes the weekly capacity the draft may spend", async () => {
  const { snapshot } = await adaptSnapshot(fakeClient());
  assert.equal(snapshot.schedule.capacityHours, 5);
  assert.equal(snapshot.schedule.optimismCoefficient, null);
});

test("one failing section falls back on its own without blanking the rest", async () => {
  const { snapshot, origins } = await adaptSnapshot(
    fakeClient({
      latestDirectionRun: async () => {
        throw new Error("more than 60 requests in 60s");
      },
    }),
  );

  assert.equal(origins.shapes, "fixture");
  assert.equal(origins.goalTree, "backend");
  assert.ok(snapshot.shapes.length > 0, "the fixture's shapes still render");
});

test("with no plan yet, stations 2 and 3 keep the fixture", async () => {
  const { origins } = await adaptSnapshot(fakeClient({ plans: async () => [], plan: async () => null }));
  assert.equal(origins.shapes, "backend");
  assert.equal(origins.goalTree, "fixture");
  assert.equal(origins.ledger, "fixture");
});
