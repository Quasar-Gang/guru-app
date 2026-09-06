"use client";

import { useState } from "react";
import { Colophon, StationShell } from "../StationShell";
import type { Branch, CoachingSnapshot } from "@/lib/contracts";
import { LOAD_CEILING } from "@/lib/scheduler";
import { PARKED } from "@/lib/mock/snapshot";

/**
 * Station 2 · goal tree draft.
 *
 * The coach drafts, the user signs off. Two layers are deliberately empty:
 * intake produces a one-year hypothesis and cannot reach vision or the
 * five-year path, so those rows read "not covered this period" instead of
 * pretending to be filled. The alternative paths stay on the page as a
 * standing control group — that is the only evidence form the second causal
 * layer can ever produce.
 */

const ENERGY_LABEL = { low: "低", mid: "中", high: "高" } as const;

export function PlanStation({
  snapshot,
  onAccept,
}: {
  snapshot: CoachingSnapshot;
  /** Persists the sign-off when a backend is configured. Optional by design. */
  onAccept?: () => Promise<{ ok: boolean; message: string | null }>;
}) {
  const { goalTree, challenges, horizon } = snapshot;
  const [paths, setPaths] = useState(goalTree.paths);
  const [scored, setScored] = useState(false);
  const [openBranch, setOpenBranch] = useState<string | null>(goalTree.branches[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [locked, setLocked] = useState(false);

  const unanswered = challenges.filter((item) => (answers[item.id] ?? "").trim().length === 0);
  const slotted = goalTree.branches.filter((branch) => branch.slot !== null);

  return (
    <StationShell current="/plan">
      <div className="mist-card mist-card--lg">
        <div className="mist-row mist-row--between">
          <p className="mist-label mist-subtle">教練起草 · 待你確認</p>
          <span className={`mist-badge ${locked ? "mist-badge--done" : "mist-badge--attention"}`}>
            {locked ? `已生效 · ${goalTree.version}` : "草案 · 尚未生效"}
          </span>
        </div>
        <h1 className="mist-h1">目標樹草案</h1>
        <p className="mist-body mist-muted">
          讀完既有痕跡與站 1 的一年期假設之後，教練把它拆成可判斷、可排程的層級。
          目標由你宣告，拆解由教練起草——你只需要確認、刪減，或回答三個它答不出來的問題。
        </p>

        <div className="mist-stats">
          <div className="mist-stat mist-stat--sm mist-stat--rule mist-stat--rule-mark">
            <span className="mist-stat__value">{snapshot.period.traceCount}</span>
            <span className="mist-stat__label">筆痕跡已讀入</span>
          </div>
          <div className="mist-stat mist-stat--sm mist-stat--rule">
            <span className="mist-stat__value">{snapshot.imports.filter((s) => s.status !== "absent").length}</span>
            <span className="mist-stat__label">類來源已連接</span>
          </div>
          <div className="mist-stat mist-stat--sm mist-stat--rule mist-stat--rule-accent">
            <span className="mist-stat__value">{unanswered.length}</span>
            <span className="mist-stat__label">項追問待答</span>
          </div>
          <div className="mist-stat mist-stat--sm mist-stat--rule">
            <span className="mist-stat__value">
              {slotted.length} / {horizon.slotCap}
            </span>
            <span className="mist-stat__label">推進名額</span>
          </div>
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">L1–L2 · 願景與五年 VISION</p>
        <h2 className="mist-h2">這兩層本期未涵蓋</h2>
        <p className="mist-body mist-muted">
          站 1 產得出一年期假設，產不出願景。
          <span className="mist-body-strong">它能借一年的東西，借不到願景與五年路徑。</span>
          所以這兩層留在樹上但是空的——留白比填一個借來的願景誠實。
        </p>
        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <div className="mist-row mist-row--between">
              <span className="mist-label mist-subtle">願景層</span>
              <span className="mist-badge mist-badge--idle">本期未涵蓋 · 由你自行宣告或留空</span>
            </div>
            <hr className="mist-divider" />
            <div className="mist-row mist-row--between">
              <span className="mist-label mist-subtle">五年層</span>
              <span className="mist-badge mist-badge--idle">本期未涵蓋 · 備選路徑改掛在一年層</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">L3 · 一年 PATHS</p>
        <h2 className="mist-h2">通往那個形狀的路，不只一條</h2>
        <p className="mist-body mist-muted">
          多數規劃練習只做一次：寫下幾條路，然後照第一條過日子。這裡把其餘幾條留成
          <span className="mist-body-strong">常設對照組</span>
          ，每季重新評分——正在走的越走越掙扎、某條備選持續上升，就是有資料支撐的換軌訊號。
        </p>

        <div className="mist-split--even mist-split">
          {paths.map((path) => (
            <div className="mist-inset" key={path.id}>
              <div className="mist-stack--sm mist-stack">
                <div className="mist-row mist-row--between">
                  <span className="mist-label mist-subtle">{path.title}</span>
                  <span className={`mist-badge ${path.live ? "mist-badge--active" : "mist-badge--idle"}`}>
                    {path.live ? "正在走" : "對照組"}
                  </span>
                </div>
                <p className="mist-body">{path.summary}</p>
                <div className="mist-row mist-row--between">
                  <label className="mist-label mist-subtle" htmlFor={`attract-${path.id}`}>
                    現時吸引力
                  </label>
                  <span className="mist-h3">{path.attractiveness}</span>
                </div>
                <input
                  id={`attract-${path.id}`}
                  type="range"
                  min={0}
                  max={10}
                  value={path.attractiveness}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setScored(true);
                    setPaths((previous) =>
                      previous.map((entry) =>
                        entry.id === path.id ? { ...entry, attractiveness: value } : entry,
                      ),
                    );
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <p className="mist-body mist-muted">
          {scored
            ? "評分已更新，將存為本期基準線。趨勢要到第二次季度對帳才有意義——屆時看的不是絕對分數，是正在走的那條有沒有持續下滑、備選有沒有持續上升。"
            : "冷啟動：本次評分只建立基準線，沒有趨勢可看。趨勢要到第二次季度對帳才有意義。"}
        </p>
      </div>

      <div className="mist-card mist-card--lg">
        <div className="mist-row mist-row--between">
          <p className="mist-label mist-subtle">L4 · 分支與名額 BRANCHES</p>
          <span className="mist-badge mist-badge--idle">
            {slotted.length} / {horizon.slotCap} · 累積型{" "}
            {slotted.filter((branch) => branch.slot === "cumulative").length} 常設 · 專案型{" "}
            {slotted.filter((branch) => branch.slot === "project").length} 輪替
          </span>
        </div>
        <h2 className="mist-h2">這一季推哪幾格</h2>
        <p className="mist-body mist-muted">
          顧此失彼的主因是名額超載——每季都碰所有分支，等於全部沒進展。累積型常設不輪替，專案型每季重選，總數硬上限{" "}
          {horizon.slotCap}。
          <span className="mist-body-strong">平衡不是每季平衡，是輪流深耕、跨季看起來平衡。</span>
        </p>

        <div className="mist-stack--sm mist-stack">
          {goalTree.branches.map((branch) => (
            <BranchRow
              key={branch.id}
              branch={branch}
              open={openBranch === branch.id}
              onToggle={() => setOpenBranch(openBranch === branch.id ? null : branch.id)}
            />
          ))}
        </div>

        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <p className="mist-label mist-subtle">本季未取得名額 · 刻意不推</p>
            {PARKED.map((item) => (
              <div className="mist-row mist-row--between" key={item.title}>
                <span className="mist-body">{item.title}</span>
                <span className="mist-caption mist-muted">{item.note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">L5 · 每週 WEEKLY</p>
        <h2 className="mist-h2">這一層你不用規劃</h2>
        <p className="mist-body mist-muted">
          每週的量不固定，由排程器依下週實際可用容量重新分配——固定量在忙的那週必定爆掉，在閒的那週又浪費空檔。
          你只做兩件事：<span className="mist-body-strong">刪掉排不下的</span>
          ，以及回答兩分鐘的週檢查。<span className="mist-body-strong">這一層沒有新增按鈕。</span>
        </p>
        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <SpecRow term="排程上限" detail={`可用時段 ${Math.round(LOAD_CEILING * 100)}%`} />
            <hr className="mist-divider" />
            <SpecRow term="冷啟動" detail="無樂觀係數 · 第一季刻意排少到很確定做得完" />
            <hr className="mist-divider" />
            <SpecRow term="能量規則" detail="高耗能不排在耗能事件隔天" />
            <hr className="mist-divider" />
            <SpecRow term="容量不足時" detail="累積型保底，專案型讓位" />
          </div>
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">Q · 追問 CHALLENGE</p>
        <h2 className="mist-h2">三個教練答不出來的問題</h2>
        <p className="mist-body mist-muted">
          拆解可以代勞，這三個不行——它們的答案只能來自你。教練的工作不是否決，是讓你聽見自己說的話。
        </p>

        <div className="mist-stack">
          {challenges.map((item) => {
            const answered = (answers[item.id] ?? "").trim().length > 0;
            return (
              <div className="mist-inset" key={item.id}>
                <div className="mist-stack--sm mist-stack">
                  <div className="mist-row mist-row--between">
                    <p className="mist-label mist-subtle">{item.id}</p>
                    <span className={`mist-badge ${answered ? "mist-badge--done" : "mist-badge--attention"}`}>
                      {answered ? "已回答" : "待答"}
                    </span>
                  </div>
                  <p className="mist-body-strong">{item.title}</p>
                  <p className="mist-body mist-muted">{item.body}</p>
                  <p className="mist-caption mist-subtle">{item.basis}</p>
                  <div className="mist-field">
                    <label className="mist-field__label" htmlFor={`chal-${item.id}`}>
                      說出來就好，教練負責結構化
                    </label>
                    <textarea
                      className="mist-field__input"
                      id={`chal-${item.id}`}
                      value={answers[item.id] ?? ""}
                      onChange={(event) =>
                        setAnswers((previous) => ({ ...previous, [item.id]: event.target.value }))
                      }
                    />
                  </div>
                  <p className="mist-caption mist-muted">
                    答案會連同時間與當時能量狀態存成下一個版本的變更理由。
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">簽核 SIGN-OFF</p>
        <h2 className="mist-h2">接受這份計畫</h2>
        <p className="mist-body mist-muted">
          接受之後，本季指標在季內鎖住——不是不能改，是只能在季界改。
          每週接觸系統就是每週有機會重新談判，所以這條界線寫在機制裡，不靠自制。
        </p>

        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <p className="mist-body">
              <span className="mist-body-strong">{slotted.length} 個推進分支</span>
              的四要素與本季指標生效
            </p>
            <p className="mist-body">
              <span className="mist-body-strong">
                {goalTree.branches.filter((branch) => branch.falsificationCondition).length} 個效果假設與反證條件
              </span>
              存檔，季末自動比對
            </p>
            <p className="mist-body">
              <span className="mist-body-strong">備選路徑吸引力</span>記為基準線
            </p>
            <p className="mist-body">
              本季指標<span className="mist-body-strong">鎖定至 {goalTree.lockedUntil}</span>，季內不接受變更
            </p>
            <p className="mist-body">
              退場條件：12 週內有 4 週未回應週檢查，
              <span className="mist-body-strong">自動降頻到月</span>
              ——視為設計不合，不是你的失敗
            </p>
          </div>
        </div>

        {locked ? (
          <div className="mist-inset">
            <div className="mist-stack--sm mist-stack">
              <span className="mist-badge mist-badge--done">
                已接受 · {goalTree.lockedAt} · 指標鎖定至 {goalTree.lockedUntil}
                {unanswered.length > 0 ? ` · ${unanswered.length} 項追問記入下次對帳議程` : ""}
              </span>
              <p className="mist-body mist-muted">
                下一次教練主動找你是本週的週檢查，約兩分鐘。下一次可以改目標是 {goalTree.lockedUntil}。
                目標永不覆寫，只增加版本——這份 {goalTree.version} 會一直留著，日後可以回頭問「那次改動事後看是對的嗎」。
              </p>
              <div className="mist-row">
                <a className="mist-btn mist-btn--primary" href="/ledger">
                  看季度對帳
                </a>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mist-row">
              <button type="button" className="mist-btn mist-btn--primary" onClick={() => {
                  setLocked(true);
                  void onAccept?.();
                }}>
                接受並鎖定本季
              </button>
              <button
                type="button"
                className="mist-btn mist-btn--ghost"
                onClick={() => {
                  const first = unanswered[0];
                  if (first) document.getElementById(`chal-${first.id}`)?.focus();
                }}
              >
                留著草案，我先回答追問
              </button>
            </div>
            <p className="mist-caption mist-muted">
              {unanswered.length === 0
                ? "三項追問都已回答。這份草案的推導基礎完整。"
                : `尚有 ${unanswered.length} 項追問未回答。可以直接接受，未答項會記入下次對帳議程。`}
            </p>
          </>
        )}
      </div>

      <Colophon
        lines={[
          "本頁為原型，資料為示範用途。目標永不覆寫，只增加版本；每次變更記錄時間、理由與當時的能量狀態。",
          "未收斂項：年度層要幾個分支與怎麼切、累積型第二個常設名額放什麼、歸戶規則對模糊與跨分支行動的處理、冷啟動折扣的預設值。頁面上以「未定」標記，不假裝已經解決。",
        ]}
      />
    </StationShell>
  );
}

function BranchRow({
  branch,
  open,
  onToggle,
}: {
  branch: Branch;
  open: boolean;
  onToggle: () => void;
}) {
  const missingFourElements = branch.unitAction === null;

  return (
    <div className="mist-inset">
      <div className="mist-stack--sm mist-stack">
        <div className="mist-row mist-row--between">
          <p className="mist-body-strong mist-grow">{branch.title}</p>
          <span
            className={`mist-badge ${
              branch.type === "cumulative"
                ? "mist-badge--active"
                : branch.type === "project"
                  ? "mist-badge--idle"
                  : "mist-badge--attention"
            }`}
          >
            {branch.type === "cumulative" ? "累積型" : branch.type === "project" ? "專案型" : "未分型"}
          </span>
          <button
            type="button"
            className="mist-btn mist-btn--ghost"
            onClick={onToggle}
            aria-expanded={open}
          >
            {open ? "收合" : "展開"}
          </button>
        </div>
        <p className="mist-caption mist-muted">{branch.slotRationale}</p>

        {open ? (
          <div className="mist-stack--sm mist-stack">
            {missingFourElements ? (
              <div className="mist-row">
                <span className="mist-badge mist-badge--attention">缺四要素 · 無法排程</span>
                <span className="mist-body mist-grow">
                  沒有單位動作、單次耗時、能量需求、最低週量這四項，排程器排不進去，對帳也判斷不了——
                  它只會永遠停在「效果未知」。
                </span>
              </div>
            ) : (
              <>
                <SpecRow term="單位動作" detail={branch.unitAction ?? "—"} />
                <hr className="mist-divider" />
                <SpecRow term="單次耗時" detail={`${branch.durationMin} 分`} />
                <hr className="mist-divider" />
                <SpecRow term="能量需求" detail={branch.energy ? ENERGY_LABEL[branch.energy] : "—"} />
                <hr className="mist-divider" />
                <SpecRow term="最低週量" detail={branch.minWeekly ? `${branch.minWeekly} 次` : "不適用"} />
              </>
            )}
            <hr className="mist-divider" />
            <SpecRow term="本季指標" detail={branch.quarterIndicator ?? "未定"} />
            <hr className="mist-divider" />
            <SpecRow term="進展怎麼測" detail={branch.retestMethod ?? "未定 · 沒有重測方式等於沒有可測性"} />
            <hr className="mist-divider" />
            <SpecRow
              term="基準線"
              detail={
                branch.baseline
                  ? `${branch.baseline.metric} ${branch.baseline.value}（${branch.baseline.takenAt}）`
                  : "無"
              }
            />
            <hr className="mist-divider" />
            <SpecRow term="既有錨點" detail={branch.anchor?.label ?? "無 · 錨點缺口"} />

            {branch.effectHypothesis ? (
              <div className="mist-stack--sm mist-stack">
                <hr className="mist-divider" />
                <p className="mist-label mist-subtle">效果假設 · 教練起草，待你確認</p>
                <p className="mist-body">{branch.effectHypothesis}</p>
                <p className="mist-label mist-subtle">反證條件</p>
                <p className="mist-body">{branch.falsificationCondition}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SpecRow({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="mist-row mist-row--between">
      <span className="mist-label mist-subtle">{term}</span>
      <span className="mist-body">{detail}</span>
    </div>
  );
}
