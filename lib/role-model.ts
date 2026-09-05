import type { CapabilityBreakdown, RoleModelDraft } from "./contracts";

/**
 * "I want <person>'s <capability>" decomposed into three cells.
 *
 * Why a named capability instead of an abstract life shape: a nameable
 * capability carries its own retest. "A deep specialist" has no hit rate;
 * "three-point percentage" does. Without a retest method a cumulative branch
 * is stuck at "effect unknown" forever, which is the one blocking unknown in
 * the whole specification.
 *
 * The mapping below is a hard-coded first version, exactly as the design says.
 * The production version replaces it with a model call; the shape of the
 * output — three cells plus a retest method — does not change.
 */

interface CapabilityPattern {
  keywords: string[];
  measurable: string;
  retestMethod: string;
  impliedShape: string;
  cost: string;
}

const PATTERNS: CapabilityPattern[] = [
  {
    keywords: ["三分", "命中", "投籃", "shooting"],
    measurable: "三分命中率",
    retestMethod: "每季末投 100 球記錄命中率，與上季並排比較",
    impliedShape: "深耕的專家",
    cost: "換軌成本高。深度越厚，橫向機會越難拿",
  },
  {
    keywords: ["講", "說明", "表達", "簡報", "口說", "溝通"],
    measurable: "把一個複雜決策講到外行聽懂所需的時間",
    retestMethod: "每季錄一段 3 分鐘同題說明，與上季錄音並排比較",
    impliedShape: "跨界的連結者",
    cost: "每個領域都不會是最深的那個，需要一直解釋自己在做什麼",
  },
  {
    keywords: ["兩週", "做出", "做成", "建造", "ship", "原型"],
    measurable: "從想法到可用原型的天數",
    retestMethod: "每季完成一個小而完整的東西，記錄起訖日期",
    impliedShape: "從零到一的建造者",
    cost: "很少東西做到成熟。履歷會看起來跳",
  },
  {
    keywords: ["寫", "文章", "產出", "發表"],
    measurable: "公開發表且有回應的篇數",
    retestMethod: "每季一篇公開文章，記錄篇數與具體回應",
    impliedShape: "跨界的連結者",
    cost: "寫作吃掉的是原本用來做東西的時間",
  },
];

export function decompose(draft: RoleModelDraft): CapabilityBreakdown {
  const text = draft.capability.trim();
  if (text.length === 0) {
    return { measurable: null, retestMethod: null, impliedShape: null, cost: null, tooAbstract: false };
  }

  const matched = PATTERNS.find((pattern) =>
    pattern.keywords.some((keyword) => text.toLowerCase().includes(keyword.toLowerCase())),
  );

  if (!matched) {
    // Say so rather than silently accepting a capability nobody can measure.
    return { measurable: null, retestMethod: null, impliedShape: null, cost: null, tooAbstract: true };
  }

  return {
    measurable: matched.measurable,
    retestMethod: matched.retestMethod,
    impliedShape: matched.impliedShape,
    cost: matched.cost,
    tooAbstract: false,
  };
}

/** Suggestions shown under the input. Mixing famous names with people the
 *  user actually knows is deliberate: a nearby person's cost is visible. */
export const CAPABILITY_EXAMPLES: RoleModelDraft[] = [
  { person: "Stephen Curry", capability: "三分球能力" },
  { person: "某位前輩", capability: "把複雜的事講得讓外行聽懂的能力" },
  { person: "某位同事", capability: "把一個想法在兩週內做成可用東西的能力" },
  { person: "某位作者", capability: "持續產出讓人讀完會想做點什麼的文章的能力" },
];
