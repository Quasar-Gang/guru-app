export type TaskStatus = "pending" | "done" | "missed" | "skipped";
export type Difficulty = "easy" | "hard" | "extremely_hard";

export type ApiErrorBody = {
  error?: { code?: string; message?: string };
  detail?: string | Array<{ msg?: string }>;
};

export class GuruApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "GuruApiError";
  }
}

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
  is_new_user: boolean;
};

export type Me = { user_id: string; email: string };
export type Profile = {
  user_id: string;
  answers: Record<string, unknown>;
  timezone: string;
  updated_at: string;
};

export type PlanSummary = {
  id: string;
  title: string;
  difficulty: Difficulty;
  status: string;
  duration_weeks: number;
  start_date: string;
  deadline: string;
  goal_statement: string;
  sessions_per_week: number;
  total_minutes_per_week: number;
  completion_rate: number;
};

export type Phase = {
  index: number;
  name: string;
  week_start: number;
  week_end: number;
  focus: string;
  milestone_title: string;
  milestone_metric: string;
};

export type PhaseRate = {
  phase_index: number;
  name: string;
  done: number;
  total: number;
  rate: number;
};

export type PlanDetail = {
  id: string;
  session_id: string;
  title: string;
  difficulty: Difficulty;
  status: string;
  goal_statement: string;
  duration_weeks: number;
  start_date: string;
  deadline: string;
  phases: Phase[];
  success_criteria: string[];
  assumptions: string[];
  progress: {
    total: number;
    done: number;
    missed: number;
    skipped: number;
    pending: number;
    completion_rate: number;
    phase_rates: PhaseRate[];
    checkpoints: Array<{
      phase_index: number;
      title: string;
      metric: string;
      due_at: string;
      status: string;
    }>;
  };
  exports: ExportStatus[];
};

export type PlanTask = {
  id: string;
  template_key: string;
  week_index: number;
  phase_index: number;
  occurrence: number;
  task_type: "session" | "habit" | "checkpoint";
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  status: TaskStatus;
  completed_at: string | null;
  missed_reason: string | null;
  synced: boolean;
};

export type CheckinHistory = {
  items: Array<{
    id: string;
    checkin_date: string;
    results: Array<{ task_id: string; status: Exclude<TaskStatus, "pending">; reason?: string | null }>;
    note: string | null;
    created_at: string;
  }>;
  daily_rates: Array<{ date: string; done: number; total: number; rate: number }>;
};

export type FollowupQuestion = {
  id: string;
  metric_id: string;
  text: string;
  options: string[];
  allow_custom: boolean;
  allow_skip: boolean;
};

export type PlanSession = {
  id: string;
  status: string;
  round: number;
  goal: string;
  questions: FollowupQuestion[];
  plans: PlanSummary[];
  error: string | null;
};

export type RoleModel = {
  id: string;
  kind: "trait" | "persona";
  name: string;
  tags: string[];
  summary: string;
};

export type ImportView = {
  id: string;
  source: string;
  format: string;
  filename: string;
  status: string;
  error: string | null;
  created_at: string;
  event_count: number;
  chunk_count: number;
};

export type Integration = {
  provider: string;
  connected: boolean;
  scopes: string[];
  needs_reauth: boolean;
  connected_at: string | null;
};

export type ExportStatus = {
  target: string;
  status: string;
  external_calendar_id: string | null;
  last_synced_at: string | null;
  error: string | null;
  pending_changes: number;
};

export type ExportResult = {
  target: string;
  mode: string | null;
  job_id: string | null;
  markdown: { content: string; download_url: string; storage_key: string } | null;
};

export type Revision = {
  id: string;
  plan_id: string;
  strategy: string;
  status: string;
  rationale: string | null;
  diff: Array<{
    template_key: string;
    week_index: number;
    occurrence: number;
    kind: "added" | "moved" | "removed" | "shortened" | "lengthened" | "reduced" | "unchanged";
    title: string;
    before: { title: string; start_at: string; end_at: string; all_day: boolean } | null;
    after: { title: string; start_at: string; end_at: string; all_day: boolean } | null;
  }>;
  summary: Record<"added" | "moved" | "removed" | "shortened" | "lengthened" | "unchanged", number>;
  created_at: string;
  decided_at: string | null;
};

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown; authenticated?: boolean };

function errorMessage(body: ApiErrorBody, status: number): string {
  if (body.error?.message) return body.error.message;
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail)) return body.detail.map((item) => item.msg).filter(Boolean).join(", ");
  return `guru-core request failed with status ${status}`;
}

export class GuruApiClient {
  constructor(readonly baseUrl: string, readonly token: string = "") {}

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.baseUrl) throw new GuruApiError("guru-core API URL is not configured", 0, "not_configured");
    const { body, authenticated = true, headers, ...rest } = options;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/v1${path}`, {
      ...rest,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(authenticated && this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as ApiErrorBody;
      throw new GuruApiError(errorMessage(payload, response.status), response.status, payload.error?.code);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  loginWithGoogle(code: string, redirectUri: string) {
    return this.request<LoginResponse>("/auth/google", {
      method: "POST",
      authenticated: false,
      body: { code, redirect_uri: redirectUri },
    });
  }

  me() { return this.request<Me>("/me"); }
  getProfile() { return this.request<Profile>("/profile"); }
  updateProfile(answers: Record<string, unknown>, timezone: string) {
    return this.request<Profile>("/profile", { method: "PUT", body: { answers, timezone } });
  }
  listPlans(status?: string) {
    return this.request<PlanSummary[]>(`/plans${status ? `?status=${encodeURIComponent(status)}` : ""}`);
  }
  getPlan(planId: string) { return this.request<PlanDetail>(`/plans/${planId}`); }
  updatePlan(planId: string, patch: { title?: string; status?: string }) {
    return this.request<PlanDetail>(`/plans/${planId}`, { method: "PATCH", body: patch });
  }
  archivePlan(planId: string) { return this.request<PlanDetail>(`/plans/${planId}/archive`, { method: "POST" }); }
  deletePlan(planId: string) { return this.request<void>(`/plans/${planId}`, { method: "DELETE" }); }
  listTasks(planId: string, from: string, to: string) {
    const query = new URLSearchParams({ from, to });
    return this.request<{ items: PlanTask[]; total: number }>(`/plans/${planId}/tasks?${query}`);
  }
  updateTask(planId: string, taskId: string, patch: { status?: TaskStatus; start_at?: string; end_at?: string; missed_reason?: string | null }) {
    return this.request<PlanTask>(`/plans/${planId}/tasks/${taskId}`, { method: "PATCH", body: patch });
  }
  submitCheckin(planId: string, checkinDate: string, results: Array<{ task_id: string; status: Exclude<TaskStatus, "pending">; reason?: string }>, note?: string) {
    return this.request(`/plans/${planId}/checkins`, { method: "POST", body: { checkin_date: checkinDate, results, ...(note ? { note } : {}) } });
  }
  listCheckins(planId: string) { return this.request<CheckinHistory>(`/plans/${planId}/checkins`); }
  listRoleModels(kind: "trait" | "persona") {
    return this.request<RoleModel[]>(`/role-models?kind=${kind}`);
  }
  recommendRoleModels(goal: string, domains: string[] = [], excludedConstraints: string[] = []) {
    const query = new URLSearchParams({ goal });
    domains.forEach((item) => query.append("domains", item));
    excludedConstraints.forEach((item) => query.append("excluded_constraints", item));
    return this.request<Array<{ role_model_id: string; name: string; reason: string }>>(`/role-models/recommend?${query}`);
  }
  createPlanSession(input: { goal: string; intake?: Record<string, unknown>; import_ids?: string[]; trait_role_model_id?: string; persona_role_model_id?: string }) {
    return this.request<{ session_id: string; job_id: string }>("/plan-sessions", { method: "POST", body: input });
  }
  getPlanSession(sessionId: string) { return this.request<PlanSession>(`/plan-sessions/${sessionId}`); }
  submitAnswers(sessionId: string, answers: Array<{ question_id: string; choice?: string; custom?: string; skipped: boolean }>) {
    return this.request<{ session_id: string; job_id: string }>(`/plan-sessions/${sessionId}/answers`, { method: "POST", body: { answers } });
  }
  presignImport(file: File) {
    return this.request<{ import_id: string; upload_url: string; storage_key: string; expires_in: number }>("/imports/presign", {
      method: "POST",
      body: { filename: file.name, content_type: file.type || "application/octet-stream", size_bytes: file.size },
    });
  }
  async uploadImport(file: File) {
    const signed = await this.presignImport(file);
    const response = await fetch(signed.upload_url, { method: "PUT", body: file });
    if (!response.ok) throw new GuruApiError("File upload failed", response.status, "upload_failed");
    return this.request<ImportView>(`/imports/${signed.import_id}/complete`, { method: "POST" });
  }
  listImports() { return this.request<ImportView[]>("/imports"); }
  importGoogleCalendar(days = 30) {
    return this.request<ImportView>("/imports/google-calendar", { method: "POST", body: { days } });
  }
  listIntegrations() { return this.request<Integration[]>("/integrations"); }
  integrationAuthorize(provider: string) {
    return this.request<{ authorize_url: string }>(`/integrations/${provider}/authorize`);
  }
  completeIntegration(provider: string, code: string) {
    return this.request<Integration>(`/integrations/${provider}/callback`, { method: "POST", body: { code } });
  }
  disconnectIntegration(provider: string) {
    return this.request<void>(`/integrations/${provider}`, { method: "DELETE" });
  }
  requestExport(planId: string, target: "markdown" | "google_calendar", options: Record<string, unknown> = {}) {
    return this.request<ExportResult>(`/plans/${planId}/export`, { method: "POST", body: { target, options } });
  }
  listExports(planId: string) {
    return this.request<ExportStatus[]>(`/plans/${planId}/export`);
  }
  createRevision(planId: string, strategy: "postpone" | "reduce", note?: string) {
    return this.request<{ revision_id: string; job_id: string }>(`/plans/${planId}/revisions`, { method: "POST", body: { strategy, ...(note ? { note } : {}) } });
  }
  getRevision(planId: string, revisionId: string) {
    return this.request<Revision>(`/plans/${planId}/revisions/${revisionId}`);
  }
  decideRevision(planId: string, revisionId: string, decision: "accept" | "reject") {
    return this.request<Revision>(`/plans/${planId}/revisions/${revisionId}/${decision}`, { method: "POST" });
  }
}

export function localDate(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
