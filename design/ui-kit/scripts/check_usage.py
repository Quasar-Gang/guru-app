#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""檢查元件／頁面 CSS 是否遵守設計系統規則。

用法:
    python3 check_usage.py --tokens <tokens.css> --components <components.css> [--pages <a.html> ...]

檢查項目（error 讓 exit code = 1）：
  1. var() 引用的 token 是否真的存在
  2. 元件是否只引用 comp 層（標了 @allow-sys 的區段例外——排版／版面 utility
     本來就是 sys 的公開介面，不該再包一層無意義的 comp alias）
  3. 是否有 hard-code 的數值（例外清單見 Guidelines 4.2；1px 不在例外裡）
  4. 頁面是否有 inline style、寫死顏色、或自己新增樣式定義（＝detach instance）

這支是未來 lint 的雛形。四個入口（PreToolUse / Stop / pre-commit / CI）之後共用它。
"""
import argparse, re, sys, collections

VAR_DEF  = re.compile(r"(?:^|[{;])\s*(--[a-z0-9-]+)\s*:", re.M)
VAR_USE  = re.compile(r"var\(\s*(--[a-z0-9-]+)")
HEX      = re.compile(r"#[0-9a-fA-F]{3,8}\b")
LEN      = re.compile(r"(?<![\w.-])(\d+(?:\.\d+)?)(px|rem|em)\b")
SECTION  = re.compile(r"/\*+([^*]|\*(?!/))*\*/", re.S)
# 「資料介面」：刻意由頁面提供、不存在於 token 檔的變數。
# 必須在 CSS 檔頭的註解裡以 `*   --name` 的形式宣告過才准用
# —— 文件本身就是宣告，忘了寫文件就會被擋下來。
DATA_DECL = re.compile(r"^\s*\*\s+(--[a-z0-9-]+)\s", re.M)

# Guidelines 4.2 允許的例外
OK_LEN = {"1em"}                     # 長度值一律要 token。1em＝「與文字同高」，屬結構值
OK_CTX = (
    "animation", "transition", "@media",      # motion / breakpoint 是已知缺口
)

def mask_comments(text, open_tok="/*", close_tok="*/"):
    """把註解內容換成空白，但保留換行 —— 行號不變，
    註解裡寫的示例數值（例如「線寬固定 8px」）才不會被當成 hard-code。"""
    out, i, n = [], 0, len(text)
    while i < n:
        if text.startswith(open_tok, i):
            j = text.find(close_tok, i + len(open_tok))
            j = n if j == -1 else j + len(close_tok)
            out.append("".join("\n" if c == "\n" else " " for c in text[i:j]))
            i = j
        else:
            out.append(text[i]); i += 1
    return "".join(out)


def load_defined(path):
    return set(VAR_DEF.findall(open(path, encoding="utf-8").read()))

def allow_sys_ranges(text):
    """回傳允許引用 sys 的行號區間：從 @allow-sys 註解到下一個區段標題。"""
    lines = text.split("\n")
    ranges, start = [], None
    for i, ln in enumerate(lines, 1):
        if "@allow-sys" in ln:
            start = i
        elif start and re.match(r"\s*/\*\s*═+", ln):
            ranges.append((start, i)); start = None
    if start:
        ranges.append((start, len(lines)))
    return ranges

def in_ranges(n, ranges):
    return any(a <= n <= b for a, b in ranges)

def check_css(path, defined, errors, warns):
    raw = open(path, encoding="utf-8").read()
    # 宣告（local var、資料介面、@allow-sys）寫在註解裡，要從原文讀；
    # 檢查則對遮掉註解的版本做。
    local = set(VAR_DEF.findall(raw)) | set(DATA_DECL.findall(raw))
    allow = allow_sys_ranges(raw)
    text = mask_comments(raw)
    for n, ln in enumerate(text.split("\n"), 1):
        stripped = ln.strip()
        if not stripped:
            continue
        # 1 + 2：var() 引用
        for v in VAR_USE.findall(ln):
            if v in local:
                continue
            if v not in defined:
                errors.append(f"{path}:{n} 引用了不存在的 token {v}")
                continue
            parts = v.lstrip("-").split("-")
            layer = parts[1] if len(parts) > 1 else "?"
            if layer in ("sys", "ref") and not in_ranges(n, allow):
                warns.append(f"{path}:{n} 元件直接引用 {layer} 層：{v}（應改為 comp token）")
        # 3：hard-code
        if HEX.search(ln):
            errors.append(f"{path}:{n} 寫死顏色：{HEX.search(ln).group(0)}")
        for num, unit in LEN.findall(ln):
            if any(k in ln for k in OK_CTX):
                continue
            if f"{num}{unit}" in OK_LEN:
                continue
            errors.append(f"{path}:{n} 寫死長度：{num}{unit} —— {stripped[:64]}")

def check_page(path, defined, errors, warns):
    text = mask_comments(open(path, encoding="utf-8").read(), "<!--", "-->")
    for n, ln in enumerate(text.split("\n"), 1):
        # inline style 只允許純粹的 custom property 宣告（資料介面）。
        # 混進任何一般屬性就是 detach —— 不能靠「含有 -- 就放行」蒙過去。
        for attr in re.findall(r'\sstyle\s*=\s*"([^"]*)"', ln):
            decls = [d.strip() for d in attr.split(";") if d.strip()]
            bad = [d for d in decls if not d.startswith("--")]
            if bad:
                errors.append(f"{path}:{n} 頁面用了 inline style（＝detach instance）："
                              + "; ".join(bad[:3]))
        if HEX.search(ln):
            errors.append(f"{path}:{n} 頁面寫死顏色：{HEX.search(ln).group(0)}")
    # 頁面內的 <style> 區塊：不得新增樣式定義
    for blk in re.findall(r"<style[^>]*>(.*?)</style>", text, re.S):
        sels = [s for s in re.findall(r"^\s*([.#][\w-][^{]*)\{", blk, re.M)]
        if sels:
            errors.append(f"{path} 頁面層新增了樣式定義：{', '.join(s.strip() for s in sels[:5])}")

def check_padding_vs_radius(tokens_path, errors):
    """內距不得小於圓角。

    文字若從圓角弧線的內側開始，視覺上會被弧線擠壓；內距等於圓角時，
    文字起點剛好落在邊框由彎轉直的位置。內距大於圓角是安全的（刻意加寬），
    小於才是問題。這條規則沒辦法用 token 的「不存在」擋掉——同一組
    spacing 與 shape 刻度可以任意配對——所以只能用檢查。
    """
    text = open(tokens_path, encoding="utf-8").read()
    val = {m.group(1): m.group(2).strip()
           for m in re.finditer(r"(--[a-z0-9-]+):\s*([^;]+);", text)}

    def resolve(v, d=0):
        if d > 10:
            return v
        m = re.fullmatch(r"var\((--[a-z0-9-]+)\)", v.strip())
        return resolve(val[m.group(1)], d + 1) if m and m.group(1) in val else v

    def px(v):
        m = re.match(r"(-?\d+(?:\.\d+)?)px", resolve(v).strip())
        return float(m.group(1)) if m else None

    comps = collections.defaultdict(dict)
    for k in val:
        m = re.match(r"--[a-z0-9]+-comp-([a-z0-9-]+?)-(?:container-)?(shape|padding-x|padding)$", k)
        if m:
            comps[m.group(1)][m.group(2)] = k
    for name, d in sorted(comps.items()):
        if "shape" not in d:
            continue
        pk = d.get("padding-x") or d.get("padding")
        if not pk:
            continue
        r, pad = px(val[d["shape"]]), px(val[pk])
        if r is None or pad is None or r >= 9999:
            continue
        if pad < r:
            errors.append(f"{name}：左右內距 {pad:g}px 小於圓角 {r:g}px"
                          f" —— 文字會擠在圓角弧線裡。把內距加大到 {r:g}px，或把圓角縮小")


def check_overrides(path, warns):
    """local-overrides.css 是洩壓閥：允許寫，但要讓債務看得見。"""
    try:
        text = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        return
    body = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    rules = re.findall(r"([^{}]+)\{", body)
    rules = [r.strip() for r in rules if r.strip() and not r.strip().startswith("@")]
    if rules:
        warns.append(f"{path} 有 {len(rules)} 條還沒回庫的 override："
                     + ", ".join(rules[:5]) + (" …" if len(rules) > 5 else ""))
        warns.append("  → 這些應該回到設計系統的 components.css，然後重新複製 ui/ 覆蓋過來")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tokens", required=True)
    ap.add_argument("--components", nargs="*", default=[])
    ap.add_argument("--pages", nargs="*", default=[])
    ap.add_argument("--skip-geometry", action="store_true",
                    help="跳過「內距不得小於圓角」的檢查")
    ap.add_argument("--overrides", default=None,
                    help="local-overrides.css 的路徑。有內容時列為可見債務（警告，不是錯誤）")
    a = ap.parse_args()

    defined = load_defined(a.tokens)
    errors, warns = [], []
    if not a.skip_geometry:
        check_padding_vs_radius(a.tokens, errors)
    for f in a.components:
        check_css(f, defined, errors, warns)
    for f in a.pages:
        check_page(f, defined, errors, warns)
    if a.overrides:
        check_overrides(a.overrides, warns)

    print(f"已定義 token：{len(defined)}")
    if warns:
        print(f"\n--- 警告（{len(warns)}）---")
        for w in warns: print("  " + w)
    if errors:
        print(f"\n--- 錯誤（{len(errors)}）---")
        for e in errors: print("  " + e)
        print(f"\n不通過：{len(errors)} 個錯誤。")
        sys.exit(1)
    print("\n通過。" + (f"（{len(warns)} 個警告）" if warns else ""))

if __name__ == "__main__":
    main()
