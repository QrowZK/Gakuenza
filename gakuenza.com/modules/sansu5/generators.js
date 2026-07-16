// 算数 5年 — Gakuenza module content & problem generators
// すべてオリジナル教材。東京書籍『新編 新しい算数5』(令和6年度版) の
// 単元構成（18単元・上下2巻・標準175時間）に対応させているが、問題そのものは
// 全て独自生成 — 教科書の問題文・数値・図版は一切転載していない。
//
// アーキテクチャは sansu3 / sansu4 の生成器パターンをそのまま踏襲する
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
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }
  function lcm(a, b) { return a / gcd(a, b) * b; }

  // decimal helper — keep arithmetic in integer units of 1/scale to avoid
  // floating-point drift, then format cleanly (strip trailing zeros).
  //   dec(1234, 100)  -> "12.34"
  //   dec(1200, 1000) -> "1.2"
  //   dec(50,   10)   -> "5"
  function dec(intVal, scale) {
    const neg = intVal < 0;
    let v = Math.abs(Math.round(intVal));
    const whole = Math.floor(v / scale);
    const frac = v % scale;
    if (frac === 0) return (neg ? '-' : '') + whole;
    const digits = String(scale).length - 1; // 10->1, 100->2, 1000->3
    let fs = String(frac).padStart(digits, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + whole + '.' + fs;
  }
  // Every printed decimal answer also accepts the same value written a few
  // common ways (e.g. "3.0"/"3", ".5"/"0.5"); normalize() in app.js already
  // strips width/space, so we only add value-equal variants here.
  function decAccepts(intVal, scale) {
    const s = dec(intVal, scale);
    const set = [s];
    const num = intVal / scale;
    if (String(num) !== s) set.push(String(num));
    return set;
  }

  const NAMES = ['ゆい', 'はると', 'さくら', 'そうた', 'ひなた', 'りく', 'あおい', 'みお', 'いつき', 'こはる'];
  const THINGS = [
    { n: 'あめ', c: 'こ' }, { n: 'えんぴつ', c: '本' }, { n: 'おり紙', c: 'まい' },
    { n: 'クッキー', c: 'こ' }, { n: 'カード', c: 'まい' }, { n: 'ビー玉', c: 'こ' },
    { n: 'シール', c: 'まい' }, { n: 'ジュース', c: '本' },
  ];

  // ---------- answer form helpers ----------
  function typed(o) { o.kind = 'typed'; o.accepted = o.accepted || [o.answer]; o.inputMode = o.inputMode || 'numeric'; return o; }

  // Robust choice builder: guarantees exactly 4 DISTINCT options, the
  // correct one present exactly once, and NO distractor equal to the
  // correct value (the "secretly-also-correct" bug). wrongs is a list of
  // candidate distractors (strings/numbers); fill() optionally supplies
  // more if dedup leaves fewer than 3.
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

  // rectangular prism (cabinet projection) with labeled edges
  function boxFig(aLab, bLab, cLab) {
    const x = 50, y = 60, w = 120, h = 80, dx = 46, dy = -32;
    function ln(x1, y1, x2, y2, dash) {
      return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="#4a6b4f" stroke-width="2.5"' + (dash ? ' stroke-dasharray="5 4"' : '') + '/>';
    }
    let body = '';
    body += ln(x, y, x + w, y) + ln(x + w, y, x + w, y + h) + ln(x + w, y + h, x, y + h) + ln(x, y + h, x, y);
    body += ln(x + dx, y + dy, x + w + dx, y + dy) + ln(x + w + dx, y + dy, x + w + dx, y + h + dy) +
      ln(x + w + dx, y + h + dy, x + dx, y + h + dy, true) + ln(x + dx, y + h + dy, x + dx, y + dy, true);
    body += ln(x, y, x + dx, y + dy) + ln(x + w, y, x + w + dx, y + dy) + ln(x + w, y + h, x + w + dx, y + h + dy) +
      ln(x, y + h, x + dx, y + h + dy, true);
    body += '<text x="' + (x + w / 2) + '" y="' + (y + h + 20) + '" font-size="14" font-weight="bold" text-anchor="middle" fill="#1c2530">' + aLab + '</text>';
    body += '<text x="' + (x + w + 8) + '" y="' + (y + h / 2 + 5) + '" font-size="14" font-weight="bold" text-anchor="start" fill="#1c2530">' + bLab + '</text>';
    body += '<text x="' + (x + w + dx / 2 + 6) + '" y="' + (y + dy / 2 + 4) + '" font-size="14" font-weight="bold" text-anchor="start" fill="#1c2530">' + cLab + '</text>';
    return svg(240, 170, body);
  }

  // parallelogram with labeled base + height (dashed height inside)
  function paraFig(baseLab, hLab) {
    const W = 280, H = 170, x = 40, y = 120, b = 160, sk = 44, h = 78;
    const p1 = [x, y], p2 = [x + b, y], p3 = [x + b + sk, y - h], p4 = [x + sk, y - h];
    let body = '<polygon points="' + p1.join(',') + ' ' + p2.join(',') + ' ' + p3.join(',') + ' ' + p4.join(',') +
      '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    // height (dashed) from p4 straight down to base line
    body += '<line x1="' + (x + sk) + '" y1="' + (y - h) + '" x2="' + (x + sk) + '" y2="' + y + '" stroke="#b5572e" stroke-width="2" stroke-dasharray="5 4"/>';
    body += '<rect x="' + (x + sk) + '" y="' + (y - 10) + '" width="10" height="10" fill="none" stroke="#b5572e" stroke-width="1.5"/>';
    body += '<text x="' + (x + b / 2) + '" y="' + (y + 22) + '" font-size="14" font-weight="bold" text-anchor="middle" fill="#1c2530">' + baseLab + '</text>';
    body += '<text x="' + (x + sk - 8) + '" y="' + (y - h / 2 + 4) + '" font-size="14" font-weight="bold" text-anchor="end" fill="#b5572e">' + hLab + '</text>';
    return svg(W, H, body);
  }

  // triangle with labeled base + height
  function triFig(baseLab, hLab) {
    const W = 260, H = 170, x = 30, y = 130, b = 170, apex = 60, h = 92;
    const p1 = [x, y], p2 = [x + b, y], p3 = [x + apex, y - h];
    let body = '<polygon points="' + p1.join(',') + ' ' + p2.join(',') + ' ' + p3.join(',') +
      '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    body += '<line x1="' + (x + apex) + '" y1="' + (y - h) + '" x2="' + (x + apex) + '" y2="' + y + '" stroke="#b5572e" stroke-width="2" stroke-dasharray="5 4"/>';
    body += '<rect x="' + (x + apex) + '" y="' + (y - 10) + '" width="10" height="10" fill="none" stroke="#b5572e" stroke-width="1.5"/>';
    body += '<text x="' + (x + b / 2) + '" y="' + (y + 22) + '" font-size="14" font-weight="bold" text-anchor="middle" fill="#1c2530">' + baseLab + '</text>';
    body += '<text x="' + (x + apex - 8) + '" y="' + (y - h / 2 + 4) + '" font-size="14" font-weight="bold" text-anchor="end" fill="#b5572e">' + hLab + '</text>';
    return svg(W, H, body);
  }

  // trapezoid with labeled top(上底)/bottom(下底)/height
  function trapFig(topLab, botLab, hLab) {
    const W = 300, H = 170, x = 30, y = 125, bot = 230, top = 120, off = 55, h = 82;
    const p1 = [x, y], p2 = [x + bot, y], p3 = [x + off + top, y - h], p4 = [x + off, y - h];
    let body = '<polygon points="' + p1.join(',') + ' ' + p2.join(',') + ' ' + p3.join(',') + ' ' + p4.join(',') +
      '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    body += '<line x1="' + (x + off) + '" y1="' + (y - h) + '" x2="' + (x + off) + '" y2="' + y + '" stroke="#b5572e" stroke-width="2" stroke-dasharray="5 4"/>';
    body += '<text x="' + (x + off + top / 2) + '" y="' + (y - h - 8) + '" font-size="13" font-weight="bold" text-anchor="middle" fill="#1c2530">' + topLab + '</text>';
    body += '<text x="' + (x + bot / 2) + '" y="' + (y + 22) + '" font-size="13" font-weight="bold" text-anchor="middle" fill="#1c2530">' + botLab + '</text>';
    body += '<text x="' + (x + off - 8) + '" y="' + (y - h / 2 + 4) + '" font-size="13" font-weight="bold" text-anchor="end" fill="#b5572e">' + hLab + '</text>';
    return svg(W, H, body);
  }

  // circle with a diameter (or radius) line labeled
  function circleFig(label, isRadius) {
    const W = 220, H = 200, cx = 110, cy = 100, r = 76;
    let body = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    body += '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#1c2530"/>';
    if (isRadius) {
      body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#b5572e" stroke-width="2.5"/>';
      body += '<text x="' + (cx + r / 2) + '" y="' + (cy - 8) + '" font-size="14" font-weight="bold" text-anchor="middle" fill="#b5572e">' + label + '</text>';
    } else {
      body += '<line x1="' + (cx - r) + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#b5572e" stroke-width="2.5"/>';
      body += '<text x="' + cx + '" y="' + (cy - 8) + '" font-size="14" font-weight="bold" text-anchor="middle" fill="#b5572e">' + label + '</text>';
    }
    return svg(W, H, body);
  }

  // simple horizontal band graph (帯グラフ): segments[] = {label, pct}
  function bandFig(segments) {
    const W = 360, H = 90, x0 = 14, w = 332, y = 26, h = 34;
    let body = '<rect x="' + x0 + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#fffdf8" stroke="#3a4555" stroke-width="1.5"/>';
    const fills = ['#c9a24b', '#4a6b4f', '#b5572e', '#8a7b9e', '#5b8aa0', '#cbb89a'];
    let acc = 0;
    // top scale 0..100 by 10
    for (let s = 0; s <= 100; s += 10) {
      const sx = x0 + w * s / 100;
      body += '<line x1="' + sx.toFixed(1) + '" y1="' + (y - 5) + '" x2="' + sx.toFixed(1) + '" y2="' + y + '" stroke="#3a4555" stroke-width="1"/>';
      if (s % 20 === 0) body += '<text x="' + sx.toFixed(1) + '" y="' + (y - 8) + '" font-size="10" text-anchor="middle" fill="#3a4555">' + s + '</text>';
    }
    segments.forEach(function (seg, i) {
      const sx = x0 + w * acc / 100;
      const sw = w * seg.pct / 100;
      body += '<rect x="' + sx.toFixed(1) + '" y="' + y + '" width="' + sw.toFixed(1) + '" height="' + h + '" fill="' + fills[i % fills.length] + '" stroke="#3a4555" stroke-width="1"/>';
      if (sw > 30) body += '<text x="' + (sx + sw / 2).toFixed(1) + '" y="' + (y + h / 2 + 5) + '" font-size="12" text-anchor="middle" fill="#1c2530">' + seg.label + '</text>';
      acc += seg.pct;
    });
    return svg(W, H, body);
  }

  // regular n-gon figure (for 正多角形)
  function ngonFig(n) {
    const W = 200, H = 190, cx = 100, cy = 98, r = 78;
    let pts = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    return svg(W, H, '<polygon points="' + pts.join(' ') + '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>');
  }

  // ================= generators per unit =================

  // ---------- U1 整数と小数 ----------
  function genDecimalPlace() {
    const t = ri(0, 3);
    if (t === 0) { // ×10 / ×100 / ÷10 / ÷100 of a decimal
      const base = ri(105, 9995); // thousandths
      const mode = pick(['x10', 'x100', 'd10', 'd100']);
      const factor = { x10: 10, x100: 100, d10: 1 / 10, d100: 1 / 100 }[mode];
      const ansTh = Math.round(base * factor);
      const baseS = dec(base, 1000), ansS = dec(ansTh, 1000);
      const label = { x10: '10倍', x100: '100倍', d10: '10でわった数', d100: '100でわった数' }[mode];
      return typed({
        tid: 'dec-scale', category: '小数の10倍・100倍・1/10・1/100', inputMode: 'text',
        q: baseS + ' を' + label + 'は、いくつですか。',
        answer: ansS, accepted: decAccepts(ansTh, 1000),
        exp: (mode[0] === 'x' ? '10倍で位が1つ、100倍で位が2つ上がります。' : '10でわると位が1つ、100でわると位が2つ下がります。') +
          ' ' + baseS + ' → ' + ansS + '。',
      });
    }
    if (t === 1) { // compose from place-value pieces (0.1 / 0.01 / 0.001)
      const a = ri(1, 9), b = ri(0, 9), c = ri(0, 9);
      const th = a * 100 + b * 10 + c; // thousandths
      const val = dec(th, 1000);
      return typed({
        tid: 'dec-compose', category: '小数のしくみ（0.1・0.01・0.001のいくつ分）', inputMode: 'text',
        q: '0.1を' + a + 'こ、0.01を' + b + 'こ、0.001を' + c + 'こ合わせた数を書きましょう。',
        answer: val, accepted: decAccepts(th, 1000),
        exp: '0.1が' + a + '、0.01が' + b + '、0.001が' + c + ' で ' + val + ' です。',
      });
    }
    if (t === 2) { // 0.001 が □ こ
      const th = ri(1005, 9995); // thousandths count
      const val = dec(th, 1000);
      return typed({
        tid: 'dec-unit-count', category: '0.001のいくつ分', inputMode: 'text',
        q: dec(th, 1000) + ' は、0.001を何こ集めた数ですか。',
        answer: String(th), accepted: [String(th), comma(th)],
        exp: '0.001が1000こで1です。' + val + ' は 0.001 が ' + comma(th) + ' こ分です。',
      });
    }
    // read digit at a named place
    const digs = [ri(1, 9), ri(0, 9), ri(0, 9), ri(0, 9)]; // tens, ones, tenths, hundredths
    const val = digs[0] * 10 + digs[1] + digs[2] / 10 + digs[3] / 100;
    const th = Math.round(val * 100);
    const places = [
      { name: '十の位', d: digs[0] }, { name: '一の位', d: digs[1] },
      { name: '10分の1の位（小数第一位）', d: digs[2] }, { name: '100分の1の位（小数第二位）', d: digs[3] },
    ];
    const pl = pick(places);
    return typed({
      tid: 'dec-place-digit', category: '小数の位', inputMode: 'numeric',
      q: dec(th, 100) + ' の ' + pl.name + ' の数字はいくつですか。',
      answer: String(pl.d), accepted: [String(pl.d)],
      exp: dec(th, 100) + ' の ' + pl.name + ' は ' + pl.d + ' です。',
    });
  }

  // ---------- U2 直方体や立方体の体積 ----------
  function genVolume() {
    const t = ri(0, 3);
    if (t === 0) { // box volume
      const a = ri(2, 12), b = ri(2, 12), c = ri(2, 10);
      return typed({
        tid: 'vol-box', category: '直方体の体積', inputMode: 'text',
        q: 'たて' + a + 'cm、横' + b + 'cm、高さ' + c + 'cmの直方体の体積は何cm³ですか。', unitSuffix: 'cm³',
        fig: boxFig(b + 'cm', a + 'cm', c + 'cm'),
        answer: String(a * b * c), accepted: [String(a * b * c), a * b * c + 'cm3'],
        exp: '直方体の体積＝たて×横×高さ。' + a + '×' + b + '×' + c + '＝' + (a * b * c) + 'cm³。',
      });
    }
    if (t === 1) { // cube volume
      const s = ri(2, 10);
      return typed({
        tid: 'vol-cube', category: '立方体の体積', inputMode: 'text',
        q: '1辺が' + s + 'cmの立方体の体積は何cm³ですか。', unitSuffix: 'cm³',
        answer: String(s * s * s), accepted: [String(s * s * s), s * s * s + 'cm3'],
        exp: '立方体の体積＝1辺×1辺×1辺。' + s + '×' + s + '×' + s + '＝' + (s * s * s) + 'cm³。',
      });
    }
    if (t === 2) { // unit conversion
      const conv = pick([
        { q: '1m³は何cm³ですか。', a: '1000000', s: 'cm3', exp: '1m＝100cmなので、1m³＝100×100×100＝1000000cm³。' },
        { q: '1L は何cm³ですか。', a: '1000', s: 'cm3', exp: '1L＝1000cm³（1辺10cmの立方体）です。' },
        { q: '1m³ は何L ですか。', a: '1000', s: 'L', exp: '1m³＝1000000cm³、1L＝1000cm³なので、1000000÷1000＝1000L。' },
        { q: '1辺が10cmの立方体の体積は何cm³ですか。（これが1Lです）', a: '1000', s: 'cm3', exp: '10×10×10＝1000cm³＝1L。' },
      ]);
      return typed({
        tid: 'vol-unit', category: '体積のたんい', inputMode: 'numeric',
        q: conv.q, answer: conv.a, accepted: [conv.a, comma(Number(conv.a)), conv.a + conv.s],
        exp: conv.exp,
      });
    }
    // composite solid (two boxes)
    const aw = ri(4, 9), ah = ri(3, 7), ad = ri(2, 6);
    const bw = ri(2, 5), bh = ri(2, 5), bd = ri(2, 5);
    const vol = aw * ah * ad + bw * bh * bd;
    return typed({
      tid: 'vol-compound', category: '組み合わせた立体の体積', inputMode: 'text',
      q: '大きい直方体（たて' + ah + 'cm・横' + aw + 'cm・高さ' + ad + 'cm）と小さい直方体（たて' + bh + 'cm・横' + bw + 'cm・高さ' + bd + 'cm）を合わせた立体の体積は何cm³ですか。', unitSuffix: 'cm³',
      answer: String(vol), accepted: [String(vol), vol + 'cm3'],
      exp: '2つに分けて計算します。' + (aw * ah * ad) + '＋' + (bw * bh * bd) + '＝' + vol + 'cm³。',
    });
  }

  // ---------- U3 比例 ----------
  function genProportion() {
    const t = ri(0, 2);
    if (t === 0) { // y = k * x, given k and x find y
      const k = pick([2, 3, 4, 5, 6, 8, 10, 12]);
      const x = ri(3, 12);
      return typed({
        tid: 'prop-forward', category: '比例の関係（○＝きまった数×□）',
        q: '□と○は比例していて、○ ＝ ' + k + ' × □ の関係があります。□が' + x + 'のとき、○はいくつですか。',
        answer: String(k * x),
        exp: '○＝' + k + '×□ に □＝' + x + ' を入れて、' + k + '×' + x + '＝' + (k * x) + '。',
      });
    }
    if (t === 1) { // find the "きまった数" k from a pair
      const k = pick([3, 4, 5, 6, 7, 8]);
      const x = ri(2, 9);
      const y = k * x;
      return typed({
        tid: 'prop-constant', category: '比例のきまった数',
        q: '○は□に比例していて、□が' + x + 'のとき○は' + y + 'です。○を□でわった「きまった数」はいくつですか。',
        answer: String(k),
        exp: 'きまった数＝○÷□＝' + y + '÷' + x + '＝' + k + '。（○＝' + k + '×□）',
      });
    }
    // word: ribbon/water proportional
    const per = pick([40, 50, 60, 80, 120, 15, 25]);
    const x = ri(3, 9);
    const item = pick([
      { n: 'リボン', u: 'm', c: '円', unit: 'ねだん' },
      { n: 'はり金', u: 'm', c: 'g', unit: '重さ' },
    ]);
    return typed({
      tid: 'prop-word', category: '比例の文章題',
      q: item.n + 'の' + item.unit + 'は長さに比例します。1' + item.u + 'で' + per + item.c + 'のとき、' + x + item.u + 'では何' + item.c + 'ですか。',
      unitSuffix: item.c, answer: String(per * x),
      exp: '1' + item.u + 'あたり' + per + item.c + 'なので、' + per + '×' + x + '＝' + (per * x) + item.c + '。',
    });
  }

  // ---------- U4 小数のかけ算 ----------
  function genDecimalMul() {
    const t = ri(0, 2);
    if (t === 0) { // decimal(tenths) × decimal(tenths) -> hundredths
      const aT = ri(11, 89), bT = ri(11, 39);
      const prodH = aT * bT; // (aT/10)*(bT/10) = aT*bT/100
      return typed({
        tid: 'decmul-dd', category: '小数×小数', inputMode: 'text',
        q: dec(aT, 10) + ' × ' + dec(bT, 10) + ' をけいさんしましょう。',
        answer: dec(prodH, 100), accepted: decAccepts(prodH, 100),
        exp: '小数点より下のけた数の合計だけ、答えの小数点を左にずらします（1＋1＝2けた）。答えは ' + dec(prodH, 100) + '。',
      });
    }
    if (t === 1) { // decimal(hundredths) × whole
      const aH = ri(105, 895), n = ri(2, 9);
      const prodH = aH * n;
      return typed({
        tid: 'decmul-dw', category: '小数×整数', inputMode: 'text',
        q: dec(aH, 100) + ' × ' + n + ' をけいさんしましょう。',
        answer: dec(prodH, 100), accepted: decAccepts(prodH, 100),
        exp: '整数のようにかけてから、小数点を2けた分もどします。答えは ' + dec(prodH, 100) + '。',
      });
    }
    // word: 1mの重さ × 長さ(decimal × decimal)
    const wT = ri(12, 45); // kg per m, tenths
    const lT = ri(12, 38); // m, tenths
    const totH = wT * lT;
    return typed({
      tid: 'decmul-word', category: '小数のかけ算の文章題', inputMode: 'text',
      q: '1mの重さが' + dec(wT, 10) + 'kgのぼうがあります。このぼう' + dec(lT, 10) + 'mの重さは何kgですか。', unitSuffix: 'kg',
      answer: dec(totH, 100), accepted: decAccepts(totH, 100),
      exp: '式は ' + dec(wT, 10) + '×' + dec(lT, 10) + '＝' + dec(totH, 100) + 'kg です。',
    });
  }

  // ---------- U5 小数のわり算 ----------
  function genDecimalDiv() {
    const t = ri(0, 2);
    if (t === 0) { // decimal ÷ decimal, exact whole quotient
      const dvT = ri(12, 45); // divisor tenths (1.2..4.5)
      const q = ri(2, 9);
      const numT = dvT * q; // dividend tenths = (dvT/10)*q*10
      return typed({
        tid: 'decdiv-exact', category: '小数÷小数（わりきれる）', inputMode: 'text',
        q: dec(numT, 10) + ' ÷ ' + dec(dvT, 10) + ' をけいさんしましょう。',
        answer: String(q), accepted: [String(q)],
        exp: 'わる数を10倍して整数' + dvT + 'にし、わられる数も10倍して計算します。答えは ' + q + '。',
      });
    }
    if (t === 1) { // round quotient to 小数第一位 (四捨五入)
      let numT, dvT, qt;
      let guard = 0;
      do {
        dvT = ri(3, 9);            // divisor 0.3..0.9 (tenths)
        numT = ri(21, 95);         // dividend 2.1..9.5 (tenths)
        // quotient = (numT/10)/(dvT/10) = numT/dvT ; ×10 then round
        const tenTimes = numT * 10 / dvT;
        qt = Math.round(tenTimes);
        // avoid exact .5 rounding boundary so the answer is unambiguous
        var rem2 = (numT * 20) % dvT;
        guard++;
      } while ((rem2 === 0 && (numT * 10) % dvT !== 0) || (numT % dvT === 0 && guard < 40));
      return typed({
        tid: 'decdiv-round', category: '商をがい数で（四捨五入）', inputMode: 'text',
        q: dec(numT, 10) + ' ÷ ' + dec(dvT, 10) + ' の商を、四捨五入して小数第一位まで求めましょう。',
        answer: dec(qt, 10), accepted: decAccepts(qt, 10),
        exp: '小数第二位まで計算し、四捨五入して小数第一位まで求めます。答えは約 ' + dec(qt, 10) + '。',
      });
    }
    // remainder: decimal ÷ whole, quotient whole + decimal remainder
    const dvW = ri(3, 8);
    const qw = ri(3, 12);
    const rT = ri(1, dvW * 10 - 1); // remainder < divisor, in tenths
    // clamp remainder tenths so remainder value < divisor: rT/10 < dvW -> rT < 10*dvW (ok)
    const numT = dvW * qw * 10 + rT; // dividend tenths
    return typed({
      tid: 'decdiv-remainder', category: '小数のわり算のあまり', inputMode: 'text',
      q: dec(numT, 10) + ' ÷ ' + dvW + ' を、商を一の位まで求めて、あまりも出しましょう。（れい：3あまり0.4）',
      answer: qw + 'あまり' + dec(rT, 10),
      accepted: [qw + 'あまり' + dec(rT, 10), qw + ' あまり ' + dec(rT, 10), qw + '…' + dec(rT, 10), qw + 'r' + dec(rT, 10)],
      exp: '商の一の位は' + qw + '、' + dvW + '×' + qw + '＝' + (dvW * qw) + '、' + dec(numT, 10) + '−' + (dvW * qw) + '＝' + dec(rT, 10) + '。あまりは0.1の位までのこります。',
    });
  }

  // ---------- U6 合同な図形 ----------
  const CONGRUENT_FACTS = [
    { q: '合同な2つの図形について、いつでも正しいものはどれですか。', correct: '対応する辺の長さは等しい',
      wrong: ['対応する辺の長さは2倍になる', '面積だけが等しい', '対応する角の大きさは等しくない'] },
    { q: '合同な2つの図形について、いつでも正しいものはどれですか。', correct: '対応する角の大きさは等しい',
      wrong: ['対応する角の大きさは半分になる', 'まわりの長さだけがちがう', '対応する辺の長さはちがう'] },
    { q: '三角形を1つに決めるための条件として正しいものはどれですか。', correct: '3つの辺の長さ',
      wrong: ['3つの角の大きさ', '1つの辺の長さだけ', '1つの角の大きさだけ'] },
    { q: '三角形を1つに決めるための条件として正しいものはどれですか。', correct: '2つの辺の長さとその間の角の大きさ',
      wrong: ['3つの角の大きさ', '2つの角の大きさだけ', '1つの辺と1つの角だけ'] },
    { q: '「合同」の意味として正しいものはどれですか。', correct: 'ぴったり重ね合わせることができること',
      wrong: ['形が同じで大きさがちがうこと', '面積が同じであること', 'まわりの長さが同じであること'] },
  ];
  function genCongruent() {
    const t = ri(0, 1);
    if (t === 0) {
      const f = pick(CONGRUENT_FACTS);
      return choice({
        tid: 'cong-fact', category: '合同の性質・作図の条件',
        q: f.q, exp: '合同な図形では対応する辺・角がそれぞれ等しくなります。',
      }, f.correct, shuffle(f.wrong.slice()));
    }
    // corresponding part length in congruent triangles
    const AB = ri(3, 9), BC = ri(4, 11), CA = ri(5, 12);
    const map = pick([
      { from: '辺AB', to: '辺DE', val: AB }, { from: '辺BC', to: '辺EF', val: BC }, { from: '辺CA', to: '辺FD', val: CA },
    ]);
    return typed({
      tid: 'cong-corresp', category: '合同な図形の対応する辺', inputMode: 'text',
      q: '三角形ABCと三角形DEFは合同で、頂点はA-D、B-E、C-Fが対応しています。三角形ABCの' + map.from + 'の長さが' + map.val + 'cmのとき、対応する三角形DEFの' + map.to + 'の長さは何cmですか。',
      unitSuffix: 'cm', answer: String(map.val), accepted: [String(map.val), map.val + 'cm'],
      exp: '合同な図形の対応する辺は長さが等しいので、' + map.to + 'も' + map.val + 'cmです。',
    });
  }

  // ---------- U7 図形の角 ----------
  function genAngles() {
    const t = ri(0, 3);
    if (t === 0) { // triangle third angle
      const a = ri(30, 90), b = ri(30, 90);
      if (a + b >= 170) return genAngles();
      const c = 180 - a - b;
      return typed({
        tid: 'angle-tri', category: '三角形の角の和（180°）',
        q: '三角形の3つの角のうち、2つが' + a + '度と' + b + '度です。もう1つの角は何度ですか。', unitSuffix: '度',
        answer: String(c),
        exp: '三角形の3つの角の和は180度です。180−' + a + '−' + b + '＝' + c + '度。',
      });
    }
    if (t === 1) { // quadrilateral fourth angle
      const a = ri(60, 120), b = ri(60, 120), c = ri(60, 120);
      if (a + b + c >= 350 || a + b + c <= 100) return genAngles();
      const d = 360 - a - b - c;
      return typed({
        tid: 'angle-quad', category: '四角形の角の和（360°）',
        q: '四角形の4つの角のうち、3つが' + a + '度、' + b + '度、' + c + '度です。残りの角は何度ですか。', unitSuffix: '度',
        answer: String(d),
        exp: '四角形の4つの角の和は360度です。360−' + a + '−' + b + '−' + c + '＝' + d + '度。',
      });
    }
    if (t === 2) { // polygon interior angle sum
      const n = pick([5, 6, 7, 8]);
      const sum = 180 * (n - 2);
      const name = { 5: '五角形', 6: '六角形', 7: '七角形', 8: '八角形' }[n];
      return typed({
        tid: 'angle-polysum', category: '多角形の角の和',
        q: name + 'の角の大きさの和は何度ですか。', unitSuffix: '度',
        answer: String(sum),
        exp: 'n角形の角の和は180×(n−2)。' + name + 'は180×(' + n + '−2)＝' + sum + '度。',
      });
    }
    // isosceles / exterior via straight line (180 - interior)
    const inr = pick([40, 50, 55, 65, 70, 80, 100, 110, 120, 130]);
    const ext = 180 - inr;
    return typed({
      tid: 'angle-exterior', category: '一直線と角',
      q: '三角形の1つの角のとなりに、一直線になるようにできる角があります。三角形の角が' + inr + '度のとき、そのとなりの角（一直線の残り）は何度ですか。', unitSuffix: '度',
      answer: String(ext),
      exp: '一直線は180度なので、180−' + inr + '＝' + ext + '度。',
    });
  }

  // ---------- U8 偶数と奇数、倍数と約数 ----------
  function genMultiplesFactors() {
    const t = ri(0, 4);
    if (t === 0) { // even/odd
      const n = ri(10, 999);
      const isEven = n % 2 === 0;
      return choice({
        tid: 'mf-parity', category: '偶数と奇数',
        q: comma(n) + ' は偶数ですか、奇数ですか。',
        exp: '一の位が0・2・4・6・8なら偶数、1・3・5・7・9なら奇数です。' + comma(n) + ' は' + (isEven ? '偶数' : '奇数') + '。',
      }, isEven ? '偶数' : '奇数', [isEven ? '奇数' : '偶数']);
    }
    if (t === 1) { // LCM
      let a = ri(2, 9), b = ri(2, 12);
      if (a === b) b = a + 1;
      const l = lcm(a, b);
      return typed({
        tid: 'mf-lcm', category: '最小公倍数',
        q: a + ' と ' + b + ' の最小公倍数を求めましょう。',
        answer: String(l),
        exp: a + 'の倍数と' + b + 'の倍数に共通する数のうち、いちばん小さいのは' + l + 'です。',
      });
    }
    if (t === 2) { // GCF
      const g0 = ri(2, 9);
      const a = g0 * pick([2, 3, 4, 5]);
      const b = g0 * pick([2, 3, 5, 7]);
      const g = gcd(a, b);
      return typed({
        tid: 'mf-gcf', category: '最大公約数',
        q: a + ' と ' + b + ' の最大公約数を求めましょう。',
        answer: String(g),
        exp: a + 'の約数と' + b + 'の約数に共通する数のうち、いちばん大きいのは' + g + 'です。',
      });
    }
    if (t === 3) { // number of factors / list smallest multiple over threshold
      const n = ri(6, 30);
      const k = ri(4, 9);
      const m = Math.ceil((k * 10 + 1) / n) * n; // smallest multiple of n greater than k*10
      return typed({
        tid: 'mf-multiple-over', category: '倍数を見つける',
        q: n + ' の倍数のうち、' + (k * 10) + ' より大きくて、いちばん小さい数はいくつですか。',
        answer: String(m),
        exp: n + '×' + (m / n) + '＝' + m + ' が ' + (k * 10) + ' より大きい最小の' + n + 'の倍数です。',
      });
    }
    // is A a factor/divisor of B?
    const b = ri(12, 60);
    const factors = [];
    for (let i = 2; i < b; i++) if (b % i === 0) factors.push(i);
    const nonf = [];
    for (let i = 2; i < b; i++) if (b % i !== 0) nonf.push(i);
    const useFactor = factors.length && Math.random() < 0.5;
    const cand = useFactor ? pick(factors) : (nonf.length ? pick(nonf) : pick(factors));
    const isFac = b % cand === 0;
    return choice({
      tid: 'mf-isfactor', category: '約数の判定',
      q: cand + ' は ' + b + ' の約数ですか。',
      exp: b + ' ÷ ' + cand + ' が' + (isFac ? 'わりきれる' : 'わりきれない') + 'ので、' + cand + ' は ' + b + ' の約数で' + (isFac ? 'す' : 'はありません') + '。',
    }, isFac ? '約数である' : '約数ではない', [isFac ? '約数ではない' : '約数である']);
  }

  // ---------- U9 分数と小数、整数の関係 ----------
  function genFractionDecimal() {
    const t = ri(0, 3);
    if (t === 0) { // integer ÷ integer as fraction
      let a = ri(2, 9), b = ri(2, 9);
      if (a === b) b = a + 1;
      const g = gcd(a, b);
      const rn = a / g, rd = b / g;
      const ansPrimary = rn + '/' + rd;
      const accepted = [rn + '/' + rd, a + '/' + b, rd + '分の' + rn, rn + '／' + rd];
      return typed({
        tid: 'fd-div-frac', category: '整数のわり算を分数で', inputMode: 'text',
        q: a + ' ÷ ' + b + ' の答えを分数で書きましょう。（約分できるときはしましょう）',
        answer: ansPrimary, accepted: accepted,
        exp: '□÷○＝○分の□。' + a + '÷' + b + '＝' + a + '/' + b + (g > 1 ? '＝' + rn + '/' + rd + '（約分）' : '') + '。',
      });
    }
    if (t === 1) { // fraction -> decimal (terminating)
      const opt = pick([
        { n: 1, d: 2, v: '0.5' }, { n: 3, d: 4, v: '0.75' }, { n: 1, d: 4, v: '0.25' },
        { n: 1, d: 5, v: '0.2' }, { n: 3, d: 5, v: '0.6' }, { n: 2, d: 5, v: '0.4' },
        { n: 1, d: 8, v: '0.125' }, { n: 3, d: 8, v: '0.375' }, { n: 7, d: 10, v: '0.7' },
        { n: 1, d: 10, v: '0.1' }, { n: 9, d: 20, v: '0.45' }, { n: 3, d: 20, v: '0.15' },
      ]);
      return typed({
        tid: 'fd-frac-dec', category: '分数を小数で表す', inputMode: 'text',
        q: opt.d + '分の' + opt.n + '（' + opt.n + '/' + opt.d + '）を小数で表しましょう。',
        answer: opt.v, accepted: [opt.v, String(Number(opt.v))],
        exp: opt.n + '÷' + opt.d + '＝' + opt.v + ' です。',
      });
    }
    if (t === 2) { // decimal -> fraction (reduced)
      const opt = pick([
        { v: '0.5', n: 1, d: 2 }, { v: '0.25', n: 1, d: 4 }, { v: '0.75', n: 3, d: 4 },
        { v: '0.2', n: 1, d: 5 }, { v: '0.4', n: 2, d: 5 }, { v: '0.6', n: 3, d: 5 },
        { v: '0.8', n: 4, d: 5 }, { v: '0.1', n: 1, d: 10 }, { v: '0.3', n: 3, d: 10 },
        { v: '0.7', n: 7, d: 10 }, { v: '0.9', n: 9, d: 10 },
      ]);
      return typed({
        tid: 'fd-dec-frac', category: '小数を分数で表す', inputMode: 'text',
        q: opt.v + ' を分数で表しましょう。（約分できるときはしましょう）',
        answer: opt.n + '/' + opt.d,
        accepted: [opt.n + '/' + opt.d, opt.d + '分の' + opt.n, opt.n + '／' + opt.d],
        exp: opt.v + '＝' + opt.n + '/' + opt.d + ' です。',
      });
    }
    // compare a fraction and a decimal
    const opts = [
      { f: '1/2', fv: 0.5 }, { f: '3/4', fv: 0.75 }, { f: '2/5', fv: 0.4 }, { f: '3/5', fv: 0.6 }, { f: '1/4', fv: 0.25 },
    ];
    const o = pick(opts);
    let d;
    do { d = ri(1, 9) / 10; } while (Math.abs(d - o.fv) < 1e-9);
    const decS = String(d);
    const fracBigger = o.fv > d;
    return choice({
      tid: 'fd-compare', category: '分数と小数の大小',
      q: o.f + ' と ' + decS + ' では、どちらが大きいですか。',
      exp: o.f + '＝' + o.fv + ' なので、' + (fracBigger ? o.f : decS) + ' の方が大きいです。',
    }, fracBigger ? o.f : decS, [fracBigger ? decS : o.f]);
  }

  // ---------- U10 分数のたし算とひき算 ----------
  function reduceFrac(n, d) { const g = gcd(n, d) || 1; return [n / g, d / g]; }
  function fracToText(n, d) {
    // returns proper display, converting improper to mixed for the answer text
    if (n === 0) return '0';
    if (n % d === 0) return String(n / d);
    if (n > d) { const w = Math.floor(n / d), r = n % d; return w + ' ' + r + '/' + d; }
    return n + '/' + d;
  }
  function fracAccepts(n, d) {
    // accepts improper, mixed (space and と), and 分の form
    const set = new Set();
    set.add(n + '/' + d);
    set.add(d + '分の' + n);
    if (n % d === 0) set.add(String(n / d));
    else if (n > d) {
      const w = Math.floor(n / d), r = n % d;
      set.add(w + ' ' + r + '/' + d);
      set.add(w + 'と' + r + '/' + d);
      set.add(w + r + '/' + d);
    }
    return Array.from(set);
  }
  function genFractionAddSub() {
    const t = ri(0, 2);
    // choose two unlike denominators from a friendly set
    const dens = [2, 3, 4, 5, 6, 8, 10, 12];
    if (t === 0) { // addition, different denominators
      let d1 = pick(dens), d2 = pick(dens);
      if (d1 === d2) d2 = pick(dens.filter(function (x) { return x !== d1; }));
      const n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
      const L = lcm(d1, d2);
      const sumN = n1 * (L / d1) + n2 * (L / d2);
      const [rn, rd] = reduceFrac(sumN, L);
      return typed({
        tid: 'fa-add', category: '分数のたし算（通分）', inputMode: 'text',
        q: d1 + '分の' + n1 + '（' + n1 + '/' + d1 + '） ＋ ' + d2 + '分の' + n2 + '（' + n2 + '/' + d2 + '） をけいさんしましょう。約分できるときはします。（れい：5/6 または 1 1/6）',
        answer: fracToText(rn, rd), accepted: fracAccepts(rn, rd).concat([sumN + '/' + L]),
        exp: '通分して分母を' + L + 'にそろえます。' + (n1 * (L / d1)) + '/' + L + '＋' + (n2 * (L / d2)) + '/' + L + '＝' + sumN + '/' + L + '＝' + fracToText(rn, rd) + '。',
      });
    }
    if (t === 1) { // subtraction, different denominators (positive)
      let d1 = pick(dens), d2 = pick(dens);
      if (d1 === d2) d2 = pick(dens.filter(function (x) { return x !== d1; }));
      const L = lcm(d1, d2);
      let n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
      let a = n1 * (L / d1), b = n2 * (L / d2);
      if (a <= b) { // swap to keep positive
        const td = d1; d1 = d2; d2 = td; const tn = n1; n1 = n2; n2 = tn;
        const ta = a; a = b; b = ta;
      }
      if (a === b) return genFractionAddSub();
      const diffN = a - b;
      const [rn, rd] = reduceFrac(diffN, L);
      return typed({
        tid: 'fa-sub', category: '分数のひき算（通分）', inputMode: 'text',
        q: d1 + '分の' + n1 + '（' + n1 + '/' + d1 + '） − ' + d2 + '分の' + n2 + '（' + n2 + '/' + d2 + '） をけいさんしましょう。約分できるときはします。',
        answer: fracToText(rn, rd), accepted: fracAccepts(rn, rd).concat([diffN + '/' + L]),
        exp: '通分して分母を' + L + 'にそろえます。' + a + '/' + L + '−' + b + '/' + L + '＝' + diffN + '/' + L + '＝' + fracToText(rn, rd) + '。',
      });
    }
    // 3-term or mixed-number addition kept simple: proper + proper same-lcm with reduce
    let d1 = pick([3, 4, 6]), d2 = pick([2, 4, 8]);
    if (d1 === d2) d2 = d1 === 4 ? 8 : 4;
    const whole = ri(1, 2);
    const n1 = ri(1, d1 - 1), n2 = ri(1, d2 - 1);
    const L = lcm(d1, d2);
    const sumN = whole * L + n1 * (L / d1) + n2 * (L / d2);
    const [rn, rd] = reduceFrac(sumN, L);
    return typed({
      tid: 'fa-mixed-add', category: '帯分数のたし算', inputMode: 'text',
      q: whole + 'と' + d1 + '分の' + n1 + '（' + whole + ' ' + n1 + '/' + d1 + '） ＋ ' + d2 + '分の' + n2 + '（' + n2 + '/' + d2 + '） をけいさんしましょう。（れい：3 1/4）',
      answer: fracToText(rn, rd), accepted: fracAccepts(rn, rd).concat([sumN + '/' + L]),
      exp: '整数部分と分数部分を通分してたします。答えは ' + fracToText(rn, rd) + '。',
    });
  }

  // ---------- U11 平均 ----------
  function genAverage() {
    const t = ri(0, 2);
    if (t === 0) { // mean of a set (integer mean)
      const n = ri(3, 5);
      const mean = ri(4, 20);
      // build values summing to mean*n, each >=0
      const vals = [];
      let remaining = mean * n;
      for (let i = 0; i < n - 1; i++) {
        const lo = Math.max(1, remaining - (n - 1 - i) * (mean + 6));
        const hi = Math.min(mean + 6, remaining - (n - 1 - i) * 1);
        const v = ri(Math.max(1, lo), Math.max(1, hi));
        vals.push(v); remaining -= v;
      }
      vals.push(remaining);
      if (vals.some(function (v) { return v < 1 || v > 40; })) return genAverage();
      return typed({
        tid: 'avg-mean', category: '平均を求める', inputMode: 'text',
        q: vals.join('、') + ' の' + n + 'つの数の平均を求めましょう。',
        answer: String(mean),
        exp: '平均＝合計÷個数。(' + vals.join('＋') + ')÷' + n + '＝' + (mean * n) + '÷' + n + '＝' + mean + '。',
      });
    }
    if (t === 1) { // total from mean
      const n = ri(4, 8);
      const mean = ri(5, 25);
      return typed({
        tid: 'avg-total', category: '平均から合計を求める',
        q: n + '人の' + pick(['計算テスト', '本の冊数', 'なわとびの回数']) + 'の平均が' + mean + 'のとき、合計はいくつですか。',
        answer: String(mean * n),
        exp: '合計＝平均×個数＝' + mean + '×' + n + '＝' + (mean * n) + '。',
      });
    }
    // missing value to reach a target mean
    const n = ri(4, 5);
    const mean = ri(6, 15);
    const total = mean * n;
    const known = [];
    let s = 0;
    for (let i = 0; i < n - 1; i++) { const v = ri(Math.max(1, mean - 4), mean + 4); known.push(v); s += v; }
    const missing = total - s;
    if (missing < 1 || missing > 40) return genAverage();
    return typed({
      tid: 'avg-missing', category: '平均から残りを求める', inputMode: 'numeric',
      q: n + '回のテストの平均を' + mean + '点にしたいです。今まで' + known.join('、') + '点でした。残り1回で何点とればよいですか。',
      answer: String(missing),
      exp: '合計は' + mean + '×' + n + '＝' + total + '点。今の合計は' + s + '点なので、' + total + '−' + s + '＝' + missing + '点。',
    });
  }

  // ---------- U12 単位量あたりの大きさ ----------
  function genPerUnit() {
    const t = ri(0, 2);
    if (t === 0) { // population density
      const area = pick([2, 3, 4, 5, 6, 8, 10]);
      const density = ri(30, 400);
      const pop = density * area;
      return typed({
        tid: 'pu-density', category: '人口密度', inputMode: 'numeric',
        q: '面積が' + area + 'km²の町に、' + comma(pop) + '人が住んでいます。1km²あたりの人口（人口密度）は何人ですか。', unitSuffix: '人',
        answer: String(density), accepted: [String(density), comma(density)],
        exp: '人口密度＝人口÷面積＝' + comma(pop) + '÷' + area + '＝' + density + '人。',
      });
    }
    if (t === 1) { // speed
      const mode = pick([
        { calc: 'speed', ask: '速さ（時速）', u: 'km' },
        { calc: 'dist', ask: '道のり', u: 'km' },
        { calc: 'time', ask: '時間', u: '時間' },
      ]);
      const speed = pick([30, 40, 45, 50, 60, 70, 80]);
      const time = ri(2, 6);
      const dist = speed * time;
      if (mode.calc === 'speed') {
        return typed({
          tid: 'pu-speed', category: '速さを求める', unitSuffix: 'km/時',
          q: '' + dist + 'kmの道のりを' + time + '時間で進む自動車の速さは時速何kmですか。',
          answer: String(speed), exp: '速さ＝道のり÷時間＝' + dist + '÷' + time + '＝時速' + speed + 'km。',
        });
      }
      if (mode.calc === 'dist') {
        return typed({
          tid: 'pu-dist', category: '道のりを求める', unitSuffix: 'km',
          q: '時速' + speed + 'kmで' + time + '時間走ると、道のりは何kmですか。',
          answer: String(dist), exp: '道のり＝速さ×時間＝' + speed + '×' + time + '＝' + dist + 'km。',
        });
      }
      return typed({
        tid: 'pu-time', category: '時間を求める', unitSuffix: '時間',
        q: '時速' + speed + 'kmで' + dist + 'km進むには、何時間かかりますか。',
        answer: String(time), exp: '時間＝道のり÷速さ＝' + dist + '÷' + speed + '＝' + time + '時間。',
      });
    }
    // per-unit comparison / best value (cost per item)
    const perA = ri(20, 60);
    const cntA = pick([4, 5, 6, 8]);
    return typed({
      tid: 'pu-cost', category: '単位量あたりのねだん', unitSuffix: '円',
      q: pick(THINGS).n + 'が' + cntA + 'こで' + (perA * cntA) + '円です。1こあたりのねだんは何円ですか。',
      answer: String(perA), accepted: [String(perA), comma(perA)],
      exp: '1こあたり＝ねだん÷こ数＝' + (perA * cntA) + '÷' + cntA + '＝' + perA + '円。',
    });
  }

  // ---------- U13 四角形と三角形の面積 ----------
  function genAreaShapes() {
    const t = ri(0, 3);
    if (t === 0) { // parallelogram
      const b = ri(3, 15), h = ri(2, 12);
      return typed({
        tid: 'area-para', category: '平行四辺形の面積', inputMode: 'text',
        q: '底辺' + b + 'cm、高さ' + h + 'cmの平行四辺形の面積は何cm²ですか。', unitSuffix: 'cm²',
        fig: paraFig(b + 'cm', h + 'cm'),
        answer: String(b * h), accepted: [String(b * h), b * h + 'cm2'],
        exp: '平行四辺形の面積＝底辺×高さ。' + b + '×' + h + '＝' + (b * h) + 'cm²。',
      });
    }
    if (t === 1) { // triangle (ensure integer)
      let b = ri(3, 16), h = ri(2, 14);
      if ((b * h) % 2 !== 0) { if (b % 2 !== 0) b += 1; else h += 1; }
      return typed({
        tid: 'area-tri', category: '三角形の面積', inputMode: 'text',
        q: '底辺' + b + 'cm、高さ' + h + 'cmの三角形の面積は何cm²ですか。', unitSuffix: 'cm²',
        fig: triFig(b + 'cm', h + 'cm'),
        answer: String(b * h / 2), accepted: [String(b * h / 2), (b * h / 2) + 'cm2'],
        exp: '三角形の面積＝底辺×高さ÷2。' + b + '×' + h + '÷2＝' + (b * h / 2) + 'cm²。',
      });
    }
    if (t === 2) { // trapezoid
      let top = ri(2, 9), bot = ri(top + 1, 14), h = ri(2, 10);
      if (((top + bot) * h) % 2 !== 0) { if (h % 2 !== 0) h += 1; else top += 1; if (top >= bot) bot = top + 1; }
      const area = (top + bot) * h / 2;
      return typed({
        tid: 'area-trap', category: '台形の面積', inputMode: 'text',
        q: '上底' + top + 'cm、下底' + bot + 'cm、高さ' + h + 'cmの台形の面積は何cm²ですか。', unitSuffix: 'cm²',
        fig: trapFig(top + 'cm', bot + 'cm', h + 'cm'),
        answer: String(area), accepted: [String(area), area + 'cm2'],
        exp: '台形の面積＝(上底＋下底)×高さ÷2。(' + top + '＋' + bot + ')×' + h + '÷2＝' + area + 'cm²。',
      });
    }
    // rhombus via diagonals
    let d1 = ri(3, 14), d2 = ri(3, 14);
    if ((d1 * d2) % 2 !== 0) { if (d1 % 2 !== 0) d1 += 1; else d2 += 1; }
    const area = d1 * d2 / 2;
    return typed({
      tid: 'area-rhombus', category: 'ひし形の面積', inputMode: 'text',
      q: '2本の対角線が' + d1 + 'cmと' + d2 + 'cmのひし形の面積は何cm²ですか。', unitSuffix: 'cm²',
      answer: String(area), accepted: [String(area), area + 'cm2'],
      exp: 'ひし形の面積＝対角線×対角線÷2。' + d1 + '×' + d2 + '÷2＝' + area + 'cm²。',
    });
  }

  // ---------- U14 割合 ----------
  function genPercentage() {
    const t = ri(0, 3);
    if (t === 0) { // find percentage: part/base
      const base = pick([20, 25, 40, 50, 80, 100, 200, 10, 16, 8]);
      const pct = pick([5, 10, 15, 20, 25, 40, 50, 60, 75, 80]);
      const part = base * pct / 100;
      if (!Number.isInteger(part)) return genPercentage();
      return typed({
        tid: 'pct-find', category: '割合を百分率で求める', unitSuffix: '%',
        q: '定員' + base + '人のバスに' + part + '人乗っています。乗っている人数は定員の何％ですか。',
        answer: String(pct), accepted: [String(pct), pct + '%', pct + 'パーセント'],
        exp: '割合＝くらべる量÷もとにする量＝' + part + '÷' + base + '＝' + (part / base) + '。百分率にして' + pct + '％。',
      });
    }
    if (t === 1) { // find part: base × pct%
      const base = pick([40, 60, 80, 120, 200, 50, 30, 150]);
      const pct = pick([10, 20, 25, 30, 40, 50, 60, 75, 80]);
      const part = base * pct / 100;
      if (!Number.isInteger(part)) return genPercentage();
      return typed({
        tid: 'pct-part', category: 'くらべる量を求める',
        q: '' + base + '人の' + pct + '％は何人ですか。',
        answer: String(part), unitSuffix: '人',
        accepted: [String(part), comma(part)],
        exp: 'くらべる量＝もとにする量×割合＝' + base + '×' + (pct / 100) + '＝' + part + '人。',
      });
    }
    if (t === 2) { // find base: part is pct% of base
      const base = pick([40, 60, 80, 120, 200, 50, 150, 250]);
      const pct = pick([10, 20, 25, 40, 50, 75, 80]);
      const part = base * pct / 100;
      if (!Number.isInteger(part)) return genPercentage();
      return typed({
        tid: 'pct-base', category: 'もとにする量を求める', unitSuffix: '人',
        q: 'ある学年の' + pct + '％が' + part + '人です。この学年の人数は何人ですか。',
        answer: String(base), accepted: [String(base), comma(base)],
        exp: 'もとにする量＝くらべる量÷割合＝' + part + '÷' + (pct / 100) + '＝' + base + '人。',
      });
    }
    // 歩合 conversion (typed to avoid representation-collision)
    const opt = pick([
      { dec: '0.3', bu: '3割' }, { dec: '0.25', bu: '2割5分' }, { dec: '0.4', bu: '4割' },
      { dec: '0.35', bu: '3割5分' }, { dec: '0.08', bu: '8分' }, { dec: '0.125', bu: '1割2分5厘' },
      { dec: '0.5', bu: '5割' }, { dec: '0.62', bu: '6割2分' }, { dec: '0.7', bu: '7割' },
      { dec: '0.09', bu: '9分' },
    ]);
    return typed({
      tid: 'pct-buai', category: '歩合で表す', inputMode: 'text',
      q: '割合 ' + opt.dec + ' を歩合で表しましょう。（れい：3割5分）',
      answer: opt.bu, accepted: [opt.bu],
      exp: '0.1を1割、0.01を1分、0.001を1厘とよみます。' + opt.dec + '＝' + opt.bu + '。',
    });
  }

  // ---------- U15 帯グラフと円グラフ ----------
  function genGraphs() {
    // build a set of categories with percentages summing to 100
    const themesets = [
      ['サッカー', '野球', '水泳', 'その他'],
      ['りんご', 'みかん', 'いちご', 'その他'],
      ['犬', 'ねこ', '魚', 'その他'],
    ];
    const labels = pick(themesets);
    // pick 3 percentages (multiples of 5) then remainder is その他
    let a, b, c, d;
    let guard = 0;
    do {
      a = ri(3, 9) * 5; b = ri(2, 7) * 5; c = ri(2, 6) * 5; d = 100 - a - b - c;
      guard++;
    } while ((d < 5 || d > 40) && guard < 60);
    if (d < 5 || d > 40) { a = 40; b = 30; c = 20; d = 10; }
    const segs = [
      { label: labels[0], pct: a }, { label: labels[1], pct: b },
      { label: labels[2], pct: c }, { label: labels[3], pct: d },
    ];
    const fig = bandFig(segs);
    const t = ri(0, 2);
    if (t === 0) { // read a percentage
      const idx = ri(0, 3);
      return typed({
        tid: 'graph-read-pct', category: '帯グラフをよむ（百分率）', unitSuffix: '%',
        q: 'すきなものを調べた帯グラフです。「' + segs[idx].label + '」は全体の何％ですか。',
        fig: fig, answer: String(segs[idx].pct), accepted: [String(segs[idx].pct), segs[idx].pct + '%'],
        exp: 'めもりを読むと「' + segs[idx].label + '」は' + segs[idx].pct + '％です。',
      });
    }
    if (t === 1) { // compute a count from % of a total
      const total = pick([20, 40, 50, 100, 200]);
      const idx = ri(0, 3);
      const cnt = total * segs[idx].pct / 100;
      if (!Number.isInteger(cnt)) return genGraphs();
      return typed({
        tid: 'graph-count', category: '割合から人数を求める', unitSuffix: '人',
        q: '全体で' + total + '人に調べた帯グラフです。「' + segs[idx].label + '」を選んだ人は何人ですか。',
        fig: fig, answer: String(cnt), accepted: [String(cnt), comma(cnt)],
        exp: '' + total + '×' + (segs[idx].pct / 100) + '＝' + cnt + '人。（' + segs[idx].pct + '％）',
      });
    }
    // which is the largest category
    let maxIdx = 0; segs.forEach(function (s, i) { if (s.pct > segs[maxIdx].pct) maxIdx = i; });
    // ensure unique max
    if (segs.filter(function (s) { return s.pct === segs[maxIdx].pct; }).length > 1) return genGraphs();
    return choice({
      tid: 'graph-largest', category: 'グラフでいちばん多いもの',
      q: 'すきなものを調べた帯グラフです。いちばん多いのはどれですか。',
      fig: fig, exp: '帯の長さ（％）がいちばん大きいのは「' + segs[maxIdx].label + '」です。',
    }, segs[maxIdx].label, segs.filter(function (_, i) { return i !== maxIdx; }).map(function (s) { return s.label; }));
  }

  // ---------- U16 変わり方調べ ----------
  function genFunctional() {
    const t = ri(0, 2);
    if (t === 0) { // ○ = □ × a + b, find ○ given □
      const a = pick([2, 3, 4]), b = pick([1, 2, 3, 4]);
      const box = ri(3, 12);
      return typed({
        tid: 'fn-linear', category: '変わり方のきまり（○＝□×a＋b）',
        q: '表を調べると、○ ＝ □ × ' + a + ' ＋ ' + b + ' の関係がありました。□が' + box + 'のとき、○はいくつですか。',
        answer: String(box * a + b),
        exp: '○＝□×' + a + '＋' + b + ' に □＝' + box + ' を入れて、' + box + '×' + a + '＋' + b + '＝' + (box * a + b) + '。',
      });
    }
    if (t === 1) { // sum-constant
      const S = ri(12, 24);
      const box = ri(1, S - 1);
      return typed({
        tid: 'fn-sum', category: '変わり方のきまり（和が一定）',
        q: '□と○をたすといつも' + S + 'になります（□ ＋ ○ ＝ ' + S + '）。□が' + box + 'のとき、○はいくつですか。',
        answer: String(S - box),
        exp: '○＝' + S + '−' + box + '＝' + (S - box) + '。',
      });
    }
    // infer the rule from a table then extend (○ = □ × a)
    const a = pick([3, 4, 5, 6]);
    const x1 = 1, x2 = 2, x3 = 3;
    const target = ri(6, 12);
    return typed({
      tid: 'fn-table', category: '表からきまりを見つける',
      q: '□が1、2、3のとき、○は' + (a * x1) + '、' + (a * x2) + '、' + (a * x3) + 'でした。同じきまりで、□が' + target + 'のとき○はいくつですか。',
      answer: String(a * target),
      exp: '○は□の' + a + '倍（○＝□×' + a + '）です。' + a + '×' + target + '＝' + (a * target) + '。',
    });
  }

  // ---------- U17 正多角形と円周の長さ ----------
  function genPolygonCircle() {
    const t = ri(0, 3);
    if (t === 0) { // regular polygon central angle
      const n = pick([3, 4, 5, 6, 8, 9, 10, 12]);
      const ans = 360 / n;
      const name = { 3: '正三角形', 4: '正方形', 5: '正五角形', 6: '正六角形', 8: '正八角形', 9: '正九角形', 10: '正十角形', 12: '正十二角形' }[n];
      return typed({
        tid: 'pc-central', category: '正多角形の中心の角', unitSuffix: '度',
        q: name + 'を、中心のまわりに合同な三角形に分けます。中心のまわりの1つの角は何度ですか。',
        fig: ngonFig(n), answer: String(ans),
        exp: '中心のまわりは360度。' + name + 'は' + n + '等分するので、360÷' + n + '＝' + ans + '度。',
      });
    }
    if (t === 1) { // regular polygon one interior angle (choose n giving integer)
      const n = pick([3, 4, 5, 6, 8, 9, 10, 12]);
      const ans = 180 * (n - 2) / n;
      const name = { 3: '正三角形', 4: '正方形', 5: '正五角形', 6: '正六角形', 8: '正八角形', 9: '正九角形', 10: '正十角形', 12: '正十二角形' }[n];
      return typed({
        tid: 'pc-interior', category: '正多角形の1つの角', unitSuffix: '度',
        q: name + 'の1つの角の大きさは何度ですか。',
        fig: ngonFig(n), answer: String(ans),
        exp: '角の和は180×(' + n + '−2)＝' + (180 * (n - 2)) + '度。1つの角は' + (180 * (n - 2)) + '÷' + n + '＝' + ans + '度。',
      });
    }
    if (t === 2) { // circumference from diameter (or radius)
      const useRadius = Math.random() < 0.5;
      const d = useRadius ? ri(2, 12) * 2 : ri(3, 20);
      const circH = d * 314; // circumference in 1/100 units (d * 3.14)
      const r = d / 2;
      return typed({
        tid: 'pc-circumference', category: '円周の長さ', unitSuffix: 'cm', inputMode: 'text',
        q: useRadius
          ? '半径' + r + 'cmの円の円周の長さは何cmですか。円周率は3.14とします。'
          : '直径' + d + 'cmの円の円周の長さは何cmですか。円周率は3.14とします。',
        fig: circleFig((useRadius ? '半径' + r : '直径' + d) + 'cm', useRadius),
        answer: dec(circH, 100), accepted: decAccepts(circH, 100),
        exp: '円周＝直径×3.14。' + d + '×3.14＝' + dec(circH, 100) + 'cm。',
      });
    }
    // diameter from circumference (choose circ divisible cleanly)
    const d = ri(3, 20);
    const circH = d * 314;
    return typed({
      tid: 'pc-diameter', category: '円周から直径を求める', unitSuffix: 'cm',
      q: '円周の長さが' + dec(circH, 100) + 'cmの円の直径は何cmですか。円周率は3.14とします。',
      answer: String(d), accepted: [String(d), d + 'cm'],
      exp: '直径＝円周÷3.14＝' + dec(circH, 100) + '÷3.14＝' + d + 'cm。',
    });
  }

  // ---------- U18 角柱と円柱 ----------
  function genPrismCylinder() {
    const t = ri(0, 3);
    if (t === 0) { // count faces/edges/vertices of a prism
      const n = pick([3, 4, 5, 6]);
      const name = { 3: '三角柱', 4: '四角柱', 5: '五角柱', 6: '六角柱' }[n];
      const which = pick([
        { q: 'の面の数は何個ですか。', a: n + 2, note: '底面2＋側面' + n + '＝' + (n + 2) + '個' },
        { q: 'の辺の数は何本ですか。', a: 3 * n, note: '底面のまわり' + n + '×2＋高さの辺' + n + '＝' + (3 * n) + '本' },
        { q: 'の頂点の数は何個ですか。', a: 2 * n, note: '底面の頂点' + n + '×2＝' + (2 * n) + '個' },
      ]);
      return typed({
        tid: 'prism-count', category: '角柱の面・辺・頂点',
        q: name + which.q, answer: String(which.a),
        exp: name + 'は、' + which.note + 'です。',
      });
    }
    if (t === 1) { // base shape of a prism
      const n = pick([3, 4, 5, 6]);
      const name = { 3: '三角柱', 4: '四角柱', 5: '五角柱', 6: '六角柱' }[n];
      const shape = { 3: '三角形', 4: '四角形', 5: '五角形', 6: '六角形' }[n];
      const wrongs = ['三角形', '四角形', '五角形', '六角形', '円'].filter(function (s) { return s !== shape; });
      return choice({
        tid: 'prism-base', category: '角柱の底面の形',
        q: name + 'の底面はどんな形ですか。',
        exp: name + 'の底面は' + shape + 'です。',
      }, shape, shuffle(wrongs));
    }
    if (t === 2) { // cylinder facts
      const f = pick([
        { q: '円柱の底面はどんな形ですか。', a: '円', w: ['四角形', '三角形', '長方形'] },
        { q: '円柱の側面を開くと、どんな形になりますか。', a: '長方形', w: ['円', '三角形', '正方形だけ'] },
        { q: '角柱や円柱で、上と下に向かい合っている面を何といいますか。', a: '底面', w: ['側面', '頂点', '対角線'] },
        { q: '角柱の側面はどんな形ですか。', a: '長方形', w: ['三角形', '円', '五角形'] },
      ]);
      return choice({
        tid: 'cyl-fact', category: '円柱・角柱の面',
        q: f.q, exp: '角柱・円柱のつくりから考えます。答えは「' + f.a + '」です。',
      }, f.a, shuffle(f.w.slice()));
    }
    // prism height / side count relationship (typed)
    const n = pick([3, 4, 5, 6]);
    const name = { 3: '三角柱', 4: '四角柱', 5: '五角柱', 6: '六角柱' }[n];
    return typed({
      tid: 'prism-sides', category: '角柱の側面の数',
      q: name + 'の側面（長方形）は何個ありますか。', answer: String(n),
      exp: name + 'の側面は底面の辺の数と同じ' + n + '個です。',
    });
  }

  // ---------- unit/section table ----------
  // Canonical unit keys (stored in class_modules.focus_units, honored by
  // app.js for unit-scoped pacing). Documented list — see README / spec:
  // u01_decimals … u18_prisms_cylinders, one per textbook unit below.
  const UNITS = [
    { num: 1, key: 'u01_decimals', title: '整数と小数', vol: '上', sections: [
      { id: 'u01-dec', title: '小数のしくみと10倍・1/10', gen: genDecimalPlace, n: 10 },
    ]},
    { num: 2, key: 'u02_volume', title: '直方体や立方体の体積', vol: '上', sections: [
      { id: 'u02-vol', title: '体積の計算とたんい', gen: genVolume, n: 10 },
    ]},
    { num: 3, key: 'u03_proportion', title: '比例', vol: '上', sections: [
      { id: 'u03-prop', title: '比例の関係', gen: genProportion, n: 8 },
    ]},
    { num: 4, key: 'u04_decimal_mul', title: '小数のかけ算', vol: '上', sections: [
      { id: 'u04-decmul', title: '小数×小数の計算', gen: genDecimalMul, n: 10 },
    ]},
    { num: 5, key: 'u05_decimal_div', title: '小数のわり算', vol: '上', sections: [
      { id: 'u05-decdiv', title: '小数÷小数・あまり・がい数', gen: genDecimalDiv, n: 10 },
    ]},
    { num: 6, key: 'u06_congruence', title: '合同な図形', vol: '上', sections: [
      { id: 'u06-cong', title: '合同と対応する辺・角', gen: genCongruent, n: 8 },
    ]},
    { num: 7, key: 'u07_angles', title: '図形の角', vol: '下', sections: [
      { id: 'u07-angle', title: '三角形・多角形の角', gen: genAngles, n: 10 },
    ]},
    { num: 8, key: 'u08_multiples_factors', title: '偶数と奇数、倍数と約数', vol: '下', sections: [
      { id: 'u08-mf', title: '偶数奇数・公倍数・公約数', gen: genMultiplesFactors, n: 10 },
    ]},
    { num: 9, key: 'u09_fraction_decimal', title: '分数と小数、整数の関係', vol: '下', sections: [
      { id: 'u09-fd', title: '分数・小数・整数の関係', gen: genFractionDecimal, n: 10 },
    ]},
    { num: 10, key: 'u10_fraction_addsub', title: '分数のたし算とひき算', vol: '下', sections: [
      { id: 'u10-fa', title: '通分してたし算・ひき算', gen: genFractionAddSub, n: 10 },
    ]},
    { num: 11, key: 'u11_average', title: '平均', vol: '下', sections: [
      { id: 'u11-avg', title: '平均を求める', gen: genAverage, n: 8 },
    ]},
    { num: 12, key: 'u12_per_unit', title: '単位量あたりの大きさ', vol: '下', sections: [
      { id: 'u12-pu', title: '人口密度・速さ・単位量あたり', gen: genPerUnit, n: 10 },
    ]},
    { num: 13, key: 'u13_area', title: '四角形と三角形の面積', vol: '下', sections: [
      { id: 'u13-area', title: '平行四辺形・三角形・台形・ひし形', gen: genAreaShapes, n: 10 },
    ]},
    { num: 14, key: 'u14_percentage', title: '割合', vol: '下', sections: [
      { id: 'u14-pct', title: '割合・百分率・歩合', gen: genPercentage, n: 10 },
    ]},
    { num: 15, key: 'u15_graphs', title: '帯グラフと円グラフ', vol: '下', sections: [
      { id: 'u15-graph', title: '帯グラフ・円グラフをよむ', gen: genGraphs, n: 8 },
    ]},
    { num: 16, key: 'u16_functional', title: '変わり方調べ', vol: '下', sections: [
      { id: 'u16-fn', title: '表・式で変わり方を調べる', gen: genFunctional, n: 8 },
    ]},
    { num: 17, key: 'u17_polygon_circle', title: '正多角形と円周の長さ', vol: '下', sections: [
      { id: 'u17-pc', title: '正多角形の角・円周', gen: genPolygonCircle, n: 10 },
    ]},
    { num: 18, key: 'u18_prisms_cylinders', title: '角柱と円柱', vol: '下', sections: [
      { id: 'u18-prism', title: '角柱・円柱の面・辺・頂点', gen: genPrismCylinder, n: 8 },
    ]},
  ];

  // まとめ (mixed) — draws one problem from a random unit's generator.
  const MIXED_POOL = [];
  UNITS.forEach(function (u) { u.sections.forEach(function (s) { MIXED_POOL.push(s.gen); }); });
  function genMatome() { return pick(MIXED_POOL)(); }
  UNITS.push({ num: 19, key: 'u19_review', title: '5年のまとめ', vol: '下', sections: [
    { id: 'u19-matome', title: 'まとめテスト（全単元から）', gen: genMatome, n: 12 },
  ]});

  window.SANSU5_DATA = { UNITS };
})();
