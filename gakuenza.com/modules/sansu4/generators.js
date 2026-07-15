// 算数 4年 — Gakuenza module content & problem generators
// すべてオリジナル教材。東京書籍『新編 新しい算数4』(令和6年度版) の
// 単元構成（14単元・上下2巻）に対応させているが、問題そのものは全て
// 独自生成 — 教科書の問題文・数値・図版は一切転載していない。
//
// アーキテクチャは sansu3 の生成器パターンをそのまま踏襲する
// （固定の問題バンクではなく、毎回パラメータから問題を生成する）。
//
// 各 section は gen() を持ち、ONE problem object を返す:
//   {
//     tid,               // template id — 問題TYPEごとに安定。
//                        //   activity_result_items.item_ref に使う
//                        //   （カテゴリ集計・誤答分析のグループ化キー）
//     category,          // gradebook 分析カテゴリ（日本語ラベル）
//     q,                 // 問題文
//     fig,               // 任意: inner-HTML の SVG 図
//     kind: 'typed' | 'choice',
//     answer,            // typed: 正答の文字列
//     accepted,          // typed: 受理する正規化前の別表記の配列
//     inputMode,         // typed: 'numeric' | 'text'
//     unitSuffix,        // typed: 入力欄のうしろに表示する単位（例 'cm'）
//     choices,           // choice: 選択肢の配列（シャッフル済み）
//     correctChoice,     // choice: 正しい選択肢のテキスト
//     exp,               // 答え合わせ後に表示する説明
//   }
// 問題は毎回あたらしく生成される（練習は無制限）が、tid/category は
// TYPEごとに安定なので、教師用 gradebook のカテゴリ集計・誤答分析は
// 何度挑戦しても機能しつづける。

(function () {
  'use strict';

  // ---------- rng helpers ----------
  function ri(lo, hi) { // inclusive
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }
  function pick(arr) { return arr[ri(0, arr.length - 1)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = ri(0, i);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function comma(n) { return Number(n).toLocaleString('ja-JP'); }

  // decimal helpers — keep arithmetic in integer 1/100 units to avoid
  // floating-point drift, then format cleanly (strip trailing zeros).
  function fmtDec(hundredths) {
    const neg = hundredths < 0;
    let h = Math.abs(Math.round(hundredths));
    const whole = Math.floor(h / 100);
    const frac = h % 100;
    let s;
    if (frac === 0) s = String(whole);
    else if (frac % 10 === 0) s = whole + '.' + (frac / 10);
    else s = whole + '.' + String(frac).padStart(2, '0');
    return (neg ? '-' : '') + s;
  }

  const NAMES = ['ゆい', 'はると', 'さくら', 'そうた', 'ひなた', 'りく', 'あおい', 'みお', 'いつき', 'こはる'];
  const THINGS = [
    { n: 'あめ', c: 'こ' }, { n: 'えんぴつ', c: '本' }, { n: 'おり紙', c: 'まい' },
    { n: 'クッキー', c: 'こ' }, { n: 'カード', c: 'まい' }, { n: 'ビー玉', c: 'こ' },
    { n: 'シール', c: 'まい' }, { n: 'いちご', c: 'こ' },
  ];

  // ---------- answer form helpers ----------
  function typed(o) { o.kind = 'typed'; o.accepted = o.accepted || [o.answer]; o.inputMode = o.inputMode || 'numeric'; return o; }

  // Robust choice builder: guarantees exactly 4 DISTINCT options, the
  // correct one present exactly once, and NO distractor equal to the
  // correct value (the "secretly-also-correct" bug). wrongs is a list of
  // candidate distractors (strings/numbers); fill() optionally supplies
  // more if dedup leaves fewer than 3. Throws in dev if it can't fill —
  // the stress test asserts this never happens.
  function choice(o, correct, wrongs, fill) {
    o.kind = 'choice';
    const c = String(correct);
    o.correctChoice = c;
    const seen = new Set([c]);
    const opts = [];
    for (let i = 0; i < wrongs.length && opts.length < 3; i++) {
      const s = String(wrongs[i]);
      if (!seen.has(s)) { seen.add(s); opts.push(s); }
    }
    let guard = 0;
    while (opts.length < 3 && typeof fill === 'function' && guard++ < 500) {
      const s = String(fill());
      if (!seen.has(s)) { seen.add(s); opts.push(s); }
    }
    o.choices = shuffle([c].concat(opts));
    return o;
  }

  // ---------- SVG figure builders (all original drawings) ----------
  const SVG_OPEN = '<svg viewBox="0 0 %W% %H%" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" role="img">';
  function svg(w, h, body) {
    return SVG_OPEN.replace('%W%', w).replace('%H%', h) + body + '</svg>';
  }

  // line graph: labels[], values[], 1 grid line per `step`
  function lineFig(labels, values, unitLabel, xLabel, step) {
    const max = Math.max.apply(null, values);
    const top = Math.ceil(max / step) * step;
    const W = 360, H = 250, L = 44, B = 205, R = 12, plotH = 176, top0 = 22;
    let body = '<line x1="' + L + '" y1="' + B + '" x2="' + (W - R) + '" y2="' + B + '" stroke="#3a4555" stroke-width="2"/>' +
      '<line x1="' + L + '" y1="' + B + '" x2="' + L + '" y2="' + top0 + '" stroke="#3a4555" stroke-width="2"/>' +
      '<text x="' + (L - 6) + '" y="16" font-size="12" text-anchor="end" fill="#3a4555">(' + unitLabel + ')</text>';
    for (let v = 0; v <= top; v += step) {
      const y = B - plotH * v / top;
      body += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - R) + '" y2="' + y.toFixed(1) + '" stroke="#e4ddcc" stroke-width="1"/>' +
        '<text x="' + (L - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="12" text-anchor="end" fill="#3a4555">' + v + '</text>';
    }
    const n = labels.length;
    const gap = (W - R - L) / (n + 1);
    const pts = labels.map(function (lb, i) {
      const x = L + gap * (i + 1);
      const y = B - plotH * values[i] / top;
      return { x: x, y: y };
    });
    // vertical guide + x labels
    labels.forEach(function (lb, i) {
      body += '<text x="' + pts[i].x.toFixed(1) + '" y="' + (B + 17) + '" font-size="12" text-anchor="middle" fill="#1c2530">' + lb + '</text>';
    });
    // polyline
    let d = '';
    pts.forEach(function (p, i) { d += (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ' '; });
    body += '<path d="' + d.trim() + '" fill="none" stroke="#4a6b4f" stroke-width="2.5"/>';
    pts.forEach(function (p) { body += '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="#b5572e"/>'; });
    if (xLabel) body += '<text x="' + (W - R) + '" y="' + (B + 17) + '" font-size="11" text-anchor="end" fill="#3a4555">(' + xLabel + ')</text>';
    return svg(W, H, body);
  }

  // angle at the vertex: horizontal ray to the right + ray at `deg`, arc marked
  function angleFig(deg) {
    const cx = 110, cy = 172, r = 96;
    const a = deg * Math.PI / 180;
    const x2 = cx + r * Math.cos(a), y2 = cy - r * Math.sin(a);
    let body = '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#3a4555" stroke-width="3"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="#3a4555" stroke-width="3"/>';
    const ar = 30;
    const ax = cx + ar, ay = cy;
    const bx = cx + ar * Math.cos(a), by = cy - ar * Math.sin(a);
    const large = deg > 180 ? 1 : 0;
    body += '<path d="M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + ' A' + ar + ' ' + ar + ' 0 ' + large + ' 0 ' + bx.toFixed(1) + ' ' + by.toFixed(1) + '" fill="none" stroke="#b5572e" stroke-width="2.5"/>';
    body += '<text x="' + (cx + (ar + 16) * Math.cos(a / 2)).toFixed(1) + '" y="' + (cy - (ar + 16) * Math.sin(a / 2) + 5).toFixed(1) + '" font-size="16" text-anchor="middle" fill="#b5572e">?</text>';
    body += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="#1c2530"/>';
    return svg(220, 200, body);
  }

  // number line 0..wholeMax (tenths), arrow at v
  function numlineFig(v, wholeMax) {
    const W = 360, y = 60, x0 = 24, x1 = 336;
    const span = x1 - x0;
    let body = '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '" stroke="#3a4555" stroke-width="2"/>';
    for (let i = 0; i <= wholeMax * 10; i++) {
      const x = x0 + span * i / (wholeMax * 10);
      const big = i % 10 === 0;
      body += '<line x1="' + x.toFixed(1) + '" y1="' + (y - (big ? 12 : 6)) + '" x2="' + x.toFixed(1) + '" y2="' + y + '" stroke="#3a4555" stroke-width="' + (big ? 2 : 1) + '"/>';
      if (big) body += '<text x="' + x.toFixed(1) + '" y="' + (y + 20) + '" font-size="14" text-anchor="middle" fill="#1c2530">' + (i / 10) + '</text>';
    }
    const ax = x0 + span * v / wholeMax;
    body += '<path d="M' + ax.toFixed(1) + ' ' + (y - 30) + ' l -7 -12 h 14 z" fill="#b5572e"/>' +
      '<line x1="' + ax.toFixed(1) + '" y1="' + (y - 30) + '" x2="' + ax.toFixed(1) + '" y2="' + (y - 14) + '" stroke="#b5572e" stroke-width="3"/>';
    return svg(W, 92, body);
  }

  // fraction bar: 1 strip cut into d parts, n shaded (n may exceed d -> multi-strip capped)
  function fracFig(n, d) {
    const W = 340, x0 = 20, w = 300, y0 = 34, h = 40;
    const shade = Math.min(n, d);
    let body = '<text x="' + (x0 + w / 2) + '" y="20" font-size="14" text-anchor="middle" fill="#3a4555">1</text>';
    for (let i = 0; i < d; i++) {
      const x = x0 + w * i / d;
      body += '<rect x="' + x.toFixed(1) + '" y="' + y0 + '" width="' + (w / d).toFixed(1) + '" height="' + h + '" fill="' + (i < shade ? '#c9a24b' : '#fffdf8') + '" stroke="#3a4555" stroke-width="2"/>';
    }
    return svg(W, 96, body);
  }

  // rectangle with labeled width/height
  function rectFig(wLab, hLab) {
    const W = 260, H = 180, x = 40, y = 30, rw = 150, rh = 110;
    let body = '<rect x="' + x + '" y="' + y + '" width="' + rw + '" height="' + rh + '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    body += '<text x="' + (x + rw / 2) + '" y="' + (y + rh + 22) + '" font-size="15" font-weight="bold" text-anchor="middle" fill="#1c2530">' + wLab + '</text>';
    body += '<text x="' + (x - 10) + '" y="' + (y + rh / 2 + 5) + '" font-size="15" font-weight="bold" text-anchor="end" fill="#1c2530">' + hLab + '</text>';
    return svg(W, H, body);
  }

  // rectangular prism (cabinet projection) with labeled edges
  function boxFig(aLab, bLab, cLab) {
    const x = 50, y = 60, w = 120, h = 80, dx = 46, dy = -32;
    function ln(x1, y1, x2, y2, dash) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#4a6b4f" stroke-width="2.5"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    }
    let body = '';
    // front face
    body += ln(x, y, x + w, y) + ln(x + w, y, x + w, y + h) + ln(x + w, y + h, x, y + h) + ln(x, y + h, x, y);
    // back face (dashed hidden edges partly)
    body += ln(x + dx, y + dy, x + w + dx, y + dy) + ln(x + w + dx, y + dy, x + w + dx, y + h + dy) +
      ln(x + w + dx, y + h + dy, x + dx, y + h + dy, true) + ln(x + dx, y + h + dy, x + dx, y + dy, true);
    // connectors
    body += ln(x, y, x + dx, y + dy) + ln(x + w, y, x + w + dx, y + dy) + ln(x + w, y + h, x + w + dx, y + h + dy) +
      ln(x, y + h, x + dx, y + h + dy, true);
    body += '<text x="' + (x + w / 2) + '" y="' + (y + h + 20) + '" font-size="14" font-weight="bold" text-anchor="middle" fill="#1c2530">' + aLab + '</text>';
    body += '<text x="' + (x + w + 8) + '" y="' + (y + h / 2 + 5) + '" font-size="14" font-weight="bold" text-anchor="start" fill="#1c2530">' + bLab + '</text>';
    body += '<text x="' + (x + w + dx / 2 + 6) + '" y="' + (y + dy / 2 + 4) + '" font-size="14" font-weight="bold" text-anchor="start" fill="#1c2530">' + cLab + '</text>';
    return svg(240, 170, body);
  }

  // ================= generators per unit =================

  // ---------- U1 大きい数のしくみ ----------
  function genBigNumbers() {
    const t = ri(0, 3);
    if (t === 0) { // compose from place-value pieces (億 range)
      const oku = ri(1, 9), man = ri(1, 99);
      const n = oku * 100000000 + man * 10000;
      return typed({
        tid: 'big-compose', category: '大きい数のしくみ',
        q: '1億を' + oku + 'こ、1万を' + man + 'こ合わせた数を数字で書きましょう。',
        answer: String(n), accepted: [String(n), comma(n)],
        exp: '位ごとにあてはめると ' + comma(n) + ' です。',
      });
    }
    if (t === 1) { // 10倍 / 100倍 / 1/10
      const base = ri(12, 98) * 100000; // ends in many zeros for clean scaling
      const mode = pick(['x10', 'x100', 'd10']);
      const ans = mode === 'x10' ? base * 10 : mode === 'x100' ? base * 100 : base / 10;
      return typed({
        tid: 'big-scale', category: '10倍・100倍・10でわった数',
        q: comma(base) + ' を' + (mode === 'x10' ? '10倍' : mode === 'x100' ? '100倍' : '10でわった数') + 'にした数を数字で書きましょう。',
        answer: String(ans), accepted: [String(ans), comma(ans)],
        exp: mode === 'd10' ? '10でわると位が1つ下がります。' + comma(base) + ' → ' + comma(ans) + '。'
          : (mode === 'x10' ? '10倍すると位が1つ上がり、右に0を1つつけます。' : '100倍すると位が2つ上がり、右に0を2つつけます。') + ' 答えは ' + comma(ans) + '。',
      });
    }
    if (t === 2) { // 3-digit × 3-digit
      const a = ri(112, 899), b = ri(112, 899);
      return typed({
        tid: 'big-mul3', category: '3けた×3けたのかけ算',
        q: a + ' × ' + b + ' を筆算でけいさんして、答えを書きましょう。',
        answer: String(a * b), accepted: [String(a * b), comma(a * b)],
        exp: '一の位・十の位・百の位でそれぞれかけて、位をそろえてたします。答えは' + comma(a * b) + 'です。',
      });
    }
    // compare (億/兆)
    const useTril = Math.random() < 0.4;
    const a = useTril ? ri(1, 9) * 1000000000000 + ri(0, 999) * 100000000 : ri(1, 9) * 100000000 + ri(0, 9999) * 10000;
    let b = a + pick([-1, 1]) * (useTril ? ri(1, 900) * 100000000 : ri(1, 900) * 10000);
    if (b === a) b = a + (useTril ? 100000000 : 10000);
    const bigger = a > b ? a : b;
    // A 大小くらべ question offers exactly the two numbers being compared —
    // no invented decoys (those could exceed the correct answer, and aren't
    // even in the prompt). Matches sansu3's comparison pattern.
    return choice({
      tid: 'big-compare', category: '大きい数のくらべ方',
      q: comma(a) + ' と ' + comma(b) + ' では、どちらが大きいですか。',
      exp: 'けた数が同じときは、上の位からじゅんにくらべます。',
    }, comma(bigger), [comma(bigger === a ? b : a)]);
  }

  // ---------- U2 折れ線グラフと表 ----------
  function genLineGraph() {
    const themes = [
      { title: '気温', unit: '度', x: '時', labels: ['9', '10', '11', '12', '1', '2'] },
      { title: '池の水温', unit: '度', x: '月', labels: ['4', '5', '6', '7', '8', '9'] },
      { title: 'ヘチマの高さ', unit: 'cm', x: '月', labels: ['5', '6', '7', '8', '9', '10'] },
    ];
    const th = pick(themes);
    const step = th.unit === 'cm' ? pick([10, 20]) : pick([2, 5]);
    // generate a plausible rising-then-varying series with a unique max & a
    // uniquely-largest single-step rise (for the "biggest change" question)
    const n = th.labels.length;
    let v = step * ri(1, 3);
    const values = [v];
    for (let i = 1; i < n; i++) { v += step * ri(0, 4); values.push(v); }
    // ensure unique max
    let mi = 0; values.forEach(function (x, i) { if (x > values[mi]) mi = i; });
    const fig = lineFig(th.labels, values, th.unit, th.x, step);
    const t = ri(0, 2);
    if (t === 0) { // read a value
      const i = ri(0, n - 1);
      return typed({
        tid: 'line-read', category: '折れ線グラフをよむ',
        q: th.title + 'の折れ線グラフです。' + th.x + 'が「' + th.labels[i] + '」のときの' + th.title + 'は何' + th.unit + 'ですか。',
        unitSuffix: th.unit, fig: fig, answer: String(values[i]),
        exp: 'たてのめもりは1めもり' + step + th.unit + 'です。点の高さをよみます。',
      });
    }
    if (t === 1) { // biggest single-step change
      let best = 1, bestd = -1;
      for (let i = 1; i < n; i++) { const d = Math.abs(values[i] - values[i - 1]); if (d > bestd) { bestd = d; best = i; } }
      // guard: if tie, fall through to read-max
      let ties = 0;
      for (let i = 1; i < n; i++) { if (Math.abs(values[i] - values[i - 1]) === bestd) ties++; }
      if (ties === 1) {
        const correct = th.labels[best - 1] + th.x + '〜' + th.labels[best] + th.x;
        const wrongs = [];
        for (let i = 1; i < n; i++) { if (i !== best) wrongs.push(th.labels[i - 1] + th.x + '〜' + th.labels[i] + th.x); }
        return choice({
          tid: 'line-change', category: '変化のようすをよむ',
          q: th.title + 'の折れ線グラフです。前とくらべて' + th.title + 'のかわり方がいちばん大きいのはどこですか。',
          fig: fig, exp: '線のかたむきがいちばん急なところが、かわり方が大きいところです。',
        }, correct, shuffle(wrongs));
      }
    }
    // read the maximum value's label
    return typed({
      tid: 'line-max', category: '折れ線グラフをよむ',
      q: th.title + 'の折れ線グラフです。' + th.title + 'がいちばん高いのは何' + th.x + 'のときですか。（数だけ書きましょう）',
      unitSuffix: th.x, fig: fig, answer: String(th.labels[mi]),
      exp: 'いちばん高い点をさがして、その下の目もりをよみます。',
    });
  }

  // ---------- U3 わり算の筆算(1) ÷1けた ----------
  function genDivision1() {
    const t = ri(0, 2);
    const b = ri(2, 9);
    if (t === 0) { // 2-3 digit ÷ 1 digit, exact
      const q = ri(11, t === 0 ? 98 : 98);
      const a = b * q;
      return typed({
        tid: 'div1-exact', category: 'わり算の筆算（わりきれる）',
        q: a + ' ÷ ' + b + ' を筆算でけいさんして、答えを書きましょう。',
        answer: String(q),
        exp: '大きい位からじゅんにわっていきます。' + b + '×' + q + '＝' + a + ' なので答えは' + q + 'です。',
      });
    }
    if (t === 1) { // with remainder
      const q = ri(11, 98), r = ri(1, b - 1);
      const a = b * q + r;
      return typed({
        tid: 'div1-remainder', category: 'わり算の筆算（あまりあり）', inputMode: 'text',
        q: a + ' ÷ ' + b + ' をけいさんしましょう。（れい：12あまり3）',
        answer: q + 'あまり' + r,
        accepted: [q + 'あまり' + r, q + ' あまり ' + r, q + '...' + r, q + '…' + r, q + 'r' + r],
        exp: b + '×' + q + '＝' + (b * q) + '、' + a + '−' + (b * q) + '＝' + r + '。あまり' + r + 'はわる数' + b + 'より小さいのでOKです。',
      });
    }
    // word problem (等分除)
    const q = ri(12, 48), r = ri(0, b - 1);
    const a = b * q + r;
    const th = pick(THINGS), name = pick(NAMES);
    return typed({
      tid: 'div1-word', category: 'わり算の文章題', inputMode: r ? 'text' : 'numeric',
      q: th.n + 'が' + a + th.c + 'あります。' + name + 'さんが' + b + '人で同じ数ずつ分けると、1人分は何' + th.c + 'で、何' + th.c + 'あまりますか。' + (r ? '（れい：5あまり2）' : '（数だけ書きましょう。あまりは0です）'),
      answer: r ? q + 'あまり' + r : String(q),
      accepted: r ? [q + 'あまり' + r, q + 'r' + r, q + '…' + r] : [String(q), q + 'あまり0'],
      exp: '式は ' + a + '÷' + b + '＝' + q + (r ? 'あまり' + r : '') + ' です。',
    });
  }

  // ---------- U4 角の大きさ ----------
  function genAngles() {
    const t = ri(0, 3);
    if (t === 0) { // read an angle off the figure
      const deg = pick([30, 40, 45, 50, 60, 70, 80, 100, 110, 120, 130, 135, 140, 150]);
      return typed({
        tid: 'angle-read', category: '角の大きさをよむ',
        q: '分度器ではかった角の大きさは何度ですか。', unitSuffix: '度',
        fig: angleFig(deg), answer: String(deg),
        exp: '分度器の中心を角の頂点に合わせ、0度の線からめもりをよみます。この角は' + deg + '度です。',
      });
    }
    if (t === 1) { // straight line: 180 - a  (guard: a != 90 avoids twin)
      const a = pick([30, 40, 45, 50, 55, 60, 65, 70, 80, 100, 110, 120, 130, 135, 140, 150]);
      const ans = 180 - a;
      return typed({
        tid: 'angle-straight', category: '一直線と角',
        q: '一直線の上に角があります。一方の角が' + a + '度のとき、もう一方の角は何度ですか。', unitSuffix: '度',
        answer: String(ans),
        exp: '一直線は180度です。180−' + a + '＝' + ans + '度。',
      });
    }
    if (t === 2) { // around a point: 360 - a
      const a = pick([90, 100, 120, 135, 150, 200, 210, 240, 270]);
      const ans = 360 - a;
      return typed({
        tid: 'angle-round', category: '1回転と角',
        q: '1回転の角を2つに分けます。一方が' + a + '度のとき、もう一方は何度ですか。', unitSuffix: '度',
        answer: String(ans),
        exp: '1回転は360度です。360−' + a + '＝' + ans + '度。',
      });
    }
    // 三角定規 combination
    const combos = [
      { q: '30度と45度の三角じょうぎを組み合わせてできる角', ans: 75 },
      { q: '60度と45度の三角じょうぎを組み合わせてできる角', ans: 105 },
      { q: '90度と45度をならべてできる角', ans: 135 },
      { q: '60度から30度をひいてできる角', ans: 30 },
      { q: '90度から60度をひいてできる角', ans: 30 },
      { q: '45度と45度を合わせてできる角', ans: 90 },
    ];
    const cb = pick(combos);
    return typed({
      tid: 'angle-set', category: '三角じょうぎと角',
      q: cb.q + 'は何度ですか。', unitSuffix: '度',
      answer: String(cb.ans),
      exp: '三角じょうぎの角（30度・60度・90度、45度・45度・90度）を使って計算します。答えは' + cb.ans + '度。',
    });
  }

  // ---------- U5 小数のしくみ ----------
  function genDecimalStructure() {
    const t = ri(0, 3);
    if (t === 0) { // read number line (tenths)
      const whole = ri(0, 2), tenth = ri(1, 9);
      const v = whole + tenth / 10;
      return typed({
        tid: 'dec-numline', category: '小数のしくみ', inputMode: 'text',
        q: '↓のめもりがさす数を小数で書きましょう。',
        fig: numlineFig(v, 3), answer: v.toFixed(1), accepted: [v.toFixed(1), String(v)],
        exp: '1めもりは0.1です。さす数は ' + v.toFixed(1) + ' です。',
      });
    }
    if (t === 1) { // 0.01 が □ こ / place value
      const h = ri(103, 999); // hundredths count -> value h/100
      const val = fmtDec(h);
      return typed({
        tid: 'dec-compose', category: '小数のしくみ（0.01のいくつ分）', inputMode: 'text',
        q: '0.01を' + h + 'こ集めた数を書きましょう。',
        answer: val, accepted: [val, String(Number(val))],
        exp: '0.01が100こで1です。0.01が' + h + 'こで ' + val + '。',
      });
    }
    if (t === 2) { // ×10 / ÷10 of a decimal
      const base = ri(11, 989); // hundredths
      const mode = pick(['x10', 'd10']);
      const ansH = mode === 'x10' ? base * 10 : base / 10;
      const baseS = fmtDec(base), ansS = fmtDec(ansH);
      return typed({
        tid: 'dec-scale', category: '小数を10倍・10でわる', inputMode: 'text',
        q: baseS + ' を' + (mode === 'x10' ? '10倍' : '10でわった数') + 'は、いくつですか。',
        answer: ansS, accepted: [ansS, String(Number(ansS))],
        exp: (mode === 'x10' ? '10倍すると位が1つ上がります。' : '10でわると位が1つ下がります。') + baseS + ' → ' + ansS + '。',
      });
    }
    // compare two decimals (hundredths)
    const a = ri(11, 989);
    let b = a + pick([-1, 1]) * ri(1, 40);
    if (b <= 0) b = a + 20;
    if (b === a) b = a + 10;
    const biggerH = Math.max(a, b);
    const aS = fmtDec(a), bS = fmtDec(b), bigS = fmtDec(biggerH);
    return choice({
      tid: 'dec-compare', category: '小数の大きさくらべ',
      q: aS + ' と ' + bS + ' では、どちらが大きいですか。',
      exp: '大きい位からじゅんにくらべます。上の位が同じなら次の位でくらべます。',
    }, bigS, [fmtDec(biggerH === a ? b : a)]);
  }

  // ---------- U6 わり算の筆算(2) ÷2けた ----------
  function genDivision2() {
    const t = ri(0, 2);
    const b = ri(11, 39); // 2-digit divisor
    if (t === 0) { // exact, quotient 1 digit
      const q = ri(2, 9);
      const a = b * q;
      return typed({
        tid: 'div2-1digit', category: 'わり算の筆算（÷2けた・商1けた）',
        q: a + ' ÷ ' + b + ' を筆算でけいさんして、答えを書きましょう。',
        answer: String(q),
        exp: '商の見当をつけてから計算します。' + b + '×' + q + '＝' + a + ' なので答えは' + q + 'です。',
      });
    }
    if (t === 1) { // remainder, quotient 1-2 digit
      const q = ri(3, 28), r = ri(1, b - 1);
      const a = b * q + r;
      return typed({
        tid: 'div2-remainder', category: 'わり算の筆算（÷2けた・あまりあり）', inputMode: 'text',
        q: a + ' ÷ ' + b + ' をけいさんしましょう。（れい：12あまり3）',
        answer: q + 'あまり' + r,
        accepted: [q + 'あまり' + r, q + ' あまり ' + r, q + '...' + r, q + '…' + r, q + 'r' + r],
        exp: b + '×' + q + '＝' + (b * q) + '、' + a + '−' + (b * q) + '＝' + r + '。あまり' + r + 'はわる数' + b + 'より小さいのでOKです。',
      });
    }
    // exact division with a 2-digit quotient (3-digit dividend)
    const bb = ri(11, 24);
    const q = ri(11, 39);
    const a = bb * q;
    return typed({
      tid: 'div2-2digit', category: 'わり算の筆算（÷2けた・商2けた）',
      q: a + ' ÷ ' + bb + ' を筆算でけいさんして、答えを書きましょう。',
      answer: String(q),
      exp: '大きい位から順に、商の見当をつけながら計算します。' + bb + '×' + q + '＝' + a + ' なので答えは' + q + 'です。',
    });
  }

  // ---------- U7 がい数の表し方と使い方 ----------
  function genRounding() {
    const t = ri(0, 2);
    if (t <= 1) { // round to a specified place
      const place = pick([
        { name: '一万の位', div: 10000, label: '千の位を四捨五入して一万の位まで' },
        { name: '千の位', div: 1000, label: '百の位を四捨五入して千の位まで' },
        { name: '百の位', div: 100, label: '十の位を四捨五入して百の位まで' },
      ]);
      // pick a number where the digit below the rounding place is NOT 0/…
      // and — critically — avoid a case where the answer collides with a
      // different-place rounding used as a distractor (guarded in choice).
      let n;
      do { n = ri(place.div * 2 + 1, place.div * 97); } while (n % place.div === 0);
      const rounded = Math.round(n / place.div) * place.div;
      return typed({
        tid: 'round-place', category: '四捨五入してがい数', inputMode: 'numeric',
        q: comma(n) + ' を、' + place.label + 'のがい数にしましょう。',
        answer: String(rounded), accepted: [String(rounded), comma(rounded)],
        exp: place.label + '。' + comma(n) + ' → ' + comma(rounded) + '。',
      });
    }
    // range: 四捨五入して百の位まで made X になる整数のうち…（以上・未満）
    const hundreds = ri(3, 29) * 100;
    const kind = pick(['min', 'max']);
    const ans = kind === 'min' ? hundreds - 50 : hundreds + 49;
    return typed({
      tid: 'round-range', category: 'がい数になるもとの数の範囲',
      q: '十の位を四捨五入すると ' + comma(hundreds) + ' になる整数のうち、いちばん' + (kind === 'min' ? '小さい' : '大きい') + '数はいくつですか。',
      answer: String(ans), accepted: [String(ans), comma(ans)],
      exp: '十の位を四捨五入して' + comma(hundreds) + 'になるのは、' + comma(hundreds - 50) + '以上' + comma(hundreds + 50) + '未満の整数です。いちばん' + (kind === 'min' ? '小さいのは' + comma(hundreds - 50) : '大きいのは' + comma(hundreds + 49)) + '。',
    });
  }

  // ---------- U8 計算のきまり ----------
  function genCalcRules() {
    const t = ri(0, 3);
    if (t === 0) { // a + b × c
      const a = ri(3, 20), b = ri(2, 9), c = ri(2, 9);
      return typed({
        tid: 'calc-mixed1', category: '計算のじゅんじょ',
        q: a + ' + ' + b + ' × ' + c + ' をけいさんしましょう。',
        answer: String(a + b * c),
        exp: '×は+より先に計算します。' + b + '×' + c + '＝' + (b * c) + '、' + a + '＋' + (b * c) + '＝' + (a + b * c) + '。',
      });
    }
    if (t === 1) { // (a + b) × c
      const a = ri(3, 15), b = ri(3, 15), c = ri(2, 9);
      return typed({
        tid: 'calc-paren', category: '（　）のある計算',
        q: '( ' + a + ' + ' + b + ' ) × ' + c + ' をけいさんしましょう。',
        answer: String((a + b) * c),
        exp: '（　）の中を先に計算します。' + a + '＋' + b + '＝' + (a + b) + '、' + (a + b) + '×' + c + '＝' + ((a + b) * c) + '。',
      });
    }
    if (t === 2) { // a × b − c × d  or  100 - a × b
      if (Math.random() < 0.5) {
        const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9), d = ri(2, 9);
        return typed({
          tid: 'calc-mixed2', category: '計算のじゅんじょ',
          q: a + ' × ' + b + ' − ' + c + ' × ' + d + ' をけいさんしましょう。（答えが0より小さくなる場合はありません）',
          answer: String(Math.abs(a * b - c * d)),
          accepted: [String(Math.abs(a * b - c * d))],
          exp: 'かけ算を先に計算します。' + (a * b) + '−' + (c * d) + '＝' + Math.abs(a * b - c * d) + '。',
        });
      }
      const a = ri(2, 9), b = ri(2, 9);
      return typed({
        tid: 'calc-mixed3', category: '計算のじゅんじょ',
        q: '100 − ' + a + ' × ' + b + ' をけいさんしましょう。',
        answer: String(100 - a * b),
        exp: '×を先に計算します。' + a + '×' + b + '＝' + (a * b) + '、100−' + (a * b) + '＝' + (100 - a * b) + '。',
      });
    }
    // distributive equivalence (compare orderings)
    const tens = ri(2, 9) * 10, ones = ri(1, 9), m = ri(3, 8);
    const two = tens + ones; // e.g. 42
    const target = two * m;
    const correct = tens + '×' + m + ' ＋ ' + ones + '×' + m;
    const candidates = [
      { s: tens + '×' + m + ' × ' + ones + '×' + m, v: tens * m * ones * m },
      { s: tens + '＋' + m + ' × ' + ones + '＋' + m, v: tens + m * ones + m },
      { s: tens + '×' + ones + ' ＋ ' + m, v: tens * ones + m },
      { s: tens + '×' + m + ' − ' + ones + '×' + m, v: tens * m - ones * m },
      { s: '(' + tens + '−' + ones + ')×' + m, v: (tens - ones) * m },
    ];
    const wrongs = candidates.filter(function (x) { return x.v !== target; }).map(function (x) { return x.s; });
    return choice({
      tid: 'calc-distrib', category: '計算のきまり（分配のきまり）',
      q: two + ' × ' + m + ' を、' + two + ' を ' + tens + ' と ' + ones + ' に分けて計算します。これと答えが同じになる式はどれですか。',
      exp: two + '×' + m + '＝(' + tens + '＋' + ones + ')×' + m + '＝' + tens + '×' + m + '＋' + ones + '×' + m + '＝' + target + '。分配のきまりです。',
    }, correct, shuffle(wrongs));
  }

  // ---------- U9 垂直、平行と四角形 ----------
  const QUAD_FACTS = [
    { q: '平行四辺形について、いつでも正しいものはどれですか。', correct: '向かい合う2組の辺が平行で、長さも等しい',
      wrong: ['4つの角がすべて直角である', '4つの辺の長さがすべて等しい', '対角線の長さが等しい'] },
    { q: 'ひし形について、いつでも正しいものはどれですか。', correct: '4つの辺の長さがすべて等しい',
      wrong: ['4つの角がすべて直角である', '1組の辺だけが平行である', '対角線の長さが必ず等しい'] },
    { q: '台形の説明として正しいものはどれですか。', correct: '向かい合った1組の辺が平行な四角形',
      wrong: ['向かい合った2組の辺が平行な四角形', '4つの辺が等しい四角形', '4つの角が直角の四角形'] },
    { q: '1本の直線に垂直な2本の直線は、たがいにどんな関係ですか。', correct: '平行である',
      wrong: ['垂直である', '交わっている', '長さが等しい'] },
    { q: '平行な2本の直線のはばについて、正しいものはどれですか。', correct: 'どこではかっても等しい',
      wrong: ['はしにいくほど広がる', 'まん中がいちばんせまい', 'はかる場所でかわる'] },
  ];
  function genQuad() {
    const t = ri(0, 2);
    if (t === 0) { // parallelogram perimeter given 2 adjacent sides
      const a = ri(4, 12), b = ri(3, 11);
      return typed({
        tid: 'quad-para-peri', category: '平行四辺形のまわりの長さ',
        q: '2つの辺が' + a + 'cmと' + b + 'cmの平行四辺形があります。まわりの長さは何cmですか。', unitSuffix: 'cm',
        answer: String(2 * (a + b)),
        exp: '平行四辺形は向かい合う辺が等しいので、まわりは (' + a + '＋' + b + ')×2＝' + (2 * (a + b)) + 'cm。',
      });
    }
    if (t === 1) { // rhombus perimeter
      const s = ri(4, 14);
      return typed({
        tid: 'quad-rhombus-peri', category: 'ひし形のまわりの長さ',
        q: '1辺が' + s + 'cmのひし形があります。まわりの長さは何cmですか。', unitSuffix: 'cm',
        answer: String(s * 4),
        exp: 'ひし形は4つの辺が等しいので、' + s + '×4＝' + (s * 4) + 'cm。',
      });
    }
    const f = pick(QUAD_FACTS);
    return choice({
      tid: 'quad-fact', category: '四角形の性質',
      q: f.q, exp: '四角形の定義と性質から考えます。',
    }, f.correct, shuffle(f.wrong.slice()));
  }

  // ---------- U10 分数 ----------
  function genFractions() {
    const t = ri(0, 3);
    if (t === 0) { // improper -> mixed
      const d = pick([3, 4, 5, 6, 7, 8]);
      const whole = ri(1, 3), n = ri(1, d - 1);
      const imp = whole * d + n;
      return typed({
        tid: 'frac-improper-mixed', category: '仮分数を帯分数に', inputMode: 'text',
        q: imp + '/' + d + ' を帯分数（整数と分数）で書きましょう。（れい：2と3/4 → 2 3/4）',
        answer: whole + ' ' + n + '/' + d,
        accepted: [whole + ' ' + n + '/' + d, whole + 'と' + n + '/' + d, whole + n + '/' + d, whole + ' ' + n + '／' + d],
        exp: imp + '÷' + d + '＝' + whole + 'あまり' + n + ' なので、' + whole + 'と' + d + '分の' + n + '（' + whole + ' ' + n + '/' + d + '）です。',
      });
    }
    if (t === 1) { // mixed -> improper
      const d = pick([3, 4, 5, 6, 7, 8]);
      const whole = ri(1, 3), n = ri(1, d - 1);
      const imp = whole * d + n;
      return typed({
        tid: 'frac-mixed-improper', category: '帯分数を仮分数に', inputMode: 'text',
        q: whole + 'と' + d + '分の' + n + '（帯分数）を仮分数で書きましょう。（れい：7/4）',
        answer: imp + '/' + d,
        accepted: [imp + '/' + d, d + '分の' + imp, imp + '／' + d],
        exp: whole + '×' + d + '＋' + n + '＝' + imp + ' なので ' + imp + '/' + d + ' です。',
      });
    }
    if (t === 2) { // same-denominator addition (may exceed 1)
      const d = pick([4, 5, 6, 7, 8, 9]);
      const n1 = ri(1, d - 1), n2 = ri(1, d - 1);
      const sum = n1 + n2;
      let ansTxt, accepted;
      if (sum === d) { ansTxt = '1'; accepted = ['1', d + '/' + d]; }
      else if (sum > d) {
        const w = Math.floor(sum / d), rem = sum % d;
        ansTxt = rem === 0 ? String(w) : w + ' ' + rem + '/' + d;
        accepted = rem === 0 ? [String(w)] : [w + ' ' + rem + '/' + d, w + 'と' + rem + '/' + d, sum + '/' + d, w + rem + '/' + d];
      } else { ansTxt = sum + '/' + d; accepted = [sum + '/' + d, d + '分の' + sum]; }
      return typed({
        tid: 'frac-add', category: '分数のたし算', inputMode: 'text',
        q: n1 + '/' + d + ' + ' + n2 + '/' + d + ' をけいさんしましょう。仮分数のままでもよいです。（れい：5/4 または 1 1/4）',
        answer: ansTxt, accepted: accepted.concat([sum + '/' + d]),
        exp: '分母はそのまま、分子をたします。' + n1 + '＋' + n2 + '＝' + sum + ' なので ' + sum + '/' + d + '（＝' + ansTxt + '）。',
      });
    }
    // same-denominator subtraction (mixed - proper, may need borrow)
    const d = pick([4, 5, 6, 7, 8, 9]);
    const whole = ri(1, 3), n1 = ri(0, d - 1);
    const bigN = whole * d + n1; // as improper
    const n2 = ri(1, d - 1);
    const diff = bigN - n2;
    const w = Math.floor(diff / d), rem = diff % d;
    const ansTxt = w === 0 ? rem + '/' + d : (rem === 0 ? String(w) : w + ' ' + rem + '/' + d);
    const accepted = [diff + '/' + d];
    if (w === 0) accepted.push(rem + '/' + d, d + '分の' + rem);
    else if (rem === 0) accepted.push(String(w));
    else accepted.push(w + ' ' + rem + '/' + d, w + 'と' + rem + '/' + d, w + rem + '/' + d);
    return typed({
      tid: 'frac-sub', category: '分数のひき算', inputMode: 'text',
      q: (n1 === 0 ? String(whole) : whole + 'と' + d + '分の' + n1) + ' − ' + n2 + '/' + d + ' をけいさんしましょう。（れい：1 2/5 または 7/5）',
      answer: ansTxt, accepted: accepted,
      exp: (n1 === 0 ? whole : whole + 'と' + n1 + '/' + d) + ' を ' + bigN + '/' + d + ' として、分子を ' + bigN + '−' + n2 + '＝' + diff + '。答えは ' + ansTxt + '。',
    });
  }

  // ---------- U11 変わり方調べ ----------
  function genChange() {
    const t = ri(0, 2);
    if (t === 0) { // perimeter of square: ○ = □ × 4
      const box = ri(2, 12);
      return typed({
        tid: 'change-square', category: '変わり方のきまり（□×4）',
        q: '1辺が□cmの正方形のまわりの長さを○cmとします。□と○の関係は ○ ＝ □ × 4 です。□が' + box + 'のとき、○はいくつですか。',
        answer: String(box * 4),
        exp: '○＝□×4 に □＝' + box + ' を入れて、' + box + '×4＝' + (box * 4) + '。',
      });
    }
    if (t === 1) { // sum-constant: □ + ○ = S
      const S = ri(10, 20);
      const box = ri(1, S - 1);
      return typed({
        tid: 'change-sum', category: '変わり方のきまり（和が一定）',
        q: '2つの数□と○をたすといつも' + S + 'になります（□ ＋ ○ ＝ ' + S + '）。□が' + box + 'のとき、○はいくつですか。',
        answer: String(S - box),
        exp: '□＋○＝' + S + ' なので ○＝' + S + '−' + box + '＝' + (S - box) + '。',
      });
    }
    // matchstick / step pattern: ○ = □ × a + b
    const a = pick([2, 3]), b = pick([1, 2, 3]);
    const box = ri(3, 10);
    return typed({
      tid: 'change-linear', category: '変わり方のきまり（□×a＋b）',
      q: 'だんの数を□、まわりに使うぼうの数を○とすると、○ ＝ □ × ' + a + ' ＋ ' + b + ' の関係になります。□が' + box + 'のとき、○は何本ですか。', unitSuffix: '本',
      answer: String(box * a + b),
      exp: '○＝□×' + a + '＋' + b + ' に □＝' + box + ' を入れて、' + box + '×' + a + '＋' + b + '＝' + (box * a + b) + '本。',
    });
  }

  // ---------- U12 面積のくらべ方と表し方 ----------
  function genArea() {
    const t = ri(0, 3);
    if (t === 0) { // rectangle area
      const w = ri(3, 15), h = ri(2, 12);
      return typed({
        tid: 'area-rect', category: '長方形の面積', inputMode: 'text',
        q: 'たて' + h + 'cm、横' + w + 'cmの長方形の面積は何cm²ですか。', unitSuffix: 'cm²',
        fig: rectFig(w + 'cm', h + 'cm'), answer: String(w * h), accepted: [String(w * h), w * h + 'cm2', w * h + '平方センチメートル'],
        exp: '長方形の面積＝たて×横。' + h + '×' + w + '＝' + (w * h) + 'cm²。',
      });
    }
    if (t === 1) { // square area
      const s = ri(3, 14);
      return typed({
        tid: 'area-square', category: '正方形の面積', inputMode: 'text',
        q: '1辺が' + s + 'cmの正方形の面積は何cm²ですか。', unitSuffix: 'cm²',
        answer: String(s * s), accepted: [String(s * s), s * s + 'cm2'],
        exp: '正方形の面積＝1辺×1辺。' + s + '×' + s + '＝' + (s * s) + 'cm²。',
      });
    }
    if (t === 2) { // m<->cm area or a/ha conversions
      const conv = pick([
        { q: '1m²は何cm²ですか。', a: '10000', s: 'cm2', exp: '1m＝100cmなので、1m²＝100×100＝10000cm²。' },
        { q: '1a（アール）は何m²ですか。', a: '100', s: 'm2', exp: '1a＝10m×10m＝100m²。' },
        { q: '1ha（ヘクタール）は何m²ですか。', a: '10000', s: 'm2', exp: '1ha＝100m×100m＝10000m²。' },
        { q: '1ha は何aですか。', a: '100', s: 'a', exp: '1ha＝10000m²、1a＝100m²なので、10000÷100＝100a。' },
        { q: '1km²は何m²ですか。', a: '1000000', s: 'm2', exp: '1km＝1000mなので、1km²＝1000×1000＝1000000m²。' },
      ]);
      return typed({
        tid: 'area-unit', category: '面積のたんい', inputMode: 'numeric',
        q: conv.q, answer: conv.a, accepted: [conv.a, comma(Number(conv.a)), conv.a + conv.s],
        exp: conv.exp,
      });
    }
    // area of an L-shape via decomposition (two rectangles)
    const aw = ri(4, 10), ah = ri(3, 7), bw = ri(2, 6), bh = ri(2, 5);
    const area = aw * ah + bw * bh;
    return typed({
      tid: 'area-compound', category: '組み合わせた形の面積', inputMode: 'text',
      q: '大きい長方形（たて' + ah + 'cm・横' + aw + 'cm）と小さい長方形（たて' + bh + 'cm・横' + bw + 'cm）を合わせた形の面積は何cm²ですか。', unitSuffix: 'cm²',
      answer: String(area), accepted: [String(area), area + 'cm2'],
      exp: '2つに分けて計算します。' + ah + '×' + aw + '＝' + (aw * ah) + '、' + bh + '×' + bw + '＝' + (bw * bh) + '、合わせて' + area + 'cm²。',
    });
  }

  // ---------- U13 小数のかけ算とわり算 ----------
  function genDecimalMulDiv() {
    const t = ri(0, 2);
    if (t === 0) { // decimal (tenths) × whole
      const aT = ri(11, 89); // tenths, so value = aT/10 (1.1 .. 8.9)
      const n = ri(2, 9);
      const prodT = aT * n;
      const aS = fmtDec(aT * 10), pS = fmtDec(prodT * 10);
      return typed({
        tid: 'decmd-mul', category: '小数×整数', inputMode: 'text',
        q: aS + ' × ' + n + ' をけいさんしましょう。',
        answer: pS, accepted: [pS, String(Number(pS))],
        exp: aS + 'を10倍して整数' + (aT) + 'にして計算し、10でわしてもどします。答えは ' + pS + '。',
      });
    }
    if (t === 1) { // decimal ÷ whole, exact 1-dp quotient
      const qT = ri(11, 89); // quotient tenths (1.1..8.9)
      const n = ri(2, 9);
      const divH = qT * n; // dividend in tenths
      const qS = fmtDec(qT * 10), dS = fmtDec(divH * 10);
      return typed({
        tid: 'decmd-div', category: '小数÷整数', inputMode: 'text',
        q: dS + ' ÷ ' + n + ' をけいさんしましょう。',
        answer: qS, accepted: [qS, String(Number(qS))],
        exp: '整数と同じように筆算し、小数点をそろえておろします。答えは ' + qS + '。',
      });
    }
    // word problem: total = unit × count (decimal × whole)
    const unitT = ri(12, 45); // tenths, value unitT/10 (1.2..4.5)
    const cnt = ri(3, 8);
    const totT = unitT * cnt;
    const uS = fmtDec(unitT * 10), tS = fmtDec(totT * 10);
    return typed({
      tid: 'decmd-word', category: '小数のかけ算の文章題', inputMode: 'text',
      q: '1mの重さが' + uS + 'kgのはり金があります。このはり金' + cnt + 'mの重さは何kgですか。', unitSuffix: 'kg',
      answer: tS, accepted: [tS, String(Number(tS))],
      exp: '式は ' + uS + '×' + cnt + '＝' + tS + 'kg です。',
    });
  }

  // ---------- U14 直方体と立方体 ----------
  function genBoxes() {
    const t = ri(0, 3);
    if (t === 0) { // count faces / edges / vertices
      const which = pick([
        { q: '直方体の面の数は何個ですか。', a: 6 },
        { q: '直方体の辺の数は何本ですか。', a: 12 },
        { q: '直方体の頂点の数は何個ですか。', a: 8 },
        { q: '立方体の面の数は何個ですか。', a: 6 },
        { q: '立方体の辺の数は何本ですか。', a: 12 },
        { q: '立方体の頂点の数は何個ですか。', a: 8 },
      ]);
      return typed({
        tid: 'box-count', category: '直方体・立方体の面・辺・頂点',
        q: which.q, answer: String(which.a),
        exp: '直方体も立方体も、面は6つ、辺は12本、頂点は8つです。',
      });
    }
    if (t === 1) { // total edge length of a box
      const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9);
      return typed({
        tid: 'box-edgesum', category: '直方体の辺の長さの合計', inputMode: 'text',
        q: 'たて' + a + 'cm、横' + b + 'cm、高さ' + c + 'cmの直方体があります。すべての辺の長さの合計は何cmですか。', unitSuffix: 'cm',
        fig: boxFig(b + 'cm', a + 'cm', c + 'cm'),
        answer: String(4 * (a + b + c)),
        exp: '直方体は同じ長さの辺が4本ずつ3組あります。(' + a + '＋' + b + '＋' + c + ')×4＝' + (4 * (a + b + c)) + 'cm。',
      });
    }
    if (t === 2) { // cube total edge length
      const s = ri(2, 12);
      return typed({
        tid: 'box-cube-edgesum', category: '立方体の辺の長さの合計',
        q: '1辺が' + s + 'cmの立方体のすべての辺の長さの合計は何cmですか。', unitSuffix: 'cm',
        answer: String(12 * s),
        exp: '立方体は同じ長さの辺が12本です。' + s + '×12＝' + (12 * s) + 'cm。',
      });
    }
    // spatial: parallel / perpendicular faces
    const f = pick([
      { q: '直方体で、1つの面に平行な面はいくつありますか。', a: 1 },
      { q: '直方体で、1つの面に垂直な面はいくつありますか。', a: 4 },
      { q: '立方体で、1つの辺に平行な辺はいくつありますか。', a: 3 },
    ]);
    return typed({
      tid: 'box-spatial', category: '面や辺の垂直・平行',
      q: f.q, answer: String(f.a),
      exp: '向かい合う面は平行（1つ）、となり合う面は垂直（4つ）です。',
    });
  }

  // ---------- unit/section table ----------
  // Canonical unit keys (stored in class_modules.focus_units, honored by
  // app.js for unit-scoped pacing). Documented list — see the module README
  // / spec: u01_big_numbers … u14_boxes, one per textbook unit below.
  const UNITS = [
    { num: 1, key: 'u01_big_numbers', title: '大きい数のしくみ', vol: '上', sections: [
      { id: 'u01-big', title: '億・兆と大きい数のかけ算', gen: genBigNumbers, n: 10 },
    ]},
    { num: 2, key: 'u02_line_graphs', title: '折れ線グラフと表', vol: '上', sections: [
      { id: 'u02-line', title: '折れ線グラフをよむ', gen: genLineGraph, n: 8 },
    ]},
    { num: 3, key: 'u03_division1', title: 'わり算の筆算(1)', vol: '上', sections: [
      { id: 'u03-div1', title: '÷1けたの筆算', gen: genDivision1, n: 10 },
    ]},
    { num: 4, key: 'u04_angles', title: '角の大きさ', vol: '上', sections: [
      { id: 'u04-angle', title: '角をはかる・角を計算する', gen: genAngles, n: 8 },
    ]},
    { num: 5, key: 'u05_decimals_structure', title: '小数のしくみ', vol: '上', sections: [
      { id: 'u05-dec', title: '小数のしくみと10倍・10でわる', gen: genDecimalStructure, n: 10 },
    ]},
    { num: 6, key: 'u06_division2', title: 'わり算の筆算(2)', vol: '下', sections: [
      { id: 'u06-div2', title: '÷2けたの筆算', gen: genDivision2, n: 10 },
    ]},
    { num: 7, key: 'u07_rounding', title: 'がい数の表し方と使い方', vol: '下', sections: [
      { id: 'u07-round', title: '四捨五入とがい数', gen: genRounding, n: 10 },
    ]},
    { num: 8, key: 'u08_calc_rules', title: '計算のきまり', vol: '下', sections: [
      { id: 'u08-rules', title: '計算のじゅんじょときまり', gen: genCalcRules, n: 10 },
    ]},
    { num: 9, key: 'u09_quadrilaterals', title: '垂直、平行と四角形', vol: '下', sections: [
      { id: 'u09-quad', title: '垂直・平行と四角形の性質', gen: genQuad, n: 8 },
    ]},
    { num: 10, key: 'u10_fractions', title: '分数', vol: '下', sections: [
      { id: 'u10-frac', title: '仮分数・帯分数とたし算ひき算', gen: genFractions, n: 10 },
    ]},
    { num: 11, key: 'u11_change', title: '変わり方調べ', vol: '下', sections: [
      { id: 'u11-change', title: '□と○の変わり方', gen: genChange, n: 8 },
    ]},
    { num: 12, key: 'u12_area', title: '面積のくらべ方と表し方', vol: '下', sections: [
      { id: 'u12-area', title: '面積の計算とたんい', gen: genArea, n: 10 },
    ]},
    { num: 13, key: 'u13_decimal_muldiv', title: '小数のかけ算とわり算', vol: '下', sections: [
      { id: 'u13-decmd', title: '小数×整数・小数÷整数', gen: genDecimalMulDiv, n: 10 },
    ]},
    { num: 14, key: 'u14_boxes', title: '直方体と立方体', vol: '下', sections: [
      { id: 'u14-box', title: '直方体・立方体と面・辺・頂点', gen: genBoxes, n: 8 },
    ]},
  ];

  // まとめ (mixed) — draws one problem from a random unit's generator.
  const MIXED_POOL = [];
  UNITS.forEach(function (u) { u.sections.forEach(function (s) { MIXED_POOL.push(s.gen); }); });
  function genMatome() { return pick(MIXED_POOL)(); }
  UNITS.push({ num: 15, key: 'u15_review', title: '4年のまとめ', vol: '下', sections: [
    { id: 'u15-matome', title: 'まとめテスト（全単元から）', gen: genMatome, n: 12 },
  ]});

  window.SANSU4_DATA = { UNITS };
})();
