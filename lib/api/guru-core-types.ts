/**
 * Wire types for guru-core, transcribed from its exported OpenAPI 3.1 document
 * (`../guru-core/docs/api/openapi.json`, info.version 1.0.0).
 *
 * These mirror the backend exactly, including the fields we do not use. They are
 * kept apart from `lib/contracts.ts` on purpose: that file is what the UI reads,
 * this one is what the network returns, and `snapshot-adapter.ts` is the only
 * place the two meet. When the backend changes, only these three files move.
 *
 * Free-form `object` fields in the spec are typed here from the backend's own
 * Pydantic models, named in the comment above each one.
 */

/* ── Identity and profile ────────────────────────────────────────── */

export interface MeResponse {
  user_id: string;
  email: string;
}

/** `services/engine/domain/profile.py` · Coverage. */
export interface Coverage {
  sources?: string[];
  events?: number;
  text_chunks?: number;
  period_start?: string | null;
  period_end?: string | null;
  weeks?: number;
}

export interface ProfileView {
  timezone: string;
  signals?: Record<string, unknown>;
  coverage?: Coverage;
  updated_at?: string | null;
}

/* ── Imports and integrations ────────────────────────────────────── */

export type ImportStatusWire = "pending" | "uploaded" | "parsing" | "parsed" | "failed";

export interface ImportView {
  id: string;
  source: string;
  /** csv · xlsx · md · html · pdf · docx · ics */
  format: string;
  filename: string;
  status: ImportStatusWire;
  error: string | null;
  created_at: string;
  event_count?: number;
  chunk_count?: number;
}

export interface IntegrationView {
  provider: string;
  connected: boolean;
  scopes: string[];
  needs_reauth: boolean;
  connected_at: string | null;
}

/* ── The three constraint questions ──────────────────────────────── */

export interface QuestionView {
  key: string;
  prompt: string;
  /** Why the question is being asked. A hidden purpose gets defensive answers. */
  purpose: string;
  /** Non-empty for q3 only, which is a forced choice. */
  choices: string[];
  answer?: string | null;
  skipped?: boolean;
  answered_at?: string | null;
}

/** What q3's answer writes: the weekly ceiling and the cut order. */
export interface QuotaView {
  drop_first: "career" | "relationships" | "health";
  weekly_minutes: number;
  effective_from?: string | null;
}

/* ── The catalogue of shapes ─────────────────────────────────────── */

export interface RoleModelView {
  id: string;
  code: string;
  name: string;
  vision: string;
  five_year_path: string;
  must_accumulate: string;
  /** `NOT NULL` in the backend: a template with no stated trade-off is rejected. */
  cost: string;
  tags?: string[];
  author: string;
}

/* ── Station 1 · the direction run ───────────────────────────────── */

export type RunStatus = "pending" | "analyzing" | "recommending" | "ready" | "failed";

/** `services/engine/domain/report.py` · ReadOuts. */
export interface ReadOuts {
  trajectory?: string;
  skills?: string[];
  continuity?: string;
  voids?: string[];
  signals?: string[];
  unclassified?: string;
}

export type Dimension =
  | "work"
  | "social"
  | "learning"
  | "exercise"
  | "capacity"
  | "money"
  | "unclassified";

/** `services/engine/domain/profile.py` · DimensionMetrics. */
export interface ReportMetrics {
  dimension?: Dimension;
  events?: number;
  hours?: number;
  share?: number;
  weeks_present?: number;
  longest_streak_weeks?: number;
  last_seen?: string | null;
}

/** `services/engine/domain/report.py` · ReportDraft, minus its dimension. */
export interface ReportFindings {
  headline?: string;
  observations?: string[];
  voids?: string[];
  signals?: string[];
}

export interface ReportView {
  id: string;
  dimension: Dimension;
  period_start: string;
  period_end: string;
  metrics: ReportMetrics;
  findings: ReportFindings;
}

export type Fit =
  | "strongly_consistent"
  | "partly_consistent"
  | "moderate_gap"
  | "large_gap"
  | "largest_gap"
  | "runs_opposite";

/** Exactly five per verdict, at least one of each stance, every one cited. */
export interface EvidenceItem {
  stance: "for" | "against";
  text: string;
  cites: { dimension: Dimension; fact: string };
}

/** The one cheap test attached to a verdict, sized to a quarter. */
export interface Probe {
  statement: string;
  cost: string;
}

export interface VerdictView {
  id: string;
  role_model_id: string;
  role_model_code: string;
  role_model_name: string;
  cost: string;
  fit: Fit;
  verdict: string;
  note: string;
  evidence: EvidenceItem[];
  probe: Probe;
}

export interface DirectionRunView {
  id: string;
  status: RunStatus;
  period_start: string | null;
  period_end: string | null;
  readouts: ReadOuts;
  error: string | null;
  reports: ReportView[];
  verdicts: VerdictView[];
}

/* ── Station 2 · hypothesis and plan ─────────────────────────────── */

export interface HypothesisView {
  id: string;
  /** Append-only. There is no update route anywhere in the backend. */
  version: number;
  role_model_id: string;
  role_model_code: string;
  role_model_name: string;
  fit_verdict_id: string;
  source: string;
  evidence_snapshot: Record<string, unknown>;
  drop_first: string | null;
  answers_count: number;
  review_date: string;
  created_at: string;
  plan_id?: string | null;
}

export type PlanStatus = "generating" | "draft" | "active" | "archived" | "failed";

export interface MilestoneView {
  id: string;
  key: string;
  title: string;
  metric: string;
  target_date: string | null;
  status: string;
  children?: MilestoneView[];
}

/** `services/engine/application/generate_plan.py` · the `structure` payload. */
export interface PlanStructure {
  success_criteria?: string[];
  /** Read this before showing anything: a plan that hides its assumptions lies. */
  assumptions?: string[];
  quota?: QuotaView;
  trimmed?: { key?: string; title?: string; reason?: string }[];
  unplaced?: string[];
  baseline_schedule?: unknown[];
}

export interface PlanSummary {
  id: string;
  hypothesis_id: string;
  title: string;
  status: PlanStatus;
  start_date: string | null;
  duration_weeks: number;
  error: string | null;
  task_counts?: Record<string, number>;
}

export interface PlanDetail extends PlanSummary {
  structure?: PlanStructure;
  milestones?: MilestoneView[];
}

export type TaskStatus = "todo" | "done" | "missed" | "skipped";

export interface TaskView {
  id: string;
  milestone_id: string;
  key: string;
  week_index: number;
  occurrence: number;
  area: "career" | "relationships" | "health";
  task_type: "session" | "habit" | "checkpoint" | "rest";
  title: string;
  description: string;
  duration_minutes: number;
  status: TaskStatus;
  completed_at: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
}

/* ── Station 3 · the quarterly review ────────────────────────────── */

/** `services/engine/domain/reconciliation.py` · Comparison. */
export interface Comparison {
  execution?: {
    planned?: number;
    done?: number;
    missed?: number;
    skipped?: number;
    completion?: number;
  };
  shifts?: { dimension: Dimension; before: number; after: number; delta: number }[];
  schedule_changes?: unknown[];
  unclassified_delta?: number;
}

export interface ReconciliationView {
  id: string;
  hypothesis_id: string;
  status: string;
  period_start: string;
  period_end: string;
  comparison?: Comparison;
  narrative?: string;
  /** `null` on purpose. The comparison is arithmetic; the decision is the user's. */
  outcome?: string | null;
  revision_kind?: string | null;
  error?: string | null;
  next_hypothesis_id?: string | null;
}

/* ── Errors ──────────────────────────────────────────────────────── */

export interface ErrorResponse {
  error: { code: string; message: string };
}
