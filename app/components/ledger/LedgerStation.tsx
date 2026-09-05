"use client";

import { useMemo, useState } from "react";
import { Colophon, StationShell } from "../StationShell";
import type {
  CoachingSnapshot,
  DispatchInput,
  Energy,
  Finding,
  ReconcileResult,
} from "@/lib/contracts";
import { ATTRIBUTION_RULES } from "@/lib/attribution";
import { dispatch } from "@/lib/dispatch";
import { LOAD_CEILING, summarize, toggleSlot } from "@/lib/scheduler";

/**
 * Station 3 · quarterly reconciliation.
 *
 * A report, so it is a table: flat and comparable, unlike station 1's cards or
 * station 2's outline. Every number below is computed by the engine from the
 * trace set — nothing here is a typed-in result.
 */

const STATUS_TONE: Record<ReconcileResult["status"], string> = {
  active: "mist-badge--done",
  dormant: "mist-badge--attention",
  unattributed: "mist-badge--active",
  noEffect: "mist-badge--attention",
};

const GROUPS: { status: ReconcileResult["status"]; label: string }[] = [
  { status: "active", label: "有行動 · 進展" },
  { status: "noEffect", label: "有行動、但重測沒動 · 所有追蹤工具都會給綠燈的那一格" },
  { status: "dormant", label: "長期零行動 · 失衡" },
  { status: "unattributed", label: "歸不進任何分支 · 隱形投入" },
];

export function LedgerStation({ snapshot }: { snapshot: CoachingSnapshot }) {
  const { period, results, diagnosis, prescriptions, goalTree } = snapshot;

  const [input, setInput] = useState<DispatchInput>({ hours: 2, energy: "mid", cash: "ok" });
  const answer = useMemo(() => dispatch(input), [input]);

  const [checks, setChecks] = useState(snapshot.weeklyCheck);
  const [schedule, setSchedule] = useState(snapshot.schedule);
  const summary = useMemo(() => summarize(schedule), [schedule]);

  const speaking = goalTree.branches.find((branch) => branch.effectHypothesis !== null);

  return (
    <StationShell current="/ledger">
      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">體測報告 · {period.label}</p>
        <h1 className="mist-h1">季度對帳</h1>
        <p className="mist-body mist-muted">
          教練把這一季的痕跡歸戶到目標樹各分支之下，算出進展、空白與歸不進去的投入，據此開下一季處方。
          <span className="mist-body-strong">你本季沒有做任何紀錄。</span>
        </p>

        <div className="mist-stats">
          <div className="mist-stat mist-stat--sm mist-stat--rule mist-stat--rule-mark">
            <span className="mist-stat__value">{period.traceCount}</span>
            <span className="mist-stat__label">筆痕跡</span>
          </div>
          <div className="mist-stat mist-stat--sm mist-stat--rule">
            <span className="mist-stat__value">{period.autoAttributionRate}%</span>
            <span className="mist-stat__label">自動歸戶率</span>
          </div>
          <div className="mist-stat mist-stat--sm mist-stat--rule">
            <span className="mist-stat__value">
              {period.slotsUsed} / {period.slotCap}
            </span>
            <span className="mist-stat__label">推進名額</span>
          </div>
          <div className="mist-stat mist-stat--sm mist-stat--rule mist-stat--rule-accent">
            <span className="mist-stat__value">{period.daysToQuarterBoundary}</span>
            <span className="mist-stat__label">天後到季界</span>
          </div>
        </div>
        <p className="mist-caption mist-muted">
          對帳期間 {period.start} – {period.end}。樂觀係數：冷啟動，尚未累積。
        </p>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">01 · 對帳 RECONCILE</p>
        <h2 className="mist-h2">行動歸戶結果</h2>
        <p className="mist-body mist-muted">
          累積型看能力重測，專案型看完成度。
          <span className="mist-body-strong">出席率不計入進展。</span>
        </p>

        <div className="mist-scroll">
          <table className="mist-table">
            <thead>
              <tr>
                <th>分支</th>
                <th>型別</th>
                <th>本季行動</th>
                <th>效果重測</th>
                <th>錨點</th>
                <th>判定</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((group) => {
                const rows = results.filter((result) => result.status === group.status);
                if (rows.length === 0) return null;
                return (
                  <ResultGroup key={group.status} label={group.label} rows={rows} tone={STATUS_TONE[group.status]} />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <p className="mist-label mist-subtle">歸戶假設 · 這一版寫死，並且攤在你眼前</p>
            <p className="mist-body">
              關鍵字 ＋ 分支對照表，跨分支者歸主分支並標記。規則本身就是下面這張表，不是散在畫面裡的數字。
            </p>
            {ATTRIBUTION_RULES.map((rule) => (
              <div className="mist-row mist-row--between" key={rule.branchId}>
                <span className="mist-label mist-subtle">{rule.branchId}</span>
                <span className="mist-caption mist-muted">{rule.keywords.join("、")}</span>
              </div>
            ))}
            <hr className="mist-divider" />
            <p className="mist-caption mist-muted">
              已知盲區：不花錢又不進系統的活動無痕——睡眠、自主訓練、獨處。這些只在對帳問答中重建。
            </p>
          </div>
        </div>

        {speaking ? (
          <div className="mist-inset">
            <div className="mist-stack--sm mist-stack">
              <p className="mist-label mist-subtle">效果假設 · {speaking.title}</p>
              <p className="mist-body">{speaking.effectHypothesis}</p>
              <p className="mist-label mist-subtle">反證條件（你自訂）</p>
              <p className="mist-body">{speaking.falsificationCondition}</p>
              <hr className="mist-divider" />
              <p className="mist-body">
                <span className="mist-body-strong">基準線與本季重測無可辨差異 · 已達成反證條件 1 / 2。</span>
                系統不判斷「行動該不該做」，只回報假設是否還站得住。
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">02 · 診斷 DIAGNOSE</p>
        <h2 className="mist-h2">本季四項判準</h2>
        <p className="mist-body mist-muted">
          前三項回溯，第四項前瞻——
          <span className="mist-body-strong">錨點缺口是唯一能在事情發生前給出警告的判準。</span>
        </p>

        <div className="mist-stack--sm mist-stack">
          <FindingGroup title="落後" findings={diagnosis.lagging} />
          <FindingGroup title="失衡" findings={diagnosis.imbalanced} />
          <FindingGroup title="隱形投入" findings={diagnosis.invisible} />
          <FindingGroup title="錨點缺口" findings={diagnosis.anchorGap} />
          <FindingGroup title="限制因素" findings={diagnosis.constraint} />
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">03 · 處方 PRESCRIBE</p>
        <h2 className="mist-h2">下一季：裝錨，不加油</h2>
        <p className="mist-body mist-muted">
          處方的形式是一次性動作，做完就自動運轉。
          <span className="mist-body-strong">本季只為兩個分支裝錨</span>
          ——同時綁太多會全部壓在一起，反而全數失效。提醒每次都要重新消耗一次意志力，錨點只消耗一次。
        </p>

        <div className="mist-stack--sm mist-stack">
          {prescriptions.map((item) => (
            <div className="mist-inset" key={item.branchId}>
              <div className="mist-stack--sm mist-stack">
                <div className="mist-row mist-row--between">
                  <p className="mist-body-strong">{item.branchTitle}</p>
                  <span className={`mist-badge mist-badge--${item.tone}`}>{item.label}</span>
                </div>
                <p className="mist-body">{item.body}</p>
                <p className="mist-caption mist-subtle">{item.cost}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">04 · 調度 DISPATCH</p>
        <h2 className="mist-h2">空檔調度</h2>
        <p className="mist-body mist-muted">
          你發起，零紀錄要求。判斷依據是時間流與金錢流，不是感覺——所以它可以被算出來。
        </p>

        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <Segmented
              label="可用時數"
              options={[
                { value: "0.5", text: "30 分" },
                { value: "2", text: "2 小時" },
                { value: "4", text: "4 小時" },
              ]}
              current={String(input.hours)}
              onSelect={(value) => setInput((previous) => ({ ...previous, hours: Number(value) }))}
            />
            <Segmented
              label="能量狀態"
              options={[
                { value: "low", text: "低" },
                { value: "mid", text: "中" },
                { value: "high", text: "高" },
              ]}
              current={input.energy}
              onSelect={(value) => setInput((previous) => ({ ...previous, energy: value as Energy }))}
            />
            <Segmented
              label="金錢流（你申報）"
              options={[
                { value: "ok", text: "健康" },
                { value: "tight", text: "緊" },
              ]}
              current={input.cash}
              onSelect={(value) =>
                setInput((previous) => ({ ...previous, cash: value === "tight" ? "tight" : "ok" }))
              }
            />
            <p className="mist-caption mist-subtle">
              本期未匯入帳單，金錢流沒有自動來源，所以這一軸是你申報的，不是算出來的。
            </p>
          </div>
        </div>

        <div className="mist-inset" aria-live="polite">
          <div className="mist-stack--sm mist-stack">
            <p className="mist-label mist-subtle">建議</p>
            <h3 className="mist-h3">{answer.pick}</h3>
            <p className="mist-caption mist-muted">{answer.unit}</p>
            {answer.why.map((line) => (
              <p className="mist-body" key={line}>
                → {line}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">05 · 週檢查 VERIFY</p>
        <h2 className="mist-h2">本週校對</h2>
        <p className="mist-body mist-muted">
          不問「這週做了什麼」，那是紀錄。教練拿痕跡問，你只確認或補一句——成本約兩分鐘。
        </p>

        <div className="mist-stack--sm mist-stack">
          {checks.map((item) => (
            <div className="mist-inset" key={item.id}>
              <div className="mist-row mist-row--between">
                <p className="mist-body mist-grow">{item.prompt}</p>
                <Segmented
                  label=""
                  options={[
                    { value: "yes", text: "對" },
                    { value: "no", text: "不對" },
                  ]}
                  current={item.answer ?? ""}
                  onSelect={(value) =>
                    setChecks((previous) =>
                      previous.map((entry) =>
                        entry.id === item.id ? { ...entry, answer: value === "yes" ? "yes" : "no" } : entry,
                      ),
                    )
                  }
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mist-inset">
          <div className="mist-row mist-row--between">
            <p className="mist-body mist-grow">
              週檢查只問執行。本季指標在季內鎖住——每週接觸系統就是每週有機會重新談判，所以這條界線寫在機制裡，不靠自制。
            </p>
            <button className="mist-btn mist-btn--secondary" type="button" disabled aria-disabled="true">
              修改目標 · 季界開放 · 剩 {period.daysToQuarterBoundary} 天
            </button>
          </div>
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">06 · 排程 SCHEDULE</p>
        <h2 className="mist-h2">下週草案 · 只能刪</h2>
        <p className="mist-body mist-muted">
          依下週行事曆算出可用時段後排 {Math.round(LOAD_CEILING * 100)}%，不排滿——空檔隨機出現，排滿則空檔無意義。
          冷啟動無樂觀係數，本季刻意排少到很確定做得完。
        </p>

        <div className="mist-stack--sm mist-stack">
          {schedule.slots.map((slot) => (
            <div className={`mist-inset${slot.removed ? " is-removed" : ""}`} key={slot.id}>
              <div className="mist-row mist-row--between">
                <div className="mist-stack--sm mist-stack mist-grow">
                  <p className="mist-body-strong">
                    {slot.day} · {slot.title}
                  </p>
                  <p className="mist-caption mist-muted">
                    {slot.note} · {slot.durationMin} 分 · {slot.energy === "low" ? "低" : slot.energy === "mid" ? "中" : "高"}耗能
                  </p>
                </div>
                <button
                  type="button"
                  className="mist-btn mist-btn--ghost"
                  disabled={slot.fixed}
                  aria-disabled={slot.fixed}
                  onClick={() => setSchedule((previous) => toggleSlot(previous, slot.id))}
                >
                  {slot.fixed ? "既有強錨 · 不可刪" : slot.removed ? "復原" : "刪除"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <div className="mist-row mist-row--between">
              <span className="mist-label mist-subtle">已排 / 可用</span>
              <span className="mist-body">
                {summary.loadHours} / {summary.capacityHours} 小時 · 佔用 {summary.loadPercent}%
              </span>
            </div>
            <hr className="mist-divider" />
            {summary.brokenChains.length === 0 ? (
              <div className="mist-row">
                <span className="mist-badge mist-badge--done">最低週量達標</span>
                <span className="mist-body mist-grow">累積型的保底線都還在。</span>
              </div>
            ) : (
              summary.brokenChains.map((chain) => (
                <div className="mist-row" key={chain.title}>
                  <span className="mist-badge mist-badge--attention">斷鏈警告</span>
                  <span className="mist-body mist-grow">
                    {chain.title} 目前 {chain.scheduled} / {chain.required}
                    ——累積型斷一週要重來，專案型延一週就只是延一週。
                  </span>
                </div>
              ))
            )}
            {summary.overCeiling ? (
              <div className="mist-row">
                <span className="mist-badge mist-badge--attention">超過七成上限</span>
                <span className="mist-body mist-grow">排滿會殺掉空檔調度，也會在忙的那週爆掉。</span>
              </div>
            ) : null}
          </div>
        </div>

        <p className="mist-caption mist-muted">
          沒有新增按鈕。代排的副作用是擁有感下降，給刪除權可保住控制感；把方向限制在只能往少的那邊，剛好對治樂觀。
          容量不足時的順序：無錨點的專案型 → 有錨點但時程寬鬆 → 有 deadline 壓力 → 累積型最低週量（最後才動）。
        </p>
      </div>

      <Colophon
        lines={[
          "本頁為原型。資料為示範用途，非真實個人紀錄。",
          "本系統不證明行動有效——證明「這個目標該搭配這個行動」需要對照組與數年時間。它只做到讓「有做但沒效」這個所有追蹤工具都會給綠燈的狀態被看見。",
          "退場條件：12 週內有 4 週未回應週檢查，自動降頻到月，視為設計不合，不是個人失敗。",
        ]}
      />
    </StationShell>
  );
}

function ResultGroup({ label, rows, tone }: { label: string; rows: ReconcileResult[]; tone: string }) {
  return (
    <>
      <tr className="mist-table__group">
        <td colSpan={6}>{label}</td>
      </tr>
      {rows.map((row) => (
        <tr key={row.branchId}>
          <td>
            <span className="mist-table__name">{row.branchTitle}</span>
            <span className="mist-table__unit">{row.evidence.length} 筆痕跡</span>
          </td>
          <td className="mist-table__tight">
            {row.type === "cumulative" ? "累積型" : row.type === "project" ? "專案型" : "未歸戶"}
          </td>
          <td>{row.actionLabel}</td>
          <td>{row.effectLabel ?? "—"}</td>
          <td className="mist-table__tight">{row.anchorLabel}</td>
          <td>
            <span className={`mist-badge ${tone}`}>{row.verdict}</span>
          </td>
        </tr>
      ))}
    </>
  );
}

function FindingGroup({ title, findings }: { title: string; findings: Finding[] }) {
  return (
    <div className="mist-inset">
      <div className="mist-stack--sm mist-stack">
        <p className="mist-label mist-subtle">{title}</p>
        {findings.length === 0 ? (
          <p className="mist-body mist-muted">本季沒有命中這一項。</p>
        ) : (
          findings.map((finding) => (
            <div className="mist-row" key={finding.id}>
              <span
                className={`mist-badge ${
                  finding.severity === "high"
                    ? "mist-badge--attention"
                    : finding.severity === "mid"
                      ? "mist-badge--active"
                      : "mist-badge--idle"
                }`}
              >
                {finding.severity === "high" ? "高" : finding.severity === "mid" ? "中" : "停用"}
              </span>
              <span className="mist-body mist-grow">
                <span className="mist-body-strong">{finding.title}</span>　{finding.reason}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Segmented({
  label,
  options,
  current,
  onSelect,
}: {
  label: string;
  options: { value: string; text: string }[];
  current: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mist-row mist-row--between">
      {label ? <span className="mist-label mist-subtle">{label}</span> : null}
      <div className="mist-seg" role="group" aria-label={label || "選項"}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="mist-seg__item"
            aria-pressed={option.value === current}
            onClick={() => onSelect(option.value)}
          >
            {option.text}
          </button>
        ))}
      </div>
    </div>
  );
}
