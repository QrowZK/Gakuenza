// 算数 2年 — Gakuenza module content & problem generators
// すべてオリジナル教材。東京書籍『新しい算数2』(令和 edition) の単元構成
// （表とグラフ〜はこの形の15単元）に対応させているが、問題そのものは全て
// 独自生成 — 教科書の問題文・数値・図版は一切転載していない。
//
// アーキテクチャは sansu3 / sansu5 の生成器パターンをそのまま踏襲する
// （固定の問題バンクではなく、毎回パラメータから問題を生成する）。
//
// この学年の中心は かけ算九九（単元11・12）。九九は 1×1〜9×9 の全81通りを
// 生成し、読む向きの両方・虫食い（□×4=28）・全段まぜまぜまで扱う。
//
// 各 section は gen() を持ち、ONE problem object を返す:
//   {
//     tid,               // template id — 問題TYPEごとに安定。
//                        //   activity_result_items.item_ref に使う
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

  const NAMES = ['ゆい', 'はると', 'さくら', 'そうた', 'ひなた', 'りく', 'あおい', 'みお', 'いつき', 'こはる'];
  const THINGS = [
    { n: 'あめ', c: 'こ' }, { n: 'えんぴつ', c: '本' }, { n: 'おりがみ', c: 'まい' },
    { n: 'クッキー', c: 'こ' }, { n: 'カード', c: 'まい' }, { n: 'ビーだま', c: 'こ' },
    { n: 'シール', c: 'まい' }, { n: 'いちご', c: 'こ' }, { n: 'どんぐり', c: 'こ' },
  ];

  // ---------- answer form helpers ----------
  function typed(o) { o.kind = 'typed'; o.accepted = o.accepted || [o.answer]; o.inputMode = o.inputMode || 'numeric'; return o; }

  // Robust choice builder: guarantees exactly 4 DISTINCT options, the correct
  // one present exactly once, and NO distractor equal to the correct value
  // (the "secretly-also-correct" bug). wrongs is a list of candidate
  // distractors; fill() optionally supplies more if dedup leaves fewer than 3.
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

  // analog clock at h:m (same UI as sansu3's clock)
  function clockFig(h, m) {
    const cx = 110, cy = 110, r = 96;
    let body = '<circle cx="110" cy="110" r="100" fill="#fffdf8" stroke="#3a4555" stroke-width="4"/>';
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 - 90) * Math.PI / 180;
      const long = i % 5 === 0;
      const r1 = long ? r - 10 : r - 4;
      body += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (cx + r * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r * Math.sin(a)).toFixed(1) +
        '" stroke="#3a4555" stroke-width="' + (long ? 3 : 1.4) + '"/>';
    }
    for (let n = 1; n <= 12; n++) {
      const a = (n * 30 - 90) * Math.PI / 180;
      body += '<text x="' + (cx + (r - 26) * Math.cos(a)).toFixed(1) + '" y="' + (cy + (r - 26) * Math.sin(a) + 7).toFixed(1) +
        '" font-size="20" font-weight="bold" text-anchor="middle" fill="#1c2530">' + n + '</text>';
    }
    const ha = ((h % 12) * 30 + m * 0.5 - 90) * Math.PI / 180;
    const ma = (m * 6 - 90) * Math.PI / 180;
    body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 52 * Math.cos(ha)).toFixed(1) + '" y2="' + (cy + 52 * Math.sin(ha)).toFixed(1) + '" stroke="#1c2530" stroke-width="7" stroke-linecap="round"/>';
    body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + 80 * Math.cos(ma)).toFixed(1) + '" y2="' + (cy + 80 * Math.sin(ma)).toFixed(1) + '" stroke="#b5572e" stroke-width="4.5" stroke-linecap="round"/>';
    body += '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#1c2530"/>';
    return svg(220, 220, body);
  }

  // picture graph (絵グラフ): cats = [{label, count}] stacked ○ per row
  function pictoFig(cats) {
    const top = 16, rowH = 30, left = 78, cell = 22;
    const maxCount = Math.max.apply(null, cats.map(function (c) { return c.count; }));
    const W = left + maxCount * cell + 16;
    const H = top + cats.length * rowH + 8;
    let body = '';
    cats.forEach(function (c, i) {
      const y = top + i * rowH;
      body += '<text x="' + (left - 10) + '" y="' + (y + 18) + '" font-size="14" text-anchor="end" fill="#1c2530">' + c.label + '</text>';
      for (let k = 0; k < c.count; k++) {
        body += '<circle cx="' + (left + cell * k + cell / 2) + '" cy="' + (y + 13) + '" r="8" fill="#4a6b4f" stroke="#34503a" stroke-width="1"/>';
      }
    });
    return svg(W, H, body);
  }

  // fraction bar: rectangle split into `parts` equal strips, first `shaded` filled
  function fracBarFig(parts, shaded) {
    const W = 260, H = 84, x0 = 24, y0 = 20, w = 212, h = 46;
    const sw = w / parts;
    let body = '';
    for (let i = 0; i < parts; i++) {
      const fill = i < shaded ? '#c9a24b' : '#fffdf8';
      body += '<rect x="' + (x0 + sw * i).toFixed(1) + '" y="' + y0 + '" width="' + sw.toFixed(1) + '" height="' + h + '" fill="' + fill + '" stroke="#3a4555" stroke-width="2"/>';
    }
    return svg(W, H, body);
  }

  // plain rectangular box (cabinet projection); dots=true marks the 8 vertices
  function boxFig(dots) {
    const x = 46, y = 58, w = 118, h = 74, dx = 42, dy = -30;
    function ln(x1, y1, x2, y2, dash) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#4a6b4f" stroke-width="2.5"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    }
    let body = '';
    body += ln(x, y, x + w, y) + ln(x + w, y, x + w, y + h) + ln(x + w, y + h, x, y + h) + ln(x, y + h, x, y);
    body += ln(x + dx, y + dy, x + w + dx, y + dy) + ln(x + w + dx, y + dy, x + w + dx, y + h + dy) +
      ln(x + w + dx, y + h + dy, x + dx, y + h + dy, true) + ln(x + dx, y + h + dy, x + dx, y + dy, true);
    body += ln(x, y, x + dx, y + dy) + ln(x + w, y, x + w + dx, y + dy) + ln(x + w, y + h, x + w + dx, y + h + dy) +
      ln(x, y + h, x + dx, y + h + dy, true);
    if (dots) {
      const vs = [[x, y], [x + w, y], [x + w, y + h], [x, y + h],
        [x + dx, y + dy], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + dx, y + h + dy]];
      vs.forEach(function (p) { body += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.5" fill="#b5572e"/>'; });
    }
    return svg(230, 150, body);
  }

  // right-angle tick at corner (px,py) opening toward (dirx,diry) in {±1}
  function rightMark(px, py, dirx, diry) {
    const s = 12;
    return '<path d="M' + (px + dirx * s) + ',' + py + ' L' + (px + dirx * s) + ',' + (py + diry * s) +
      ' L' + px + ',' + (py + diry * s) + '" fill="none" stroke="#b5572e" stroke-width="1.6"/>';
  }

  // canonical polygon figures for 三角形と四角形
  function shapeFig(kind) {
    if (kind === 'tri') {
      return svg(200, 150, '<polygon points="30,124 170,124 92,28" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>');
    }
    if (kind === 'quad') { // irregular quadrilateral (not a rectangle)
      return svg(200, 150, '<polygon points="28,110 120,128 176,52 60,26" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>');
    }
    if (kind === 'rect') {
      let b = '<rect x="34" y="42" width="132" height="66" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
      b += rightMark(34, 42, 1, 1) + rightMark(166, 42, -1, 1) + rightMark(166, 108, -1, -1) + rightMark(34, 108, 1, -1);
      return svg(200, 150, b);
    }
    if (kind === 'square') {
      let b = '<rect x="54" y="30" width="92" height="92" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
      b += rightMark(54, 30, 1, 1) + rightMark(146, 30, -1, 1) + rightMark(146, 122, -1, -1) + rightMark(54, 122, 1, -1);
      return svg(200, 150, b);
    }
    // right triangle
    let b = '<polygon points="40,120 40,34 156,120" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    b += rightMark(40, 120, 1, -1);
    return svg(200, 150, b);
  }

  // ================= generators per unit =================

  // ---------- U1 表とグラフ ----------
  const GRAPH_THEMES = [
    { title: 'すきなくだもの', items: ['りんご', 'みかん', 'いちご', 'ぶどう', 'バナナ'] },
    { title: 'すきないろ', items: ['あか', 'あお', 'きいろ', 'みどり', 'ピンク'] },
    { title: 'すきなどうぶつ', items: ['いぬ', 'ねこ', 'うさぎ', 'ぱんだ', 'きりん'] },
    { title: 'すきなあそび', items: ['おにごっこ', 'ブランコ', 'すなあそび', 'ボール', 'なわとび'] },
  ];
  function genGraph() {
    const theme = pick(GRAPH_THEMES);
    const labels = shuffle(theme.items).slice(0, 4);
    // distinct counts 1..9 so "most/least" and differences are unambiguous
    const pool = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
    const cats = labels.map(function (lb, i) { return { label: lb, count: pool[i] }; });
    const fig = pictoFig(cats);
    const t = ri(0, 3);
    if (t === 0) { // most
      const top = cats.slice().sort(function (a, b) { return b.count - a.count; })[0];
      return choice({
        tid: 'graph-most', category: 'グラフ（いちばん多い）',
        q: theme.title + 'のグラフです。いちばん多いのはどれですか。', fig: fig,
        exp: 'いちばん高い（○の多い）ものをえらびます。' + top.label + 'が' + top.count + 'こで、いちばん多いです。',
      }, top.label, cats.filter(function (c) { return c !== top; }).map(function (c) { return c.label; }));
    }
    if (t === 1) { // least
      const low = cats.slice().sort(function (a, b) { return a.count - b.count; })[0];
      return choice({
        tid: 'graph-least', category: 'グラフ（いちばん少ない）',
        q: theme.title + 'のグラフです。いちばん少ないのはどれですか。', fig: fig,
        exp: '○のいちばん少ないものをえらびます。' + low.label + 'が' + low.count + 'こで、いちばん少ないです。',
      }, low.label, cats.filter(function (c) { return c !== low; }).map(function (c) { return c.label; }));
    }
    if (t === 2) { // count of one category
      const c = pick(cats);
      return typed({
        tid: 'graph-count', category: 'グラフ（数をよむ）',
        q: theme.title + 'のグラフです。' + c.label + 'は何こ（何人）ですか。', fig: fig, unitSuffix: '',
        answer: String(c.count), accepted: [String(c.count)],
        exp: c.label + 'の○の数をかぞえると' + c.count + 'です。',
      });
    }
    // difference between two
    const two = shuffle(cats.slice()).slice(0, 2);
    const hi = Math.max(two[0].count, two[1].count), lo = Math.min(two[0].count, two[1].count);
    const more = two[0].count >= two[1].count ? two[0] : two[1];
    return typed({
      tid: 'graph-diff', category: 'グラフ（ちがいをもとめる）',
      q: theme.title + 'のグラフです。' + more.label + 'は、もう一方（' + (more === two[0] ? two[1].label : two[0].label) + '）より何こ多いですか。',
      fig: fig, answer: String(hi - lo), accepted: [String(hi - lo)],
      exp: hi + '−' + lo + '＝' + (hi - lo) + 'こ多いです。',
    });
  }

  // ---------- U2 たし算のひっ算（2けた） ----------
  function genAdd2() {
    const t = ri(0, 2);
    if (t === 0) { // 2桁 + 2桁 (may carry)
      const A = ri(10, 79), B = ri(10, Math.min(89, 118 - A));
      return typed({
        tid: 'add2-2d', category: '2けた＋2けたのたし算',
        q: A + ' ＋ ' + B + ' を ひっ算で計算しましょう。',
        answer: String(A + B),
        exp: '一のくらいから じゅんに たします。くり上がりに気をつけて。' + A + '＋' + B + '＝' + (A + B) + '。',
      });
    }
    if (t === 1) { // 2桁 + 1桁 (may carry)
      const A = ri(15, 89), B = ri(3, 9);
      return typed({
        tid: 'add2-1d', category: '2けた＋1けたのたし算',
        q: A + ' ＋ ' + B + ' を計算しましょう。',
        answer: String(A + B),
        exp: '一のくらいをたして、くり上がったら十のくらいへ1くり上げます。' + A + '＋' + B + '＝' + (A + B) + '。',
      });
    }
    // word problem
    const th = pick(THINGS);
    const A = ri(12, 48), B = ri(13, 39);
    const nm = pick(NAMES);
    return typed({
      tid: 'add2-word', category: 'たし算の文しょうだい',
      q: nm + 'さんは' + th.n + 'を' + A + th.c + 'もっています。' + B + th.c + 'もらうと、ぜんぶで何' + th.c + 'になりますか。',
      unitSuffix: th.c, answer: String(A + B), accepted: [String(A + B), (A + B) + th.c],
      exp: 'あわせるので たし算です。' + A + '＋' + B + '＝' + (A + B) + th.c + '。',
    });
  }

  // ---------- U3 ひき算のひっ算（2けた） ----------
  function genSub2() {
    const t = ri(0, 2);
    if (t === 0) { // 2桁 - 2桁 (may borrow)
      const A = ri(30, 99), B = ri(11, A - 1);
      return typed({
        tid: 'sub2-2d', category: '2けた−2けたのひき算',
        q: A + ' − ' + B + ' を ひっ算で計算しましょう。',
        answer: String(A - B),
        exp: '一のくらいから ひきます。ひけないときは十のくらいから1くり下げます。' + A + '−' + B + '＝' + (A - B) + '。',
      });
    }
    if (t === 1) { // 2桁 - 1桁 (may borrow)
      const A = ri(11, 60), B = ri(3, 9);
      return typed({
        tid: 'sub2-1d', category: '2けた−1けたのひき算',
        q: A + ' − ' + B + ' を計算しましょう。',
        answer: String(A - B),
        exp: '一のくらいがひけないときは、十のくらいから1くり下げます。' + A + '−' + B + '＝' + (A - B) + '。',
      });
    }
    // word problem
    const th = pick(THINGS);
    const A = ri(25, 80), B = ri(8, A - 5);
    const nm = pick(NAMES);
    return typed({
      tid: 'sub2-word', category: 'ひき算の文しょうだい',
      q: th.n + 'が' + A + th.c + 'あります。' + nm + 'さんが' + B + th.c + '使うと、のこりは何' + th.c + 'ですか。',
      unitSuffix: th.c, answer: String(A - B), accepted: [String(A - B), (A - B) + th.c],
      exp: 'のこりをもとめるので ひき算です。' + A + '−' + B + '＝' + (A - B) + th.c + '。',
    });
  }

  // ---------- U4 長さ（cm・mm） ----------
  function genLengthCm() {
    const t = ri(0, 4);
    if (t === 0) { // cm -> mm
      const cm = ri(2, 9);
      return typed({
        tid: 'lcm-cm2mm', category: 'cmをmmになおす', unitSuffix: 'mm',
        q: cm + 'cm は 何mm ですか。',
        answer: String(cm * 10), accepted: [String(cm * 10), cm * 10 + 'mm'],
        exp: '1cm＝10mm です。' + cm + '×10＝' + (cm * 10) + 'mm。',
      });
    }
    if (t === 1) { // mm -> cm (multiple of 10)
      const cm = ri(2, 9), mm = cm * 10;
      return typed({
        tid: 'lcm-mm2cm', category: 'mmをcmになおす', unitSuffix: 'cm',
        q: mm + 'mm は 何cm ですか。',
        answer: String(cm), accepted: [String(cm), cm + 'cm'],
        exp: '10mm＝1cm です。' + mm + '÷10＝' + cm + 'cm。',
      });
    }
    if (t === 2) { // cm mm -> mm
      const cm = ri(1, 9), mm = ri(1, 9);
      const total = cm * 10 + mm;
      return typed({
        tid: 'lcm-mix2mm', category: '○cm○mm を mm になおす', unitSuffix: 'mm',
        q: cm + 'cm' + mm + 'mm は 何mm ですか。',
        answer: String(total), accepted: [String(total), total + 'mm'],
        exp: cm + 'cm＝' + (cm * 10) + 'mm。あわせて ' + (cm * 10) + '＋' + mm + '＝' + total + 'mm。',
      });
    }
    if (t === 3) { // mm -> cm mm
      const cm = ri(1, 9), mm = ri(1, 9), total = cm * 10 + mm;
      return typed({
        tid: 'lcm-mm2mix', category: 'mm を ○cm○mm になおす', inputMode: 'text',
        q: total + 'mm は 何cm何mm ですか。（れい：3cm5mm）',
        answer: cm + 'cm' + mm + 'mm', accepted: [cm + 'cm' + mm + 'mm', cm + 'cm' + mm],
        exp: total + 'mm＝' + (cm * 10) + 'mm＋' + mm + 'mm＝' + cm + 'cm' + mm + 'mm。',
      });
    }
    // addition of lengths (same or mixed unit, no carry across cm)
    const cm1 = ri(1, 6), mm1 = ri(1, 5), cm2 = ri(1, 6), mm2 = ri(1, 4);
    const cmS = cm1 + cm2, mmS = mm1 + mm2; // keep mmS < 10 by bounds
    return typed({
      tid: 'lcm-add', category: '長さのたし算', inputMode: 'text',
      q: cm1 + 'cm' + mm1 + 'mm ＋ ' + cm2 + 'cm' + mm2 + 'mm は 何cm何mm ですか。（れい：3cm5mm）',
      answer: cmS + 'cm' + mmS + 'mm', accepted: [cmS + 'cm' + mmS + 'mm', cmS + 'cm' + mmS],
      exp: 'cm どうし、mm どうしを たします。' + cmS + 'cm' + mmS + 'mm。',
    });
  }

  // ---------- U5 100より大きい数 ----------
  function genBigNum() {
    const t = ri(0, 5);
    if (t === 0) { // digit at a place
      const h = ri(1, 9), te = ri(0, 9), on = ri(0, 9);
      const n = h * 100 + te * 10 + on;
      const pl = pick([{ name: '百のくらい', d: h }, { name: '十のくらい', d: te }, { name: '一のくらい', d: on }]);
      return typed({
        tid: 'bn-place', category: '数のくらい',
        q: comma(n) + ' の ' + pl.name + ' の数字はいくつですか。',
        answer: String(pl.d), accepted: [String(pl.d)],
        exp: comma(n) + ' の ' + pl.name + ' は ' + pl.d + ' です。',
      });
    }
    if (t === 1) { // compose
      const h = ri(1, 9), te = ri(0, 9), on = ri(0, 9);
      const n = h * 100 + te * 10 + on;
      return typed({
        tid: 'bn-compose', category: '数のしくみ（何こ分）',
        q: '100を' + h + 'こ、10を' + te + 'こ、1を' + on + 'こ あわせた数はいくつですか。',
        answer: String(n), accepted: [String(n), comma(n)],
        exp: '100が' + h + '、10が' + te + '、1が' + on + ' で ' + comma(n) + ' です。',
      });
    }
    if (t === 2) { // 何百のたし算・ひき算
      const a = ri(1, 8), b = ri(1, 9 - a);
      const add = Math.random() < 0.5;
      if (add) {
        return typed({
          tid: 'bn-hundreds-add', category: '何百のたし算',
          q: (a * 100) + ' ＋ ' + (b * 100) + ' を計算しましょう。',
          answer: String((a + b) * 100), accepted: [String((a + b) * 100), comma((a + b) * 100)],
          exp: '100の まとまりで考えます。' + a + '＋' + b + '＝' + (a + b) + ' で ' + comma((a + b) * 100) + '。',
        });
      }
      const big = ri(3, 9), small = ri(1, big - 1);
      return typed({
        tid: 'bn-hundreds-sub', category: '何百のひき算',
        q: (big * 100) + ' − ' + (small * 100) + ' を計算しましょう。',
        answer: String((big - small) * 100), accepted: [String((big - small) * 100), comma((big - small) * 100)],
        exp: '100の まとまりで考えます。' + big + '−' + small + '＝' + (big - small) + ' で ' + comma((big - small) * 100) + '。',
      });
    }
    if (t === 3) { // 10 が □ こ
      const tens = ri(11, 99);
      return typed({
        tid: 'bn-ten-count', category: '10のいくつ分',
        q: '10を' + tens + 'こ集めた数はいくつですか。',
        answer: String(tens * 10), accepted: [String(tens * 10), comma(tens * 10)],
        exp: '10が' + tens + 'こで ' + comma(tens * 10) + ' です。',
      });
    }
    if (t === 4) { // 1000 の しくみ
      const q = pick([
        { q: '100を10こ集めた数はいくつですか。', a: '1000' },
        { q: '1000は100を何こ集めた数ですか。', a: '10' },
        { q: '1000は10を何こ集めた数ですか。', a: '100' },
        { q: '990より10大きい数はいくつですか。', a: '1000' },
      ]);
      return typed({
        tid: 'bn-thousand', category: '1000のしくみ',
        q: q.q, answer: q.a, accepted: [q.a, comma(Number(q.a))],
        exp: '100が10こで1000です。答えは ' + comma(Number(q.a)) + '。',
      });
    }
    // compare two 3-digit numbers
    let a = ri(100, 999), b = ri(100, 999);
    if (a === b) b = a + ri(1, 9);
    const bigger = Math.max(a, b);
    return choice({
      tid: 'bn-compare', category: '数の大小',
      q: comma(a) + ' と ' + comma(b) + ' では、どちらが大きいですか。',
      exp: '大きいくらいの数字からくらべます。' + comma(bigger) + ' の方が大きいです。',
    }, comma(bigger), [comma(a === bigger ? b : a)]);
  }

  // ---------- U6 かさ（L・dL・mL） ----------
  function genVolume() {
    const t = ri(0, 4);
    if (t === 0) { // L -> dL
      const L = ri(2, 9);
      return typed({
        tid: 'vol-l2dl', category: 'LをdLになおす', unitSuffix: 'dL',
        q: L + 'L は 何dL ですか。',
        answer: String(L * 10), accepted: [String(L * 10), L * 10 + 'dl'],
        exp: '1L＝10dL です。' + L + '×10＝' + (L * 10) + 'dL。',
      });
    }
    if (t === 1) { // dL -> L (multiple of 10)
      const L = ri(2, 9), dL = L * 10;
      return typed({
        tid: 'vol-dl2l', category: 'dLをLになおす', unitSuffix: 'L',
        q: dL + 'dL は 何L ですか。',
        answer: String(L), accepted: [String(L), L + 'l'],
        exp: '10dL＝1L です。' + dL + '÷10＝' + L + 'L。',
      });
    }
    if (t === 2) { // L -> mL
      const L = ri(1, 5);
      return typed({
        tid: 'vol-l2ml', category: 'LをmLになおす', unitSuffix: 'mL',
        q: L + 'L は 何mL ですか。',
        answer: String(L * 1000), accepted: [String(L * 1000), comma(L * 1000), L * 1000 + 'ml'],
        exp: '1L＝1000mL です。' + L + '×1000＝' + comma(L * 1000) + 'mL。',
      });
    }
    if (t === 3) { // L dL -> dL
      const L = ri(1, 8), dL = ri(1, 9), total = L * 10 + dL;
      return typed({
        tid: 'vol-mix2dl', category: '○L○dL を dL になおす', unitSuffix: 'dL',
        q: L + 'L' + dL + 'dL は 何dL ですか。',
        answer: String(total), accepted: [String(total), total + 'dl'],
        exp: L + 'L＝' + (L * 10) + 'dL。あわせて ' + (L * 10) + '＋' + dL + '＝' + total + 'dL。',
      });
    }
    // compare
    const opt = pick([
      { a: '1L', b: '8dL', bigger: '1L', exp: '1L＝10dL。10dL と 8dL では 1L の方が多いです。' },
      { a: '1L', b: '12dL', bigger: '12dL', exp: '1L＝10dL。10dL と 12dL では 12dL の方が多いです。' },
      { a: '5dL', b: '400mL', bigger: '5dL', exp: '1dL＝100mL なので 5dL＝500mL。500mL と 400mL では 5dL の方が多いです。' },
      { a: '2L', b: '2000mL', bigger: 'おなじ', exp: '1L＝1000mL なので 2L＝2000mL。同じかさです。' },
    ]);
    const wrongs = opt.bigger === 'おなじ' ? [opt.a, opt.b] : [opt.bigger === opt.a ? opt.b : opt.a, 'おなじ'];
    return choice({
      tid: 'vol-compare', category: 'かさの大小',
      q: opt.a + ' と ' + opt.b + ' では、どちらが多いですか。（同じときは「おなじ」）',
      exp: opt.exp,
    }, opt.bigger, wrongs);
  }

  // ---------- U7 時こくと時間 ----------
  function genClockRead() {
    const h = ri(1, 12);
    const m = pick([0, 5, 10, 15, 20, 30, 35, 40, 45, 50, 55]);
    const correct = h + '時' + (m === 0 ? '' : m + '分');
    const wrongs = [];
    wrongs.push((h % 12) + 1 + '時' + (m === 0 ? '' : m + '分'));
    wrongs.push(h + '時' + ((m + 5) % 60 === 0 ? '55分' : ((m + 5) % 60) + '分'));
    wrongs.push(h + '時' + (m === 30 ? '15分' : '30分'));
    const uw = Array.from(new Set(wrongs)).filter(function (w) { return w !== correct; }).slice(0, 3);
    while (uw.length < 3) uw.push(ri(1, 12) + '時' + pick([5, 10, 20, 40, 50]) + '分');
    return choice({
      tid: 'clock-read', category: '時こくをよむ',
      q: 'とけいは何時何分をさしていますか。', fig: clockFig(h, m),
      exp: 'みじかいはりが「時」、長いはりが「分」です。長いはりは数字1つ分で5分すすみます。',
    }, correct, uw);
  }
  function genTimeCalc() {
    const t = ri(0, 3);
    if (t === 0) { // 1時間=60分 etc.
      const q = pick([
        { q: '1時間は何分ですか。', a: '60', s: '分' },
        { q: '1日は何時間ですか。', a: '24', s: '時間' },
        { q: '半日（はんにち）は何時間ですか。', a: '12', s: '時間' },
        { q: '2時間は何分ですか。', a: '120', s: '分' },
      ]);
      return typed({
        tid: 'time-unit', category: '時間のたんい', unitSuffix: q.s,
        q: q.q, answer: q.a, accepted: [q.a, q.a + q.s, comma(Number(q.a))],
        exp: '1時間＝60分、1日＝24時間 です。答えは ' + q.a + q.s + '。',
      });
    }
    if (t === 1) { // 分 -> 時間分
      const h = ri(1, 2), m = pick([10, 15, 20, 30, 40, 45, 50]);
      const total = h * 60 + m;
      return typed({
        tid: 'time-min2hm', category: '何分を何時間何分に', inputMode: 'text',
        q: total + '分は 何時間何分ですか。（れい：1時間20分）',
        answer: h + '時間' + m + '分', accepted: [h + '時間' + m + '分'],
        exp: '60分で1時間です。' + total + '分＝' + h + '時間' + m + '分。',
      });
    }
    if (t === 2) { // elapsed minutes within/simple
      const h = ri(1, 11), m1 = pick([0, 5, 10, 15, 20]), dur = pick([15, 20, 25, 30, 35, 40]);
      const end = m1 + dur;
      const eh = h + Math.floor(end / 60), em = end % 60;
      return typed({
        tid: 'time-elapsed', category: 'たった時間（分）', unitSuffix: '分',
        q: h + '時' + (m1 === 0 ? '' : m1 + '分') + 'から ' + eh + '時' + (em === 0 ? '' : em + '分') + ' までは 何分間ですか。',
        answer: String(dur), accepted: [String(dur), dur + '分'],
        exp: '長いはりが すすんだ 分をかぞえます。' + dur + '分間です。',
      });
    }
    // 時こく + 分 = 時こく
    const h = ri(1, 10), m = pick([0, 5, 10, 15, 20, 30]), add = pick([10, 15, 20, 30]);
    const total = m + add, nh = h + Math.floor(total / 60), nm = total % 60;
    return typed({
      tid: 'time-after', category: '○分後の時こく', inputMode: 'text',
      q: h + '時' + (m === 0 ? '' : m + '分') + 'の ' + add + '分後の時こくを書きましょう。（れい：3時40分）',
      answer: nh + '時' + (nm === 0 ? '' : nm + '分'),
      accepted: [nh + '時' + (nm === 0 ? '' : nm + '分'), nh + '時' + nm + '分'],
      exp: m + '分に' + add + '分を たします。答えは ' + nh + '時' + (nm === 0 ? '' : nm + '分') + '。',
    });
  }

  // ---------- U8 計算のくふう ----------
  function genCalcTricks() {
    const t = ri(0, 2);
    if (t === 0) { // three-term grouping to make 10
      const b = ri(2, 8), c = 10 - b; // b+c=10
      const a = ri(11, 39);
      return typed({
        tid: 'trick-make10', category: '10のまとまりを作るくふう',
        q: a + ' ＋ ' + b + ' ＋ ' + c + ' を くふうして計算しましょう。',
        answer: String(a + b + c),
        exp: '（' + b + '＋' + c + '）＝10 を先に作ると かんたんです。' + a + '＋10＝' + (a + b + c) + '。',
      });
    }
    if (t === 1) { // commutative property fact
      const a = ri(13, 48), b = ri(13, 48);
      return choice({
        tid: 'trick-commute', category: 'たし算のじゅんじょ',
        q: a + '＋' + b + ' と ' + b + '＋' + a + ' の答えは、同じですか ちがいますか。',
        exp: 'たされる数と たす数を 入れかえても 答えは同じです（どちらも ' + (a + b) + '）。',
      }, 'おなじ', ['ちがう', 'どちらともいえない']);
    }
    // three-term add in easy order
    const a = ri(6, 9), b = ri(2, 5), c = 10 - a; // a+c=10
    const arr = shuffle([a, b, c]);
    return typed({
      tid: 'trick-order', category: 'じゅんじょをくふうするたし算',
      q: arr[0] + ' ＋ ' + arr[1] + ' ＋ ' + arr[2] + ' を計算しましょう。',
      answer: String(a + b + c),
      exp: 'たす じゅんじょを 変えても 答えは同じ。10 を作れる 組を先にたすと らくです。答えは ' + (a + b + c) + '。',
    });
  }

  // ---------- U9 たし算とひき算のひっ算（3けた） ----------
  function genAddSub3() {
    const t = ri(0, 3);
    if (t === 0) { // 3d + 2/3d addition, sum <= 1000
      const A = ri(105, 799), B = ri(30, Math.min(190, 1000 - A));
      return typed({
        tid: 'as3-add', category: '3けたのたし算',
        q: A + ' ＋ ' + B + ' を ひっ算で計算しましょう。',
        answer: String(A + B), accepted: [String(A + B), comma(A + B)],
        exp: '一のくらいから じゅんに、くり上がりに気をつけて たします。' + A + '＋' + B + '＝' + (A + B) + '。',
      });
    }
    if (t === 1) { // 3d - 2/3d subtraction (may borrow)
      const A = ri(210, 999), B = ri(40, A - 30);
      return typed({
        tid: 'as3-sub', category: '3けたのひき算',
        q: A + ' − ' + B + ' を ひっ算で計算しましょう。',
        answer: String(A - B), accepted: [String(A - B), comma(A - B)],
        exp: '一のくらいから じゅんに、くり下がりに気をつけて ひきます。' + A + '−' + B + '＝' + (A - B) + '。',
      });
    }
    if (t === 2) { // 3d + 3d
      const A = ri(120, 480), B = ri(120, Math.min(480, 1000 - A));
      return typed({
        tid: 'as3-add3', category: '3けた＋3けたのたし算',
        q: A + ' ＋ ' + B + ' を計算しましょう。',
        answer: String(A + B), accepted: [String(A + B), comma(A + B)],
        exp: 'くらいを たてに そろえて たします。' + A + '＋' + B + '＝' + (A + B) + '。',
      });
    }
    // word problem
    const A = ri(150, 600), B = ri(40, 200);
    const th = pick(THINGS);
    return typed({
      tid: 'as3-word', category: '3けたの文しょうだい',
      q: th.n + 'が' + A + th.c + 'あります。' + B + th.c + 'ふえると、ぜんぶで何' + th.c + 'ですか。',
      unitSuffix: th.c, answer: String(A + B), accepted: [String(A + B), comma(A + B), (A + B) + th.c],
      exp: 'ふえるので たし算です。' + A + '＋' + B + '＝' + (A + B) + th.c + '。',
    });
  }

  // ---------- U10 三角形と四角形 ----------
  const SHAPE_FACTS = [
    { q: '三角形の 辺（へん）の数はいくつですか。', a: '3', exp: '三角形は 辺が3つ、ちょう点が3つ あります。' },
    { q: '三角形の ちょう点の数はいくつですか。', a: '3', exp: '三角形は ちょう点が3つ あります。' },
    { q: '四角形の 辺（へん）の数はいくつですか。', a: '4', exp: '四角形は 辺が4つ、ちょう点が4つ あります。' },
    { q: '四角形の ちょう点の数はいくつですか。', a: '4', exp: '四角形は ちょう点が4つ あります。' },
    { q: '長方形には 直角（ちょっかく）がいくつ ありますか。', a: '4', exp: '長方形の 角は ぜんぶ 直角で、4つ あります。' },
    { q: '正方形には 直角がいくつ ありますか。', a: '4', exp: '正方形の 角は ぜんぶ 直角で、4つ あります。' },
  ];
  const SHAPE_PROPS = [
    { q: '長方形について、いつでも正しいものはどれですか。', correct: 'むかい合う辺の長さが同じ',
      wrong: ['4つの辺の長さがすべて同じ', '直角が1つもない', '辺が3つしかない'] },
    { q: '正方形について、いつでも正しいものはどれですか。', correct: '4つの辺の長さがすべて同じ',
      wrong: ['角に直角が1つもない', '辺が3つしかない', 'むかい合う辺だけ長さがちがう'] },
    { q: '直角三角形とは どんな三角形ですか。', correct: '直角が1つある三角形',
      wrong: ['辺が4つある三角形', '直角が3つある三角形', 'まるい形の三角形'] },
  ];
  function genTriQuad() {
    const t = ri(0, 2);
    if (t === 0) { // name from figure
      const kind = pick(['tri', 'quad', 'rect', 'square', 'rtri']);
      const nameMap = { tri: '三角形', quad: '四角形', rect: '長方形', square: '正方形', rtri: '直角三角形' };
      const correct = nameMap[kind];
      const allNames = ['三角形', '四角形', '長方形', '正方形', '直角三角形'];
      return choice({
        tid: 'tq-name', category: '形の名前',
        q: 'この形の名前はどれですか。', fig: shapeFig(kind),
        exp: (kind === 'tri' ? '辺が3つの形は 三角形。' :
          kind === 'quad' ? '辺が4つの形は 四角形。' :
          kind === 'rect' ? '4つの角がぜんぶ直角の四角形は 長方形。' :
          kind === 'square' ? '4つの辺が同じで角がぜんぶ直角の四角形は 正方形。' :
          '直角が1つある三角形は 直角三角形。') + ' 答えは ' + correct + '。',
      }, correct, shuffle(allNames.filter(function (n) { return n !== correct; })));
    }
    if (t === 1) { // count fact (typed)
      const f = pick(SHAPE_FACTS);
      return typed({
        tid: 'tq-count', category: '辺・ちょう点・直角の数',
        q: f.q, answer: f.a, accepted: [f.a],
        exp: f.exp,
      });
    }
    // property (choice)
    const p = pick(SHAPE_PROPS);
    return choice({
      tid: 'tq-prop', category: '形のせいしつ',
      q: p.q, exp: '答えは「' + p.correct + '」です。',
    }, p.correct, shuffle(p.wrong.slice()));
  }

  // ---------- U11 かけ算(1)：2・3・4・5のだん ＋ かけ算のいみ ----------
  function multWrongs(a, b, ans) {
    const cand = [(a + 1) * b, (a - 1) * b, a * (b + 1), a * (b - 1), ans + b, ans - b, ans + a, ans - a, ans + 1, ans - 1];
    return cand.filter(function (v) { return v > 0 && v !== ans; });
  }
  function genKuku(dans) {
    // a is the multiplier restricted to `dans`; b is 1..9; reading order random
    const a = pick(dans), b = ri(1, 9);
    const ans = a * b;
    const asChoice = Math.random() < 0.45;
    const swap = Math.random() < 0.5;
    const x = swap ? b : a, y = swap ? a : b;
    const q = x + ' × ' + y + ' はいくつですか。';
    const exp = x + '×' + y + '＝' + ans + '。' + (dans.length <= 4 ? a + 'のだんの九九です。' : '');
    if (asChoice) {
      return choice({
        tid: 'kuku-' + (dans.length <= 4 ? 'low' : 'high') + '-c', category: '九九（えらぶ）',
        q: q, exp: exp,
      }, ans, shuffle(multWrongs(a, b, ans)), function () { return ri(1, 81); });
    }
    return typed({
      tid: 'kuku-' + (dans.length <= 4 ? 'low' : 'high') + '-t', category: '九九（かく）',
      q: q, answer: String(ans), accepted: [String(ans)], exp: exp,
    });
  }
  function genMult1() { return genKuku([2, 3, 4, 5]); }
  function genMultMeaning() {
    const t = ri(0, 2);
    if (t === 0) { // meaning: a が b つ分
      const a = ri(2, 5), b = ri(2, 6);
      const th = pick(THINGS);
      return typed({
        tid: 'mm-groups', category: 'かけ算のいみ（いくつ分）',
        q: '1さらに' + th.n + 'が' + a + th.c + 'ずつ のっています。' + b + 'さら分では ぜんぶで何' + th.c + 'ですか。',
        unitSuffix: th.c, answer: String(a * b), accepted: [String(a * b), a * b + th.c],
        exp: a + th.c + 'の ' + b + 'つ分なので ' + a + '×' + b + '＝' + (a * b) + th.c + '。',
      });
    }
    if (t === 1) { // which expression matches
      const a = ri(2, 5), b = ri(2, 6);
      return choice({
        tid: 'mm-expr', category: 'かけ算の式',
        q: a + 'この ' + b + 'つ分を もとめる式はどれですか。',
        exp: '（1つ分の数）×（いくつ分）なので ' + a + '×' + b + ' です。',
      }, a + '×' + b, [a + '＋' + b, b + '−' + a, a + '×' + (b + 1)]);
    }
    // ×1 と ×0 の考え、または 5ずつ
    const q = pick([
      { q: 'どんな数に 1 をかけると、答えはどうなりますか。', a: 'もとの数と同じ', w: ['0になる', '1になる', '2ばいになる'], exp: '□×1＝□。1をかけると もとの数のままです。' },
      { q: '4×3 と 3×4 の 答えは、同じですか ちがいますか。', a: 'おなじ', w: ['ちがう', 'わからない'], exp: 'かける じゅんじょが かわっても 答えは同じ（どちらも12）です。' },
    ]);
    return choice({
      tid: 'mm-rule', category: 'かけ算のきまり',
      q: q.q, exp: q.exp,
    }, q.a, shuffle(q.w.slice()));
  }

  // ---------- U12 かけ算(2)：6・7・8・9・1のだん ＋ 全段 ＋ □さがし ----------
  function genMult2() { return genKuku([1, 6, 7, 8, 9]); }
  function genKukuAll() { return genKuku([1, 2, 3, 4, 5, 6, 7, 8, 9]); }
  function genMissingFactor() {
    // Fix the SHOWN operand k (1..9); blank is a (1..9); product = k*a.
    // Because k is shown and fixed, a = product/k is UNIQUE in 1..9 — this is
    // the spec's required guard against the two-factorization collision.
    const a = ri(1, 9), k = ri(1, 9);
    const prod = a * k;
    const blankFirst = Math.random() < 0.5;
    const q = (blankFirst ? '□ × ' + k : k + ' × □') + ' ＝ ' + prod + '　の □ に入る数はいくつですか。';
    return typed({
      tid: 'kuku-missing', category: '九九（□をもとめる）',
      q: q, answer: String(a), accepted: [String(a)],
      exp: k + 'のだんで、答えが ' + prod + ' になるのは ' + k + '×' + a + '＝' + prod + '。□は ' + a + '。',
    });
  }

  // ---------- U13 長い長さ（m） ----------
  function genLengthM() {
    const t = ri(0, 4);
    if (t === 0) { // m -> cm
      const m = ri(2, 9);
      return typed({
        tid: 'lm-m2cm', category: 'mをcmになおす', unitSuffix: 'cm',
        q: m + 'm は 何cm ですか。',
        answer: String(m * 100), accepted: [String(m * 100), comma(m * 100), m * 100 + 'cm'],
        exp: '1m＝100cm です。' + m + '×100＝' + (m * 100) + 'cm。',
      });
    }
    if (t === 1) { // cm -> m (multiple of 100)
      const m = ri(2, 9), cm = m * 100;
      return typed({
        tid: 'lm-cm2m', category: 'cmをmになおす', unitSuffix: 'm',
        q: cm + 'cm は 何m ですか。',
        answer: String(m), accepted: [String(m), m + 'm'],
        exp: '100cm＝1m です。' + cm + '÷100＝' + m + 'm。',
      });
    }
    if (t === 2) { // m cm -> cm
      const m = ri(1, 8), cm = ri(1, 99), total = m * 100 + cm;
      return typed({
        tid: 'lm-mix2cm', category: '○m○cm を cm になおす', unitSuffix: 'cm',
        q: m + 'm' + cm + 'cm は 何cm ですか。',
        answer: String(total), accepted: [String(total), comma(total), total + 'cm'],
        exp: m + 'm＝' + (m * 100) + 'cm。あわせて ' + (m * 100) + '＋' + cm + '＝' + total + 'cm。',
      });
    }
    if (t === 3) { // cm -> m cm
      const m = ri(1, 8), cm = ri(1, 99), total = m * 100 + cm;
      return typed({
        tid: 'lm-cm2mix', category: 'cm を ○m○cm になおす', inputMode: 'text',
        q: total + 'cm は 何m何cm ですか。（れい：2m40cm）',
        answer: m + 'm' + cm + 'cm', accepted: [m + 'm' + cm + 'cm', m + 'm' + cm],
        exp: total + 'cm＝' + (m * 100) + 'cm＋' + cm + 'cm＝' + m + 'm' + cm + 'cm。',
      });
    }
    // which unit fits
    const opt = pick([
      { q: 'きょうしつの たての長さを はかるのに いちばん よいたんいはどれですか。', a: 'm', exp: '長い長さは m ではかります。' },
      { q: 'えんぴつの 長さを はかるのに いちばん よいたんいはどれですか。', a: 'cm', exp: 'みじかい長さは cm ではかります。' },
      { q: 'けしゴムの あつさを はかるのに いちばん よいたんいはどれですか。', a: 'mm', exp: 'とても みじかい長さは mm ではかります。' },
    ]);
    return choice({
      tid: 'lm-unit', category: 'たんいのえらび方',
      q: opt.q, exp: opt.exp,
    }, opt.a, ['mm', 'cm', 'm'].filter(function (u) { return u !== opt.a; }));
  }

  // ---------- U14 分数 ----------
  function genFraction() {
    const t = ri(0, 2);
    if (t === 0) { // name the shaded fraction from a bar (unit fractions only)
      const parts = pick([2, 3, 4]);
      const fig = fracBarFig(parts, 1);
      const correct = parts + '分の1';
      const wrongPool = [2, 3, 4, 8].filter(function (p) { return p !== parts; }).map(function (p) { return p + '分の1'; });
      return choice({
        tid: 'fr-name', category: '分数をよむ',
        q: '色をぬった ところは、もとの大きさの どれだけですか。', fig: fig,
        exp: '同じ大きさに ' + parts + 'つに分けた 1つ分なので ' + parts + '分の1 です。',
      }, correct, shuffle(wrongPool));
    }
    if (t === 1) { // meaning of half / quarter (typed number of parts)
      const opt = pick([
        { q: 'もとの大きさを 同じ大きさに 2つに分けた 1つ分を 何といいますか。数字で「□分の1」の □ を書きましょう。', a: '2' },
        { q: 'もとの大きさを 同じ大きさに 4つに分けた 1つ分を 「□分の1」と表します。□ に入る数はいくつですか。', a: '4' },
        { q: '2分の1が 2つ分で、もとの大きさは いくつ分になりますか。（1と書きます）', a: '1' },
      ]);
      return typed({
        tid: 'fr-mean', category: '分数のいみ',
        q: opt.q, answer: opt.a, accepted: [opt.a],
        exp: '同じ大きさに □こに 分けた 1つ分が □分の1 です。答えは ' + opt.a + '。',
      });
    }
    // compare 1/2 vs 1/4 vs 1/3 (bigger unit fraction has smaller denominator)
    const two = shuffle([2, 3, 4]).slice(0, 2);
    const smallDen = Math.min(two[0], two[1]);
    const correct = smallDen + '分の1';
    return choice({
      tid: 'fr-compare', category: '分数の大小',
      q: two[0] + '分の1 と ' + two[1] + '分の1 では、どちらが大きいですか。',
      exp: '同じ大きさを 分ける数が 少ないほど 1つ分は 大きくなります。' + smallDen + '分の1 の方が大きいです。',
    }, correct, [Math.max(two[0], two[1]) + '分の1']);
  }

  // ---------- U15 はこの形 ----------
  const BOX_FACTS = [
    { q: 'はこの形（直方体）の 面（めん）の数はいくつですか。', a: '6', exp: 'はこの形には 面が6つ あります。' },
    { q: 'はこの形の へん の数はいくつですか。', a: '12', exp: 'はこの形には へんが12 あります。' },
    { q: 'はこの形の ちょう点の数はいくつですか。', a: '8', exp: 'はこの形には ちょう点が8つ あります。' },
    { q: 'サイコロ（立方体）の 面の数はいくつですか。', a: '6', exp: 'サイコロも 面が6つ あります。' },
  ];
  const BOX_PROPS = [
    { q: 'はこの形は、いくつの 長方形で かこまれていますか。', correct: '6つ', wrong: ['4つ', '8つ', '12こ'] },
    { q: 'はこの形の むかい合う面は、どんな関係ですか。', correct: '形も大きさも同じ', wrong: ['大きさがちがう', '三角形になる', '1つしかない'] },
    { q: 'サイコロ（立方体）の 面は、どんな形ですか。', correct: '正方形', wrong: ['三角形', '長方形（正方形ではない）', '丸'] },
  ];
  function genBoxes() {
    const t = ri(0, 1);
    if (t === 0) {
      const f = pick(BOX_FACTS);
      const showFig = f.a === '12' || f.a === '8' || Math.random() < 0.5;
      return typed({
        tid: 'box-count', category: 'はこの 面・へん・ちょう点',
        q: f.q, fig: showFig ? boxFig(f.a === '8') : null,
        answer: f.a, accepted: [f.a], exp: f.exp,
      });
    }
    const p = pick(BOX_PROPS);
    return choice({
      tid: 'box-prop', category: 'はこの形のせいしつ',
      q: p.q, fig: boxFig(false), exp: '答えは「' + p.correct + '」です。',
    }, p.correct, shuffle(p.wrong.slice()));
  }

  // ================= units =================
  const UNITS = [
    { key: 'u01_tables_graphs', num: 1, title: '表とグラフ', vol: '上', sections: [
      { id: 'u01-graph', title: 'グラフをよむ', gen: genGraph, n: 8 },
    ] },
    { key: 'u02_add_column', num: 2, title: 'たし算のひっ算', vol: '上', sections: [
      { id: 'u02-keisan', title: '2けたのたし算', gen: genAdd2, n: 10 },
      { id: 'u02-bunsho', title: 'たし算の文しょうだい', gen: function () { return genAdd2word(); }, n: 6 },
    ] },
    { key: 'u03_sub_column', num: 3, title: 'ひき算のひっ算', vol: '上', sections: [
      { id: 'u03-keisan', title: '2けたのひき算', gen: genSub2, n: 10 },
      { id: 'u03-bunsho', title: 'ひき算の文しょうだい', gen: function () { return genSub2word(); }, n: 6 },
    ] },
    { key: 'u04_length_cm_mm', num: 4, title: '長さ（cm・mm）', vol: '上', sections: [
      { id: 'u04-nagasa', title: '長さ（cm・mm）', gen: genLengthCm, n: 8 },
    ] },
    { key: 'u05_to1000', num: 5, title: '100より大きい数', vol: '上', sections: [
      { id: 'u05-shikumi', title: '数のしくみ', gen: genBigNum, n: 10 },
    ] },
    { key: 'u06_volume', num: 6, title: 'かさ（L・dL・mL）', vol: '上', sections: [
      { id: 'u06-kasa', title: 'かさ（L・dL・mL）', gen: genVolume, n: 8 },
    ] },
    { key: 'u07_time', num: 7, title: '時こくと時間', vol: '上', sections: [
      { id: 'u07-yomu', title: '時こくをよむ', gen: genClockRead, n: 8 },
      { id: 'u07-keisan', title: '時間のけいさん', gen: genTimeCalc, n: 8 },
    ] },
    { key: 'u08_calc_tricks', num: 8, title: '計算のくふう', vol: '上', sections: [
      { id: 'u08-kufuu', title: '計算のくふう', gen: genCalcTricks, n: 8 },
    ] },
    { key: 'u09_addsub3digit', num: 9, title: 'たし算とひき算のひっ算', vol: '下', sections: [
      { id: 'u09-tashi', title: '3けたのたし算', gen: function () { return pick3add(); }, n: 8 },
      { id: 'u09-hiki', title: '3けたのひき算', gen: function () { return pick3sub(); }, n: 8 },
    ] },
    { key: 'u10_tri_quad', num: 10, title: '三角形と四角形', vol: '下', sections: [
      { id: 'u10-katachi', title: '三角形と四角形', gen: genTriQuad, n: 8 },
    ] },
    { key: 'u11_mult1', num: 11, title: 'かけ算(1)', vol: '下', sections: [
      { id: 'u11-kuku', title: '九九（2・3・4・5のだん）', gen: genMult1, n: 10 },
      { id: 'u11-imi', title: 'かけ算のいみ', gen: genMultMeaning, n: 6 },
    ] },
    { key: 'u12_mult2', num: 12, title: 'かけ算(2)', vol: '下', sections: [
      { id: 'u12-kuku', title: '九九（6・7・8・9・1のだん）', gen: genMult2, n: 10 },
      { id: 'u12-zenbu', title: '九九（ぜんぶの段）', gen: genKukuAll, n: 12 },
      { id: 'u12-missing', title: '□をもとめる（九九）', gen: genMissingFactor, n: 8 },
    ] },
    { key: 'u13_length_m', num: 13, title: '長い長さ（m）', vol: '下', sections: [
      { id: 'u13-nagasa', title: '長い長さ（m）', gen: genLengthM, n: 8 },
    ] },
    { key: 'u14_fractions', num: 14, title: '分数', vol: '下', sections: [
      { id: 'u14-bunsu', title: '分数', gen: genFraction, n: 8 },
    ] },
    { key: 'u15_boxes', num: 15, title: 'はこの形', vol: '下', sections: [
      { id: 'u15-hako', title: 'はこの形', gen: genBoxes, n: 8 },
    ] },
  ];

  // Section generators that must yield a specific sub-type: reuse the base
  // generator's word-problem branch by retrying until it lands on it (cheap:
  // each base gen returns the word type ~1/3 of the time).
  function genAdd2word() { let p; do { p = genAdd2(); } while (p.tid !== 'add2-word'); return p; }
  function genSub2word() { let p; do { p = genSub2(); } while (p.tid !== 'sub2-word'); return p; }
  function pick3add() { let p; do { p = genAddSub3(); } while (!(p.tid === 'as3-add' || p.tid === 'as3-add3' || p.tid === 'as3-word')); return p; }
  function pick3sub() { let p; do { p = genAddSub3(); } while (p.tid !== 'as3-sub'); return p; }

  window.SANSU2_DATA = { UNITS: UNITS };
})();
