# 風格包規格 — mist

**級別**：主力風格候選（第一版）
**建立**：2026 年 9 月 4 日
**狀態**：可用於黑客松。招牌細節待原創化（見下方「已知債務」）
**token prefix**：`--mist-ref-*` / `--mist-sys-*` / `--mist-comp-*`

模板見 [../../STYLE-PACK-TEMPLATE.md](../../STYLE-PACK-TEMPLATE.md)。

---

## 1. 血統／參照

當代 SaaS dashboard 語彙 —— 淺灰底、超大圓角白卡、極簡線性圖表、極小面積的暖色點綴。
參照來源是一張 freelancer 收入儀表板的設計圖（2023–2025 年 Dribbble / Behance 的主流做法）。

**誠實記錄：這不是有歷史血統的傳統。** 照抄的結果會落在「好看但可預測」，不是「有個性」。

但它被選用有理由：結構決策紮實，而且調性適合談人生規劃的產品 —— 溫和、專業、不施壓。
談生涯的介面不該張牙舞爪。

## 2. 招牌細節

**選中項帶一道貫穿高亮柱。**

被選中的元素除了自身變深色實心，其**後方會出現一道與周圍不同的柱狀色塊，貫穿整個容器**，
把「選擇器」和「它所影響的內容」連起來。

- **正宗實作在圖表**（`.mist-lollipop__col.is-selected`）：高亮柱從資料區頂端一路貫穿到底部的日期節點
- **OptionCard**：選中時高亮由邊到邊鋪滿整張卡（不是內縮色塊）
- **TaskItem**：完成時整列被高亮鋪滿

拿掉這個，mist 就認不出來了。

> 高亮色的**對比方向依表面而定** —— 在白卡上它是比卡片稍深的淺灰（`neutral.3`）。
> 不要寫成「比底色亮」，那只在深色表面上成立。

## 3. 硬約束

| 項目 | 約束 | 怎麼保證 |
|---|---|---|
| **表面分層** | 三層亮度：頁面底（藍灰 `slate.40`）→ app 容器（`neutral.10`）→ 卡片（白）。**卡片靠亮度差浮起** | `sys.color.surface-*` 階梯 |
| **陰影** | 完全不用。層次靠亮度差 + hairline | **沒有任何 shadow token**，寫不出來 |
| 圓角 | 容器 40 / 其餘一律 24 / 小元件 pill。**沒有中等圓角** | `ref.shape` 只有 0 / 24 / 40 / 9999 |
| **內距 = 圓角** | 卡片類容器的左右內距必須等於它的圓角。大於安全，**小於禁止** | `check_usage.py` 自動比對每個元件的 shape 與 padding |
| 字級 | 12 / 14 / 20 / 28 / 40 / 56。跨度 4.6 倍 | `ref.font.size` 只有這六級 |
| 字重 | **只有 regular 400 與 medium 500** | `ref.font.weight` 只有兩個值，沒有 bold |
| 彩色面積 | 極小。只准出現在 badge、圓點、icon 底、頂規 | 見禁止事項 1 |
| 圖表 | **標記寬度必須是 token 裡的固定值**，不得用 `flex: 1` 隨容器撐開。2px 細線（趨勢）／8–12px 條（讀數值）／8px 環（佔比） | 見禁止事項 4 |
| 圖表格線 | 虛線（`4 4`）。**虛線只用在圖表格線**，其他地方一律實線 hairline | `comp.chart.grid.dash` |
| 狀態色 | 完成＝深色實心／進行中＝淡藍／未開始＝淺灰／需注意＝橘紅。**不用綠黃紅** | `sys.color.status-*` |
| 線 | hairline 1px、focus 2px。就這兩種 | `ref.border-width` 只有三個值 |
| 字體 | Plus Jakarta Sans + Noto Sans TC | `ref.font.family` |

## 4. 禁止事項

只有這四條 —— 其他都被 token 的「不存在」擋掉了。

1. **彩色不做大面積背景。** 橘紅與淡藍只能是點綴（badge、圓點、頂規、logo）。九成畫面必須是灰白黑。
2. **不用陰影做層次。** 需要層次時往亮度階梯上找一階，不要加陰影。
3. **同一區塊內不要用相鄰字級。** 要跳級才有兩極化效果（例：`caption` 12 配 `display` 56，不要 14 配 20）。
4. **圖表標記不得用 `flex: 1` 撐開。** 寬度一定要來自 token 的固定值 —— 讓標記隨容器伸縮，少量資料時會脹成色塊，那正是最典型的 AI dashboard。

> **這條在 2026-09-05 修訂過。** 原本是「圖表用線不用面，禁止實心填色」，
> 但照著做出來的長條圖只有 1px、讀不出高度差。修訂後保留了原約束真正在保護的東西
> （標記寬度是刻意選的，不是被容器撐出來的），同時讓圖表可讀。理由見 DECISIONS F10。

> 原本還有第五條「內距不得小於圓角」，現在已經變成 `check_usage.py` 的自動檢查，
> 所以從禁止清單移除了 —— 能被程式擋的東西不該留在需要人記得的清單裡。

## 5. token

375+ 個。`./build.sh` 一次產出全部衍生檔。

```
tokens/mist.tokens-studio.json   ← 唯一真實來源，Tokens Studio 讀寫這份
css/mist.tokens.css              ← 前端引入這份
docs/tokens.md                   ← 每個 token 的來源與用途
tokens/build/mist.tokens.json    ← W3C DTCG，餵 style-dictionary（也是跨到 App 的橋）
```

改完 token 後：

```bash
./build.sh
```

驗證一定要跑（`build.sh` 已包含）—— 格式錯誤在 Figma 裡不會報錯，只會靜靜壞掉。

## 6. 元件

12 個，實作在 `css/components.css`，全狀態展示在 `reference.html`。

Surface / Nav / Button / Badge / OptionCard / SpecCard / Progress / TaskItem / StatTile / GeneratingState / Field

**圖表**（各有職責，不要混用）：

| 元件 | 職責 |
|---|---|
| `.mist-linechart` | 時間序列。平滑曲線 + 虛線格線 + hover tooltip |
| `.mist-funnel` | 階段轉換。8px 條，每階段一根深色標記 |
| `.mist-donut` / `--half` | 部分佔整體、單一比例儀表。8px 描邊 |
| `.mist-lollipop` | 少量分類。12px 圓頭條 + 圓點 |
| `.mist-hairbars` | **趨勢紋理，不用來讀個別數值**。2px 細線 |

折線圖的 hover 需要選配的 `js/mist-charts.js`；**沒有它靜態外觀依然正確**（曲線的 `d` 寫在 markup 裡）。

實作 pattern 沿用 Duo：基底 class 只描述結構並讀 local variable，變體 class 只填 comp token、零屬性宣告。
新增變體不必碰任何選擇器，也不可能漏掉狀態。

清單與用法見 [COMPONENTS.md](COMPONENTS.md)。

## 7. 頁面範本

| 檔案 | 用途 |
|---|---|
| `pages/questionnaire.html` | 問卷／選擇題流程 |
| `pages/plan-review.html` | AI 產出規劃表 + 確認（含生成中狀態） |
| `pages/dashboard.html` | 任務追蹤 |
| `reference.html` | 元件全狀態參考 |

骨架層做了「主 2 : 次 1 兩欄」（`.mist-split`，比例偷 Polaris 的 resource details）與單欄置中（`.mist-shell--narrow`）。
其他骨架與成品範本尚未做，見「已知債務」。

---

## 這個風格特有的陷阱

實際做出來才發現的，不是理論。

**一、元件會預設自己在白卡上。**
`surface-inset`（`neutral.10`）和 app 容器同色。任何用 inset 當底的元件一放到 app 底色上就**同色消失**。
進度條就踩到了 —— 未完成的段落整條隱形。

修法：需要在任何表面上都看得見的東西，用 `sys.color.surface-track`（`neutral.20`，深一階）。
`surface-inset` 只能用在白卡內。

**二、亮度分層很依賴中性色階刻得夠細。**
`neutral` 有 0/3/5/10/15/20/… 這種非等距刻度，是因為分層需要「差一點但看得出來」的相鄰值。
不要為了整齊把它改成等距。

**三、大圓角讓「內距」變成幾何問題，不只是留白問題。**
圓角 24px 的卡片如果內距只有 16px，文字會從弧線的內側開始，看起來被擠壓。
內距等於圓角時，文字起點剛好落在邊框由彎轉直的位置。

這條在小圓角的風格裡無關緊要（圓角 4px 時差別看不出來），但 mist 的圓角很大，
所以它變成硬約束。間距刻度因此必須有 24 和 40 兩級來配對兩級圓角。

**四、`[hidden]` 會被元件的 `display` 蓋掉。**
`.mist-generating { display: flex }` 的優先度高於瀏覽器的 `[hidden] { display: none }`。
`components.css` 裡已加 `[hidden] { display: none !important }` —— 不要拿掉。

---

## 已知債務

| 項目 | 說明 |
|---|---|
| **招牌細節不是原創** | 這是最大的一筆。要正式當主力風格前，招牌要換成自己的東西 |
| motion token | duration / easing 目前寫在 CSS 裡（`140ms ease`）。屬 Guidelines 4.2 的已知例外 |
| breakpoint token | `@media` 讀不到 CSS 變數，這是技術限制不是疏漏。目前只有一個 900px 斷點 |
| z-index token | 尚未需要 |
| 其餘骨架與成品範本 | 只做了黑客松需要的三頁。缺 list-detail、settings、auth、狀態組 |
| 狀態變體 | `plan-review` 有生成中狀態，但 dashboard / 列表的「沒資料 / 資料爆多」還沒做 |
| 深色模式 | 沒做。亮度階梯要整條反轉，不是換幾個顏色就好 |
