"use client";

import { useMemo, useState } from "react";
import { CheckIcon } from "../CheckIcon";
import { Colophon, StationShell } from "../StationShell";
import type { CoachingSnapshot, ImportStatus, RoleModelDraft } from "@/lib/contracts";
import { buildHorizons } from "@/lib/horizon";
import { CAPABILITY_EXAMPLES, decompose } from "@/lib/role-model";
import { IMPORT_FORMATS } from "@/lib/mock/snapshot";

/**
 * Station 1 · intake.
 *
 * Seven sections, in the order the specification fixes them: horizon first,
 * because it sets the scale of every field after it; the generated shape
 * second to last, because it is an inference and an inference needs its inputs
 * first. The page never asks "what do you want" — that is the question the
 * user cannot answer, and it is why they are here.
 */

const STATUS_LABEL: Record<ImportStatus, { text: string; tone: string }> = {
  connected: { text: "已連接", tone: "mist-badge--done" },
  parsed: { text: "已解析", tone: "mist-badge--done" },
  absent: { text: "未連接 · 可稍後補", tone: "mist-badge--idle" },
};

export function IntakeStation({ snapshot }: { snapshot: CoachingSnapshot }) {
  const horizons = useMemo(() => buildHorizons(snapshot.horizon.start), [snapshot.horizon.start]);
  const [horizonId, setHorizonId] = useState(snapshot.horizon.id);
  const horizon = horizons.find((entry) => entry.id === horizonId) ?? snapshot.horizon;

  const [roleModel, setRoleModel] = useState<RoleModelDraft>(snapshot.roleModel);
  const breakdown = useMemo(() => decompose(roleModel), [roleModel]);

  const [shapeId, setShapeId] = useState(snapshot.shapes[0].id);
  const shape = snapshot.shapes.find((entry) => entry.id === shapeId) ?? snapshot.shapes[0];
  const crossCheck = snapshot.crossChecks[shape.id];

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answeredCount = Object.values(answers).filter((value) => value.trim().length > 0).length;

  const calendarImported = snapshot.imports.some(
    (source) => source.priority === "P0" && source.status !== "absent",
  );

  return (
    <StationShell current="/">
      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">第一次使用 · 尚無任何目標</p>
        <h1 className="mist-h1">不是問你要什麼，是把你的一年變成一個可以對帳的東西</h1>
        <p className="mist-body mist-muted">
          大部分人回答不出「你的願景是什麼」——那是一道要你無中生有的題。所以這裡不問你要什麼，只做四件事：
          <span className="mist-body-strong">先定下你要看多久</span>、
          <span className="mist-body-strong">讀你已經留下的痕跡</span>、
          <span className="mist-body-strong">讓你講出一個想要的能力</span>、然後
          <span className="mist-body-strong">拿痕跡回頭跟那個能力對一次</span>。
          最後產出的不是願景，是一個一年內測得完的假設。
        </p>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">01 · 期間 HORIZON</p>
        <h2 className="mist-h2">你要看多久</h2>
        <p className="mist-body mist-muted">
          一年。不是因為一年是個好聽的數字，是因為一年剛好夠讓一項能力被重測三到四次——
          <span className="mist-body-strong">一次重測沒有趨勢，兩次才看得出方向</span>。
          同時它短到你簽下的反證條件會在你還在乎的時候到期。這個決定會決定後面所有東西的刻度，所以它放在最前面。
        </p>

        <div className="mist-stack--sm mist-stack" role="radiogroup" aria-label="期間">
          {horizons.map((option) => (
            <button
              key={option.id}
              type="button"
              className="mist-option"
              role="radio"
              aria-checked={option.id === horizonId}
              aria-disabled={!option.available}
              onClick={() => option.available && setHorizonId(option.id)}
            >
              <span className="mist-option__marker" aria-hidden="true">
                <CheckIcon />
              </span>
              <span className="mist-option__body">
                <span className="mist-option__label">{option.label}</span>
                <span className="mist-option__desc">
                  {option.available ? "可選（預設）" : "暫不開放 · 範圍限縮是一個取捨，取捨要看得見"}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <SpecRow term="期間" detail={`${horizon.start} → ${horizon.end}`} />
            <hr className="mist-divider" />
            <SpecRow
              term="分季"
              detail={horizon.quarters
                .map((quarter) => `${quarter.id} ${quarter.start}→${quarter.end}`)
                .join(" · ")}
            />
            <hr className="mist-divider" />
            <SpecRow term="首次對帳" detail={horizon.firstReconcileAt} />
            <hr className="mist-divider" />
            <SpecRow
              term="重測頻率"
              detail={`每季末一次，共 ${horizon.retestCount} 次（基準線於 intake 當日建立）`}
            />
            <hr className="mist-divider" />
            <SpecRow term="推進名額" detail={`${horizon.slotCap}（硬上限，跨季不累加）`} />
          </div>
        </div>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">02 · 匯入 IMPORT</p>
        <h2 className="mist-h2">先讀你已經留下的痕跡</h2>
        <p className="mist-body mist-muted">
          這一步只讀既有資料——你的時間怎麼花的、你在哪裡留下過東西、你的經歷長什麼樣、你的身體狀態如何。
          <span className="mist-body-strong">不要求你回想，也不要求你開始記錄。</span>
        </p>

        <div className="mist-inset">
          <div className="mist-stack">
            {snapshot.imports.map((source, index) => (
              <div key={source.id}>
                {index > 0 ? <hr className="mist-divider" /> : null}
                <div className="mist-row mist-row--between">
                  <div className="mist-stack--sm mist-stack mist-grow">
                    <p className="mist-body-strong">
                      {source.priority} · {source.name}
                    </p>
                    <p className="mist-caption mist-muted">
                      {source.detail ? `${source.detail} · ` : ""}
                      {source.provides}
                    </p>
                    <p className="mist-caption mist-subtle">沒有它：{source.withoutIt}</p>
                  </div>
                  <span className={`mist-badge ${STATUS_LABEL[source.status].tone}`}>
                    {STATUS_LABEL[source.status].text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mist-caption mist-muted">支援格式：{IMPORT_FORMATS}</p>
        <p className="mist-body mist-muted">
          行事曆是唯一不可替代的那一項。它提供時間流，而時間流是對帳的分母。
          <span className="mist-body-strong">
            一個人聲稱重視什麼，和他把時間放在哪，落差本身就是診斷。
          </span>
          其餘三項可以稍後再補，少一項不會擋住你往下走，只會讓後面的比對少一個角度。
        </p>
      </div>

      <div className="mist-card mist-card--lg">
        <div className="mist-row mist-row--between">
          <p className="mist-label mist-subtle">03 · 基本題 BASELINE</p>
          <span className="mist-badge mist-badge--idle">
            {answeredCount} / {snapshot.baselineQuestions.length} · 全部選填
          </span>
        </div>
        <h2 className="mist-h2">這幾題全部可以跳過</h2>
        <p className="mist-body mist-muted">
          它們不是門檻，是<span className="mist-body-strong">刻度</span>
          ——答了，後面的排程與處方會更貼你；不答，系統會用預設值，並且在用到的地方標明那是預設值。
          而且這些都是事實題，<span className="mist-body-strong">沒有方向感也答得出來</span>。
        </p>

        <div className="mist-stack">
          {snapshot.baselineQuestions.map((question) => (
            <div className="mist-inset" key={question.id}>
              <div className="mist-stack--sm mist-stack">
                <p className="mist-label mist-subtle">{question.id}</p>
                <p className="mist-body-strong">{question.prompt}</p>
                <p className="mist-caption mist-subtle">用途：{question.downstream}</p>
                <div className="mist-field">
                  <label className="mist-field__label" htmlFor={`q-${question.id}`}>
                    你的回答（選填）
                  </label>
                  <input
                    className="mist-field__input"
                    id={`q-${question.id}`}
                    placeholder={question.placeholder}
                    value={answers[question.id] ?? ""}
                    onChange={(event) =>
                      setAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))
                    }
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mist-body mist-muted">
          <span className="mist-body-strong">跳過會被記成一個答案，不是遺漏</span>
          ——它跟你答了一樣會被下游用到。答不出方向感也沒關係，下一段會用另一種方式問同一件事：
          不是問你要什麼，是問你想要誰的什麼能力。
        </p>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">04 · ROLE MODEL</p>
        <h2 className="mist-h2">你想要誰的什麼能力</h2>
        <p className="mist-body mist-muted">
          「你的願景是什麼」很難答，「你羨慕誰的什麼能力」好答得多——因為它有具體對象，而且你通常已經想過。
          講得越具體越好。
          <span className="mist-body-strong">「厲害」不能重測，「三分命中率」可以。</span>
          這一格是整個系統裡唯一能讓「有做但沒效」在一年後被驗出來的入口。
        </p>

        <div className="mist-split--even mist-split">
          <div className="mist-field">
            <label className="mist-field__label" htmlFor="rm-person">
              我想要（誰）
            </label>
            <input
              className="mist-field__input"
              id="rm-person"
              value={roleModel.person}
              onChange={(event) =>
                setRoleModel((previous) => ({ ...previous, person: event.target.value }))
              }
            />
          </div>
          <div className="mist-field">
            <label className="mist-field__label" htmlFor="rm-capability">
              的（什麼能力）
            </label>
            <input
              className="mist-field__input"
              id="rm-capability"
              value={roleModel.capability}
              onChange={(event) =>
                setRoleModel((previous) => ({ ...previous, capability: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="mist-row">
          {CAPABILITY_EXAMPLES.map((example) => (
            <button
              key={example.capability}
              type="button"
              className="mist-btn mist-btn--ghost"
              onClick={() => setRoleModel(example)}
            >
              如{example.person}一般的{example.capability}
            </button>
          ))}
        </div>

        <div className="mist-inset">
          {breakdown.tooAbstract ? (
            <div className="mist-stack--sm mist-stack">
              <span className="mist-badge mist-badge--attention">還測不出來</span>
              <p className="mist-body">
                這個講法拆不出重測方式，要不要再具體一點？
                <span className="mist-body-strong">
                  沒有可重測的能力，一年後你只會知道自己有沒有出席，不會知道有沒有變強。
                </span>
              </p>
            </div>
          ) : (
            <div className="mist-stack--sm mist-stack">
              <p className="mist-label mist-subtle">系統推論 · 可修改</p>
              <SpecRow term="可重測能力" detail={breakdown.measurable ?? "—"} />
              <hr className="mist-divider" />
              <SpecRow term="重測方式" detail={breakdown.retestMethod ?? "—"} />
              <hr className="mist-divider" />
              <SpecRow term="隱含形狀" detail={breakdown.impliedShape ?? "—"} />
              <hr className="mist-divider" />
              <SpecRow term="代價" detail={breakdown.cost ?? "—"} />
            </div>
          )}
        </div>
        <p className="mist-caption mist-muted">
          你可以填多個 role model，但只有一個會被設成本期的可重測能力——名額是稀缺資源。
          「代價」那一格是系統推論的，推錯了比不推更傷，所以它可以被你改掉。
        </p>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">05 · 形狀 SHAPE</p>
        <h2 className="mist-h2">這不是選擇題</h2>
        <p className="mist-body mist-muted">
          這是系統依你給的東西推出來的幾種可能的形狀，每一張都附上它憑什麼推給你。
          <span className="mist-body-strong">推錯了就換掉。</span>
          依據行寫在那裡就是為了讓你能反駁它——如果那一行寫的事情你不認同，這張卡片就不成立。
        </p>

        <div className="mist-specs" role="radiogroup" aria-label="系統建議的形狀">
          {snapshot.shapes.map((option) => {
            const selected = option.id === shape.id;
            return (
              <button
                key={option.id}
                type="button"
                className="mist-spec"
                role="radio"
                aria-checked={selected}
                onClick={() => setShapeId(option.id)}
              >
                <span className="mist-spec__head">
                  <span className="mist-spec__id">{option.id}</span>
                  <span className={`mist-badge mist-badge--${option.fitTone}`}>{option.fitLabel}</span>
                </span>
                <span className="mist-spec__title">{option.name}</span>
                <span className="mist-spec__lede">「{option.lede}」</span>
                <dl className="mist-spec__rows">
                  {option.evidence.map((line) => (
                    <div className="mist-spec__row" key={line.text}>
                      <dt className="mist-spec__term">依據</dt>
                      <dd className="mist-spec__detail">{line.text}</dd>
                    </div>
                  ))}
                  <div className="mist-spec__row">
                    <dt className="mist-spec__term">一年</dt>
                    <dd className="mist-spec__detail">{option.yearLooksLike}</dd>
                  </div>
                  <div className="mist-spec__row">
                    <dt className="mist-spec__term">需累積</dt>
                    <dd className="mist-spec__detail">{option.accumulates}</dd>
                  </div>
                  <div className="mist-spec__row">
                    <dt className="mist-spec__term">代價</dt>
                    <dd className="mist-spec__detail">{option.cost}</dd>
                  </div>
                </dl>
                <span className="mist-spec__foot">
                  <CheckIcon />
                  {selected ? "已選為對照基準" : "選為對照基準"}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mist-body mist-muted">
          也可以自己寫一個。樣板存在的理由不是限制選擇，是
          <span className="mist-body-strong">讓「我不知道」變成一個可以往下走的答案</span>。
        </p>
      </div>

      <div className="mist-card mist-card--lg">
        <p className="mist-label mist-subtle">06 · 反差 CROSS-CHECK</p>
        <h2 className="mist-h2">你選的形狀，跟你的痕跡對得上嗎</h2>

        {calendarImported && crossCheck?.available ? (
          <>
            <p className="mist-body mist-muted">
              <span className="mist-body-strong">對不上不代表選錯</span>
              ——它可能代表你正要改變，也可能代表你選的是想像中的自己。差別只有你自己知道，但落差必須先被看見。
            </p>
            <h3 className="mist-h3">{crossCheck.verdict}</h3>
            <p className="mist-body mist-muted">{crossCheck.narrative}</p>

            <div className="mist-stack--sm mist-stack">
              {crossCheck.items.map((item) => (
                <div className="mist-row" key={item.text}>
                  <span
                    className={`mist-badge ${
                      item.mark === "supports" ? "mist-badge--done" : "mist-badge--attention"
                    }`}
                  >
                    {item.mark === "supports" ? "支持" : "缺"}
                  </span>
                  <span className="mist-body mist-grow">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="mist-inset">
              <div className="mist-stack--sm mist-stack">
                <p className="mist-label mist-subtle">這一年唯一要驗證的事</p>
                <p className="mist-body">{crossCheck.test}</p>
                <p className="mist-caption mist-muted">{crossCheck.cost}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="mist-inset">
            <div className="mist-stack--sm mist-stack">
              <span className="mist-badge mist-badge--attention">無法對帳 · 缺痕跡</span>
              <p className="mist-body">
                反差比對需要你的行為紀錄，而你還沒有匯入行事曆。這裡不會用你填的基本題湊出一個看起來像比對的東西——
                <span className="mist-body-strong">那會是猜測，不是對帳。</span>
              </p>
              <p className="mist-body mist-muted">
                你仍然可以往下走，拿到一份處方。但這個產品最有價值的那一格，要等你把痕跡交出來才打得開。
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mist-card mist-card--lg">
        <div className="mist-row mist-row--between">
          <p className="mist-label mist-subtle">07 · 產出 HYPOTHESIS</p>
          <span className="mist-badge mist-badge--attention">假設 v0 · 不是願景</span>
        </div>
        <h2 className="mist-h2">這是你這一年的對照基準</h2>
        <h3 className="mist-h3">「{shape.lede}」</h3>

        <p className="mist-body mist-muted">
          <span className="mist-body-strong">這不是你的願景，是一個借來的形狀。</span>
          願景要自己長出來，長出來之前你需要的是一個能對照的東西——沒有基準就沒有診斷，沒有診斷就永遠停在「還可以吧」。
          三個月後拿真實行為回頭比一次，那時候的你會比現在更清楚。
        </p>

        <div className="mist-inset">
          <div className="mist-stack--sm mist-stack">
            <SpecRow term="期間" detail={`${horizon.start} → ${horizon.end}`} />
            <hr className="mist-divider" />
            <SpecRow term="可重測能力" detail={breakdown.measurable ?? "尚未拆出 · 請把能力講得更具體"} />
            <hr className="mist-divider" />
            <SpecRow term="基準線" detail={breakdown.retestMethod ?? "待建立 · 建議於第一週完成首測"} />
            <hr className="mist-divider" />
            <SpecRow term="重測排程" detail={horizon.quarters.map((quarter) => quarter.end).join(" / ")} />
            <hr className="mist-divider" />
            <SpecRow term="首次對帳" detail={horizon.firstReconcileAt} />
            <hr className="mist-divider" />
            <SpecRow
              term="來源"
              detail={`${shape.id} ${shape.name} ＋ 你的資料 ＋ 基本題 ${answeredCount}/${snapshot.baselineQuestions.length}`}
            />
            <hr className="mist-divider" />
            <SpecRow term="版本" detail="v0 · 永不覆寫" />
          </div>
        </div>

        <div className="mist-row">
          <a className="mist-btn mist-btn--primary" href="/plan">
            用這個假設產生目標樹草案
          </a>
        </div>
        <p className="mist-caption mist-muted">
          假設會標記為 v0 並記錄今天的時間與來源。一年內若行為與它持續不符，教練會主動拿出來問——
          不是催你執行，是問這個形狀還算不算數。
        </p>
      </div>

      <Colophon
        lines={[
          "本頁為原型，資料為示範用途。這是三站流程的第一站：方向假設 → 目標樹草案 → 季度對帳。",
          "設計取捨：期間限縮在一年，等於暫時不處理願景層與五年層。這不是否定那兩層，是承認 intake 產不出它們——借一年的東西，比借五年的東西誠實。",
          "形狀建議在這一版是預寫的。它是站 1 唯一無法用規則寫死的東西，真做要由模型依三種輸入生成，每張必帶依據行。",
        ]}
      />
    </StationShell>
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
