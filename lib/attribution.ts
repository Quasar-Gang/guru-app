import type { Attribution, Trace } from "./contracts";

/**
 * Attribution: traces in, branch bookings out.
 *
 * The rule table below is deliberately data, not logic scattered through the
 * views. A backend engineer opening this file should see the *rules*, not the
 * results — the first production version can ship this exact table before
 * swapping in semantic matching plus human review.
 *
 * Known simplification, stated on stage: a trace matching more than one branch
 * is booked to the primary branch and flagged `crossBranch`.
 */

export interface AttributionRule {
  /** Branch that wins when one of these keywords appears in the trace. */
  branchId: string;
  /** Lower number wins a tie. The primary branch of a cross-branch trace. */
  precedence: number;
  keywords: string[];
}

export const ATTRIBUTION_RULES: AttributionRule[] = [
  {
    branchId: "branch-career",
    precedence: 1,
    keywords: ["評審", "spec", "WorkPlus", "sprint", "站會", "產品會議", "review 會"],
  },
  {
    branchId: "branch-portfolio",
    precedence: 2,
    keywords: ["Figma", "作品集", "case study", "portfolio", "研究整理"],
  },
  {
    branchId: "branch-speaking",
    precedence: 3,
    keywords: ["口說", "shadowing", "English", "英文", "conversation"],
  },
  {
    branchId: "branch-fitness",
    precedence: 4,
    keywords: ["健身", "重訓", "深蹲", "gym", "1RM"],
  },
  {
    branchId: "branch-health",
    precedence: 5,
    keywords: ["睡眠", "體檢", "門診"],
  },
];

/** Booked nowhere. Real time, no owner — the most interesting outcome. */
export const UNATTRIBUTED_RULE = "no rule matched · invisible investment";

function match(trace: Trace): AttributionRule[] {
  const haystack = `${trace.title} ${trace.raw}`.toLowerCase();
  return ATTRIBUTION_RULES.filter((rule) =>
    rule.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())),
  ).sort((a, b) => a.precedence - b.precedence);
}

/** Books one trace. Returns a `null` branch when nothing matched. */
export function attribute(trace: Trace): Attribution {
  const hits = match(trace);
  if (hits.length === 0) {
    return { traceId: trace.id, branchId: null, rule: UNATTRIBUTED_RULE, crossBranch: false };
  }
  const winner = hits[0];
  return {
    traceId: trace.id,
    branchId: winner.branchId,
    rule: `keyword → ${winner.branchId}`,
    crossBranch: hits.length > 1,
  };
}

export function attributeAll(traces: Trace[]): Attribution[] {
  return traces.map(attribute);
}

/** Share of traces the rules could book without asking a human. */
export function autoAttributionRate(attributions: Attribution[]): number {
  if (attributions.length === 0) return 0;
  const booked = attributions.filter((entry) => entry.branchId !== null).length;
  return Math.round((booked / attributions.length) * 1000) / 10;
}
