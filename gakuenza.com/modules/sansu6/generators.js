// 算数 6年 — Gakuenza module content & problem generators
// すべてオリジナル教材。東京書籍『新編 新しい算数6』(令和6年度版) の
// 単元構成に対応させているが、問題そのものは全て独自生成 —
// 教科書の問題文・数値・図版は一切転載していない。
//
// Ported from sansu3 / sansu4's generator architecture (parameterized
// generation, not a fixed bank). Each section has gen(): returns ONE fresh
// problem object per call — unlimited practice — while tid/category stay
// stable so the teacher gradebook's category rollup and dominant-wrong-answer
// analysis keep working across attempts.
//
//   {
//     tid,               // template id — stable per problem TYPE
//     category,          // gradebook analysis category (Japanese label)
//     q,                 // question text
//     fig,               // optional inner-HTML SVG figure
//     kind: 'typed' | 'choice',
//     answer,            // typed: canonical answer string
//     accepted,          // typed: array of accepted normalized forms
//     inputMode,         // typed: 'numeric' | 'text'
//     unitSuffix,        // typed: shown after the input box (e.g. 'cm²')
//     choices,           // choice: array of option strings (already shuffled)
//     correctChoice,     // choice: the correct option's text
//     exp,               // explanation shown after answering
//   }

(function () {
  'use strict';

  // ---------- rng helpers ----------
  function ri(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function pick(arr) { return arr[ri(0, arr.length - 1)]; }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = ri(0, i);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = b; b = a % b; a = t; } return a || 1; }

  const NAMES = ['ゆい', 'はると', 'さくら', 'そうた', 'ひなた', 'りく', 'あおい', 'みお', 'いつき', 'こはる'];
  const THINGS = [
    { n: 'あめ', c: 'こ' }, { n: 'えんぴつ', c: '本' }, { n: 'おり紙', c: 'まい' },
    { n: 'クッキー', c: 'こ' }, { n: 'カード', c: 'まい' }, { n: 'ビー玉', c: 'こ' },
    { n: 'シール', c: 'まい' }, { n: 'いちご', c: 'こ' },
  ];

  // ---------- number formatting ----------
  // Format an integer number of hundredths as a decimal string with no
  // trailing zeros. Keeps 3.14×r² style answers EXACT (integer math, no float
  // drift): fmt2(7850) === '78.5', fmt2(628) === '6.28', fmt2(314) === '3.14'.
  function fmt2(cents) {
    const neg = cents < 0; cents = Math.abs(cents);
    const w = Math.floor(cents / 100);
    const f = cents % 100;
    let s = String(w);
    if (f > 0) s += '.' + String(f).padStart(2, '0').replace(/0+$/, '');
    return (neg ? '-' : '') + s;
  }

  // ---------- fraction helpers ----------
  // Reduce n/d to lowest terms; canonical answer is a reduced IMPROPER
  // fraction (Japanese convention for 6年 ×/÷ results). Returns { n, d, txt,
  // accepted } where accepted also allows the "d分のn" and full-width-slash
  // forms, and integer results collapse to a bare integer.
  function fracAns(n, d) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    n = n / g; d = d / g;
    if (d === 1) return { n: n, d: 1, txt: String(n), accepted: [String(n)] };
    const txt = n + '/' + d;
    return { n: n, d: d, txt: txt, accepted: [txt, d + '分の' + n, n + '／' + d] };
  }

  // ---------- SVG figure builders (all original drawings) ----------
  const SVG_OPEN = '<svg viewBox="0 0 %W% %H%" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" role="img">';
  function svg(w, h, body) { return SVG_OPEN.replace('%W%', w).replace('%H%', h) + body + '</svg>'; }

  // regular n-gon, optionally with an axis-of-symmetry dashed line
  function regPolyFig(n, showAxis) {
    const cx = 120, cy = 115, r = 88;
    const start = -Math.PI / 2 + (n % 2 === 0 ? Math.PI / n : 0);
    let pts = [];
    for (let i = 0; i < n; i++) {
      const a = start + i * 2 * Math.PI / n;
      pts.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
    }
    let body = '<polygon points="' + pts.join(' ') + '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>';
    if (showAxis) {
      body += '<line x1="' + cx + '" y1="' + (cy - r - 8) + '" x2="' + cx + '" y2="' + (cy + r + 8) +
        '" stroke="#b5572e" stroke-width="2" stroke-dasharray="6 5"/>';
    }
    return svg(240, 230, body);
  }

  // circle with a labeled radius (mode 'radius') or diameter (mode 'diameter')
  function circleFig(mode, valueLabel) {
    const cx = 130, cy = 110, r = 88;
    let body = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#fffdf8" stroke="#4a6b4f" stroke-width="3"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#1c2530"/>';
    if (mode === 'radius') {
      body += '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#b5572e" stroke-width="3"/>' +
        '<text x="' + (cx + r / 2) + '" y="' + (cy - 8) + '" font-size="15" font-weight="bold" text-anchor="middle" fill="#b5572e">' + valueLabel + '</text>';
    } else {
      body += '<line x1="' + (cx - r) + '" y1="' + cy + '" x2="' + (cx + r) + '" y2="' + cy + '" stroke="#b5572e" stroke-width="3"/>' +
        '<text x="' + cx + '" y="' + (cy - 8) + '" font-size="15" font-weight="bold" text-anchor="middle" fill="#b5572e">' + valueLabel + '</text>';
    }
    return svg(260, 220, body);
  }

  // schematic cylinder with labeled radius + height
  function cylinderFig(rLabel, hLabel) {
    const cx = 110, topY = 34, botY = 176, rx = 56, ry = 16;
    let body =
      '<path d="M' + (cx - rx) + ' ' + topY + ' A ' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ' ' + topY +
      ' L ' + (cx + rx) + ' ' + botY + ' A ' + rx + ' ' + ry + ' 0 0 1 ' + (cx - rx) + ' ' + botY + ' Z" fill="#eef3ee" stroke="#4a6b4f" stroke-width="3"/>' +
      '<ellipse cx="' + cx + '" cy="' + topY + '" rx="' + rx + '" ry="' + ry + '" fill="#fffdf8" stroke="#4a6b4f" stroke-width="3"/>' +
      '<line x1="' + cx + '" y1="' + topY + '" x2="' + (cx + rx) + '" y2="' + topY + '" stroke="#b5572e" stroke-width="2.5"/>' +
      '<text x="' + (cx + rx / 2) + '" y="' + (topY - 6) + '" font-size="13" font-weight="bold" text-anchor="middle" fill="#b5572e">' + rLabel + '</text>' +
      '<line x1="' + (cx + rx + 14) + '" y1="' + topY + '" x2="' + (cx + rx + 14) + '" y2="' + botY + '" stroke="#3a4555" stroke-width="2"/>' +
      '<text x="' + (cx + rx + 20) + '" y="' + ((topY + botY) / 2) + '" font-size="13" font-weight="bold" text-anchor="start" fill="#3a4555">' + hLabel + '</text>';
    return svg(230, 210, body);
  }

  // schematic rectangular prism (直方体) with labeled edges a(width) b(depth) c(height)
  function boxFig(aLabel, bLabel, cLabel) {
    const x = 40, y = 70, w = 120, h = 90, d = 40;
    let body =
      '<polygon points="' + x + ',' + (y + h) + ' ' + (x + w) + ',' + (y + h) + ' ' + (x + w) + ',' + y + ' ' + x + ',' + y + '" fill="#eef3ee" stroke="#4a6b4f" stroke-width="2.5"/>' +
      '<polygon points="' + x + ',' + y + ' ' + (x + d) + ',' + (y - d) + ' ' + (x + w + d) + ',' + (y - d) + ' ' + (x + w) + ',' + y + '" fill="#e2ebe2" stroke="#4a6b4f" stroke-width="2.5"/>' +
      '<polygon points="' + (x + w) + ',' + y + ' ' + (x + w + d) + ',' + (y - d) + ' ' + (x + w + d) + ',' + (y + h - d) + ' ' + (x + w) + ',' + (y + h) + '" fill="#d8e4d8" stroke="#4a6b4f" stroke-width="2.5"/>' +
      '<text x="' + (x + w / 2) + '" y="' + (y + h + 18) + '" font-size="13" font-weight="bold" text-anchor="middle" fill="#b5572e">' + aLabel + '</text>' +
      '<text x="' + (x + w + d / 2 + 6) + '" y="' + (y - d / 2 - 2) + '" font-size="13" font-weight="bold" text-anchor="middle" fill="#b5572e">' + bLabel + '</text>' +
      '<text x="' + (x + w + d + 8) + '" y="' + (y + (h - d) / 2 + 6) + '" font-size="13" font-weight="bold" text-anchor="start" fill="#b5572e">' + cLabel + '</text>';
    return svg(230, 190, body);
  }

  // ---------- answer form helpers ----------
  function typed(o) { o.kind = 'typed'; o.accepted = o.accepted || [o.answer]; o.inputMode = o.inputMode || 'numeric'; return o; }
  function choice(o, correct, wrongs) {
    o.kind = 'choice';
    o.correctChoice = String(correct);
    o.choices = shuffle([String(correct)].concat(wrongs.map(String)));
    return o;
  }

  // =====================================================================
  // U1 対称な図形
  // =====================================================================
  // Curated shape bank with verifiable symmetry facts.
  //   axes  = number of lines of symmetry (円 excluded from axis-count Qs)
  //   point = point-symmetric (180° rotation maps onto itself)
  const SYM_SHAPES = [
    { name: '正三角形', axes: 3, point: false },
    { name: '二等辺三角形', axes: 1, point: false },
    { name: '正方形', axes: 4, point: true },
    { name: '長方形', axes: 2, point: true },
    { name: 'ひし形', axes: 2, point: true },
    { name: '平行四辺形', axes: 0, point: true },
    { name: '正五角形', axes: 5, point: false },
    { name: '正六角形', axes: 6, point: true },
    { name: '正八角形', axes: 8, point: true },
  ];
  function regularPolyFor(name) {
    const map = { '正三角形': 3, '正方形': 4, '正五角形': 5, '正六角形': 6, '正八角形': 8 };
    return map[name] || null;
  }
  function genSymmetry() {
    const t = ri(0, 3);
    if (t === 0) { // number of axes (regular polygon, drawable)
      const n = pick([3, 4, 5, 6, 8]);
      const name = ({ 3: '正三角形', 4: '正方形', 5: '正五角形', 6: '正六角形', 8: '正八角形' })[n];
      return typed({
        tid: 'sym-axes', category: '対称の軸の数',
        q: name + 'には、対称の軸が何本ありますか。', unitSuffix: '本',
        fig: regPolyFig(n, true),
        answer: String(n),
        exp: '正' + (n === 4 ? '方形' : n + '角形') + 'は、頂点や辺の数と同じ' + n + '本の対称の軸があります。',
      });
    }
    if (t === 1) { // line-symmetric? yes/no
      const s = pick(SYM_SHAPES);
      const isLine = s.axes > 0;
      const np = regularPolyFor(s.name);
      return choice({
        tid: 'sym-line', category: '線対称かどうか',
        q: s.name + 'は線対称な図形ですか。',
        fig: np ? regPolyFig(np, false) : null,
        exp: '線対称な図形は、1本の直線で折るとぴったり重なります。' + s.name + 'の対称の軸は' + s.axes + '本' + (isLine ? 'あります' : '（ありません）') + '。',
      }, isLine ? 'はい' : 'いいえ', [isLine ? 'いいえ' : 'はい']);
    }
    if (t === 2) { // point-symmetric? yes/no
      const s = pick(SYM_SHAPES);
      const np = regularPolyFor(s.name);
      return choice({
        tid: 'sym-point', category: '点対称かどうか',
        q: s.name + 'は点対称な図形ですか。',
        fig: np ? regPolyFig(np, false) : null,
        exp: '点対称な図形は、ある点のまわりに180°回すともとの形にぴったり重なります。' +
          s.name + 'は' + (s.point ? '点対称です' : '点対称ではありません') + '。',
      }, s.point ? 'はい' : 'いいえ', [s.point ? 'いいえ' : 'はい']);
    }
    // regular n-gon: is it point-symmetric? (rule: yes iff n even)
    const n = pick([3, 4, 5, 6, 8]);
    const name = ({ 3: '正三角形', 4: '正方形', 5: '正五角形', 6: '正六角形', 8: '正八角形' })[n];
    const isPoint = n % 2 === 0;
    return choice({
      tid: 'sym-regular-point', category: '正多角形と点対称',
      q: name + 'について、正しいものをえらびましょう。',
      fig: regPolyFig(n, false),
      exp: '正多角形は、頂点の数が偶数のとき点対称になります。' + name + 'は' + (isPoint ? '点対称です' : '点対称ではありません') + '。',
    }, isPoint ? '点対称である' : '点対称ではない', [isPoint ? '点対称ではない' : '点対称である']);
  }

  // =====================================================================
  // U2 文字と式
  // =====================================================================
  function genLetter() {
    const t = ri(0, 3);
    if (t === 0) { // evaluate a×x, x×a+b, etc.
      const a = ri(2, 9), b = ri(1, 20), x = ri(2, 12);
      const form = pick(['ax', 'ax+b', 'ax-b']);
      let val, qexpr;
      if (form === 'ax') { val = a * x; qexpr = 'x × ' + a; }
      else if (form === 'ax+b') { val = a * x + b; qexpr = 'x × ' + a + ' + ' + b; }
      else { val = a * x - b; qexpr = 'x × ' + a + ' − ' + b; }
      if (val < 0) return genLetter();
      return typed({
        tid: 'let-eval', category: '式の値を求める',
        q: 'x = ' + x + ' のとき、' + qexpr + ' の値を求めましょう。',
        answer: String(val),
        exp: 'x に ' + x + ' をあてはめます。' + qexpr.replace(/x/g, x) + ' = ' + val + '。',
      });
    }
    if (t === 1) { // word -> expression -> value (numeric answer)
      const price = ri(30, 90) * 10, qty = ri(2, 9), extra = ri(1, 5) * 100;
      const th = pick(['ノート', 'ジュース', 'おかし', 'えんぴつ']);
      return typed({
        tid: 'let-word', category: '場面を式に表す',
        q: '1こ x 円の' + th + 'を' + qty + 'こ買って、' + extra + '円の箱に入れてもらいます。代金は「x × ' + qty + ' + ' + extra + '」で表せます。x = ' + price + ' のときの代金を求めましょう。', unitSuffix: '円',
        answer: String(price * qty + extra),
        exp: 'x × ' + qty + ' + ' + extra + ' に x = ' + price + ' を入れて、' + price + ' × ' + qty + ' + ' + extra + ' = ' + (price * qty + extra) + '円。',
      });
    }
    if (t === 2) { // solve a×x = b
      const a = ri(2, 9), x = ri(2, 12);
      return typed({
        tid: 'let-solve-mul', category: 'xを求める',
        q: 'x × ' + a + ' = ' + (a * x) + ' のとき、x にあてはまる数を求めましょう。',
        answer: String(x),
        exp: 'x = ' + (a * x) + ' ÷ ' + a + ' = ' + x + '。かけ算の x は、わり算でもとめられます。',
      });
    }
    // solve x + a = b or x - a = b
    const a = ri(3, 30), x = ri(3, 40);
    const sub = Math.random() < 0.5;
    return typed({
      tid: 'let-solve-add', category: 'xを求める',
      q: (sub ? 'x − ' + a + ' = ' + x : 'x + ' + a + ' = ' + (x + a)) + ' のとき、x にあてはまる数を求めましょう。',
      answer: sub ? String(x + a) : String(x),
      exp: sub ? 'x = ' + x + ' + ' + a + ' = ' + (x + a) + '。' : 'x = ' + (x + a) + ' − ' + a + ' = ' + x + '。',
    });
  }

  // =====================================================================
  // U3 分数×整数、分数÷整数、分数×分数
  // =====================================================================
  function genFracMul() {
    const t = ri(0, 3);
    if (t === 0) { // a/b × n
      const b = pick([2, 3, 4, 5, 6, 7, 8]), a = ri(1, b - 1), n = ri(2, 6);
      const ans = fracAns(a * n, b);
      return typed({
        tid: 'fmul-int', category: '分数×整数', inputMode: 'text',
        q: a + '/' + b + ' × ' + n + ' を計算しましょう。約分できるときは約分します。（れい：3/4、2）',
        answer: ans.txt, accepted: ans.accepted,
        exp: '分子に整数をかけます。' + a + '×' + n + '/' + b + ' = ' + ans.txt + '。',
      });
    }
    if (t === 1) { // a/b ÷ n
      const b = pick([2, 3, 4, 5, 6]), a = ri(1, b - 1), n = ri(2, 5);
      const ans = fracAns(a, b * n);
      return typed({
        tid: 'fmul-divint', category: '分数÷整数', inputMode: 'text',
        q: a + '/' + b + ' ÷ ' + n + ' を計算しましょう。約分できるときは約分します。（れい：1/6）',
        answer: ans.txt, accepted: ans.accepted,
        exp: '分母に整数をかけます。' + a + '/(' + b + '×' + n + ') = ' + ans.txt + '。',
      });
    }
    if (t === 2) { // a/b × c/d
      const b = pick([2, 3, 4, 5]), a = ri(1, b - 1);
      const d = pick([2, 3, 4, 5, 6]), c = ri(1, d - 1);
      const ans = fracAns(a * c, b * d);
      return typed({
        tid: 'fmul-frac', category: '分数×分数', inputMode: 'text',
        q: a + '/' + b + ' × ' + c + '/' + d + ' を計算しましょう。約分できるときは約分します。（れい：3/8）',
        answer: ans.txt, accepted: ans.accepted,
        exp: '分子どうし・分母どうしをかけます。' + (a * c) + '/' + (b * d) + ' = ' + ans.txt + '。',
      });
    }
    // 逆数
    const kind = pick(['frac', 'int']);
    if (kind === 'frac') {
      const d = pick([2, 3, 4, 5, 7, 8]), n = ri(2, 9);
      const g = gcd(n, d);
      const rn = n / g, rd = d / g;
      const ans = fracAns(rd, rn);
      return typed({
        tid: 'fmul-recip', category: '逆数', inputMode: 'text',
        q: (rn) + '/' + (rd) + ' の逆数を書きましょう。（れい：4/3、2）',
        answer: ans.txt, accepted: ans.accepted,
        exp: '逆数は分子と分母を入れかえた数です。かけると1になります。' + rn + '/' + rd + ' の逆数は ' + ans.txt + '。',
      });
    }
    const n = ri(2, 9);
    const ans = fracAns(1, n);
    return typed({
      tid: 'fmul-recip-int', category: '逆数', inputMode: 'text',
      q: '整数 ' + n + ' の逆数を書きましょう。（れい：1/5）',
      answer: ans.txt, accepted: ans.accepted,
      exp: '整数 ' + n + ' は ' + n + '/1 と考えられるので、逆数は ' + ans.txt + '。',
    });
  }

  // =====================================================================
  // U4 分数÷分数
  // =====================================================================
  function genFracDiv() {
    const t = ri(0, 2);
    if (t === 0) { // a/b ÷ c/d
      const b = pick([2, 3, 4, 5]), a = ri(1, b - 1);
      const d = pick([2, 3, 4, 5, 6]), c = ri(1, d - 1);
      const ans = fracAns(a * d, b * c);
      return typed({
        tid: 'fdiv-frac', category: '分数÷分数', inputMode: 'text',
        q: a + '/' + b + ' ÷ ' + c + '/' + d + ' を計算しましょう。約分できるときは約分します。（れい：5/6、2）',
        answer: ans.txt, accepted: ans.accepted,
        exp: 'わる数の逆数（' + d + '/' + c + '）をかけます。' + a + '/' + b + ' × ' + d + '/' + c + ' = ' + ans.txt + '。',
      });
    }
    if (t === 1) { // integer ÷ fraction
      const d = pick([2, 3, 4, 5]), c = ri(1, d - 1), m = ri(2, 6);
      const ans = fracAns(m * d, c);
      return typed({
        tid: 'fdiv-int-frac', category: '整数÷分数', inputMode: 'text',
        q: m + ' ÷ ' + c + '/' + d + ' を計算しましょう。約分できるときは約分します。（れい：8/3、6）',
        answer: ans.txt, accepted: ans.accepted,
        exp: 'わる数の逆数（' + d + '/' + c + '）をかけます。' + m + ' × ' + d + '/' + c + ' = ' + ans.txt + '。',
      });
    }
    // mixed: a/b × c/d ÷ e/f  (kept small)
    const b = pick([2, 3, 4]), a = ri(1, b - 1);
    const d = pick([2, 3, 4]), c = ri(1, d - 1);
    const f = pick([2, 3, 4]), e = ri(1, f - 1);
    const ans = fracAns(a * c * f, b * d * e);
    return typed({
      tid: 'fdiv-mixed', category: '分数の混じった計算', inputMode: 'text',
      q: a + '/' + b + ' × ' + c + '/' + d + ' ÷ ' + e + '/' + f + ' を計算しましょう。約分できるときは約分します。',
      answer: ans.txt, accepted: ans.accepted,
      exp: 'わる数を逆数にしてかけ算だけの式にします。' + (a * c) + '/' + (b * d) + ' × ' + f + '/' + e + ' = ' + ans.txt + '。',
    });
  }

  // =====================================================================
  // U5 比
  // =====================================================================
  function genRatio() {
    const t = ri(0, 3);
    if (t === 0) { // 比の値
      const g = ri(1, 4), a = ri(1, 6) * g, b = ri(1, 6) * g;
      const ans = fracAns(a, b);
      return typed({
        tid: 'ratio-value', category: '比の値', inputMode: 'text',
        q: a + ' : ' + b + ' の比の値を書きましょう。（れい：3/4、2）',
        answer: ans.txt, accepted: ans.accepted,
        exp: '比の値は「前の数 ÷ 後ろの数」。' + a + ' ÷ ' + b + ' = ' + ans.txt + '。',
      });
    }
    if (t === 1) { // simplify ratio
      const g = ri(2, 9);
      let a0 = ri(2, 9), b0 = ri(2, 9);
      if (gcd(a0, b0) !== 1) { const gg = gcd(a0, b0); a0 /= gg; b0 /= gg; }
      const a = a0 * g, b = b0 * g;
      return typed({
        tid: 'ratio-simplify', category: '比を簡単にする', inputMode: 'text',
        q: a + ' : ' + b + ' をできるだけ簡単な整数の比にしましょう。（れい：2:3）',
        answer: a0 + ':' + b0,
        accepted: [a0 + ':' + b0, a0 + '：' + b0],
        exp: '両方を同じ数（' + g + '）でわります。' + a + ':' + b + ' = ' + a0 + ':' + b0 + '。',
      });
    }
    if (t === 2) { // equivalent ratio: find missing term
      const a = ri(2, 6), b = ri(2, 6), k = ri(2, 6);
      return typed({
        tid: 'ratio-equiv', category: '等しい比', inputMode: 'numeric',
        q: a + ' : ' + b + ' = ' + (a * k) + ' : □　の □ にあてはまる数を求めましょう。',
        answer: String(b * k),
        exp: '前の数が ' + a + ' から ' + (a * k) + ' へ ' + k + '倍になっているので、後ろも ' + k + '倍。' + b + ' × ' + k + ' = ' + (b * k) + '。',
      });
    }
    // proportional division
    const p = ri(1, 4), q2 = ri(1, 4);
    const unit = ri(2, 8);
    const total = (p + q2) * unit;
    const askSmaller = p <= q2;
    const smallPart = Math.min(p, q2) * unit, bigPart = Math.max(p, q2) * unit;
    const th = pick(THINGS);
    return typed({
      tid: 'ratio-divide', category: '比で分ける',
      q: th.n + 'が全部で' + total + th.c + 'あります。これを ' + p + ' : ' + q2 + ' の比で分けます。' +
        (askSmaller ? '少ない' : '多い') + 'ほうは何' + th.c + 'になりますか。（数だけ書きましょう）', unitSuffix: th.c,
      answer: String(askSmaller ? smallPart : bigPart),
      exp: '全体を ' + (p + q2) + ' 等分した1つ分が ' + total + '÷' + (p + q2) + '＝' + unit + th.c + '。' +
        (askSmaller ? Math.min(p, q2) : Math.max(p, q2)) + 'つ分で ' + (askSmaller ? smallPart : bigPart) + th.c + '。',
    });
  }

  // =====================================================================
  // U6 拡大図と縮図
  // =====================================================================
  function genScale() {
    const t = ri(0, 2);
    if (t === 0) { // enlargement: side × ratio
      const base = ri(3, 12), k = pick([2, 3, 4]);
      const up = Math.random() < 0.5;
      if (up) {
        return typed({
          tid: 'scale-enlarge', category: '拡大図', unitSuffix: 'cm',
          q: 'ある辺の長さが ' + base + 'cm の図形を ' + k + '倍に拡大します。この辺は何cmになりますか。',
          answer: String(base * k),
          exp: '拡大図では、対応する辺の長さがもとの ' + k + '倍になります。' + base + '×' + k + '＝' + (base * k) + 'cm。',
        });
      }
      return typed({
        tid: 'scale-reduce', category: '縮図', unitSuffix: 'cm',
        q: 'ある辺の長さが ' + (base * k) + 'cm の図形を ' + k + '分の1に縮小します。この辺は何cmになりますか。',
        answer: String(base),
        exp: '縮図では、対応する辺の長さがもとの ' + k + '分の1になります。' + (base * k) + '÷' + k + '＝' + base + 'cm。',
      });
    }
    if (t === 1) { // map scale: drawing cm -> actual (clean m)
      const denom = pick([1000, 2000, 5000]);
      const cm = pick([2, 3, 4, 5, 6, 8]);
      const actualCm = cm * denom;
      const actualM = actualCm / 100;
      return typed({
        tid: 'scale-map-actual', category: '縮尺と実際の長さ', unitSuffix: 'm',
        q: '縮尺 1/' + denom + ' の地図で、長さが ' + cm + 'cm の道があります。実際の長さは何mですか。',
        answer: String(actualM),
        exp: '実際の長さ＝地図の長さ×' + denom + '。' + cm + '×' + denom + '＝' + actualCm + 'cm＝' + actualM + 'm。',
      });
    }
    // actual m -> drawing cm
    const denom = pick([1000, 2000, 5000]);
    const m = pick([20, 40, 50, 60, 100]);
    const actualCm = m * 100;
    const drawCm = actualCm / denom;
    if (!Number.isInteger(drawCm) || drawCm < 1) return genScale();
    return typed({
      tid: 'scale-map-draw', category: '縮尺と地図の長さ', unitSuffix: 'cm',
      q: '縮尺 1/' + denom + ' の地図をかきます。実際の長さが ' + m + 'm のとき、地図では何cmになりますか。',
      answer: String(drawCm),
      exp: '地図の長さ＝実際の長さ÷' + denom + '。' + m + 'm＝' + actualCm + 'cm、' + actualCm + '÷' + denom + '＝' + drawCm + 'cm。',
    });
  }

  // =====================================================================
  // U7 データの調べ方
  // =====================================================================
  function genData() {
    const t = ri(0, 3);
    if (t === 0) { // mean (choose so integer)
      const k = ri(4, 6);
      const mean = ri(4, 12);
      // build k values summing to mean*k
      const vals = [];
      let sum = 0;
      for (let i = 0; i < k - 1; i++) { const v = ri(Math.max(1, mean - 4), mean + 4); vals.push(v); sum += v; }
      const last = mean * k - sum;
      if (last < 1 || last > mean + 8) return genData();
      vals.push(last);
      return typed({
        tid: 'data-mean', category: '平均',
        q: '次の' + k + '個の数の平均を求めましょう。\n' + shuffle(vals).join('、'),
        answer: String(mean),
        exp: '合計 ' + (mean * k) + ' ÷ 個数 ' + k + ' ＝ ' + mean + '。平均＝合計÷個数です。',
      });
    }
    if (t === 1) { // median (odd count)
      const k = pick([5, 7]);
      const vals = [];
      const seen = new Set();
      while (vals.length < k) { const v = ri(1, 30); if (!seen.has(v)) { seen.add(v); vals.push(v); } }
      const sorted = vals.slice().sort(function (a, b) { return a - b; });
      const med = sorted[(k - 1) / 2];
      return typed({
        tid: 'data-median', category: '中央値',
        q: '次の' + k + '個のデータの中央値（メジアン）を求めましょう。\n' + shuffle(vals).join('、'),
        answer: String(med),
        exp: '小さいじゅんにならべると ' + sorted.join('、') + '。まん中の値は ' + med + '。',
      });
    }
    if (t === 2) { // mode
      const modeVal = ri(3, 9);
      const others = [];
      const seen = new Set([modeVal]);
      while (others.length < 3) { const v = ri(1, 12); if (!seen.has(v)) { seen.add(v); others.push(v); } }
      // mode appears 3 times, others once each
      const vals = [modeVal, modeVal, modeVal].concat(others);
      return typed({
        tid: 'data-mode', category: '最頻値',
        q: '次のデータで、いちばん多く出てくる値（最頻値・モード）を求めましょう。\n' + shuffle(vals).join('、'),
        answer: String(modeVal),
        exp: modeVal + ' が3回出てきて、いちばん多いので最頻値は ' + modeVal + '。',
      });
    }
    // frequency table reading (total, or which class has most)
    const classes = ['0以上10未満', '10以上20未満', '20以上30未満', '30以上40未満'];
    const freq = classes.map(function () { return ri(1, 9); });
    let mi = 0; freq.forEach(function (v, i) { if (v > freq[mi]) mi = i; });
    // ensure unique max
    let dup = freq.filter(function (v) { return v === freq[mi]; }).length;
    if (dup > 1) { freq[mi] += 1; }
    const table = classes.map(function (c, i) { return c + '：' + freq[i] + '人'; }).join('\n');
    const askTotal = Math.random() < 0.5;
    if (askTotal) {
      const total = freq.reduce(function (a, b) { return a + b; }, 0);
      return typed({
        tid: 'data-table-total', category: '度数分布表', unitSuffix: '人',
        q: '記録を整理した表です。全部で何人いますか。\n' + table,
        answer: String(total),
        exp: '各階級の人数をすべてたします。合計 ' + total + '人。',
      });
    }
    return choice({
      tid: 'data-table-max', category: '度数分布表',
      q: '記録を整理した表です。人数がいちばん多い階級はどれですか。\n' + table,
      exp: '人数がいちばん多いのは ' + classes[mi] + '（' + freq[mi] + '人）です。',
    }, classes[mi], classes.filter(function (_, i) { return i !== mi; }));
  }

  // =====================================================================
  // U8 円の面積
  // =====================================================================
  function genCircleArea() {
    const t = ri(0, 2);
    if (t === 0) { // full circle from radius
      const r = ri(1, 12);
      const cents = 314 * r * r;
      return typed({
        tid: 'circ-area-r', category: '円の面積', unitSuffix: 'cm²',
        q: '半径 ' + r + 'cm の円の面積を求めましょう。円周率は 3.14 とします。',
        fig: circleFig('radius', '半径 ' + r + 'cm'),
        answer: fmt2(cents), accepted: [fmt2(cents)],
        exp: '円の面積＝半径×半径×3.14。' + r + '×' + r + '×3.14＝' + fmt2(cents) + 'cm²。',
      });
    }
    if (t === 1) { // full circle from diameter
      const r = ri(1, 10);
      const cents = 314 * r * r;
      return typed({
        tid: 'circ-area-d', category: '円の面積', unitSuffix: 'cm²',
        q: '直径 ' + (r * 2) + 'cm の円の面積を求めましょう。円周率は 3.14 とします。',
        fig: circleFig('diameter', '直径 ' + (r * 2) + 'cm'),
        answer: fmt2(cents), accepted: [fmt2(cents)],
        exp: '半径は直径の半分で ' + r + 'cm。' + r + '×' + r + '×3.14＝' + fmt2(cents) + 'cm²。',
      });
    }
    // semicircle (composite)
    const r = ri(2, 10);
    const cents = 157 * r * r; // 314*r*r / 2
    return typed({
      tid: 'circ-area-half', category: '円の面積（半円）', unitSuffix: 'cm²',
      q: '半径 ' + r + 'cm の半円の面積を求めましょう。円周率は 3.14 とします。',
      answer: fmt2(cents), accepted: [fmt2(cents)],
      exp: '円の面積の半分です。' + r + '×' + r + '×3.14÷2＝' + fmt2(cents) + 'cm²。',
    });
  }

  // =====================================================================
  // U9 角柱と円柱の体積
  // =====================================================================
  function genVolume() {
    const t = ri(0, 2);
    if (t === 0) { // rectangular prism
      const a = ri(2, 12), b = ri(2, 12), c = ri(2, 12);
      return typed({
        tid: 'vol-box', category: '直方体の体積', unitSuffix: 'cm³',
        q: 'たて ' + b + 'cm、横 ' + a + 'cm、高さ ' + c + 'cm の直方体の体積を求めましょう。',
        fig: boxFig('横' + a + 'cm', 'たて' + b + 'cm', '高さ' + c + 'cm'),
        answer: String(a * b * c),
        exp: '直方体の体積＝たて×横×高さ。底面積（' + a + '×' + b + '＝' + (a * b) + '）×高さ ' + c + '＝' + (a * b * c) + 'cm³。',
      });
    }
    if (t === 1) { // triangular prism
      const base = ri(3, 10) * 2, height = ri(2, 9), len = ri(3, 12);
      const baseArea = base * height / 2;
      return typed({
        tid: 'vol-tri-prism', category: '角柱の体積', unitSuffix: 'cm³',
        q: '底面が「底辺 ' + base + 'cm、高さ ' + height + 'cm」の三角形で、高さ（長さ）' + len + 'cm の三角柱の体積を求めましょう。',
        answer: String(baseArea * len),
        exp: '角柱の体積＝底面積×高さ。底面積＝' + base + '×' + height + '÷2＝' + baseArea + 'cm²。' + baseArea + '×' + len + '＝' + (baseArea * len) + 'cm³。',
      });
    }
    // cylinder
    const r = ri(2, 8), h = ri(2, 10);
    const cents = 314 * r * r * h;
    return typed({
      tid: 'vol-cylinder', category: '円柱の体積', unitSuffix: 'cm³',
      q: '底面の半径 ' + r + 'cm、高さ ' + h + 'cm の円柱の体積を求めましょう。円周率は 3.14 とします。',
      fig: cylinderFig('半径' + r + 'cm', '高さ' + h + 'cm'),
      answer: fmt2(cents), accepted: [fmt2(cents)],
      exp: '円柱の体積＝底面積×高さ。底面積＝' + r + '×' + r + '×3.14＝' + fmt2(314 * r * r) + 'cm²。×高さ ' + h + '＝' + fmt2(cents) + 'cm³。',
    });
  }

  // =====================================================================
  // U10 およその面積と体積
  // =====================================================================
  function genApprox() {
    const t = ri(0, 2);
    if (t === 0) { // grid method: full + partial/2
      const full = ri(6, 20), partial = ri(2, 10) * 2; // partial even
      const approx = full + partial / 2;
      return typed({
        tid: 'approx-grid', category: 'およその面積（方眼）', unitSuffix: 'cm²',
        q: '1辺1cmの方眼の上に、ある形をかきました。完全に中に入っているマスが ' + full + 'こ、線がかかっているマスが ' + partial + 'こあります。この形のおよその面積を求めましょう。（かかっているマスは半分と考えます）',
        answer: String(approx),
        exp: 'およその面積＝完全なマス＋かかっているマス÷2。' + full + '＋' + partial + '÷2＝' + full + '＋' + (partial / 2) + '＝' + approx + 'cm²。',
      });
    }
    if (t === 1) { // approximate lake/field as a rectangle
      const a = ri(2, 9), b = ri(2, 9);
      const th = pick(['池', '公園', '畑', '運動場']);
      return typed({
        tid: 'approx-rect', category: 'およその面積（長方形）', unitSuffix: 'm²',
        q: 'ある' + th + 'を、たて ' + a + 'm、横 ' + b + 'm のおよそ長方形とみます。およその面積を求めましょう。',
        answer: String(a * b),
        exp: '長方形とみて、たて×横で求めます。' + a + '×' + b + '＝' + (a * b) + 'm²。',
      });
    }
    // approximate volume as a box
    const a = ri(2, 8), b = ri(2, 8), c = ri(2, 6);
    const th = pick(['荷物', '石', '箱に入った品物']);
    return typed({
      tid: 'approx-box', category: 'およその体積', unitSuffix: 'cm³',
      q: 'ある' + th + 'を、たて ' + a + 'cm、横 ' + b + 'cm、高さ ' + c + 'cm のおよそ直方体とみます。およその体積を求めましょう。',
      answer: String(a * b * c),
      exp: '直方体とみて、たて×横×高さで求めます。' + a + '×' + b + '×' + c + '＝' + (a * b * c) + 'cm³。',
    });
  }

  // =====================================================================
  // U11 比例と反比例
  // =====================================================================
  function genProportion() {
    const t = ri(0, 3);
    if (t === 0) { // direct: find a, y=ax
      const a = ri(2, 9), x = ri(2, 9);
      return typed({
        tid: 'prop-a', category: '比例の式（きまった数）',
        q: 'y は x に比例し、x = ' + x + ' のとき y = ' + (a * x) + ' です。y を x を使った式 y = □×x で表すとき、□（きまった数）を求めましょう。',
        answer: String(a),
        exp: 'きまった数＝y÷x＝' + (a * x) + '÷' + x + '＝' + a + '。式は y ＝ ' + a + '×x。',
      });
    }
    if (t === 1) { // direct: find y for new x
      const a = ri(2, 8), x1 = ri(2, 6), x2 = ri(7, 12);
      return typed({
        tid: 'prop-y', category: '比例（yを求める）',
        q: 'y は x に比例し、x = ' + x1 + ' のとき y = ' + (a * x1) + ' です。x = ' + x2 + ' のときの y を求めましょう。',
        answer: String(a * x2),
        exp: 'きまった数は ' + (a * x1) + '÷' + x1 + '＝' + a + '。y＝' + a + '×' + x2 + '＝' + (a * x2) + '。',
      });
    }
    if (t === 2) { // inverse: find y
      const k = pick([12, 18, 24, 36, 48]);
      // pick x1, x2 that divide k
      const divs = [];
      for (let d = 1; d <= k; d++) if (k % d === 0 && d <= 12) divs.push(d);
      const x1 = pick(divs); let x2 = pick(divs); if (x2 === x1) x2 = pick(divs);
      if (x2 === x1) return genProportion();
      return typed({
        tid: 'inv-y', category: '反比例（yを求める）',
        q: 'y は x に反比例し、x = ' + x1 + ' のとき y = ' + (k / x1) + ' です。x = ' + x2 + ' のときの y を求めましょう。',
        answer: String(k / x2),
        exp: '反比例では x×y がきまった数。' + x1 + '×' + (k / x1) + '＝' + k + '。y＝' + k + '÷' + x2 + '＝' + (k / x2) + '。',
      });
    }
    // behavior (choice): how does y change?
    const inverse = Math.random() < 0.5;
    const mult = pick([2, 3, 4]);
    if (inverse) {
      const ansMap = { 2: '半分（1/2）になる', 3: '1/3になる', 4: '1/4になる' };
      return choice({
        tid: 'prop-behavior-inv', category: '反比例の性質',
        q: 'y が x に反比例するとき、x を ' + mult + '倍にすると y はどうなりますか。',
        exp: '反比例では、x を ' + mult + '倍すると y は ' + mult + '分の1になります。',
      }, ansMap[mult], [mult + '倍になる', '変わらない', (mult + 1) + '倍になる']);
    }
    return choice({
      tid: 'prop-behavior-dir', category: '比例の性質',
      q: 'y が x に比例するとき、x を ' + mult + '倍にすると y はどうなりますか。',
      exp: '比例では、x を ' + mult + '倍すると y も ' + mult + '倍になります。',
    }, mult + '倍になる', ['変わらない', mult + '分の1になる', '半分になる']);
  }

  // =====================================================================
  // U12 並べ方と組み合わせ方
  // =====================================================================
  function factorial(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
  function genCombinatorics() {
    const t = ri(0, 3);
    if (t === 0) { // arrangements in a row: k!
      const k = ri(3, 4);
      const people = shuffle(NAMES).slice(0, k);
      return typed({
        tid: 'comb-arrange', category: '並べ方（順列）', unitSuffix: '通り',
        q: people.join('・') + ' の ' + k + '人が1列にならびます。ならび方は全部で何通りありますか。',
        answer: String(factorial(k)),
        exp: '1番目は' + k + '通り、2番目は' + (k - 1) + '通り…と考えます。' +
          (k === 3 ? '3×2×1＝6通り' : '4×3×2×1＝24通り') + '。',
      });
    }
    if (t === 1) { // 2-digit numbers from n distinct nonzero digits: n×(n-1)
      const n = ri(3, 4);
      const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, n).sort(function (a, b) { return a - b; });
      return typed({
        tid: 'comb-2digit', category: '並べ方（整数づくり）', unitSuffix: '通り',
        q: digits.join('、') + ' の ' + n + 'まいのカードから2まいをならべて2けたの整数をつくります。整数は全部で何通りできますか。',
        answer: String(n * (n - 1)),
        exp: '十の位は' + n + '通り、一の位は残りの' + (n - 1) + '通り。' + n + '×' + (n - 1) + '＝' + (n * (n - 1)) + '通り。',
      });
    }
    if (t === 2) { // combinations choose 2 from n: n(n-1)/2 (round-robin / handshake)
      const n = ri(4, 6);
      const kind = pick(['試合', '対戦', 'あくしゅ']);
      const c = n * (n - 1) / 2;
      return typed({
        tid: 'comb-choose2', category: '組み合わせ方', unitSuffix: '通り',
        q: n + 'つのチームが、どのチームとも1回ずつ' + kind + 'をします。' + kind + 'は全部で何通りありますか。',
        answer: String(c),
        exp: '2チームの組み合わせを数えます。' + n + '×' + (n - 1) + '÷2＝' + c + '通り（じゅんは考えないので2でわります）。',
      });
    }
    // choose 2 from n where order matters (captain & vice): n×(n-1)
    const n = ri(3, 5);
    const c = n * (n - 1);
    return typed({
      tid: 'comb-ordered2', category: '選び方（順番あり）', unitSuffix: '通り',
      q: n + '人の中から、委員長と副委員長を1人ずつ選びます。選び方は全部で何通りありますか。',
      answer: String(c),
      exp: '委員長は' + n + '通り、副委員長は残りの' + (n - 1) + '通り。' + n + '×' + (n - 1) + '＝' + c + '通り。',
    });
  }

  // ---------- unit/section table ----------
  const UNITS = [
    { num: 1, key: 'u01_symmetry', title: '対称な図形', vol: '上', sections: [
      { id: 'u01-sym', title: '線対称・点対称と対称の軸', gen: genSymmetry, n: 10 },
    ]},
    { num: 2, key: 'u02_letters', title: '文字と式', vol: '上', sections: [
      { id: 'u02-letter', title: '文字を使った式と式の値', gen: genLetter, n: 10 },
    ]},
    { num: 3, key: 'u03_fraction_mul', title: '分数のかけ算', vol: '上', sections: [
      { id: 'u03-fmul', title: '分数×整数・÷整数・分数×分数・逆数', gen: genFracMul, n: 10 },
    ]},
    { num: 4, key: 'u04_fraction_div', title: '分数のわり算', vol: '上', sections: [
      { id: 'u04-fdiv', title: '分数÷分数と混じった計算', gen: genFracDiv, n: 10 },
    ]},
    { num: 5, key: 'u05_ratio', title: '比', vol: '上', sections: [
      { id: 'u05-ratio', title: '比の値・簡単な比・比で分ける', gen: genRatio, n: 10 },
    ]},
    { num: 6, key: 'u06_scale', title: '拡大図と縮図', vol: '上', sections: [
      { id: 'u06-scale', title: '拡大・縮小と縮尺', gen: genScale, n: 8 },
    ]},
    { num: 7, key: 'u07_data', title: 'データの調べ方', vol: '上', sections: [
      { id: 'u07-data', title: '平均・中央値・最頻値と度数分布表', gen: genData, n: 8 },
    ]},
    { num: 8, key: 'u08_circle_area', title: '円の面積', vol: '下', sections: [
      { id: 'u08-circ', title: '円と半円の面積', gen: genCircleArea, n: 8 },
    ]},
    { num: 9, key: 'u09_volume', title: '角柱と円柱の体積', vol: '下', sections: [
      { id: 'u09-vol', title: '角柱・円柱の体積', gen: genVolume, n: 8 },
    ]},
    { num: 10, key: 'u10_approx', title: 'およその面積と体積', vol: '下', sections: [
      { id: 'u10-approx', title: 'およその面積・体積', gen: genApprox, n: 8 },
    ]},
    { num: 11, key: 'u11_proportion', title: '比例と反比例', vol: '下', sections: [
      { id: 'u11-prop', title: '比例・反比例の式と性質', gen: genProportion, n: 10 },
    ]},
    { num: 12, key: 'u12_combinatorics', title: '並べ方と組み合わせ方', vol: '下', sections: [
      { id: 'u12-comb', title: '並べ方・組み合わせ方', gen: genCombinatorics, n: 8 },
    ]},
  ];

  // まとめ / 算数のしあげ (mixed review + capstone) — draws one problem from a
  // random unit's generator. Covers 13．算数のしあげ and ★算数卒業旅行 from the
  // textbook as mixed practice across every unit built above (per spec).
  const MIXED_POOL = [];
  UNITS.forEach(function (u) { u.sections.forEach(function (s) { MIXED_POOL.push(s.gen); }); });
  function genMatome() { return pick(MIXED_POOL)(); }
  UNITS.push({ num: 13, key: 'u13_review', title: '6年のまとめ（算数のしあげ）', vol: '下', sections: [
    { id: 'u13-matome', title: 'まとめテスト（全単元から）', gen: genMatome, n: 12 },
  ]});

  window.SANSU6_DATA = { UNITS };

  // Exposed for the stress test (node): lets the test enumerate every section's
  // generator without a browser. Harmless in the browser (just an extra prop).
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UNITS, _internals: { fracAns: fracAns, fmt2: fmt2, gcd: gcd, factorial: factorial } };
  }
})();
