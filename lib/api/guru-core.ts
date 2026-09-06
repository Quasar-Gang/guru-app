import type {
  DirectionRunView,
  ErrorResponse,
  HypothesisView,
  ImportView,
  IntegrationView,
  MeResponse,
  PlanDetail,
  PlanStatus,
  PlanSummary,
  ProfileView,
  QuestionView,
  QuotaView,
  ReconciliationView,
  RoleModelView,
  TaskView,
} from "./guru-core-types";

/**
 * The guru-core HTTP client.
 *
 * Server-side only. The bearer token is a server secret and must never be sent
 * to the browser, so the credentials come from `GURU_API_BASE_URL` and
 * `GURU_API_TOKEN` — no `NEXT_PUBLIC_` prefix — and every page that needs data
 * fetches it in its server component.
 *
 * Two backend conventions this class honours rather than hides:
 *
 * - **Ownership reads as absence.** Another user's resource is a 404, not a 403.
 *   `getOptional` therefore treats 404 as "nothing yet", which is a normal
 *   answer for a user who has not run the loop, not an error.
 * - **Long work returns 202 and is polled on the resource, not the job.** This
 *   client never polls; it reads whatever state exists right now and lets the
 *   caller decide what a `generating` plan should look like.
 */

export class GuruCoreError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GuruCoreError";
    this.status = status;
    this.code = code;
  }
}

/** How long a single backend call may take before the page gives up on it. */
const TIMEOUT_MS = 8_000;

export interface GuruCoreConfig {
  origin: string;
  token: string;
}

/** Reads the server-side configuration. Returns `null` when unconfigured. */
export function readConfig(): GuruCoreConfig | null {
  const origin = process.env.GURU_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";
  const token = process.env.GURU_API_TOKEN?.trim() ?? "";
  if (!/^https?:\/\//.test(origin) || token.length === 0) return null;
  return { origin, token };
}

export class GuruCoreClient {
  constructor(private readonly config: GuruCoreConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.origin}/v1${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.config.token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      // Every station reads live state; a cached ledger is a wrong ledger.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (response.status === 204) return undefined as T;

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as Partial<ErrorResponse>;
      throw new GuruCoreError(
        response.status,
        body.error?.code ?? "unknown_error",
        body.error?.message ?? response.statusText,
      );
    }

    return (await response.json()) as T;
  }

  /** A read whose absence is expected. 404 means "not there yet", not failure. */
  private async getOptional<T>(path: string): Promise<T | null> {
    try {
      return await this.request<T>(path);
    } catch (error) {
      if (error instanceof GuruCoreError && error.status === 404) return null;
      throw error;
    }
  }

  me(): Promise<MeResponse> {
    return this.request<MeResponse>("/me");
  }

  profile(): Promise<ProfileView | null> {
    return this.getOptional<ProfileView>("/profile");
  }

  imports(): Promise<ImportView[]> {
    return this.request<ImportView[]>("/imports");
  }

  integrations(): Promise<IntegrationView[]> {
    return this.request<IntegrationView[]>("/integrations");
  }

  questions(): Promise<QuestionView[]> {
    return this.request<QuestionView[]>("/questions");
  }

  quota(): Promise<QuotaView | null> {
    return this.getOptional<QuotaView>("/quota");
  }

  roleModels(): Promise<RoleModelView[]> {
    return this.request<RoleModelView[]>("/role-models");
  }

  /** The latest run. Absent until the user has asked for an analysis. */
  latestDirectionRun(): Promise<DirectionRunView | null> {
    return this.getOptional<DirectionRunView>("/direction/runs/latest");
  }

  /** Every version, oldest first. The last one is the direction in force. */
  hypotheses(): Promise<HypothesisView[]> {
    return this.request<HypothesisView[]>("/hypotheses");
  }

  plans(): Promise<PlanSummary[]> {
    return this.request<PlanSummary[]>("/plans");
  }

  plan(planId: string): Promise<PlanDetail | null> {
    return this.getOptional<PlanDetail>(`/plans/${encodeURIComponent(planId)}`);
  }

  tasks(planId: string, from?: string, to?: string): Promise<TaskView[]> {
    const query = new URLSearchParams();
    if (from) query.set("start_from", from);
    if (to) query.set("start_to", to);
    const suffix = query.size > 0 ? `?${query}` : "";
    return this.request<TaskView[]>(`/plans/${encodeURIComponent(planId)}/tasks${suffix}`);
  }

  reconciliation(reconciliationId: string): Promise<ReconciliationView | null> {
    return this.getOptional<ReconciliationView>(
      `/reconciliations/${encodeURIComponent(reconciliationId)}`,
    );
  }

  /**
   * Starts or archives a plan. A plan is never edited into something else —
   * wanting a different plan means wanting a different hypothesis.
   */
  setPlanStatus(planId: string, status: PlanStatus): Promise<PlanSummary> {
    return this.request<PlanSummary>(`/plans/${encodeURIComponent(planId)}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  }
}
