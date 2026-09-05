/* mist — 圖表的選配輔助
 *
 * 這支是「選配」的。不載入它，圖表的靜態外觀完全正確 —— 曲線的 d
 * 可以直接寫在 markup 裡。它只負責兩件 CSS 做不到的事：
 *   1. 從一串數字算出平滑曲線的 path
 *   2. hover 時移動垂直指示線、圓點與 tooltip
 *
 * 零依賴，不需要建置。用法：
 *   <script src="../ui/mist-charts.js" defer></script>
 * 頁面載入後會自動掃 [data-mist-linechart]；動態塞資料的話再呼叫
 *   mistCharts.init(rootElement)
 */
(function (global) {
  "use strict";

  var VB_W = 100, VB_H = 100;   // 所有折線圖都用 100×100 的 viewBox，實際尺寸交給 CSS

  function parseValues(el) {
    var raw = (el.getAttribute("data-values") || "").trim();
    if (!raw) return [];
    return raw.split(/[\s,]+/).map(Number).filter(function (v) { return !isNaN(v); });
  }

  /* 把數值陣列換成 viewBox 座標。min/max 可指定，否則自動取。 */
  function toPoints(values, min, max) {
    var n = values.length;
    if (n < 2) return [];
    var lo = (min === null || min === undefined) ? Math.min.apply(null, values) : min;
    var hi = (max === null || max === undefined) ? Math.max.apply(null, values) : max;
    var span = (hi - lo) || 1;
    return values.map(function (v, i) {
      return {
        x: (i / (n - 1)) * VB_W,
        y: VB_H - ((v - lo) / span) * VB_H
      };
    });
  }

  /* Catmull-Rom 轉三次貝茲，得到平滑曲線。tension 0.5 是標準值。 */
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    var d = "M" + pts[0].x.toFixed(2) + "," + pts[0].y.toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || p2;
      var c1x = p1.x + (p2.x - p0.x) / 6;
      var c1y = p1.y + (p2.y - p0.y) / 6;
      var c2x = p2.x - (p3.x - p1.x) / 6;
      var c2y = p2.y - (p3.y - p1.y) / 6;
      d += "C" + c1x.toFixed(2) + "," + c1y.toFixed(2) +
           " " + c2x.toFixed(2) + "," + c2y.toFixed(2) +
           " " + p2.x.toFixed(2) + "," + p2.y.toFixed(2);
    }
    return d;
  }

  function initLineChart(root) {
    if (root.__mistReady) return;
    root.__mistReady = true;

    var svg    = root.querySelector(".mist-linechart__svg");
    var lines  = [].slice.call(root.querySelectorAll(".mist-linechart__line"));
    var cursor = root.querySelector(".mist-linechart__cursor");
    var marks  = [].slice.call(root.querySelectorAll(".mist-linechart__marker"));
    var tip    = root.querySelector(".mist-linechart__tip");
    var tipVal = root.querySelector(".mist-linechart__tip-value");
    var tipTit = root.querySelector(".mist-linechart__tip-title");
    var ticks  = [].slice.call(root.querySelectorAll(".mist-linechart__xtick"));
    var plot   = root.querySelector(".mist-linechart__plot");
    if (!svg || !lines.length) return;

    var min = root.hasAttribute("data-min") ? Number(root.getAttribute("data-min")) : null;
    var max = root.hasAttribute("data-max") ? Number(root.getAttribute("data-max")) : null;
    var labels = (root.getAttribute("data-labels") || "").split(",");

    /* 每條線各自算 path。已經有 d 的就不覆蓋 —— 手寫優先。 */
    var series = lines.map(function (line) {
      var vals = parseValues(line);
      var pts  = toPoints(vals, min, max);
      if (pts.length && !line.getAttribute("d")) line.setAttribute("d", smoothPath(pts));
      return { el: line, values: vals, points: pts };
    }).filter(function (s) { return s.points.length; });
    if (!series.length) return;

    var count = series[0].points.length;

    /* tooltip 報主序列的值。次序列在 DOM 裡排前面（才會被畫在下層），
       所以不能直接拿 series[0]。 */
    var primary = series.filter(function (s) {
      return s.el.classList.contains("mist-linechart__line--primary");
    })[0] || series[series.length - 1];

    function show(i) {
      var s0 = series[0];
      var x  = s0.points[i].x;
      if (cursor) { cursor.setAttribute("x1", x); cursor.setAttribute("x2", x); }
      marks.forEach(function (m, k) {
        var s = series[k] || s0;
        var p = s.points[Math.min(i, s.points.length - 1)];
        m.setAttribute("cx", p.x); m.setAttribute("cy", p.y);
      });
      if (tipVal) tipVal.textContent = primary.values[Math.min(i, primary.values.length - 1)].toLocaleString();
      if (tipTit && labels[i]) tipTit.textContent = labels[i].trim();
      if (tip && plot) {
        /* tooltip 貼著游標，但不要溢出繪圖區 */
        var w = plot.clientWidth;
        var px = (x / VB_W) * w;
        var tw = tip.offsetWidth;
        tip.style.left = Math.max(0, Math.min(px - tw / 2, w - tw)) + "px";
      }
      ticks.forEach(function (t, k) { t.classList.toggle("is-selected", k === i); });
      root.classList.add("is-active");
    }

    function hide() {
      root.classList.remove("is-active");
      ticks.forEach(function (t) { t.classList.remove("is-selected"); });
      var d = root.getAttribute("data-default-index");
      if (d !== null && d !== "") {
        var i = Number(d);
        if (ticks[i]) ticks[i].classList.add("is-selected");
      }
    }

    function indexFromEvent(e) {
      var box = plot.getBoundingClientRect();
      var ratio = (e.clientX - box.left) / (box.width || 1);
      return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
    }

    plot.addEventListener("pointermove", function (e) { show(indexFromEvent(e)); });
    plot.addEventListener("pointerleave", hide);
    ticks.forEach(function (t, i) {
      t.addEventListener("pointerenter", function () { show(i); });
    });
    hide();
  }

  function init(scope) {
    var r = scope || document;
    [].slice.call(r.querySelectorAll("[data-mist-linechart]")).forEach(initLineChart);
  }

  global.mistCharts = { init: init, smoothPath: smoothPath, toPoints: toPoints };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); });
  } else {
    init();
  }
})(window);
