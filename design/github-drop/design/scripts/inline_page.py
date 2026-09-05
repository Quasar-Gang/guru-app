#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 pages/ 底下的一頁攤平成單檔，給 Artifact 用。

用法:
    python3 scripts/inline_page.py pages/01-intake.html ../demo/01-intake.html
    python3 scripts/inline_page.py pages/01-intake.html build/01-intake.html --standalone

為什麼需要這支：Artifact 是單一檔案，相對路徑的 CSS 上去就沒了。
所以發佈版必須把 ui/ 的兩支 CSS 內嵌進來。

三件轉換：
  1. 去掉 doctype / html / head / body 標籤 —— Artifact 會自己包一層
  2. 內嵌的 CSS 裡 `body.mist` 改寫成 `body` —— Artifact 的 body 我們加不到 class
  3. 字體的 <link> 保留（fonts.googleapis.com 在 Artifact 的 CSP 允許清單裡）

加 --standalone 會輸出完整的 HTML 文件（有 doctype / head / body），
給靜態主機用（NAS 的 Web Station、任何 web server）。不加就是 Artifact 用的片段。

**來源永遠是 pages/ 那一份**（它才過得了 check.sh）。輸出檔不要手改，改了下次會被蓋掉。
"""
import os, re, sys

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    standalone = "--standalone" in sys.argv
    if len(args) != 2:
        print(__doc__); return 1
    src, dst = args
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    html = open(src, encoding="utf-8").read()

    # 依 <link> 出現的順序把本地 CSS 讀進來（順序就是層疊順序，不能重排）
    css = []
    for href in re.findall(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', html):
        if href.startswith("http"):
            continue
        path = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(src)), href))
        text = open(path, encoding="utf-8").read()
        if not text.strip():
            continue
        css.append("/* ── %s ── */\n%s" % (os.path.relpath(path, root), text))
    css = "\n".join(css).replace("body.mist", "body")

    # 只留 <title>、字體 <link>、內嵌 <style>、以及 <body> 裡的內容
    title = re.search(r"<title>(.*?)</title>", html, re.S).group(1)
    fonts = re.findall(r'<link[^>]+href="https://fonts\.[^"]+"[^>]*>', html)
    body  = re.search(r"<body[^>]*>(.*)</body>", html, re.S).group(1).strip()

    if standalone:
        # 自己站得住的完整文件（放 NAS、放任何靜態主機用），body 的 class 留著
        out = ("<!doctype html>\n<html lang=\"zh-Hant\">\n<head>\n<meta charset=\"utf-8\">\n"
               "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
               "<title>%s</title>\n%s\n<style>\n%s\n</style>\n</head>\n<body class=\"mist\">\n%s\n</body>\n</html>\n"
               % (title, "\n".join(fonts), css.replace("body {", "body.mist {"), body))
    else:
        out = ("<title>%s</title>\n%s\n\n<style>\n%s\n</style>\n\n%s\n"
               % (title, "\n".join(fonts), css, body))
    open(dst, "w", encoding="utf-8").write(out)
    print("寫出 %s（%d KB）" % (dst, len(out.encode("utf-8")) // 1024))
    return 0

if __name__ == "__main__":
    sys.exit(main())
