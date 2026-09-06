import type {
  Branch,
  BaselineQuestion,
  CoachingSnapshot,
  CrossCheck,
  Energy,
  Horizon,
  ImportSource,
  ReconcileResult,
  ScheduleDraft,
  ScheduleSlot,
  ShapeSuggestion,
  Trace,
  WeeklyCheckItem,
} from "../contracts";
import { SLOT_CAP, horizonById } from "../horizon";
import { SNAPSHOT } from "../mock/snapshot";
import { diagnose, invisibleInvestment, reconcile } from "../reconcile";
import type {
  DirectionRunView,
  Fit,
  MilestoneView,
  ImportView,
  IntegrationView,
  PlanDetail,
  QuestionView,
  QuotaView,
  ReconciliationView,
  RoleModelView,
  TaskView,
  VerdictView,
} from "./guru-core-types";
import type { GuruCoreClient } from "./guru-core";

/**
 * Backend to UI.
 *
 * The UI reads one `CoachingSnapshot` and nothing else, so this file is the only
 * place guru-core's vocabulary is translated into ours. Two rules govern it:
 *
 * 1. **The backend's implementation is the authority.** Where guru-core has the
 *    concept, its value wins — the shapes, the verdicts and their five cited
 *    evidence items, the three constraint questions, the quota, the milestone
 *    tree, the schedule.
 * 2. **Where it has no concept, the demonstration fixture stands in**, section by
 *    section, and `SnapshotOrigins` records which is which so the gap is
 *    visible instead of silently papered over.
 *
 * What guru-core does not model, and therefore still comes from the fixture:
 * the role-model free-text input, the alternative paths kept as a control group,
 * the coach's challenge questions, anchors and anchor prescriptions, and the
 * capability retest that separates attendance from effect. The last one is why
 * no `noEffect` row can appear against live data: without a baseline and a
 * retest there is nothing to compare, and inventing one here would fake the
 * single outcome the product exists to show.
 */

export type SectionOrigin = "backend" | "fixture";

export interface SnapshotOrigins {
  horizon: SectionOrigin;
  imports: SectionOrigin;
  baselineQuestions: SectionOrigin;
  shapes: SectionOrigin;
  goalTree: SectionOrigin;
  ledger: SectionOrigin;
  schedule: SectionOrigin;
}

export interface AdaptedSnapshot {
  snapshot: CoachingSnapshot;
  origins: SnapshotOrigins;
}

const DAY_LABELS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];

const FIT_BADGE: Record<Fit, { label: string; tone: ShapeSuggestion["fitTone"] }> = {
  strongly_consistent: { label: "資料支持", tone: "done" },
  partly_consistent: { label: "部分一致", tone: "active" },
  moderate_gap: { label: "落差中等", tone: "active" },
  large_gap: { label: "落差大", tone: "attention" },
  largest_gap: { label: "落差最大", tone: "attention" },
  runs_opposite: { label: "方向相反", tone: "attention" },
};

/** Task type is the closest thing the backend has to an energy demand. */
const ENERGY_BY_TASK_TYPE: Record<TaskView["task_type"], Energy> = {
  session: "high",
  habit: "low",
  checkpoint: "mid",
  rest: "low",
};

function isoDay(value: string): string {
  return value.slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/* ── Station 1 ───────────────────────────────────────────────────── */

/**
 * The horizon is ours, not the backend's: guru-core sizes everything by a plan's
 * `duration_weeks` and a hypothesis `review_date`. Only the anchor date is taken
 * from live data, so the quarters and the retest schedule stay arithmetic.
 */
function buildHorizon(plan: PlanDetail | null, coverageEnd: string | null): Horizon | null {
  const anchor = plan?.start_date ?? (coverageEnd ? addDays(coverageEnd, 1) : null);
  return anchor ? horizonById(anchor, "1y") : null;
}

/**
 * Our four import rows are fixed copy — what each source provides and what is
 * lost without it. Only status and detail come from the backend.
 */
function buildImports(
  imports: ImportView[],
  integrations: IntegrationView[],
): ImportSource[] {
  const calendarConnected = integrations.some(
    (entry) => entry.provider.includes("google") && entry.connected && !entry.needs_reauth,
  );

  const matches = (formats: string[]) =>
    imports.filter((entry) => formats.includes(entry.format.toLowerCase()));

  return SNAPSHOT.imports.map((source) => {
    if (source.id === "calendar") {
      const rows = matches(["ics"]);
      const events = rows.reduce((total, row) => total + (row.event_count ?? 0), 0);
      const parsed = rows.some((row) => row.status === "parsed");
      if (!calendarConnected && !parsed) return { ...source, status: "absent", detail: null };
      return {
        ...source,
        status: calendarConnected ? "connected" : "parsed",
        detail: events > 0 ? `${events} 個行程` : null,
      };
    }

    if (source.id === "resume") {
      const rows = matches(["pdf", "docx"]);
      const parsed = rows.find((row) => row.status === "parsed");
      return parsed
        ? { ...source, status: "parsed", detail: `${parsed.filename} · ${parsed.chunk_count ?? 0} 段` }
        : { ...source, status: "absent", detail: null };
    }

    if (source.id === "notion") {
      const rows = matches(["md", "html", "csv", "xlsx"]);
      const parsed = rows.find((row) => row.status === "parsed");
      return parsed
        ? { ...source, status: "parsed", detail: `${parsed.filename} · ${parsed.chunk_count ?? 0} 段` }
        : { ...source, status: "absent", detail: null };
    }

    // Apple Health has no importer in guru-core. Saying "not connected" is the
    // honest rendering, and the row already states what is lost without it.
    return { ...source, status: "absent", detail: null };
  });
}

/**
 * guru-core asks exactly three constraint questions, each with the reason it is
 * being asked. Ours is the same control, so the backend's set replaces the
 * fixture's outright rather than being merged into it.
 */
function buildQuestions(questions: QuestionView[]): BaselineQuestion[] {
  return questions.map((question) => ({
    id: question.key.toUpperCase(),
    prompt: question.prompt,
    downstream: question.purpose,
    placeholder:
      question.choices.length > 0 ? question.choices.join(" / ") : "可以跳過。跳過會被記成一個答案，不是遺漏。",
  }));
}

function buildShapes(run: DirectionRunView, catalogue: RoleModelView[]): ShapeSuggestion[] {
  const byCode = new Map(catalogue.map((model) => [model.code, model]));

  return run.verdicts.map((verdict) => {
    const model = byCode.get(verdict.role_model_code);
    const badge = FIT_BADGE[verdict.fit];
    return {
      id: verdict.role_model_code,
      name: verdict.role_model_name || model?.name || verdict.role_model_code,
      lede: model?.vision ?? verdict.verdict,
      // Every item cites a report from this run; the backend rejects one that
      // does not, so an evidence line here always has something behind it.
      evidence: verdict.evidence.map((item) => ({
        kind: "imported" as const,
        text: `${item.text}（${item.cites.dimension}）`,
      })),
      yearLooksLike: model?.five_year_path ?? verdict.probe.statement,
      accumulates: model?.must_accumulate ?? "—",
      cost: verdict.cost || model?.cost || "—",
      fitLabel: badge.label,
      fitTone: badge.tone,
    };
  });
}

function buildCrossChecks(run: DirectionRunView): Record<string, CrossCheck> {
  const hasReports = run.reports.length > 0;
  const entries = run.verdicts.map((verdict): [string, CrossCheck] => [
    verdict.role_model_code,
    {
      available: hasReports,
      verdict: verdict.verdict,
      narrative: verdict.note,
      items: verdict.evidence.map((item) => ({
        mark: item.stance === "for" ? ("supports" as const) : ("missing" as const),
        text: item.text,
      })),
      test: verdict.probe.statement,
      cost: verdict.probe.cost,
    },
  ]);
  return Object.fromEntries(entries);
}

/* ── Station 2 ───────────────────────────────────────────────────── */

/**
 * Top-level milestones become branches. A milestone with no tasks lands with no
 * unit action, which the goal tree already renders as "missing the four
 * elements, cannot be scheduled" — the right answer rather than a blank row.
 */
function buildBranches(plan: PlanDetail, tasks: TaskView[]): Branch[] {
  const roots = plan.milestones ?? [];
  const elapsedWeeks = plan.start_date
    ? Math.max(0, Math.floor(daysBetween(plan.start_date, isoDay(new Date().toISOString())) / 7))
    : 0;
  const expected = plan.duration_weeks > 0
    ? Math.min(100, Math.round((elapsedWeeks / plan.duration_weeks) * 100))
    : 0;

  return roots.map((milestone, index) => {
    const descendants = collectIds(milestone);
    const mine = tasks.filter((task) => descendants.has(task.milestone_id));
    const done = mine.filter((task) => task.status === "done").length;
    const habits = mine.filter((task) => task.task_type === "habit");
    const sample = mine[0] ?? null;
    const weeklyCount = habits.length > 0 ? countPerWeek(habits) : null;

    return {
      id: milestone.id,
      layer: "quarter",
      title: milestone.title,
      parentId: null,
      type: habits.length > 0 ? "cumulative" : mine.length > 0 ? "project" : "undefined",
      unitAction: sample?.title ?? null,
      durationMin: sample?.duration_minutes ?? null,
      energy: sample ? ENERGY_BY_TASK_TYPE[sample.task_type] : null,
      minWeekly: weeklyCount,
      // guru-core models no anchors, so every branch reads as an anchor gap.
      // That is the criterion working, not a mapping shortcut.
      anchor: null,
      effectHypothesis: null,
      falsificationCondition: null,
      baseline: null,
      retests: [],
      quarterIndicator: milestone.metric,
      retestMethod: mine.length > 0 ? "完成度。做完就是做完。" : null,
      slot: index < SLOT_CAP ? (habits.length > 0 ? "cumulative" : "project") : null,
      slotRationale:
        index < SLOT_CAP
          ? `本季推進名額 ${index + 1} / ${SLOT_CAP} · 里程碑目標：${milestone.metric}`
          : "本季未取得名額 · 名額硬上限 3，跨季不累加",
      progressPercent: mine.length > 0 ? Math.round((done / mine.length) * 100) : null,
      milestonePercent: mine.length > 0 ? expected : null,
    };
  });
}

/**
 * Milestones nest and tasks do not, so a task hangs off whichever milestone owns
 * it — often a leaf. A branch is a *root* milestone, so bookings have to climb
 * back up, or every root reads as zero action while its children carry the work.
 */
function rootByMilestone(roots: MilestoneView[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const root of roots) {
    for (const id of collectIds(root)) map.set(id, root.id);
  }
  return map;
}

function collectIds(milestone: { id: string; children?: { id: string }[] }): Set<string> {
  const ids = new Set<string>([milestone.id]);
  for (const child of milestone.children ?? []) {
    for (const id of collectIds(child as { id: string; children?: { id: string }[] })) ids.add(id);
  }
  return ids;
}

/** How many times a habit runs in its busiest week: the minimum weekly volume. */
function countPerWeek(tasks: TaskView[]): number {
  const perWeek = new Map<number, number>();
  for (const task of tasks) perWeek.set(task.week_index, (perWeek.get(task.week_index) ?? 0) + 1);
  return Math.max(1, ...perWeek.values());
}

/* ── Station 3 ───────────────────────────────────────────────────── */

/**
 * Completed tasks are the traces. guru-core already books work to a milestone by
 * construction, so the keyword rule table is not used here — attributing an
 * already-attributed row through a guess would be worse, not better.
 */
function tracesFromTasks(
  tasks: TaskView[],
  roots: Map<string, string>,
): { traces: Trace[]; attributions: { traceId: string; branchId: string; rule: string; crossBranch: boolean }[] } {
  const done = tasks.filter((task) => task.status === "done");
  const traces: Trace[] = done.map((task) => ({
    id: task.id,
    source: "work",
    ts: isoDay(task.start_at),
    title: task.title,
    durationMin: task.duration_minutes,
    raw: task.key,
  }));
  return {
    traces,
    attributions: done.map((task) => ({
      traceId: task.id,
      branchId: roots.get(task.milestone_id) ?? task.milestone_id,
      rule: "task → milestone → branch (booked by guru-core)",
      crossBranch: false,
    })),
  };
}

/** The unclassified report is the one dimension that maps straight onto our
 *  invisible-investment row: real time that belongs to no branch. */
function unclassifiedRow(run: DirectionRunView | null): ReconcileResult[] {
  const report = run?.reports.find((entry) => entry.dimension === "unclassified");
  if (!report) return [];
  const events = report.metrics.events ?? 0;
  const hours = round(report.metrics.hours ?? 0);
  if (events === 0 && hours === 0) return [];
  return [
    {
      branchId: "unattributed:unclassified",
      branchTitle: "未分類時間",
      type: "undefined",
      status: "unattributed",
      actionCount: events,
      actionLabel: `${events} 件 · ${hours} 小時`,
      effectLabel: null,
      evidence: [],
      verdict: report.findings.headline ?? "可能是未承認的新方向，也可能是純粹的浪費",
      anchorLabel: "—",
    },
  ];
}

function buildWeeklyCheck(tasks: TaskView[], today: string): WeeklyCheckItem[] {
  const since = addDays(today, -7);
  const recent = tasks
    .filter((task) => isoDay(task.start_at) >= since && isoDay(task.start_at) <= today)
    .slice(0, 4);

  return recent.map((task) => ({
    id: task.id,
    // Proofreading, not recall: the coach brings the trace and asks.
    prompt: `我看到「${task.title}」${task.status === "done" ? "已完成" : "沒有紀錄"}，對嗎`,
    highlight: task.title,
    answer: null,
  }));
}

function buildSchedule(
  tasks: TaskView[],
  quota: QuotaView | null,
  today: string,
  roots: Map<string, string>,
): ScheduleDraft {
  const until = addDays(today, 7);
  const upcoming = tasks
    .filter((task) => isoDay(task.start_at) >= today && isoDay(task.start_at) < until)
    .sort((left, right) => left.start_at.localeCompare(right.start_at));

  const slots: ScheduleSlot[] = upcoming.map((task) => ({
    id: task.id,
    day: DAY_LABELS[new Date(task.start_at).getUTCDay()],
    branchId: roots.get(task.milestone_id) ?? task.milestone_id,
    title: task.title,
    note: task.description || `${task.area} · ${task.task_type}`,
    durationMin: task.duration_minutes,
    energy: ENERGY_BY_TASK_TYPE[task.task_type],
    // guru-core has no notion of an immovable external anchor.
    fixed: false,
    removed: false,
  }));

  const habitsByBranch = new Map<string, TaskView[]>();
  for (const task of upcoming) {
    if (task.task_type !== "habit") continue;
    const branchId = roots.get(task.milestone_id) ?? task.milestone_id;
    const bucket = habitsByBranch.get(branchId) ?? [];
    bucket.push(task);
    habitsByBranch.set(branchId, bucket);
  }

  return {
    capacityHours: quota ? round(quota.weekly_minutes / 60) : SNAPSHOT.schedule.capacityHours,
    // The personal optimism coefficient needs a quarter of planned-versus-actual.
    optimismCoefficient: null,
    slots,
    minWeekly: [...habitsByBranch.entries()].map(([branchId, group]) => ({
      branchId,
      title: group[0].title,
      unit: ` 每週 ${group.length} 次`,
      required: group.length,
    })),
  };
}

/* ── Assembly ────────────────────────────────────────────────────── */

/**
 * One section failing must not blank the rest of the page, so every read falls
 * back on its own. The failure is logged rather than swallowed: a silent partial
 * fallback is the worst kind, because the page still looks right.
 */
async function soft<T>(label: string, promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[guru-core] ${label} unavailable: ${message}`);
    return fallback;
  }
}

/**
 * Reads everything guru-core can answer for this account and folds it into the
 * one document the UI renders. Any section the backend cannot supply keeps the
 * fixture's value, so the page always renders and never lies about which is
 * which.
 */
export async function adaptSnapshot(client: GuruCoreClient): Promise<AdaptedSnapshot> {
  const today = new Date().toISOString().slice(0, 10);

  const [profile, imports, integrations, questions, quota, roleModels, run, hypotheses, plans] =
    await Promise.all([
      soft("profile", client.profile(), null),
      soft("imports", client.imports(), []),
      soft("integrations", client.integrations(), []),
      soft("questions", client.questions(), []),
      soft("quota", client.quota(), null),
      soft("role-models", client.roleModels(), []),
      soft("direction-run", client.latestDirectionRun(), null),
      soft("hypotheses", client.hypotheses(), []),
      soft("plans", client.plans(), []),
    ]);

  const hypothesis = hypotheses.at(-1) ?? null;
  const planSummary = plans.find((entry) => entry.status === "active") ?? plans.at(-1) ?? null;
  const plan = planSummary ? await soft("plan", client.plan(planSummary.id), null) : null;
  const tasks = plan ? await soft("tasks", client.tasks(plan.id), []) : [];

  const origins: SnapshotOrigins = {
    horizon: "fixture",
    imports: "fixture",
    baselineQuestions: "fixture",
    shapes: "fixture",
    goalTree: "fixture",
    ledger: "fixture",
    schedule: "fixture",
  };

  const snapshot: CoachingSnapshot = { ...SNAPSHOT };

  const horizon = buildHorizon(plan, profile?.coverage?.period_end ?? null);
  if (horizon) {
    snapshot.horizon = horizon;
    origins.horizon = "backend";
  }

  if (imports.length > 0 || integrations.length > 0) {
    snapshot.imports = buildImports(imports, integrations);
    origins.imports = "backend";
  }

  if (questions.length > 0) {
    snapshot.baselineQuestions = buildQuestions(questions);
    origins.baselineQuestions = "backend";
  }

  const ready = run && run.verdicts.length > 0;
  if (ready && run) {
    snapshot.shapes = buildShapes(run, roleModels);
    snapshot.crossChecks = buildCrossChecks(run);
    origins.shapes = "backend";
  }

  const branches = plan ? buildBranches(plan, tasks) : [];
  if (plan && branches.length > 0) {
    snapshot.goalTree = {
      ...SNAPSHOT.goalTree,
      version: hypothesis ? `v${hypothesis.version}` : SNAPSHOT.goalTree.version,
      // Vision and the five-year layer have no source in guru-core either; the
      // page already renders them as "not covered this period".
      vision: null,
      visionDeclaredAt: null,
      branches,
      lockedAt: plan.start_date,
      lockedUntil: hypothesis?.review_date ?? null,
    };
    origins.goalTree = "backend";

    const { traces, attributions } = tracesFromTasks(tasks, rootByMilestone(plan.milestones ?? []));
    const results = [
      ...reconcile({ branches, traces, attributions }),
      ...invisibleInvestment(traces, attributions),
      ...unclassifiedRow(run),
    ];

    snapshot.traces = traces;
    snapshot.results = results;
    snapshot.diagnosis = diagnose(branches, results);
    // A plan that starts tomorrow has no window yet; the period must not run
    // backwards just because the fixture's "as of today" met a future start.
    const periodStart = plan.start_date ?? snapshot.horizon.start;
    snapshot.period = {
      label: plan.title,
      start: periodStart,
      end: today > periodStart ? today : periodStart,
      traceCount: (profile?.coverage?.events ?? 0) + (profile?.coverage?.text_chunks ?? 0),
      autoAttributionRate: attributionRate(run),
      slotsUsed: branches.filter((branch) => branch.slot !== null).length,
      slotCap: SLOT_CAP,
      daysToQuarterBoundary: hypothesis
        ? Math.max(0, daysBetween(today, hypothesis.review_date))
        : SNAPSHOT.period.daysToQuarterBoundary,
    };
    origins.ledger = "backend";

    const weeklyCheck = buildWeeklyCheck(tasks, today);
    if (weeklyCheck.length > 0) snapshot.weeklyCheck = weeklyCheck;

    const schedule = buildSchedule(tasks, quota, today, rootByMilestone(plan.milestones ?? []));
    if (schedule.slots.length > 0) {
      snapshot.schedule = schedule;
      origins.schedule = "backend";
    }
  }

  return { snapshot, origins };
}

/**
 * The share of observed time the reports could name. guru-core does not publish
 * an attribution rate, but `unclassified` is exactly its complement.
 */
function attributionRate(run: DirectionRunView | null): number {
  const unclassified = run?.reports.find((entry) => entry.dimension === "unclassified");
  if (!unclassified) return SNAPSHOT.period.autoAttributionRate;
  return round((1 - (unclassified.metrics.share ?? 0)) * 100);
}

/** Folds a reconciliation's arithmetic into the period line when one exists. */
export function applyReconciliation(
  snapshot: CoachingSnapshot,
  review: ReconciliationView,
): CoachingSnapshot {
  return {
    ...snapshot,
    period: {
      ...snapshot.period,
      start: review.period_start,
      end: review.period_end,
    },
  };
}
