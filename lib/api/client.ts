import type {
  CapabilityBreakdown,
  CoachingSnapshot,
  CrossCheck,
  Hypothesis,
  RoleModelDraft,
  ShapeSuggestion,
} from "../contracts";
import { SNAPSHOT } from "../mock/snapshot";
import { decompose } from "../role-model";

/**
 * The `guru-core` client.
 *
 * The backend does not exist yet, so every method has a local fallback that
 * returns the demonstration snapshot. That is not a stub for its own sake: the
 * fallback and the remote call return the same shapes, so the mock data *is*
 * the contract the backend has to satisfy. See `docs/API.md`.
 *
 * Set `NEXT_PUBLIC_API_BASE_URL` to point at a real origin. Without it the app
 * runs entirely offline, which is what the demo needs.
 */

export class GuruApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "GuruApiError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export class GuruApiClient {
  private readonly origin: string | null;

  constructor(origin: string | null | undefined) {
    const trimmed = origin?.trim().replace(/\/+$/, "") ?? "";
    // Only an absolute origin counts. A relative path cannot be fetched during
    // server rendering, and silently falling back to the fixture is the wrong
    // failure: it would look like the backend answered.
    this.origin = /^https?:\/\//.test(trimmed) ? trimmed : null;
  }

  get isRemote(): boolean {
    return this.origin !== null;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.origin}/v1${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });

    if (response.status === 204) return undefined as T;

    if (!response.ok) {
      const envelope = (await response.json().catch(() => ({}))) as ErrorEnvelope;
      throw new GuruApiError(
        response.status,
        envelope.error?.code ?? "unknown_error",
        envelope.error?.message ?? response.statusText,
      );
    }

    return (await response.json()) as T;
  }

  /** `GET /v1/snapshot` — everything the three stations render. */
  async getSnapshot(): Promise<CoachingSnapshot> {
    if (!this.isRemote) return SNAPSHOT;
    return this.request<CoachingSnapshot>("/snapshot");
  }

  /** `POST /v1/role-model:decompose` — capability into three cells. */
  async decomposeRoleModel(draft: RoleModelDraft): Promise<CapabilityBreakdown> {
    if (!this.isRemote) return decompose(draft);
    return this.request<CapabilityBreakdown>("/role-model:decompose", {
      method: "POST",
      body: JSON.stringify(draft),
    });
  }

  /** `POST /v1/shapes` — generated suggestions, each with its evidence lines. */
  async generateShapes(draft: RoleModelDraft): Promise<ShapeSuggestion[]> {
    if (!this.isRemote) return SNAPSHOT.shapes;
    return this.request<ShapeSuggestion[]>("/shapes", {
      method: "POST",
      body: JSON.stringify(draft),
    });
  }

  /** `GET /v1/shapes/{id}/cross-check` — traces against the chosen shape. */
  async getCrossCheck(shapeId: string): Promise<CrossCheck> {
    if (!this.isRemote) return SNAPSHOT.crossChecks[shapeId];
    return this.request<CrossCheck>(`/shapes/${encodeURIComponent(shapeId)}/cross-check`);
  }

  /** `POST /v1/hypotheses` — freezes station 1's output as v0. */
  async createHypothesis(body: {
    shapeId: string;
    horizonId: string;
    roleModel: RoleModelDraft;
  }): Promise<Hypothesis> {
    if (!this.isRemote) {
      const shape = SNAPSHOT.shapes.find((entry) => entry.id === body.shapeId) ?? SNAPSHOT.shapes[0];
      const breakdown = decompose(body.roleModel);
      return {
        version: "v0",
        statement: shape.lede,
        horizon: SNAPSHOT.horizon,
        measurableCapability: breakdown.measurable,
        baselineState: breakdown.retestMethod ?? "待建立 · 建議於第一週完成首測",
        retestSchedule: SNAPSHOT.horizon.quarters.map((quarter) => quarter.end),
        falsificationDraft: "（雛形，站 2 簽定）",
        sourceSummary: `${shape.id} ${shape.name} · role model ＋ 你的資料`,
        createdAt: SNAPSHOT.goalTree.lockedAt ?? SNAPSHOT.horizon.start,
      };
    }
    return this.request<Hypothesis>("/hypotheses", { method: "POST", body: JSON.stringify(body) });
  }

  /** `POST /v1/goal-tree:lock` — the quarter gate closes here. */
  async lockGoalTree(unansweredChallengeIds: string[]): Promise<{ lockedAt: string; lockedUntil: string }> {
    if (!this.isRemote) {
      return {
        lockedAt: SNAPSHOT.goalTree.lockedAt ?? SNAPSHOT.horizon.start,
        lockedUntil: SNAPSHOT.goalTree.lockedUntil ?? SNAPSHOT.horizon.quarters[0].end,
      };
    }
    return this.request("/goal-tree:lock", {
      method: "POST",
      body: JSON.stringify({ unansweredChallengeIds }),
    });
  }
}

export function createClient(): GuruApiClient {
  return new GuruApiClient(process.env.NEXT_PUBLIC_API_BASE_URL);
}
