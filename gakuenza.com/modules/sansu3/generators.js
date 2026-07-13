// 算数 3年 — Gakuenza module content & problem generators
// すべてオリジナル教材。東京書籍『新編 新しい算数3』(令和6年度版) の
// 単元構成に対応させているが、問題そのものは全て独自生成 —
// 教科書の問題文・数値・図版は一切転載していない。
//
// 単元番号は本書のデジタルコンテンツ一覧 (6=ぼうグラフと表, 9=大きい数)
// から復元した並び。番号がずれていても UNITS の order を並べ替えるだけで
// 直せるよう、コードは配列順にのみ依存する。
//
// Each section has gen(): returns ONE problem object:
//   {
//     tid,               // template id — stable per problem TYPE, used for
//                        //   activity_result_items.item_ref (category rollup +
//                        //   distractor analysis group across attempts)
//     category,          // gradebook analysis category (Japanese label)
//     q,                 // question text
//     fig,               // optional inner-HTML SVG figure
//     kind: 'typed' | 'choice',
//     answer,            // typed: canonical answer string
//     accepted,          // typed: array of accepted normalized forms
//     inputMode,         // typed: 'numeric' | 'text'
//     unitSuffix,        // typed: shown after the input box (e.g. 'cm')
//     choices,           // choice: array of option strings (already shuffled)
//     correctChoice,     // choice: the correct option's text
//     exp,               // explanation shown after answering
//   }
// Problems are generated fresh per attempt — unlimited practice — while
// tid/category stay stable so the teacher gradebook's category rollup and
// dominant-wrong-answer analysis keep working across attempts.

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
  // n distinct ints from lo..hi including `must`
  function distinctWith(must, lo, hi, n) {
    const s = new Set([must]);
    let guard = 0;
    while (s.size < n && guard++ < 200) s.add(ri(lo, hi));
    return shuffle(Array.from(s));
  }
  function comma(n) { return Number(n).toLocaleString('ja-JP'); }

  const NAMES = ['ゆい', 'はると', 'さくら', 'そうた', 'ひなた', 'りく', 'あおい', 'みお', 'いつき', 'こはる'];
  const THINGS = [
    { n: 'あめ', c: 'こ' }, { n: 'えんぴつ', c: '本' }, { n: 'おり紙', c: 'まい' },
    { n: 'クッキー', c: 'こ' }, { n: 'カード', c: 'まい' }, { n: 'ビー玉', c: 'こ' },
    { n: 'シール', c: 'まい' }, { n: 'いちご', c: 'こ' },
  ];

  // ---------- SVG figure builders (all original drawings) ----------
  const SVG_OPEN = '<svg viewBox="0 0 %W% %H%" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" role="img">';
  function svg(w, h, body) {
    return SVG_OPEN.replace('%W%', w).replace('%H%', h) + body + '</svg>';
  }

  // analog clock at h:m
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

  // bar graph: labels[], values[], 1 grid line per `step`
  function barFig(labels, values, unitLabel, step) {
    const max = Math.max.apply(null, values);
    const top = Math.ceil(max / step) * step;
    const W = 340, H = 240, L = 46, B = 200, plotH = 170;
    let body = '<line x1="' + L + '" y1="' + B + '" x2="' + (W - 10) + '" y2="' + B + '" stroke="#3a4555" stroke-width="2"/>' +
      '<line x1="' + L + '" y1="' + B + '" x2="' + L + '" y2="18" stroke="#3a4555" stroke-width="2"/>' +
      '<text x="' + (L - 6) + '" y="14" font-size="12" text-anchor="end" fill="#3a4555">(' + unitLabel + ')</text>';
    for (let v = 0; v <= top; v += step) {
      const y = B - plotH * v / top;
      body += '<line x1="' + L + '" y1="' + y.toFixed(1) + '" x2="' + (W - 10) + '" y2="' + y.toFixed(1) + '" stroke="#d8d2c2" stroke-width="1"/>' +
        '<text x="' + (L - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="12" text-anchor="end" fill="#3a4555">' + v + '</text>';
    }
    const bw = 34, gap = (W - 20 - L - labels.length * bw) / (labels.length + 1);
    labels.forEach(function (lb, i) {
      const x = L + gap * (i + 1) + bw * i;
      const h = plotH * values[i] / top;
      body += '<rect x="' + x.toFixed(1) + '" y="' + (B - h).toFixed(1) + '" width="' + bw + '" height="' + h.toFixed(1) + '" fill="#4a6b4f"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (B + 16) + '" font-size="13" text-anchor="middle" fill="#1c2530">' + lb + '</text>';
    });
    return svg(W, H + 4, body);
  }

  // circle with center + labeled segment ('radius' | 'diameter')
  function circleFig(mode, valueLabel) {
    const cx = 130, cy = 110, r = 88;
    let body = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fffdf8" stroke="#4a6b4f" stroke-width="3"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#1c2530"/>' +
      '<text x="' + cx + '" y="' + (cy - 10) + '" font-size="13" text-anchor="middle" fill="#3a4555">中心</text>';
    if (mode === 'radius') {
      body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#b5572e" stroke-width="3"/>' +
        '<text x="' + (cx + r / 2) + '" y="' + (cy + 20) + '" font-size="15" font-weight="bold" text-anchor="middle" fill="#b5572e">' + valueLabel + '</text>';
    } else {
      body += '<line x1="' + (cx - r) + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#b5572e" stroke-width="3"/>' +
        '<text x="' + cx + '" y="' + (cy + 22) + '" font-size="15" font-weight="bold" text-anchor="middle" fill="#b5572e">' + valueLabel + '</text>';
    }
    return svg(260, 220, body);
  }

  // triangle by side lengths (schematic, labeled) — a,b,c
  function triFig(a, b, c) {
    // place base c on bottom; compute apex via law of cosines (schematic scale)
    const scale = 130 / Math.max(a, b, c);
    const A = a * scale, B2 = b * scale, C = c * scale;
    const x1 = 40, y1 = 180, x2 = x1 + C, y2 = 180;
    const cosA = (B2 * B2 + C * C - A * A) / (2 * B2 * C);
    const ang = Math.acos(Math.min(1, Math.max(-1, cosA)));
    const x3 = x1 + B2 * Math.cos(ang), y3 = y1 - B2 * Math.sin(ang);
    let body = '<polygon points="' + x1 + ',' + y1 + ' ' + x2 + ',' + y2 + ' ' + x3.toFixed(1) + ',' + y3.toFixed(1) + '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    function lab(px, py, t) { return '<text x="' + px.toFixed(1) + '" y="' + py.toFixed(1) + '" font-size="15" font-weight="bold" text-anchor="middle" fill="#1c2530">' + t + '</text>'; }
    body += lab((x1 + x2) / 2, y1 + 20, c + 'cm');
    body += lab((x1 + x3) / 2 - 16, (y1 + y3) / 2, b + 'cm');
    body += lab((x2 + x3) / 2 + 18, (y2 + y3) / 2, a + 'cm');
    return svg(260, 210, body);
  }

  // number line 0..1 (tenths) with arrow at v (0<v<1, one decimal) — also used ×10 for 小数
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

  // fraction bar: 1m strip cut into d parts, n shaded
  function fracFig(n, d) {
    const W = 340, x0 = 20, w = 300, y0 = 34, h = 40;
    let body = '<text x="' + (x0 + w / 2) + '" y="20" font-size="14" text-anchor="middle" fill="#3a4555">1m</text>';
    for (let i = 0; i < d; i++) {
      const x = x0 + w * i / d;
      body += '<rect x="' + x.toFixed(1) + '" y="' + y0 + '" width="' + (w / d).toFixed(1) + '" height="' + h + '" fill="' + (i < n ? '#c9a24b' : '#fffdf8') + '" stroke="#3a4555" stroke-width="2"/>';
    }
    return svg(W, 96, body);
  }

  // ---------- answer form helpers ----------
  function typed(o) { o.kind = 'typed'; o.accepted = o.accepted || [o.answer]; o.inputMode = o.inputMode || 'numeric'; return o; }
  function choice(o, correct, wrongs) {
    o.kind = 'choice';
    o.correctChoice = String(correct);
    o.choices = shuffle([String(correct)].concat(wrongs.map(String)));
    return o;
  }

  // ---------- generators per section ----------

  // U1 かけ算 (九九の表とかけ算)
  function genKuku() {
    const t = ri(0, 3);
    if (t === 0) { // missing factor
      const a = ri(2, 9), b = ri(2, 9);
      return typed({
        tid: 'kuku-missing', category: '九九のきまり',
        q: '□にあてはまる数を書きましょう。　' + a + ' × □ = ' + (a * b),
        answer: String(b),
        exp: a + 'のだんの九九で、答えが' + (a * b) + 'になるのは ' + a + '×' + b + ' です。',
      });
    }
    if (t === 1) { // ×0 / 0×
      const a = ri(2, 9);
      const zeroFirst = Math.random() < 0.5;
      return typed({
        tid: 'kuku-zero', category: '0のかけ算',
        q: (zeroFirst ? '0 × ' + a : a + ' × 0') + ' の答えを書きましょう。',
        answer: '0',
        exp: 'どんな数に0をかけても、0にどんな数をかけても、答えは0です。',
      });
    }
    if (t === 2) { // ×10 / 10×
      const a = ri(2, 9);
      const tenFirst = Math.random() < 0.5;
      return typed({
        tid: 'kuku-ten', category: '10のかけ算',
        q: (tenFirst ? '10 × ' + a : a + ' × 10') + ' の答えを書きましょう。',
        answer: String(a * 10),
        exp: a + '×10 は ' + a + '×9 より ' + a + ' 大きい数、つまり ' + (a * 10) + ' です。',
      });
    }
    // distributive: a×b = a×(b-1) + □
    const a = ri(3, 9), b = ri(3, 9);
    return typed({
      tid: 'kuku-rule', category: '九九のきまり',
      q: 'かけ算のきまりを使います。□にあてはまる数を書きましょう。\n' + a + ' × ' + b + ' = ' + a + ' × ' + (b - 1) + ' + □',
      answer: String(a),
      exp: 'かける数が1ふえると、答えはかけられる数の' + a + 'だけ大きくなります。',
    });
  }

  // U2 時こくと時間
  function genClockRead() {
    const h = ri(1, 12);
    const m = pick([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    const correct = h + '時' + (m === 0 ? '' : m + '分');
    const wrongs = [];
    // typical mistakes: hour/minute hands swapped-ish, off-by-5-minutes, next hour
    wrongs.push((h % 12) + 1 + '時' + (m === 0 ? '' : m + '分'));
    wrongs.push(h + '時' + ((m + 5) % 60 === 0 ? 55 + '分' : ((m + 5) % 60) + '分'));
    wrongs.push(h + '時' + (m === 30 ? '15分' : '30分'));
    const uw = Array.from(new Set(wrongs)).filter(function (w) { return w !== correct; }).slice(0, 3);
    while (uw.length < 3) uw.push(ri(1, 12) + '時' + pick([5, 10, 20, 40, 50]) + '分');
    return choice({
      tid: 'clock-read', category: '時こくをよむ',
      q: 'とけいは何時何分をさしていますか。',
      fig: clockFig(h, m),
      exp: 'みじかいはりが「時」、長いはりが「分」です。長いはりは数字1つ分で5分すすみます。',
    }, correct, uw);
  }
  function genTimeCalc() {
    const t = ri(0, 2);
    if (t === 0) { // 時こく + 分 (may cross hour)
      const h = ri(8, 11), m = pick([20, 30, 40, 50]), add = pick([20, 30, 40, 50]);
      const total = m + add, nh = h + Math.floor(total / 60), nm = total % 60;
      return typed({
        tid: 'time-after', category: '時こくをもとめる', inputMode: 'text',
        q: h + '時' + m + '分から ' + add + '分後の時こくを書きましょう。（れい：9時10分）',
        answer: nh + '時' + (nm === 0 ? '' : nm + '分'),
        accepted: [nh + '時' + nm + '分', nh + '時' + (nm === 0 ? '' : nm + '分'), nh + ':' + String(nm).padStart(2, '0')],
        exp: 'まず' + (60 - m) + '分で' + (h + 1) + '時。のこりの' + (add - (60 - m) >= 0 ? (add - (60 - m)) + '分をたします。' : '分をたします。'),
      });
    }
    if (t === 1) { // duration between two times
      const h = ri(8, 11), m1 = pick([10, 20, 30]), dur = pick([30, 40, 50, 70, 80]);
      const end = h * 60 + m1 + dur, eh = Math.floor(end / 60), em = end % 60;
      const durH = Math.floor(dur / 60), durM = dur % 60;
      const ansTxt = (durH ? durH + '時間' : '') + (durM ? durM + '分' : '');
      return typed({
        tid: 'time-duration', category: 'かかった時間', inputMode: 'text',
        q: h + '時' + m1 + '分から' + eh + '時' + (em === 0 ? '' : em + '分') + 'までの時間を書きましょう。（れい：1時間20分、40分）',
        answer: ansTxt,
        accepted: [ansTxt, dur + '分'],
        exp: 'ちょうどの時こくで区切って考えます。合わせて' + (durH ? durH + '時間' + (durM ? durM + '分' : '') : durM + '分') + 'です。',
      });
    }
    // seconds
    const s = pick([70, 80, 90, 100, 110, 130]);
    return typed({
      tid: 'time-seconds', category: '短い時間（秒）', inputMode: 'text',
      q: s + '秒は何分何秒ですか。（れい：1分10秒）',
      answer: Math.floor(s / 60) + '分' + (s % 60) + '秒',
      accepted: [Math.floor(s / 60) + '分' + (s % 60) + '秒'],
      exp: '1分＝60秒です。' + s + '秒＝60秒＋' + (s - 60) + '秒。',
    });
  }

  // U3 わり算
  function genWarizan() {
    const t = ri(0, 2);
    if (t === 0) {
      const b = ri(2, 9), q = ri(2, 9);
      return typed({
        tid: 'div-fact', category: 'わり算のきほん',
        q: (b * q) + ' ÷ ' + b + ' の答えを書きましょう。',
        answer: String(q),
        exp: b + 'のだんの九九で考えます。' + b + '×' + q + '＝' + (b * q) + ' だから、答えは' + q + 'です。',
      });
    }
    if (t === 1) {
      const b = ri(2, 9);
      const kind = pick(['zero', 'one', 'self']);
      const a = kind === 'zero' ? 0 : b;
      const d = kind === 'one' ? 1 : b;
      return typed({
        tid: 'div-special', category: '0や1のわり算',
        q: a + ' ÷ ' + d + ' の答えを書きましょう。',
        answer: kind === 'zero' ? '0' : (kind === 'one' ? String(b) : '1'),
        exp: kind === 'zero' ? '0をどんな数でわっても、答えは0です。'
          : kind === 'one' ? 'どんな数を1でわっても、答えはもとの数のままです。'
            : '同じ数どうしでわると、答えは1です。',
      });
    }
    const b = ri(2, 9), q = ri(2, 9);
    const th = pick(THINGS), name = pick(NAMES);
    const wari = Math.random() < 0.5; // 等分除 or 包含除
    return typed({
      tid: 'div-word', category: 'わり算の文章題',
      q: wari
        ? th.n + 'が' + (b * q) + th.c + 'あります。' + name + 'さんが' + b + '人に同じ数ずつ分けると、1人分は何' + th.c + 'になりますか。（数だけ書きましょう）'
        : th.n + 'が' + (b * q) + th.c + 'あります。1人に' + b + th.c + 'ずつ分けると、何人に分けられますか。（数だけ書きましょう）',
      answer: String(q),
      exp: '式は ' + (b * q) + '÷' + b + '＝' + q + ' です。',
    });
  }

  // U4 たし算とひき算の筆算
  function genHissanAdd() {
    const big = Math.random() < 0.35;
    const a = big ? ri(1000, 6999) : ri(100, 899);
    const b = big ? ri(1000, 2999) : ri(100, 899);
    return typed({
      tid: big ? 'add-4digit' : 'add-3digit', category: 'たし算の筆算',
      q: a + ' + ' + b + ' を筆算でけいさんして、答えを書きましょう。',
      answer: String(a + b),
      exp: '位をそろえて、一の位からじゅんにたします。くり上がりに気をつけましょう。答えは' + (a + b) + 'です。',
    });
  }
  function genHissanSub() {
    const big = Math.random() < 0.35;
    let a = big ? ri(2000, 9999) : ri(300, 999);
    let b = big ? ri(1000, 1999) : ri(100, 299);
    if (b > a) { const t = a; a = b; b = t; }
    return typed({
      tid: big ? 'sub-4digit' : 'sub-3digit', category: 'ひき算の筆算',
      q: a + ' − ' + b + ' を筆算でけいさんして、答えを書きましょう。',
      answer: String(a - b),
      exp: '位をそろえて、一の位からじゅんにひきます。くり下がりに気をつけましょう。答えは' + (a - b) + 'です。',
    });
  }

  // U5 長さ
  function genNagasa() {
    const t = ri(0, 1);
    if (t === 0) {
      const km = ri(1, 5), m = pick([0, 200, 300, 400, 500, 600, 700, 800]);
      const toM = Math.random() < 0.5;
      if (toM) {
        return typed({
          tid: 'len-km-to-m', category: '長さのたんい',
          q: km + 'km' + (m ? m + 'm' : '') + ' は何mですか。', unitSuffix: 'm',
          answer: String(km * 1000 + m),
          exp: '1km＝1000mです。' + km + 'km＝' + (km * 1000) + 'm。',
        });
      }
      return typed({
        tid: 'len-m-to-km', category: '長さのたんい', inputMode: 'text',
        q: (km * 1000 + m) + 'm は何km何mですか。（れい：2km300m、3km）',
        answer: km + 'km' + (m ? m + 'm' : ''),
        accepted: [km + 'km' + m + 'm', km + 'km' + (m ? m + 'm' : '')],
        exp: '1000mが1kmです。' + (km * 1000 + m) + 'm＝' + km + 'km' + (m ? m + 'm' : '') + '。',
      });
    }
    if (t === 1) { // 道のり vs きょり
      const a = pick([600, 700, 800, 900]), b = pick([500, 600, 700]);
      const total = a + b;
      const km = Math.floor(total / 1000), m = total % 1000;
      return typed({
        tid: 'len-michinori', category: '道のりときょり', inputMode: 'text',
        q: '家から公園の前を通って学校まで行きます。家から公園までは' + a + 'm、公園から学校までは' + b + 'mです。家から学校までの道のりは何km何mですか。（れい：1km200m）',
        answer: km + 'km' + (m ? m + 'm' : ''),
        accepted: [km + 'km' + m + 'm', km + 'km' + (m ? m + 'm' : ''), total + 'm'],
        exp: a + 'm＋' + b + 'm＝' + total + 'm＝' + km + 'km' + (m ? m + 'm' : '') + '。道にそってはかった長さが「道のり」です。',
      });
    }
    // t === 1 handled above; unreachable fallthrough guarded by ri(0, 1)
    return genNagasaUnitChoice();
  }
  function genNagasaUnitChoice() {
    const item = pick([
      ['プールのたての長さ', '25m', ['25km', '25cm', '25mm']],
      ['学校から駅までの道のり', '2km', ['2m', '2cm', '2mm']],
      ['算数の教科書のあつさ', '8mm', ['8cm', '8m', '8km']],
      ['つくえの高さ', '60cm', ['60km', '60m', '60mm']],
    ]);
    return choice({
      tid: 'len-unit-choice', category: '長さのたんい',
      q: item[0] + 'として、いちばん合っているものをえらびましょう。',
      exp: '長さのたんいは mm・cm・m・km。どれくらいの長さかをそうぞうしてえらびます。',
    }, item[1], item[2]);
  }
  function genNagasaFixed() {
    const t = ri(0, 2);
    if (t === 2) return genNagasaUnitChoice();
    return genNagasa(); // t 0/1 paths are self-contained
  }

  // U6 ぼうグラフと表
  function genBarGraph() {
    const labels = shuffle(['すきな給食', 'すきなスポーツ', 'すきな色', '読んだ本']).slice(0, 1);
    const cats = pick([
      ['カレー', 'あげパン', 'シチュー', 'めん'],
      ['サッカー', '水泳', '野球', 'ドッジボール'],
      ['赤', '青', '緑', '黄'],
    ]);
    const step = pick([1, 2, 5]);
    const values = cats.map(function () { return step * ri(2, 8); });
    // make a unique max
    let mi = 0; values.forEach(function (v, i) { if (v > values[mi]) mi = i; });
    values[mi] += step;
    const fig = barFig(cats, values, '人', step);
    const t = ri(0, 2);
    if (t === 0) {
      const i = ri(0, cats.length - 1);
      return typed({
        tid: 'graph-read', category: 'ぼうグラフをよむ',
        q: 'ぼうグラフを見て答えましょう。「' + cats[i] + '」をえらんだ人は何人ですか。', unitSuffix: '人',
        fig: fig, answer: String(values[i]),
        exp: 'めもりは1めもりが' + step + '人です。ぼうの高さをめもりでよみます。',
      });
    }
    if (t === 1) {
      return choice({
        tid: 'graph-max', category: 'ぼうグラフをよむ',
        q: 'ぼうグラフを見て答えましょう。人数がいちばん多いのはどれですか。',
        fig: fig,
        exp: 'いちばん高いぼうをさがします。',
      }, cats[mi], cats.filter(function (_, i) { return i !== mi; }));
    }
    const i = ri(0, cats.length - 1);
    let j = ri(0, cats.length - 1); if (j === i) j = (j + 1) % cats.length;
    const hi = values[i] > values[j] ? i : j, lo = hi === i ? j : i;
    return typed({
      tid: 'graph-diff', category: 'ぼうグラフをくらべる',
      q: 'ぼうグラフを見て答えましょう。「' + cats[hi] + '」は「' + cats[lo] + '」より何人多いですか。', unitSuffix: '人',
      fig: fig, answer: String(values[hi] - values[lo]),
      exp: values[hi] + '人−' + values[lo] + '人＝' + (values[hi] - values[lo]) + '人です。',
    });
  }

  // U7 あまりのあるわり算
  function genAmari() {
    const b = ri(2, 9), q = ri(2, 8), r = ri(1, b - 1);
    const a = b * q + r;
    const t = ri(0, 2);
    if (t <= 1) {
      return typed({
        tid: 'amari-calc', category: 'あまりのあるわり算', inputMode: 'text',
        q: a + ' ÷ ' + b + ' をけいさんしましょう。（れい：4あまり2）',
        answer: q + 'あまり' + r,
        accepted: [q + 'あまり' + r, q + ' あまり ' + r, q + '...' + r, q + '…' + r, q + 'r' + r],
        exp: b + '×' + q + '＝' + (b * q) + '、' + a + '−' + (b * q) + '＝' + r + '。あまりの' + r + 'はわる数の' + b + 'より小さくなっていればOKです。',
      });
    }
    const th = pick(THINGS);
    const roundUp = Math.random() < 0.5;
    if (roundUp) {
      return typed({
        tid: 'amari-roundup', category: 'あまりを考える文章題',
        q: '子どもが' + a + '人います。長いす1きゃくに' + b + '人ずつすわります。全員がすわるには、長いすは何きゃくいりますか。（数だけ書きましょう）', unitSuffix: 'きゃく',
        answer: String(q + 1),
        exp: a + '÷' + b + '＝' + q + 'あまり' + r + '。あまりの' + r + '人がすわるいすがもう1きゃくいるので、' + (q + 1) + 'きゃくです。',
      });
    }
    return typed({
      tid: 'amari-rounddown', category: 'あまりを考える文章題',
      q: th.n + 'が' + a + th.c + 'あります。1つのふくろに' + b + th.c + 'ずつ入れます。' + b + th.c + '入りのふくろは何ふくろできますか。（数だけ書きましょう）', unitSuffix: 'ふくろ',
      answer: String(q),
      exp: a + '÷' + b + '＝' + q + 'あまり' + r + '。あまりの' + r + th.c + 'では1ふくろにならないので、' + q + 'ふくろです。',
    });
  }

  // U8 かけ算の筆算(1) — ×1けた
  function genHissanMul1() {
    const t = ri(0, 2);
    if (t === 0) {
      const a = ri(2, 9) * 10, b = ri(2, 9);
      return typed({
        tid: 'mul1-tens', category: '何十・何百のかけ算',
        q: a + ' × ' + b + ' の答えを書きましょう。',
        answer: String(a * b),
        exp: (a / 10) + '×' + b + '＝' + (a / 10 * b) + '。10のまとまりで考えて、' + (a * b) + 'です。',
      });
    }
    const digits = t === 1 ? 2 : 3;
    const a = digits === 2 ? ri(12, 99) : ri(112, 999);
    const b = ri(2, 9);
    return typed({
      tid: 'mul1-' + digits + 'digit', category: 'かけ算の筆算（×1けた）',
      q: a + ' × ' + b + ' を筆算でけいさんして、答えを書きましょう。',
      answer: String(a * b),
      exp: '一の位からじゅんに、位ごとにかけて、くり上がりをたします。答えは' + (a * b) + 'です。',
    });
  }

  // U9 大きい数 (一万をこえる数)
  function genOokiiKazu() {
    const t = ri(0, 3);
    if (t === 0) {
      const man = ri(2, 9), sen = ri(1, 9), hyaku = ri(0, 9);
      const n = man * 10000 + sen * 1000 + hyaku * 100;
      return typed({
        tid: 'big-compose', category: '大きい数のしくみ',
        q: '一万を' + man + 'こ、千を' + sen + 'こ、百を' + hyaku + 'こ合わせた数を数字で書きましょう。',
        answer: String(n), accepted: [String(n), comma(n)],
        exp: '位ごとにあてはめると ' + comma(n) + ' です。',
      });
    }
    if (t === 1) {
      const n = ri(2, 80) * 1000;
      return typed({
        tid: 'big-thousands', category: '大きい数のしくみ',
        q: '1000を' + (n / 1000) + 'こ集めた数を数字で書きましょう。',
        answer: String(n), accepted: [String(n), comma(n)],
        exp: '1000が10こで一万です。1000×' + (n / 1000) + '＝' + comma(n) + '。',
      });
    }
    if (t === 2) {
      const base = ri(12, 98) * 10;
      const mode = pick(['x10', 'x100', 'd10']);
      const ans = mode === 'x10' ? base * 10 : mode === 'x100' ? base * 100 : base / 10;
      return typed({
        tid: 'big-scale', category: '10倍・100倍・10でわる',
        q: base + ' を' + (mode === 'x10' ? '10倍' : mode === 'x100' ? '100倍' : '10でわった数') + 'にした数を書きましょう。',
        answer: String(ans), accepted: [String(ans), comma(ans)],
        exp: mode === 'd10' ? '10でわると、位が1つ下がります（一の位の0をとる）。'
          : (mode === 'x10' ? '10倍すると位が1つ上がり、0を1つつけます。' : '100倍すると位が2つ上がり、0を2つつけます。'),
      });
    }
    const a = ri(1, 9) * 10000 + ri(0, 9999);
    let b = a + pick([-1, 1]) * ri(1, 900);
    const bigger = a > b ? a : b;
    return choice({
      tid: 'big-compare', category: '大きい数のくらべ方',
      q: comma(a) + ' と ' + comma(b) + ' では、どちらが大きいですか。',
      exp: '位の数が同じときは、上の位からじゅんにくらべます。',
    }, comma(bigger), [comma(bigger === a ? b : a)]);
  }

  // U10 円と球
  function genEnKyu() {
    const t = ri(0, 2);
    if (t === 0) {
      const r = ri(2, 9);
      return typed({
        tid: 'circle-diameter', category: '半径と直径',
        q: '半径が' + r + 'cmの円の直径は何cmですか。', unitSuffix: 'cm',
        fig: circleFig('radius', '半径 ' + r + 'cm'),
        answer: String(r * 2),
        exp: '直径は半径の2倍です。' + r + '×2＝' + (r * 2) + 'cm。',
      });
    }
    if (t === 1) {
      const r = ri(2, 9);
      return typed({
        tid: 'circle-radius', category: '半径と直径',
        q: '直径が' + (r * 2) + 'cmの円の半径は何cmですか。', unitSuffix: 'cm',
        fig: circleFig('diameter', '直径 ' + (r * 2) + 'cm'),
        answer: String(r),
        exp: '半径は直径の半分です。' + (r * 2) + '÷2＝' + r + 'cm。',
      });
    }
    const r = ri(2, 6);
    return typed({
      tid: 'circle-box', category: '円と箱の問題',
      q: '半径' + r + 'cmのボールが、箱にぴったり2こ横にならんで入っています。箱の横の長さは何cmですか。', unitSuffix: 'cm',
      answer: String(r * 4),
      exp: 'ボール1こ分の横はば＝直径＝' + (r * 2) + 'cm。2こ分で ' + (r * 2) + '×2＝' + (r * 4) + 'cmです。',
    });
  }

  // U11 小数
  function genShosuKihon() {
    const t = ri(0, 2);
    if (t === 0) {
      const whole = ri(0, 2), tenth = ri(1, 9);
      const v = whole + tenth / 10;
      return typed({
        tid: 'dec-numline', category: '小数のしくみ', inputMode: 'text',
        q: '↓のめもりがさす数を小数で書きましょう。',
        fig: numlineFig(v, 3),
        answer: v.toFixed(1), accepted: [v.toFixed(1), String(v)],
        exp: '1めもりは0.1です。' + (whole ? whole + 'と0.1が' + tenth + 'こ分で' : '0.1が' + tenth + 'こ分で') + v.toFixed(1) + '。',
      });
    }
    if (t === 1) {
      const tenths = ri(11, 49);
      return typed({
        tid: 'dec-compose', category: '小数のしくみ', inputMode: 'text',
        q: '0.1を' + tenths + 'こ集めた数を書きましょう。',
        answer: (tenths / 10).toFixed(1),
        accepted: [(tenths / 10).toFixed(1), String(tenths / 10)],
        exp: '0.1が10こで1です。0.1が' + tenths + 'こで' + (tenths / 10).toFixed(1) + '。',
      });
    }
    const a = ri(1, 9) + ri(1, 9) / 10;
    let b = a + pick([-1, 1]) * (ri(1, 5) / 10);
    b = Math.round(b * 10) / 10;
    if (b === a || b < 0) b = a + 0.2;
    const bigger = Math.max(a, b);
    return choice({
      tid: 'dec-compare', category: '小数の大きさくらべ',
      q: a.toFixed(1) + ' と ' + b.toFixed(1) + ' では、どちらが大きいですか。',
      exp: '一の位からじゅんにくらべます。一の位が同じなら、小数第一位でくらべます。',
    }, bigger.toFixed(1), [(bigger === a ? b : a).toFixed(1)]);
  }
  function genShosuKeisan() {
    const add = Math.random() < 0.5;
    let a = ri(1, 89) / 10, b = ri(1, 89) / 10;
    a = Math.round(a * 10) / 10; b = Math.round(b * 10) / 10;
    if (!add && b > a) { const t2 = a; a = b; b = t2; }
    const ans = Math.round((add ? a + b : a - b) * 10) / 10;
    const ansTxt = Number.isInteger(ans) ? String(ans) : ans.toFixed(1);
    return typed({
      tid: add ? 'dec-add' : 'dec-sub', category: '小数のたし算とひき算', inputMode: 'text',
      q: a.toFixed(1) + (add ? ' + ' : ' − ') + b.toFixed(1) + ' をけいさんしましょう。',
      answer: ansTxt,
      accepted: [ansTxt, ans.toFixed(1)],
      exp: '位をそろえて、整数と同じようにけいさんします。答えは' + ansTxt + 'です。',
    });
  }

  // U12 重さ
  function genOmosa() {
    const t = ri(0, 2);
    if (t === 0) {
      const kg = ri(1, 5), g = pick([0, 200, 300, 400, 500, 600, 700, 800]);
      const toG = Math.random() < 0.5;
      if (toG) {
        return typed({
          tid: 'wt-kg-to-g', category: '重さのたんい',
          q: kg + 'kg' + (g ? g + 'g' : '') + ' は何gですか。', unitSuffix: 'g',
          answer: String(kg * 1000 + g),
          exp: '1kg＝1000gです。' + kg + 'kg＝' + (kg * 1000) + 'g。',
        });
      }
      return typed({
        tid: 'wt-g-to-kg', category: '重さのたんい', inputMode: 'text',
        q: (kg * 1000 + g) + 'g は何kg何gですか。（れい：2kg300g、3kg）',
        answer: kg + 'kg' + (g ? g + 'g' : ''),
        accepted: [kg + 'kg' + g + 'g', kg + 'kg' + (g ? g + 'g' : '')],
        exp: '1000gが1kgです。' + (kg * 1000 + g) + 'g＝' + kg + 'kg' + (g ? g + 'g' : '') + '。',
      });
    }
    if (t === 1) {
      const box = pick([200, 300, 400]), item = ri(4, 9) * 100;
      const total = box + item, kg = Math.floor(total / 1000), g = total % 1000;
      return typed({
        tid: 'wt-word', category: '重さの計算', inputMode: 'text',
        q: '重さ' + box + 'gの入れものに、みかんを' + item + 'g入れました。全体の重さは' + (total >= 1000 ? '何kg何gですか。（れい：1kg200g）' : '何gですか。'),
        answer: total >= 1000 ? kg + 'kg' + (g ? g + 'g' : '') : String(total),
        accepted: total >= 1000 ? [kg + 'kg' + g + 'g', kg + 'kg' + (g ? g + 'g' : ''), total + 'g'] : [String(total), total + 'g'],
        exp: box + 'g＋' + item + 'g＝' + total + 'g' + (total >= 1000 ? '＝' + kg + 'kg' + (g ? g + 'g' : '') : '') + '。',
      });
    }
    return choice({
      tid: 'wt-ton', category: '重さのたんい',
      q: '1t（1トン）は何kgですか。',
      exp: '1t＝1000kgです。とても重いものの重さに使います。',
    }, '1000kg', ['100kg', '10000kg', '10kg']);
  }

  // U13 分数
  function genBunsu() {
    const t = ri(0, 2);
    if (t === 0) {
      const d = pick([3, 4, 5, 6, 7, 8]), n = ri(1, d - 1);
      return typed({
        tid: 'frac-read', category: '分数のしくみ', inputMode: 'text',
        q: '1mのテープを' + d + '等分しました。色のついた部分の長さは何mですか。分数で書きましょう。（れい：4分の3、3/4）',
        fig: fracFig(n, d),
        answer: n + '/' + d,
        accepted: [n + '/' + d, d + '分の' + n, n + '／' + d],
        exp: '1mを' + d + '等分した' + n + 'こ分だから、' + d + '分の' + n + '（' + n + '/' + d + '）mです。',
      });
    }
    if (t === 1) {
      const d = pick([4, 5, 6, 7, 8, 9]);
      const n1 = ri(1, d - 2), n2 = ri(1, d - 1 - n1);
      const add = Math.random() < 0.5;
      const a = add ? n1 : n1 + n2, b = n2;
      const ansN = add ? n1 + n2 : n1;
      const ansTxt = ansN === d ? '1' : ansN + '/' + d;
      return typed({
        tid: add ? 'frac-add' : 'frac-sub', category: '分数のたし算とひき算', inputMode: 'text',
        q: a + '/' + d + (add ? ' + ' : ' − ') + b + '/' + d + ' をけいさんしましょう。（れい：3/5）',
        answer: ansTxt,
        accepted: ansN === d ? ['1', d + '/' + d] : [ansN + '/' + d, d + '分の' + ansN, ansN + '／' + d],
        exp: '分母はそのままで、分子だけを' + (add ? 'たします' : 'ひきます') + '。答えは' + (ansN === d ? '1' : d + '分の' + ansN) + 'です。',
      });
    }
    const d = pick([4, 5, 6, 7, 8]);
    const n = ri(1, d - 1);
    const other = Math.random() < 0.5 ? '1' : (d - n) === n ? '1' : (d - n) + '/' + d;
    const aVal = n / d, bVal = other === '1' ? 1 : (d - n) / d;
    const bigger = aVal > bVal ? n + '/' + d : other;
    const smaller = bigger === other ? n + '/' + d : other;
    if (aVal === bVal) return genBunsu();
    return choice({
      tid: 'frac-compare', category: '分数の大きさくらべ',
      q: n + '/' + d + ' と ' + other + ' では、どちらが大きいですか。',
      exp: '分母が同じ分数は、分子が大きいほうが大きい。' + d + '/' + d + '＝1 も使って考えます。',
    }, bigger, [smaller]);
  }

  // U14 □を使った式
  function genShikaku() {
    const t = ri(0, 3);
    const th = pick(THINGS);
    if (t === 0) { // □ + a = b
      const add = ri(5, 30), box = ri(10, 60);
      return typed({
        tid: 'box-add', category: '□をもとめる（たし算）',
        q: th.n + 'が何' + th.c + 'かありました。' + add + th.c + 'もらったので、全部で' + (box + add) + th.c + 'になりました。はじめにあった数を□' + th.c + 'として、□にあてはまる数を書きましょう。\n□ + ' + add + ' = ' + (box + add),
        answer: String(box),
        exp: '□＝' + (box + add) + '−' + add + '＝' + box + '。たし算の□は、ひき算でもとめられます。',
      });
    }
    if (t === 1) { // □ − a = b
      const used = ri(5, 30), left = ri(10, 60);
      return typed({
        tid: 'box-sub', category: '□をもとめる（ひき算）',
        q: '□ − ' + used + ' = ' + left + '　の□にあてはまる数を書きましょう。',
        answer: String(used + left),
        exp: '□＝' + left + '＋' + used + '＝' + (used + left) + '。ひかれる数は、たし算でもどせます。',
      });
    }
    if (t === 2) { // □ × a = b
      const a = ri(2, 9), box = ri(2, 9);
      return typed({
        tid: 'box-mul', category: '□をもとめる（かけ算）',
        q: '□ × ' + a + ' = ' + (a * box) + '　の□にあてはまる数を書きましょう。',
        answer: String(box),
        exp: '□＝' + (a * box) + '÷' + a + '＝' + box + '。かけ算の□は、わり算でもとめられます。',
      });
    }
    const a = ri(2, 9), box = ri(2, 9);
    return typed({
      tid: 'box-div', category: '□をもとめる（わり算）',
      q: '□ ÷ ' + a + ' = ' + box + '　の□にあてはまる数を書きましょう。',
      answer: String(a * box),
      exp: '□＝' + box + '×' + a + '＝' + (a * box) + '。わられる数は、かけ算でもどせます。',
    });
  }

  // U15 かけ算の筆算(2) — ×2けた
  function genHissanMul2() {
    const t = ri(0, 2);
    if (t === 0) {
      const a = ri(2, 9) * 10, b = ri(2, 9) * 10;
      return typed({
        tid: 'mul2-tens', category: '何十×何十',
        q: a + ' × ' + b + ' の答えを書きましょう。',
        answer: String(a * b),
        exp: (a / 10) + '×' + (b / 10) + '＝' + (a / 10 * b / 10) + '。それを100倍して' + (a * b) + 'です。',
      });
    }
    const digits = t === 1 ? 2 : 3;
    const a = digits === 2 ? ri(12, 98) : ri(112, 598);
    const b = ri(12, 98);
    return typed({
      tid: 'mul2-' + digits + 'digit', category: 'かけ算の筆算（×2けた）',
      q: a + ' × ' + b + ' を筆算でけいさんして、答えを書きましょう。',
      answer: String(a * b),
      exp: b + 'を「' + (b % 10) + '」と「' + (Math.floor(b / 10) * 10) + '」に分けてかけ、2つの答えをたします。答えは' + (a * b) + 'です。',
    });
  }

  // U16 三角形
  function genSankakkei() {
    const t = ri(0, 2);
    if (t === 0) {
      const kind = pick(['等辺', '正', 'その他']);
      let a2, b2, c2, correct;
      if (kind === '正') { const s = ri(4, 8); a2 = s; b2 = s; c2 = s; correct = '正三角形'; }
      else if (kind === '等辺') {
        const s = ri(5, 8); let base = ri(3, 8);
        if (base === s) base = s - 1;
        a2 = s; b2 = s; c2 = base; correct = '二等辺三角形';
      } else {
        a2 = 4; b2 = 6; c2 = 7; correct = 'どちらでもない三角形';
      }
      return choice({
        tid: 'tri-classify', category: '三角形のしゅるい',
        q: '辺の長さが ' + c2 + 'cm、' + b2 + 'cm、' + a2 + 'cm の三角形は、どんな三角形ですか。',
        fig: triFig(a2, b2, c2),
        exp: '3つの辺がみんな等しい→正三角形。2つの辺が等しい→二等辺三角形。',
      }, correct, ['正三角形', '二等辺三角形', 'どちらでもない三角形'].filter(function (x) { return x !== correct; }));
    }
    if (t === 1) {
      const s = ri(3, 9);
      return typed({
        tid: 'tri-perimeter', category: '三角形と辺の長さ',
        q: '1辺が' + s + 'cmの正三角形があります。まわりの長さは何cmですか。', unitSuffix: 'cm',
        answer: String(s * 3),
        exp: '正三角形は3つの辺がみんな同じ長さです。' + s + '×3＝' + (s * 3) + 'cm。',
      });
    }
    return choice({
      tid: 'tri-angle', category: '角',
      q: '二等辺三角形の角について、正しいものをえらびましょう。',
      exp: '二等辺三角形では、2つの角の大きさが等しくなっています。正三角形では3つの角がみんな等しい。',
    }, '2つの角の大きさが等しい', ['3つの角がみんなちがう', '角はいつも直角になる', '角の大きさはくらべられない']);
  }

  // U17 まとめ — mixed
  const MIXED_POOL = [];

  // ---------- unit/section table ----------
  const UNITS = [
    { num: 1, title: 'かけ算（九九の表とかけ算）', vol: '上', sections: [
      { id: 'u01-kuku', title: '九九のきまりをきわめる', gen: genKuku, n: 10 },
    ]},
    { num: 2, title: '時こくと時間', vol: '上', sections: [
      { id: 'u02-yomu', title: '時こくをよむ', gen: genClockRead, n: 8 },
      { id: 'u02-keisan', title: '時間の計算', gen: genTimeCalc, n: 8 },
    ]},
    { num: 3, title: 'わり算', vol: '上', sections: [
      { id: 'u03-warizan', title: 'わり算のれんしゅう', gen: genWarizan, n: 10 },
    ]},
    { num: 4, title: 'たし算とひき算の筆算', vol: '上', sections: [
      { id: 'u04-tashizan', title: 'たし算の筆算', gen: genHissanAdd, n: 8 },
      { id: 'u04-hikizan', title: 'ひき算の筆算', gen: genHissanSub, n: 8 },
    ]},
    { num: 5, title: '長さ', vol: '上', sections: [
      { id: 'u05-nagasa', title: '長さのたんいと道のり', gen: genNagasaFixed, n: 8 },
    ]},
    { num: 6, title: 'ぼうグラフと表', vol: '上', sections: [
      { id: 'u06-graph', title: 'ぼうグラフをよむ', gen: genBarGraph, n: 8 },
    ]},
    { num: 7, title: 'あまりのあるわり算', vol: '上', sections: [
      { id: 'u07-amari', title: 'あまりのあるわり算', gen: genAmari, n: 10 },
    ]},
    { num: 8, title: 'かけ算の筆算（×1けた）', vol: '上', sections: [
      { id: 'u08-hissan1', title: 'かけ算の筆算（1）', gen: genHissanMul1, n: 10 },
    ]},
    { num: 9, title: '大きい数のしくみ', vol: '上', sections: [
      { id: 'u09-ookii', title: '一万をこえる数', gen: genOokiiKazu, n: 10 },
    ]},
    { num: 10, title: '円と球', vol: '上', sections: [
      { id: 'u10-en', title: '円と球', gen: genEnKyu, n: 8 },
    ]},
    { num: 11, title: '小数', vol: '下', sections: [
      { id: 'u11-shikumi', title: '小数のしくみ', gen: genShosuKihon, n: 8 },
      { id: 'u11-keisan', title: '小数のたし算とひき算', gen: genShosuKeisan, n: 10 },
    ]},
    { num: 12, title: '重さ', vol: '下', sections: [
      { id: 'u12-omosa', title: '重さのたんいと計算', gen: genOmosa, n: 8 },
    ]},
    { num: 13, title: '分数', vol: '下', sections: [
      { id: 'u13-bunsu', title: '分数', gen: genBunsu, n: 10 },
    ]},
    { num: 14, title: '□を使った式', vol: '下', sections: [
      { id: 'u14-shikaku', title: '□にあてはまる数', gen: genShikaku, n: 10 },
    ]},
    { num: 15, title: 'かけ算の筆算（×2けた）', vol: '下', sections: [
      { id: 'u15-hissan2', title: 'かけ算の筆算（2）', gen: genHissanMul2, n: 10 },
    ]},
    { num: 16, title: '三角形', vol: '下', sections: [
      { id: 'u16-sankaku', title: '三角形と角', gen: genSankakkei, n: 8 },
    ]},
  ];

  // まとめ (mixed) — draws one problem from a random unit's generator
  UNITS.forEach(function (u) { u.sections.forEach(function (s) { MIXED_POOL.push(s.gen); }); });
  function genMatome() { return pick(MIXED_POOL)(); }
  UNITS.push({ num: 17, title: '3年のまとめ', vol: '下', sections: [
    { id: 'u17-matome', title: 'まとめテスト（全単元から）', gen: genMatome, n: 12 },
  ]});

  window.SANSU3_DATA = { UNITS };
})();
