/**
 * Domain contracts for the coaching ledger.
 *
 * These types are the frontend/backend interface. Every screen is driven by a
 * value of one of these shapes, so the shapes themselves are the API spec —
 * see `docs/API.md`, which mirrors this file endpoint by endpoint.
 *
 * Field names follow the design specification (`design/docs/01-solution.md`
 * section 11.3). Nothing here is derived from a rendering concern.
 */

/** Goal tree layers. The top two are declared by the user, never inferred. */
export type Layer = "vision" | "fiveYear" | "annual" | "quarter" | "week" | "day";

/**
 * Branch type decides how progress is measured.
 * - `project`: completion. Doing the work is the result.
 * - `cumulative`: capability retest. Attendance proves nothing.
 * - `undefined`: not yet typed, therefore not schedulable.
 */
export type BranchType = "project" | "cumulative" | "undefined";

/** Energy demand of one unit action. Not the same thing as duration. */
export type Energy = "low" | "mid" | "high";

/** External commitment that keeps a branch moving without willpower. */
export interface Anchor {
  /** `deadline` and `person` are strong; `coachPact` is the weak fallback. */
  kind: "deadline" | "person" | "paid" | "public" | "coachPact";
  label: string;
}

/** A single capability measurement, taken at a quarter boundary. */
export interface Retest {
  value: string;
  takenAt: string;
}

export interface Baseline {
  metric: string;
  value: string;
  takenAt: string;
}

/**
 * One node of the goal tree.
 *
 * The four elements (`unitAction`, `durationMin`, `energy`, `minWeekly`) are
 * the scheduler's building blocks. A branch missing any of them cannot be
 * scheduled and cannot be judged — that absence is itself a diagnosis.
 */
export interface Branch {
  id: string;
  layer: Layer;
  title: string;
  /** Annual branch this quarter branch rolls up into. */
  parentId: string | null;
  type: BranchType;
  unitAction: string | null;
  durationMin: number | null;
  energy: Energy | null;
  minWeekly: number | null;
  anchor: Anchor | null;
  /** Why the user believes this action moves this goal. */
  effectHypothesis: string | null;
  /** What result would prove the hypothesis wrong. */
  falsificationCondition: string | null;
  baseline: Baseline | null;
  retests: Retest[];
  /** Twelve-week indicator: completable and judgeable inside one quarter. */
  quarterIndicator: string | null;
  /** How progress is measured, in the user's own words. */
  retestMethod: string | null;
  /** Whether the branch holds one of the three promotion slots this quarter. */
  slot: "cumulative" | "project" | null;
  /** Coach's note on why this branch did or did not get a slot. */
  slotRationale: string | null;
  /** Completion so far, 0-100. `null` when the branch cannot be measured. */
  progressPercent: number | null;
  /** What the quarter milestone expects by now, 0-100. */
  milestonePercent: number | null;
}

/** An alternative five-year path, kept alive as a standing control group. */
export interface PathOption {
  id: string;
  title: string;
  summary: string;
  /** Current attractiveness, 0-10. Trend only becomes meaningful in Q2. */
  attractiveness: number;
  live: boolean;
}

export interface GoalTree {
  version: string;
  /** Declared by the user. `null` renders as "not covered this period". */
  vision: string | null;
  visionDeclaredAt: string | null;
  paths: PathOption[];
  branches: Branch[];
  lockedAt: string | null;
  lockedUntil: string | null;
  changeLog: ChangeLogEntry[];
}

/** Goals are never overwritten, only versioned. */
export interface ChangeLogEntry {
  at: string;
  reason: string;
  energyAtTime: Energy;
  version: string;
}

/** Where a trace came from. No source requires new recording behaviour. */
export type TraceSource = "calendar" | "notion" | "resume" | "health" | "work" | "ai";

/** One piece of evidence the user already left behind. */
export interface Trace {
  id: string;
  source: TraceSource;
  ts: string;
  title: string;
  durationMin: number;
  raw: string;
}

/** The result of running one trace through the attribution rules. */
export interface Attribution {
  traceId: string;
  /** `null` means invisible investment: real time that fits no branch. */
  branchId: string | null;
  /** Which rule matched, so the user can argue with it. */
  rule: string;
  /** Matched more than one branch and was booked to the primary. */
  crossBranch: boolean;
}

/**
 * The four reconciliation outcomes.
 * `noEffect` is the one every other tracker shows as green.
 */
export type ReconcileStatus = "active" | "dormant" | "unattributed" | "noEffect";

export interface ReconcileResult {
  branchId: string;
  branchTitle: string;
  type: BranchType;
  status: ReconcileStatus;
  actionCount: number;
  actionLabel: string;
  /** Retest reading, or `null` when no baseline exists. */
  effectLabel: string | null;
  evidence: string[];
  /** Human-readable judgement shown in the ledger's verdict column. */
  verdict: string;
  anchorLabel: string;
}

export type Severity = "high" | "mid" | "unavailable";

export interface Finding {
  id: string;
  branchId: string | null;
  title: string;
  reason: string;
  severity: Severity;
}

/**
 * The four criteria. Only `anchorGap` is forward-looking; the rest read
 * the past. `constraint` needs two to three quarters of history, so the
 * first-year value is deliberately empty.
 */
export interface Diagnosis {
  lagging: Finding[];
  imbalanced: Finding[];
  invisible: Finding[];
  anchorGap: Finding[];
  constraint: Finding[];
}

/* ── Station 1 · intake ──────────────────────────────────────────── */

export type HorizonId = "3m" | "6m" | "1y" | "lifeStage";

export interface Quarter {
  id: string;
  start: string;
  end: string;
}

export interface Horizon {
  id: HorizonId;
  label: string;
  available: boolean;
  start: string;
  end: string;
  quarters: Quarter[];
  firstReconcileAt: string;
  retestCount: number;
  /** Hard cap on promotion slots. Does not accumulate across quarters. */
  slotCap: number;
}

export type ImportPriority = "P0" | "P1" | "P2" | "P3";
export type ImportStatus = "connected" | "parsed" | "absent";

export interface ImportSource {
  id: TraceSource;
  priority: ImportPriority;
  name: string;
  provides: string;
  /** What the user loses by skipping it. Stated, not hidden. */
  withoutIt: string;
  status: ImportStatus;
  detail: string | null;
}

export interface BaselineQuestion {
  id: string;
  prompt: string;
  /** Which downstream field this answer calibrates. */
  downstream: string;
  placeholder: string;
}

/** "I want <person>'s <capability>", decomposed into three cells. */
export interface RoleModelDraft {
  person: string;
  capability: string;
}

export interface CapabilityBreakdown {
  /** Empty when the stated capability cannot be retested as phrased. */
  measurable: string | null;
  retestMethod: string | null;
  impliedShape: string | null;
  cost: string | null;
  /** True when the phrasing is too abstract to produce a retest. */
  tooAbstract: boolean;
}

export type EvidenceKind = "roleModel" | "imported" | "baselineAnswers";

export interface ShapeEvidence {
  kind: EvidenceKind;
  text: string;
}

/** A generated shape suggestion. Without `evidence` it is just a poster. */
export interface ShapeSuggestion {
  id: string;
  name: string;
  lede: string;
  evidence: ShapeEvidence[];
  yearLooksLike: string;
  accumulates: string;
  cost: string;
  fitLabel: string;
  fitTone: "done" | "active" | "attention";
}

export type CrossCheckMark = "supports" | "missing";

export interface CrossCheckItem {
  mark: CrossCheckMark;
  text: string;
}

export interface CrossCheck {
  /** Disabled when the calendar (P0) has not been imported. */
  available: boolean;
  verdict: string;
  narrative: string;
  items: CrossCheckItem[];
  test: string;
  cost: string;
}

/** Station 1's output. A borrowed shape, explicitly not a vision. */
export interface Hypothesis {
  version: string;
  statement: string;
  horizon: Horizon;
  measurableCapability: string | null;
  baselineState: string;
  retestSchedule: string[];
  falsificationDraft: string;
  sourceSummary: string;
  createdAt: string;
}

/* ── Station 3 · dispatch, weekly check, schedule ────────────────── */

export type CashFlow = "ok" | "tight";

export interface DispatchInput {
  hours: number;
  energy: Energy;
  cash: CashFlow;
}

export interface DispatchAnswer {
  pick: string;
  unit: string;
  /** Every reason traces to time flow or money flow, never to a feeling. */
  why: string[];
}

export interface WeeklyCheckItem {
  id: string;
  /** Phrased as proofreading, not recall. */
  prompt: string;
  highlight: string;
  answer: "yes" | "no" | null;
}

export interface ScheduleSlot {
  id: string;
  day: string;
  branchId: string;
  title: string;
  note: string;
  durationMin: number;
  energy: Energy;
  /** Existing strong anchors cannot be deleted; they are not ours to move. */
  fixed: boolean;
  removed: boolean;
}

export interface ScheduleDraft {
  /** Usable hours next week, after the optimism discount. */
  capacityHours: number;
  /** Cold start has no personal coefficient, so the first quarter runs light. */
  optimismCoefficient: number | null;
  slots: ScheduleSlot[];
  minWeekly: { branchId: string; title: string; unit: string; required: number }[];
}

/* ── Aggregate ───────────────────────────────────────────────────── */

export interface LedgerPeriod {
  label: string;
  start: string;
  end: string;
  traceCount: number;
  autoAttributionRate: number;
  slotsUsed: number;
  slotCap: number;
  daysToQuarterBoundary: number;
}

/** Everything the three stations render, in one document. */
export interface CoachingSnapshot {
  horizon: Horizon;
  imports: ImportSource[];
  baselineQuestions: BaselineQuestion[];
  roleModel: RoleModelDraft;
  shapes: ShapeSuggestion[];
  crossChecks: Record<string, CrossCheck>;
  goalTree: GoalTree;
  challenges: Challenge[];
  period: LedgerPeriod;
  traces: Trace[];
  results: ReconcileResult[];
  diagnosis: Diagnosis;
  prescriptions: Prescription[];
  weeklyCheck: WeeklyCheckItem[];
  schedule: ScheduleDraft;
}

/** A question the coach cannot answer on the user's behalf. */
export interface Challenge {
  id: string;
  title: string;
  body: string;
  /** The evidence that produced the question. */
  basis: string;
}

export interface Prescription {
  branchId: string;
  branchTitle: string;
  tone: "attention" | "idle" | "active";
  label: string;
  body: string;
  /** Anchors are one-off actions; that is why they beat reminders. */
  cost: string;
}
