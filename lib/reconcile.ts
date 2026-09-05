import type { Attribution, Branch, Diagnosis, Finding, ReconcileResult, Trace } from "./contracts";

/**
 * The reconciliation engine and the four diagnostic criteria.
 *
 * Reconciliation is not planning. Goals are declared top down, actions are
 * observed bottom up, and this file is the ledger in between. It produces
 * four outcomes, each of which is itself a diagnosis:
 *
 *   active       branch has action
 *   dormant      branch has none — this is where imbalance shows up
 *   unattributed action fits no branch — invisible investment
 *   noEffect     action happened, retest did not move — attendance is not progress
 */

/** A cumulative branch with no baseline can never leave "effect unknown". */
function hasEffectSignal(branch: Branch): boolean {
  return branch.baseline !== null && branch.retests.length > 0;
}

function latestRetestMoved(branch: Branch): boolean {
  if (!hasEffectSignal(branch)) return false;
  const latest = branch.retests[branch.retests.length - 1];
  return latest.value !== branch.baseline?.value;
}

export interface ReconcileInput {
  branches: Branch[];
  traces: Trace[];
  attributions: Attribution[];
}

/** Runs one quarter's traces against the tree. */
export function reconcile({ branches, traces, attributions }: ReconcileInput): ReconcileResult[] {
  const byId = new Map(traces.map((trace) => [trace.id, trace]));

  return branches.map((branch) => {
    const booked = attributions.filter((entry) => entry.branchId === branch.id);
    const evidence = booked.map((entry) => entry.traceId);
    const minutes = booked.reduce((total, entry) => total + (byId.get(entry.traceId)?.durationMin ?? 0), 0);

    if (booked.length === 0) {
      return {
        branchId: branch.id,
        branchTitle: branch.title,
        type: branch.type,
        status: "dormant",
        actionCount: 0,
        actionLabel: "0",
        effectLabel: branch.baseline ? "無變化" : "無基準線",
        evidence,
        verdict: "零行動",
        anchorLabel: branch.anchor?.label ?? "缺口",
      };
    }

    // Attendance is green for both branches below. Only the retest separates them.
    const stalled = branch.type === "cumulative" && hasEffectSignal(branch) && !latestRetestMoved(branch);

    return {
      branchId: branch.id,
      branchTitle: branch.title,
      type: branch.type,
      status: stalled ? "noEffect" : "active",
      actionCount: booked.length,
      actionLabel: `${booked.length} 次 · ${Math.round(minutes / 6) / 10} 小時`,
      effectLabel: branch.baseline
        ? `${branch.baseline.value} → ${branch.retests[branch.retests.length - 1]?.value ?? "未測"}`
        : null,
      evidence,
      verdict: stalled ? "出席 ✓ ｜ 效果 ✗ · 原地踏步" : "有進展",
      anchorLabel: branch.anchor?.label ?? "缺口",
    };
  });
}

/** Traces that fit no branch, grouped into one row per source. */
export function invisibleInvestment(traces: Trace[], attributions: Attribution[]): ReconcileResult[] {
  const orphans = attributions.filter((entry) => entry.branchId === null);
  const byId = new Map(traces.map((trace) => [trace.id, trace]));
  const groups = new Map<string, Trace[]>();

  for (const orphan of orphans) {
    const trace = byId.get(orphan.traceId);
    if (!trace) continue;
    const bucket = groups.get(trace.raw) ?? [];
    bucket.push(trace);
    groups.set(trace.raw, bucket);
  }

  return [...groups.entries()].map(([label, group]) => {
    const minutes = group.reduce((total, trace) => total + trace.durationMin, 0);
    return {
      branchId: `unattributed:${label}`,
      branchTitle: label,
      type: "undefined",
      status: "unattributed",
      actionCount: group.length,
      actionLabel: `${group.length} 件 · ${Math.round(minutes / 6) / 10} 小時`,
      effectLabel: null,
      evidence: group.map((trace) => trace.id),
      verdict: "可能是未承認的新方向，也可能是純粹的浪費",
      anchorLabel: "—",
    };
  });
}

/**
 * The four criteria. `constraint` stays empty on purpose: telling
 * "not trying hard enough" apart from "energy is going elsewhere" needs
 * two to three quarters of history, and this is the first quarter.
 */
export function diagnose(branches: Branch[], results: ReconcileResult[]): Diagnosis {
  // Lagging compares completion against what the quarter milestone expects.
  // Standing still with a full attendance record is a separate signal; it
  // surfaces as the `noEffect` verdict in the ledger table.
  const lagging: Finding[] = branches
    .filter(
      (branch) =>
        branch.progressPercent !== null &&
        branch.milestonePercent !== null &&
        branch.progressPercent < branch.milestonePercent,
    )
    .map((branch) => ({
      id: `lag-${branch.id}`,
      branchId: branch.id,
      title: `落後：${branch.title}`,
      reason: `完成度 ${branch.progressPercent}%，本季里程碑要求 ${branch.milestonePercent}%。`,
      severity: "high" as const,
    }));

  const imbalanced: Finding[] = results
    .filter((result) => result.status === "dormant")
    .map((result) => ({
      id: `imb-${result.branchId}`,
      branchId: result.branchId,
      title: `失衡：${result.branchTitle} 本季零行動`,
      reason: "命中觸發條件「同一分支連續兩季零進展」，上層目標提前挑戰已排入議程。",
      severity: "high" as const,
    }));

  const invisible: Finding[] = results
    .filter((result) => result.status === "unattributed")
    .map((result) => ({
      id: `inv-${result.branchId}`,
      branchId: null,
      title: `隱形投入：${result.branchTitle}`,
      reason: `${result.actionLabel} 歸不進任何分支。純規劃式系統看不到這一項。`,
      severity: "mid" as const,
    }));

  // The only forward-looking criterion: it warns before the quarter is lost.
  const anchorGap: Finding[] = branches
    .filter((branch) => branch.anchor === null)
    .map((branch) => ({
      id: `anc-${branch.id}`,
      branchId: branch.id,
      title: `錨點缺口：${branch.title}`,
      reason: "無外部對象可綁。依錨點缺口判準，這是下一季最可能被拖的一格。",
      severity: "mid" as const,
    }));

  const constraint: Finding[] = [
    {
      id: "con-unavailable",
      branchId: null,
      title: "限制因素：資料不足",
      reason: "判斷「是不夠努力，還是能量被別處吸走」需要 2–3 季縱向資料。本季為第一季。",
      severity: "unavailable",
    },
  ];

  return { lagging, imbalanced, invisible, anchorGap, constraint };
}
