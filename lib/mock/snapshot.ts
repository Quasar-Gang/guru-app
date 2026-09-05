import {
  attributeAll,
  autoAttributionRate,
} from "../attribution";
import type {
  BaselineQuestion,
  Branch,
  Challenge,
  CoachingSnapshot,
  CrossCheck,
  GoalTree,
  ImportSource,
  Prescription,
  RoleModelDraft,
  ScheduleDraft,
  ShapeSuggestion,
  Trace,
  WeeklyCheckItem,
} from "../contracts";
import { horizonById } from "../horizon";
import { diagnose, invisibleInvestment, reconcile } from "../reconcile";

/**
 * The demonstration dataset.
 *
 * Fake data, true story. The value of the reconciliation engine is in the
 * booking result, not in how the data arrived, so the three stations share one
 * timeline rather than three plausible-looking ones:
 *
 *   2026-06-28  intake finished, goal tree drafted and locked
 *   2026-07-01  horizon opens, Q1 of four begins
 *   2026-09-04  quarterly reconciliation runs, 26 days before the boundary
 *   2026-09-30  quarter boundary — the only moment goals may change
 *
 * Every number rendered by station 3 is computed from `TRACES` by the real
 * engine. Nothing in the ledger is a typed-in result.
 */

export const INTAKE_DATE = "2026-06-28";
export const HORIZON_START = "2026-07-01";
export const LEDGER_AS_OF = "2026-09-04";
export const QUARTER_BOUNDARY = "2026-09-30";

export const HORIZON = horizonById(HORIZON_START, "1y");

/* ── Station 1 · imports ─────────────────────────────────────────── */

export const IMPORT_SOURCES: ImportSource[] = [
  {
    id: "calendar",
    priority: "P0",
    name: "Google 行事曆",
    provides: "時間流。行程 → 歸戶 → 對帳",
    withoutIt: "沒有對帳。這是唯一不可替代的來源",
    status: "connected",
    detail: "近 26 週 · 448 個行程",
  },
  {
    id: "notion",
    priority: "P1",
    name: "Notion",
    provides: "隱形投入與 side project 痕跡",
    withoutIt: "計畫外的投入看不見",
    status: "parsed",
    detail: "匯出檔 · 312 頁",
  },
  {
    id: "resume",
    priority: "P2",
    name: "履歷",
    provides: "軌跡與技能重複度",
    withoutIt: "反差比對少一半依據",
    status: "parsed",
    detail: "resume-2026.pdf · 2 頁",
  },
  {
    id: "health",
    priority: "P3",
    name: "Apple 健康",
    provides: "能量需求（四要素之一）的唯一來源",
    withoutIt: "排程器只能猜能量，不能算",
    status: "absent",
    detail: null,
  },
];

export const IMPORT_FORMATS = "xlsx · csv · markdown · html · pdf · docx";

/* ── Station 1 · baseline questions ──────────────────────────────── */

export const BASELINE_QUESTIONS: BaselineQuestion[] = [
  {
    id: "B-1",
    prompt: "你已經有想要的目標了嗎？",
    downstream: "寫得出來走快車道，寫不出來走 role model",
    placeholder: "講得出來就寫，講不出來就跳過——那才是常態。",
  },
  { id: "B-2", prompt: "年紀", downstream: "期間內的機會成本尺度", placeholder: "30" },
  { id: "B-3", prompt: "職業", downstream: "歸戶規則的關鍵字對照表基底", placeholder: "產品設計師" },
  { id: "B-4", prompt: "作息", downstream: "排程器的可用時段", placeholder: "平日 09:30–19:00，晚上通常有 2 小時" },
  { id: "B-5", prompt: "學經歷", downstream: "反差比對的軌跡依據", placeholder: "未匯履歷時的替代來源" },
  { id: "B-6", prompt: "一週可投入時間", downstream: "容量上限——排程器「只能刪」的那條線", placeholder: "6 小時" },
  { id: "B-7", prompt: "慣用的時間管理模式", downstream: "錨點處方的形式", placeholder: "番茄鐘 / 12 週工作法 / 沒有" },
];

/* ── Station 1 · role model and generated shapes ─────────────────── */

export const DEFAULT_ROLE_MODEL: RoleModelDraft = {
  person: "某位同事",
  capability: "把一個想法在兩週內做成可用東西的能力",
};

export const SHAPES: ShapeSuggestion[] = [
  {
    id: "S-1",
    name: "從零到一的建造者",
    lede: "一直在把不存在的東西做出來。",
    evidence: [
      { kind: "roleModel", text: "你講的能力是「兩週做成可用東西」，它的隱含形狀就是這一個" },
      { kind: "imported", text: "履歷有 design system 經驗，那是從零建立的東西，可以算半個" },
      { kind: "baselineAnswers", text: "一週可投入 6 小時，這個形狀的密度勉強可行，但要保留連續大塊時間" },
    ],
    yearLooksLike: "一年內從零做完 2 個小而完整的東西，其中 1 個給別人用過",
    accumulates: "從想法到可用原型的天數",
    cost: "很少東西做到成熟。履歷會看起來跳",
    fitLabel: "缺少關鍵痕跡",
    fitTone: "attention",
  },
  {
    id: "S-2",
    name: "深耕的專家",
    lede: "在一件事上做到很深，被同行認得。",
    evidence: [
      { kind: "imported", text: "同一領域 5 年 3 份工作，任期越來越長而非越來越短" },
      { kind: "imported", text: "履歷技能重複度高（Figma、使用者訪談、design system），深度確實在累積" },
      { kind: "baselineAnswers", text: "作息穩定、可投入時間固定，深耕需要的正是這種穩定" },
    ],
    yearLooksLike: "一年內把已完成的一個專案整理成可對外案例，並投一個公開場合",
    accumulates: "對外可見的作品件數",
    cost: "換軌成本高。深度越厚，橫向機會越難拿",
    fitLabel: "資料支持",
    fitTone: "done",
  },
  {
    id: "S-3",
    name: "跨界的連結者",
    lede: "站在兩三個領域之間，做別人做不到的翻譯。",
    evidence: [
      { kind: "imported", text: "週四讀書會連續 11 週未斷——你唯一的長連續行為，可能是第二個領域的種子" },
      { kind: "imported", text: "使用者訪談經驗天生跨在設計與研究之間" },
      { kind: "roleModel", text: "你講的能力偏「做出來」，跟這個形狀要的「講清楚」只有部分重疊" },
    ],
    yearLooksLike: "一年內寫 4 篇給本行同事看的文章，公開發表",
    accumulates: "公開發表且有回應的篇數",
    cost: "每個領域都不會是最深的那個，需要一直解釋自己在做什麼",
    fitLabel: "只有一個領域",
    fitTone: "active",
  },
];

export const CROSS_CHECKS: Record<string, CrossCheck> = {
  "S-1": {
    available: true,
    verdict: "你的資料裡幾乎找不到這個形狀。",
    narrative:
      "這不代表不能選，但它代表你選的是一個你還沒開始的方向。這種選擇要用測試驗證，不能直接排進一年計畫——先確認你喜歡的是「做新東西」本身，還是「做新東西」聽起來的樣子。",
    items: [
      { mark: "missing", text: "零筆 side project 痕跡。這個形狀最基本的行為證據不存在" },
      { mark: "missing", text: "週末幾乎空白——建造需要連續的大塊時間，你目前沒有在保留" },
      { mark: "supports", text: "履歷有 design system 經驗，那是從零建立的東西" },
      { mark: "supports", text: "近 3 個月 3 次獵頭面談，說明你在探路" },
      { mark: "missing", text: "62% 時間在工作會議。這個形狀要的是產出時間，不是協調時間" },
    ],
    test: "用兩週做完一個很小但完整的東西，做到能給別人用。不求好，只求做完。",
    cost: "兩週 · 每晚 1 小時 · 測的是你享不享受這個過程，不是成品",
  },
  "S-2": {
    available: true,
    verdict: "你的資料本來就長這個形狀。",
    narrative:
      "這是三張建議裡跟你行為最一致的一個。一致代表阻力小，也代表這可能是慣性而不是選擇。近三個月的三次獵頭面談是唯一的反向訊號。",
    items: [
      { mark: "supports", text: "同一領域 5 年 3 份工作，任期越來越長而非越來越短" },
      { mark: "supports", text: "履歷技能重複度高，深度確實在累積" },
      { mark: "supports", text: "週四讀書會連續 11 週未斷，是你唯一的長連續行為" },
      { mark: "missing", text: "作品的公開痕跡為零——「被同行認得」這半句沒有對應行為" },
      { mark: "missing", text: "3 次獵頭面談指向探路，跟深耕相反。兩件事同時在發生" },
    ],
    test: "把手上已經做完的一個專案整理成可對外的案例，投一個公開場合。",
    cost: "一季一次 · 約 3 個晚上 · 失敗只是沒被接受，不影響工作",
  },
  "S-3": {
    available: true,
    verdict: "你目前只有一個領域，這個形狀至少需要兩個。",
    narrative:
      "連續 11 週的讀書會是唯一指向「第二個領域」的訊號，這是你資料裡最有意思的一塊——它是你唯一沒斷過的長連續行為，卻完全不在你的履歷上。",
    items: [
      { mark: "supports", text: "讀書會連續 11 週未斷，可能就是第二個領域的種子" },
      { mark: "supports", text: "使用者訪談經驗天生跨在設計與研究之間" },
      { mark: "missing", text: "履歷只有一個領域。五年 3 份工作全部同類" },
      { mark: "missing", text: "零公開寫作或表達痕跡。這個形狀靠說得清楚吃飯" },
      { mark: "missing", text: "16% 未分類的時間可能藏著第二領域，也可能只是雜事" },
    ],
    test: "把讀書會裡學到的東西寫成一篇給本行同事看的文章，公開發表。",
    cost: "一季一篇 · 約 8 小時 · 測的是兩邊接不接得起來",
  },
};

/* ── Station 2 · goal tree ───────────────────────────────────────── */

const BRANCHES: Branch[] = [
  {
    id: "branch-speaking",
    layer: "quarter",
    title: "英文口說",
    parentId: "annual-language",
    type: "cumulative",
    unitAction: "shadowing 一次",
    durationMin: 15,
    energy: "low",
    minWeekly: 2,
    anchor: null,
    effectHypothesis: "每週一堂口說課加每週兩次 shadowing，一年內能在英語會議主持討論。",
    falsificationCondition: "連續兩季重測錄音無可辨差異，即視為此行動組合無效，該季強制重新設計行動。",
    baseline: { metric: "3 分鐘同題口說錄音", value: "基準線", takenAt: INTAKE_DATE },
    retests: [{ value: "基準線", takenAt: LEDGER_AS_OF }],
    quarterIndicator: "能在英語會議完整說明一個設計決策，錄音可辨。",
    retestMethod: "每季錄一段 3 分鐘同題口說，與上季並排比較。",
    slot: "cumulative",
    slotRationale: "累積型常設名額 1 / 2。不參與輪替，只在重測達標或決定放棄時釋出。",
    progressPercent: null,
    milestonePercent: null,
  },
  {
    id: "branch-fitness",
    layer: "quarter",
    title: "體能",
    parentId: "annual-body",
    type: "cumulative",
    unitAction: "健身房一次",
    durationMin: 60,
    energy: "mid",
    minWeekly: 2,
    anchor: { kind: "coachPact", label: "教練約定" },
    effectHypothesis: "每週兩次阻力訓練，12 週內 1RM 可提升 10–15%。",
    falsificationCondition: "連續兩季 1RM 零成長且週量達標，即視為方法問題而非投入問題。",
    baseline: { metric: "深蹲 1RM", value: "55 kg", takenAt: "2026-06-20" },
    retests: [{ value: "62 kg", takenAt: LEDGER_AS_OF }],
    quarterIndicator: "深蹲 1RM 由 55kg 提升至 62kg。",
    retestMethod: "季末測 1RM，同一動作、同一器材。",
    slot: "cumulative",
    slotRationale: "累積型常設名額 2 / 2。名額歸屬尚未收斂。",
    progressPercent: null,
    milestonePercent: null,
  },
  {
    id: "branch-portfolio",
    layer: "quarter",
    title: "HCI 作品集",
    parentId: "annual-portfolio",
    type: "project",
    unitAction: "一夜一案",
    durationMin: 180,
    energy: "high",
    minWeekly: 1,
    anchor: null,
    effectHypothesis: null,
    falsificationCondition: null,
    baseline: null,
    retests: [],
    quarterIndicator: "完成 2 個完整案例，含研究過程與決策依據，可對外。",
    retestMethod: "完成度。專案型的行動就是效果，做完就是做完。",
    slot: "project",
    slotRationale: "上半年零動作，且有外部對象可綁錨——輪替名額優先給這種分支。",
    progressPercent: 15,
    milestonePercent: 60,
  },
  {
    id: "branch-career",
    layer: "quarter",
    title: "職涯｜0-to-1 主導",
    parentId: "annual-career",
    type: "project",
    unitAction: "工作內既有結構",
    durationMin: 90,
    energy: "high",
    minWeekly: null,
    anchor: { kind: "deadline", label: "真實 deadline" },
    effectHypothesis: null,
    falsificationCondition: null,
    baseline: null,
    retests: [],
    quarterIndicator: "現行專案通過內部評審並進入實作。",
    retestMethod: "完成度。",
    slot: null,
    slotRationale: "不佔名額。工作已有 deadline 與等你交東西的人，名額要留給沒有外部承諾的分支。",
    progressPercent: 78,
    milestonePercent: 65,
  },
  {
    id: "branch-health",
    layer: "quarter",
    title: "健康",
    parentId: "annual-body",
    type: "undefined",
    unitAction: null,
    durationMin: null,
    energy: null,
    minWeekly: null,
    anchor: null,
    effectHypothesis: null,
    falsificationCondition: null,
    baseline: null,
    retests: [],
    quarterIndicator: null,
    retestMethod: null,
    slot: null,
    slotRationale: "缺四要素，排程器排不進去，對帳也判斷不了。本季只補定義不排量。",
    progressPercent: null,
    milestonePercent: null,
  },
];

export const GOAL_TREE: GoalTree = {
  version: "v1",
  vision: null,
  visionDeclaredAt: null,
  paths: [
    {
      id: "path-a",
      title: "在現職累積 0-to-1 主導經驗",
      summary: "一年內主導 1 個 0-to-1 專案，並整理成可對外的案例。",
      attractiveness: 8,
      live: true,
    },
    {
      id: "path-b",
      title: "轉向 HCI 研究與產品策略",
      summary: "一年內完成 1 個可對外的研究型專案。",
      attractiveness: 6,
      live: false,
    },
    {
      id: "path-c",
      title: "獨立接案加上自有產品",
      summary: "一年內接案收入覆蓋三成生活成本。",
      attractiveness: 4,
      live: false,
    },
  ],
  branches: BRANCHES,
  lockedAt: INTAKE_DATE,
  lockedUntil: QUARTER_BOUNDARY,
  changeLog: [
    { at: INTAKE_DATE, reason: "由站 1 的一年期假設 v0 展開", energyAtTime: "mid", version: "v1" },
  ],
};

export const PARKED = [
  { title: "接案作品集", note: "金錢流健康，不需要短期現金 · 下季優先考慮" },
  { title: "關係", note: "願景層本期未涵蓋 · 待 Q-1 回答後決定要不要建分支" },
  { title: "健康", note: "缺四要素，本季只補定義不排量" },
];

export const CHALLENGES: Challenge[] = [
  {
    id: "Q-1",
    title: "願景層與五年層本期未涵蓋，你要自己補嗎。",
    body: "站 1 只產得出一年期假設——它借得到一年的東西，借不到願景。這兩層留在樹上但是空的。你可以自己宣告，也可以先留白，等第一次對帳之後再談。",
    basis: "依據：站 1 產出為一年期假設 v0 · 上兩層無上游來源",
  },
  {
    id: "Q-2",
    title: "「健康」有分支，但沒有任何可以做的動作。",
    body: "痕跡裡找不到它——沒有相關行程、沒有相關筆記。它是你真的想要的目標，還是你覺得應該要有的目標？兩者都可以，但答案決定它要不要留在樹上。",
    basis: "依據：對帳期間該分支歸戶行動 0 筆",
  },
  {
    id: "Q-3",
    title: "有一筆投入不屬於任何一條路徑。",
    body: "這一季你有 12 件行程花在跟 A 公司的往來，歸不進 A、B、C 任何一條。它可能是尚未承認的第四條路，也可能是純粹的浪費——但它不該是隱形的。",
    basis: "依據：行事曆歸戶失敗 · 純規劃式系統看不到這一項",
  },
];

/* ── Station 3 · traces ──────────────────────────────────────────── */

function series(
  prefix: string,
  count: number,
  build: (index: number) => Omit<Trace, "id">,
): Trace[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index + 1}`, ...build(index) }));
}

/** Day offset from 2026-07-01, in ISO form. */
function day(offset: number): string {
  const date = new Date(`${HORIZON_START}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export const TRACES: Trace[] = [
  ...series("work", 142, (index) => ({
    source: "work",
    ts: day(Math.floor(index * 0.46)),
    title: index % 3 === 0 ? "產品會議" : index % 3 === 1 ? "spec 修訂" : "WorkPlus issue",
    durationMin: index % 3 === 0 ? 60 : 45,
    raw: "職涯｜0-to-1 主導",
  })),
  ...series("folio", 3, (index) => ({
    source: "work",
    ts: day(6 + index * 5),
    title: "Figma 檔案修改",
    durationMin: 180,
    raw: "HCI 作品集",
  })),
  ...series("shadow", 11, (index) => ({
    source: "calendar",
    ts: day(3 + index * 6),
    title: "shadowing",
    durationMin: 15,
    raw: "英文口說",
  })),
  ...series("class", 12, (index) => ({
    source: "calendar",
    ts: day(2 + index * 7),
    title: "口說課",
    durationMin: 60,
    raw: "英文口說",
  })),
  ...series("gym", 9, (index) => ({
    source: "calendar",
    ts: day(5 + index * 7),
    title: "健身房 · 深蹲",
    durationMin: 60,
    raw: "體能",
  })),
  ...series("acorp", 12, (index) => ({
    source: "calendar",
    ts: day(9 + index * 5),
    title: "與 A 公司窗口碰面",
    durationMin: 93,
    raw: "A 公司相關往來",
  })),
  ...series("course", 3, (index) => ({
    source: "notion",
    ts: day(12 + index * 14),
    title: "線上課程購買紀錄",
    durationMin: 0,
    raw: "線上課程購買 · 3 筆，其中 2 門零開課紀錄",
  })),
];

export const ATTRIBUTIONS = attributeAll(TRACES);

const BRANCH_RESULTS = reconcile({ branches: BRANCHES, traces: TRACES, attributions: ATTRIBUTIONS });
const ORPHAN_RESULTS = invisibleInvestment(TRACES, ATTRIBUTIONS);
export const RESULTS = [...BRANCH_RESULTS, ...ORPHAN_RESULTS];
export const DIAGNOSIS = diagnose(BRANCHES, RESULTS);

export const PRESCRIPTIONS: Prescription[] = [
  {
    branchId: "branch-portfolio",
    branchTitle: "HCI 作品集",
    tone: "attention",
    label: "錨點缺口 · 優先",
    body: "約兩位 reviewer，訂 11/15 交件日並先寄出邀約。錨點成立後不得自行往後拉。",
    cost: "一次性動作 · 約 40 分鐘 · 之後自動運轉",
  },
  {
    branchId: "branch-health",
    branchTitle: "健康",
    tone: "active",
    label: "先定義，再裝錨",
    body: "目標樹上沒有單位動作與基準線，因此無法排程也無法判斷。本季先產出四要素草稿由你刪減，不排任何量。",
    cost: "一次性動作 · 教練起草 · 你確認",
  },
  {
    branchId: "branch-speaking",
    branchTitle: "英文口說",
    tone: "idle",
    label: "弱錨",
    body: "無外部對象可綁，只能退回較弱形式：下次對帳時被拿出來問，並針對「量不夠 / 方法錯 / 目標不需要這個行動」三者做一次判定。",
    cost: "記入下次對帳議程",
  },
];

export const WEEKLY_CHECK: WeeklyCheckItem[] = [
  { id: "w-1", prompt: "我看到你 Figma 動了 3 次，最後一次是 8/29，對嗎", highlight: "Figma 動了 3 次", answer: "yes" },
  { id: "w-2", prompt: "你上了 1 堂口說課，shadowing 沒有紀錄，對嗎", highlight: "1 堂口說課", answer: "yes" },
  { id: "w-3", prompt: "作品集本週零動作，對嗎", highlight: "作品集本週零動作", answer: "yes" },
  { id: "w-4", prompt: "週三晚上那 2.5 小時空檔歸不進任何分支，對嗎", highlight: "2.5 小時空檔", answer: "no" },
];

export const SCHEDULE: ScheduleDraft = {
  capacityHours: 8,
  optimismCoefficient: null,
  minWeekly: [{ branchId: "branch-speaking", title: "shadowing", unit: " 每週 2 次", required: 2 }],
  slots: [
    { id: "s-1", day: "週一", branchId: "branch-speaking", title: "shadowing", note: "掛在通勤後 · 累積型保底", durationMin: 15, energy: "low", fixed: false, removed: false },
    { id: "s-2", day: "週三", branchId: "branch-speaking", title: "口說課", note: "既有強錨 · 不可刪", durationMin: 60, energy: "mid", fixed: true, removed: false },
    { id: "s-3", day: "週三", branchId: "branch-speaking", title: "shadowing", note: "掛在口說課之後", durationMin: 15, energy: "low", fixed: false, removed: false },
    { id: "s-4", day: "週四", branchId: "branch-portfolio", title: "HCI 作品集", note: "reviewer 邀約已寄出", durationMin: 180, energy: "high", fixed: false, removed: false },
    { id: "s-5", day: "週六", branchId: "branch-fitness", title: "健身房", note: "週日全天聚會 · 不排隔天", durationMin: 60, energy: "mid", fixed: false, removed: false },
  ],
};

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export const SNAPSHOT: CoachingSnapshot = {
  horizon: HORIZON,
  imports: IMPORT_SOURCES,
  baselineQuestions: BASELINE_QUESTIONS,
  roleModel: DEFAULT_ROLE_MODEL,
  shapes: SHAPES,
  crossChecks: CROSS_CHECKS,
  goalTree: GOAL_TREE,
  challenges: CHALLENGES,
  period: {
    label: "第 1 季 / 一年期",
    start: HORIZON_START,
    end: LEDGER_AS_OF,
    traceCount: TRACES.length,
    autoAttributionRate: autoAttributionRate(ATTRIBUTIONS),
    slotsUsed: BRANCHES.filter((branch) => branch.slot !== null).length,
    slotCap: HORIZON.slotCap,
    daysToQuarterBoundary: daysBetween(LEDGER_AS_OF, QUARTER_BOUNDARY),
  },
  traces: TRACES,
  results: RESULTS,
  diagnosis: DIAGNOSIS,
  prescriptions: PRESCRIPTIONS,
  weeklyCheck: WEEKLY_CHECK,
  schedule: SCHEDULE,
};
