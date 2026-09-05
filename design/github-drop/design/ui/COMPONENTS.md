# mist 元件索引

**這份是給 AI 和工程師看的。要短 —— 長了會在 context 裡被淹沒。**

引入順序（先 token 再元件）：

```html
<link rel="stylesheet" href="css/mist.tokens.css">
<link rel="stylesheet" href="css/components.css">
<body class="mist">
```

全狀態實際長相：開 `reference.html`。本機預覽：

```bash
python3 scripts/serve.py . 8747
```

然後開 http://localhost:8747/styles/mist/reference.html

---

## 鐵則

1. **頁面只放 class，不寫樣式。** 出現 `style="background:..."` 或頁面層的 `<style>` 規則＝detach instance
2. **缺元件時先擴充既有元件的 variant，並回寫到 `components.css`** —— 不要在頁面裡新寫一個
3. **缺 token 時先在 `tokens/mist.tokens-studio.json` 的 comp 層加一個指向 sys 的 token**，然後跑 `./build.sh`。不要寫死數值、不要直接引用 sys
4. 交檢查：`python3 ../../scripts/check_usage.py --tokens css/mist.tokens.css --components css/components.css --pages pages/*.html`

## 表面（先選對表面，再放元件）

| class | 什麼時候用 |
|---|---|
| `.mist-page` | 最外層。藍灰頁面底 |
| `.mist-app` | app 容器。淺灰、40px 圓角 |
| `.mist-card` / `.mist-card--lg` | 白卡。內容都放這裡面 |
| `.mist-inset` | 卡**內**的填色區塊。**只能放在白卡裡**，放到 `.mist-app` 上會同色消失 |
| `.mist-divider` | hairline 分隔線 |
| `.mist-shell` / `--narrow` | 限寬（1200 / 720） |

## 版面

| class | 用途 |
|---|---|
| `.mist-split` | 主 2 : 次 1 兩欄。`--even` 改成 1:1 |
| `.mist-stack` / `--sm` | 垂直堆疊 |
| `.mist-row` / `--between` | 水平排列 |
| `.mist-grow` | 佔滿剩餘寬度 |

## 排版

`.mist-display` 56 ／ `.mist-h1` 40 ／ `.mist-h2` 28 ／ `.mist-h3` 20 ／ `.mist-body` 14 ／ `.mist-body-strong` 14 ／ `.mist-label` 12 ／ `.mist-caption` 12
顏色：`.mist-muted`（次要）／`.mist-subtle`（最淡）

**同一區塊內要跳級用**，不要相鄰級並用。

## 元件

| 元件 | 什麼時候用哪個 | 最小用法 |
|---|---|---|
| **Button** | `--primary` 一頁只有一顆／`--secondary` 次要／`--ghost` 第三順位、工具列／`--icon` 只有圖示 | `<button class="mist-btn mist-btn--primary">送出</button>` |
| **Badge** | 狀態標籤。`--done` 完成／`--active` 進行中／`--idle` 未開始／`--attention` 逾期或需注意 | `<span class="mist-badge mist-badge--done">已完成</span>` |
| **OptionCard** | 選擇題的選項。**不要用原生 radio** | 見下方 |
| **SpecCard** | 並列比較的可選方案，每張帶固定欄位（一句話講得完就用 OptionCard） | 見下方 |
| **Progress** | 比例用 `.mist-progress`；問卷分段用 `.mist-steps` | `<div class="mist-progress"><div class="mist-progress__bar" style="--mist-progress-value: 62%"></div></div>` |
| **TaskItem** | 可勾選的任務列。完成加 `.is-done` | 見下方 |
| **StatTile** | 大數字 + 標籤。多欄用 `.mist-stats` 包 | `<div class="mist-stat"><span class="mist-stat__value">12</span><span class="mist-stat__label">天</span></div>` |
| **GeneratingState** | AI 生成中。`.mist-dots` 點點／`.mist-skeleton` 骨架線／`.mist-stream` 逐字游標 | 見下方 |
| **Chart** | 五種，**各有職責不要混用**。見下方「圖表怎麼選」 | 見下方 |
| **Field** | 文字輸入。`textarea` 加同一個 class | `<div class="mist-field"><label class="mist-field__label" for="x">標題</label><input class="mist-field__input" id="x"></div>` |
| **Nav** | 頂部導覽。目前頁加 `.is-active` | `<nav class="mist-nav">…</nav>` |

### OptionCard

選中靠 `aria-checked="true"`，不可選用 `aria-disabled="true"`。`__desc` 可省略。

```html
<button class="mist-option" role="radio" aria-checked="false">
  <span class="mist-option__marker" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="mist-option__body">
    <span class="mist-option__label">選項標題</span>
    <span class="mist-option__desc">補充說明（可省略）</span>
  </span>
</button>
```

### SpecCard

選中同樣靠 `aria-checked="true"`。**同一組 `.mist-specs` 內是單選**，切換要自己清掉別張。
`__lede` 會吃掉剩餘高度，所以同一列卡片的規格區與底部會對齊，不必補等高。
`__foot` 的文字由頁面提供（選中／未選中兩種），元件只負責顏色與勾勾的顯隱。

**欄位名稱在每張卡都要一致** —— 欄位不一致就不叫比較，那只是六張各說各話的卡片。

```html
<div class="mist-specs">
  <button class="mist-spec" role="radio" aria-checked="false">
    <span class="mist-spec__head">
      <span class="mist-spec__id">S-1</span>
      <span class="mist-badge mist-badge--done">資料支持</span>
    </span>
    <span class="mist-spec__title">方案名稱</span>
    <span class="mist-spec__lede">「一句話的願景」</span>
    <dl class="mist-spec__rows">
      <div class="mist-spec__row"><dt class="mist-spec__term">五年</dt><dd class="mist-spec__detail">…</dd></div>
      <div class="mist-spec__row"><dt class="mist-spec__term">代價</dt><dd class="mist-spec__detail">…</dd></div>
    </dl>
    <span class="mist-spec__foot"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>選這個方案</span>
  </button>
  <!-- 其餘卡片同結構 -->
</div>
```

### TaskItem

```html
<button class="mist-task is-done">
  <span class="mist-task__check" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
  <span class="mist-task__body">
    <span class="mist-task__label">任務名稱</span>
    <span class="mist-task__meta">3 天前完成</span>
  </span>
  <span class="mist-badge mist-badge--done">已完成</span>
</button>
```

### GeneratingState

```html
<section class="mist-generating">
  <div class="mist-row">
    <div class="mist-dots" aria-hidden="true"><i></i><i></i><i></i></div>
    <p class="mist-generating__label">正在整理你的規劃表</p>
  </div>
  <p class="mist-generating__hint">說明等待原因與預估時間</p>
  <div class="mist-skeleton" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
</section>
```

### 圖表怎麼選

| 想表達 | 用 | 標記寬度 |
|---|---|---|
| 時間怎麼變化 | `.mist-linechart` | 2px 曲線 |
| 一步一步流失多少 | `.mist-funnel` | 8px 條 |
| 各項佔整體多少 | `.mist-donut` | 8px 環 |
| 單一比例（像儀表） | `.mist-donut--half` | 8px 環 |
| 少量分類的高低 | `.mist-lollipop` | 12px 條 |
| 只要看趨勢的形狀 | `.mist-hairbars` | 2px 細線 |

**`.mist-hairbars` 不用來讀個別數值** —— 它是紋理，要讀數值請換 `.mist-lollipop`。
**任何圖表的標記都不准用 `flex: 1` 撐開**，寬度一定來自 token。

### LineChart

曲線的 `d` **要寫在 markup 裡**（`viewBox` 固定 `0 0 100 100`），這樣沒有 JS 也看得到線。
載入選配的 `ui/mist-charts.js` 之後才有 hover；它也能在沒有 `d` 時從 `data-values` 自動算。

```html
<script src="../ui/mist-charts.js" defer></script>

<div class="mist-linechart" data-mist-linechart data-min="0" data-max="100"
     data-default-index="4" data-labels="週一,週二,週三,週四,週五,週六,週日">
  <div class="mist-linechart__body">
    <div class="mist-linechart__yaxis">…<span class="mist-linechart__ytick">0</span></div>
    <div class="mist-linechart__plot">
      <svg class="mist-linechart__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <g class="mist-linechart__grid"><line x1="0" y1="50" x2="100" y2="50"></line>…</g>
        <path class="mist-linechart__line mist-linechart__line--secondary" data-values="…" d="M…"></path>
        <path class="mist-linechart__line mist-linechart__line--primary"   data-values="…" d="M…"></path>
        <line class="mist-linechart__cursor" y1="0" y2="100"></line>
        <circle class="mist-linechart__marker mist-linechart__marker--secondary"></circle>
        <circle class="mist-linechart__marker mist-linechart__marker--primary"></circle>
      </svg>
      <div class="mist-linechart__tip">
        <span class="mist-linechart__tip-title">週五</span>
        <span class="mist-linechart__tip-value">68</span>
      </div>
    </div>
  </div>
  <div class="mist-linechart__xaxis">
    <span class="mist-linechart__xtick"><span>週一</span></span>…
  </div>
</div>
```

**次序列要放在主序列前面** —— DOM 順序決定疊圖層次，主序列要畫在上面。tooltip 一律報主序列的值。

### Funnel

每個階段的第一根條加 `.is-marked`。

```html
<div class="mist-funnel">
  <div class="mist-funnel__track">
    <i class="mist-funnel__bar is-marked" style="--mist-bar: 100%"></i>
    <i class="mist-funnel__bar" style="--mist-bar: 96%"></i>…
  </div>
  <div class="mist-funnel__stages">
    <div class="mist-funnel__stage">
      <span class="mist-funnel__pct">100%</span>
      <span class="mist-funnel__name">完成問卷</span>
      <span class="mist-funnel__count">1,500</span>
    </div>…
  </div>
</div>
```

### Donut / 半圓儀表

`viewBox` 必須是 `0 0 240 240`（＝容器尺寸），circle 用 `r="104"` 並帶 `pathLength="100"`。
pathLength 把弧長正規化成 0–100，所以 `--mist-arc` 直接寫百分比。
**半圓（`--half`）的滿值是 50**，所以要傳「百分比的一半」。

```html
<div class="mist-donut">
  <div class="mist-donut__figure">
    <svg class="mist-donut__svg" viewBox="0 0 240 240" aria-hidden="true">
      <circle class="mist-donut__track" cx="120" cy="120" r="104" pathLength="100"></circle>
      <circle class="mist-donut__band is-selected" cx="120" cy="120" r="104" pathLength="100" style="--mist-arc: 16; --mist-arc-start: 62"></circle>
      <circle class="mist-donut__seg mist-donut__seg--mark" cx="120" cy="120" r="104" pathLength="100" style="--mist-arc: 61; --mist-arc-start: 0"></circle>
    </svg>
    <div class="mist-donut__center">
      <span class="mist-donut__value">16%</span>
      <span class="mist-donut__label">未分類</span>
    </div>
  </div>
  <div class="mist-donut__legend">
    <button class="mist-donut__item mist-donut__item--mark">
      <span class="mist-donut__dot"></span><span class="mist-donut__name">工作與會議</span><span class="mist-donut__pct">62%</span>
    </button>…
  </div>
</div>
```

段的顏色用 `--mark`（深藍黑）／`--accent`（ember）／`--alt`（淡藍）／`--muted`（淺灰）。

### Lollipop

選中的那一欄加 `.is-selected` —— 招牌的貫穿高亮柱就在這裡。

```html
<div class="mist-lollipop">
  <div class="mist-lollipop__col is-selected" style="--mist-stem: 78%">
    <span class="mist-lollipop__tip">3 項</span>
    <div class="mist-lollipop__plot"><i class="mist-lollipop__stem"></i></div>
    <button class="mist-lollipop__node">二</button>
  </div>
  <!-- 其餘欄同結構，不加 is-selected -->
</div>
```

密集細線圖：`.mist-hairbars`（可加 `--accent` 橘紅 ／ `--mark` 深色），每根 `<i style="--mist-bar: 62%">`。
**根數要多**（20 根以上）才會讀成線；根數少會看起來像實心色塊。

## 資料介面

頁面要把數值傳進元件，**只能用這三個** custom property。其他一律不准寫 inline style。

| 變數 | 用在 |
|---|---|
| `--mist-progress-value` | 進度條填滿比例 |
| `--mist-stem` | lollipop 的柱高比例 |
| `--mist-bar` | 密集細線圖／漏斗的單根高度 |
| `--mist-arc` | 環形圖單一段佔整圈的百分比 |
| `--mist-arc-start` | 環形圖單一段的起點百分比 |

### Diagram（架構／流程圖）

節點和線在**同一個 1600×900 座標空間**裡：節點用 `--x` / `--y` 定位（純數字，不是 px），
SVG 用同一組數字畫線。所以「線接不到框」不可能發生。

節點半寬 88、半高約 33 —— 線的端點要自己算，例如兩個相鄰節點（x=160 與 x=460、同一列）
的水平連線就是 `M248,y H372`。

```html
<div class="mist-diagram mist-diagram--frame">
  <span class="mist-diagram__heading" style="--x: 72; --y: 86">標題</span>
  <span class="mist-diagram__band" style="--x: 72; --y: 162">① 區段</span>

  <svg class="mist-diagram__edges" viewBox="0 0 1600 900" fill="none" aria-hidden="true">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path class="mist-diagram__arrowhead" d="M0,1 L9,5 L0,9 z"></path></marker></defs>
    <path class="mist-diagram__edge" marker-end="url(#ah)" d="M248,220 H372"></path>
    <path class="mist-diagram__edge mist-diagram__edge--dashed" marker-end="url(#ah)" d="M215,253 L262,307"></path>
  </svg>

  <div class="mist-diagram__node" style="--x: 160; --y: 220">
    <span class="mist-diagram__label">節點名稱</span>
    <span class="mist-diagram__sub">補充</span>
  </div>
  <span class="mist-diagram__step" style="--x: 310; --y: 220">1</span>
  <span class="mist-diagram__edge-label" style="--x: 310; --y: 190">線上的說明</span>

  <div class="mist-diagram__note" style="--x: 1360; --y: 182">
    <span class="mist-diagram__note-title">標題</span>
    <span class="mist-diagram__note-text">說明文字</span>
  </div>
</div>
```

| 修飾 | 用途 |
|---|---|
| `--frame` | 整張圖自己就是 app 表面（16:9 畫布） |
| `__node--strong` | 深色實心。流程的入口與出口 |
| `__node--stack` | 疊卡。表示「同一種東西有很多份」 |
| `__edge--dashed` | 虛線。非主線的迴圈或選配路徑 |
| `__edge-label--wrap` | 長標籤換行 |
| `__note--top` | `--y` 變成上緣而非中心。底部一排註解用它對齊 |

### 用顏色分階段

`--alt`（淡藍）／`--accent`（ember 橘）／不加（深藍黑）三組，同時套在
`__node`、`__rule`、`__edge`、`__step`、`__band` 上，一個階段一個顏色。
**跨階段的線不上色**，維持中性灰 —— 顏色的意義就是「同一個階段」。

節點頂端加一條 `__rule` 小色條標示階段：

```html
<div class="mist-diagram__node mist-diagram__node--accent" style="--x: 180; --y: 400">
  <span class="mist-diagram__rule mist-diagram__rule--accent"></span>
  <span class="mist-diagram__label">Analyzer</span>
</div>
```

`__step` 填色用**深一階**的 `accent-bold` / `accent-alt-bold`，不是 `accent` ——
ember.40 配白字只有 3.6:1 不到 AA，深一階之後是 5.1 與 7.0。

### 節點要看起來分得開

零陰影的風格裡，「這是一個獨立物件」靠兩件事：**亮度差**與**描邊**。

- 畫布用 `surface-sunken`（neutral.15），比一般 app 表面深一階，白卡才浮得起來
- 節點描邊 **2px** `outline-strong`（neutral.30）。1px 在簡報投影時會消失

**畫線前先量節點實際高度**：有副標的節點 74、只有標題的 57。端點算錯就會插進卡片裡。

**固定尺寸畫布要塞進視窗**：外層包 `.mist-center` + `.mist-fit`，再加一段選配 script 設
`--mist-fit-scale`。沒有 script 時畫布維持 1600×900，內容一樣正確。

範例見 `pages/architecture.html`。

## 目前沒有的元件

Dialog / Toast / Tabs / Table / Switch / Avatar / Dropdown（真的下拉）/ 檔案上傳 / 堆疊橫條圖。

需要時照「鐵則 2」處理 —— 在 `components.css` 加，不要在頁面裡寫。
