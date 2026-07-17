// 算数 1年 — Gakuenza module content & problem generators
// すべてオリジナル教材。東京書籍『新編 新しい算数1』(令和6年度版) の
// 単元構成に対応させているが、問題そのもの・数値・図版は一切転載していない。
// G1 なので、すべて ひらがな中心・小さい数で構成する。
//
// Each section has gen(): returns ONE problem object (same contract as
// sansu3–6):
//   {
//     tid,               // template id — stable per problem TYPE (item_ref)
//     category,          // gradebook analysis category (Japanese label)
//     q,                 // question text
//     fig,               // optional inner-HTML SVG figure
//     kind: 'typed' | 'choice',
//     answer,            // typed: canonical answer string
//     accepted,          // typed: accepted normalized forms
//     inputMode,         // typed: 'numeric' | 'text'
//     unitSuffix,        // typed: shown after the input box
//     choices,           // choice: option strings (already shuffled)
//     correctChoice,     // choice: correct option text
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
  // n distinct ints from lo..hi including `must`
  function distinctWith(must, lo, hi, n) {
    const s = new Set([must]);
    let guard = 0;
    while (s.size < n && guard++ < 300) s.add(ri(lo, hi));
    return shuffle(Array.from(s));
  }

  const NAMES = ['ゆい', 'はると', 'さくら', 'そうた', 'ひなた', 'りく', 'あおい', 'みお', 'いつき', 'こはる'];
  const THINGS = [
    { n: 'あめ', c: 'こ' }, { n: 'いちご', c: 'こ' }, { n: 'ドーナツ', c: 'こ' },
    { n: 'りんご', c: 'こ' }, { n: 'シール', c: 'まい' }, { n: 'カード', c: 'まい' },
    { n: 'えんぴつ', c: 'ほん' }, { n: 'とり', c: 'わ' }, { n: 'きんぎょ', c: 'ひき' },
  ];

  // ---------- SVG figure builders (all original drawings) ----------
  const SVG_OPEN = '<svg viewBox="0 0 %W% %H%" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif" role="img">';
  function svg(w, h, body) {
    return SVG_OPEN.replace('%W%', w).replace('%H%', h) + body + '</svg>';
  }

  // n round counters, laid out in rows of 5 (for counting 1..10)
  function dotsFig(n) {
    const per = 5, r = 15, gap = 40, x0 = 30, y0 = 30;
    const rows = Math.ceil(n / per);
    const W = x0 + per * gap, H = y0 + rows * gap;
    let body = '';
    for (let i = 0; i < n; i++) {
      const col = i % per, row = Math.floor(i / per);
      const cx = x0 + col * gap, cy = y0 + row * gap;
      body += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="#c9a24b" stroke="#34503a" stroke-width="2.5"/>';
    }
    return svg(W, H, body);
  }

  // a left-to-right row of labeled tiles (for ordinal position)
  function rowFig(items) {
    const tw = 62, th = 54, gap = 8, x0 = 46, y0 = 24;
    const W = x0 + items.length * (tw + gap) + 8, H = y0 + th + 26;
    // "まえ" marker on the left
    let body = '<text x="6" y="' + (y0 + th / 2 + 5) + '" font-size="14" font-weight="bold" fill="#b5572e">まえ</text>';
    items.forEach(function (it, i) {
      const x = x0 + i * (tw + gap);
      body += '<rect x="' + x + '" y="' + y0 + '" width="' + tw + '" height="' + th + '" rx="10" fill="#fffdf8" stroke="#4a6b4f" stroke-width="2.5"/>' +
        '<text x="' + (x + tw / 2) + '" y="' + (y0 + th / 2 + 6) + '" font-size="16" text-anchor="middle" fill="#1c2530">' + it + '</text>';
    });
    return svg(W, H, body);
  }

  // analog clock at h:m (G1 uses m = 0 or 30 only)
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

  // simple 2-D shape figure: 'tri' | 'sq' | 'circle'
  function shapeFig(kind) {
    if (kind === 'tri') {
      return svg(180, 150, '<polygon points="90,20 20,130 160,130" fill="#e8ede6" stroke="#4a6b4f" stroke-width="3"/>');
    }
    if (kind === 'sq') {
      return svg(180, 150, '<rect x="35" y="20" width="110" height="110" rx="4" fill="#e8ede6" stroke="#4a6b4f" stroke-width="3"/>');
    }
    return svg(180, 150, '<circle cx="90" cy="75" r="58" fill="#e8ede6" stroke="#4a6b4f" stroke-width="3"/>');
  }

  // ---------- answer form helpers ----------
  function typed(o) { o.kind = 'typed'; o.accepted = o.accepted || [o.answer]; o.inputMode = o.inputMode || 'numeric'; return o; }
  function choice(o, correct, wrongs) {
    o.kind = 'choice';
    o.correctChoice = String(correct);
    o.choices = shuffle([String(correct)].concat(wrongs.map(String)));
    return o;
  }

  // ---------- U1 10までのかず ----------
  function genTo10() {
    const t = ri(0, 3);
    if (t === 0) { // count the dots
      const n = ri(1, 10);
      return typed({
        tid: 'to10-count', category: 'かずをかぞえる',
        q: '○は いくつ ありますか。かずを かきましょう。',
        fig: dotsFig(n),
        answer: String(n),
        exp: '1つずつ かぞえると ' + n + 'こ です。',
      });
    }
    if (t === 1) { // next number
      const a = ri(0, 9);
      return typed({
        tid: 'to10-next', category: 'つぎのかず・まえのかず',
        q: a + ' の つぎの かずは いくつですか。',
        answer: String(a + 1),
        exp: a + ' の つぎは ' + (a + 1) + ' です。1 大きい かずです。',
      });
    }
    if (t === 2) { // previous number
      const a = ri(1, 10);
      return typed({
        tid: 'to10-prev', category: 'つぎのかず・まえのかず',
        q: a + ' の まえの かずは いくつですか。',
        answer: String(a - 1),
        exp: a + ' の まえは ' + (a - 1) + ' です。1 小さい かずです。',
      });
    }
    // compare (no ties)
    let a = ri(1, 10), b = ri(1, 10);
    while (b === a) b = ri(1, 10);
    const bigger = Math.max(a, b);
    return choice({
      tid: 'to10-compare', category: 'かずのおおきさ',
      q: a + ' と ' + b + ' では、どちらが おおきいですか。',
      exp: 'かずの せんで みぎに ある ほうが おおきい かずです。' + bigger + ' の ほうが おおきいです。',
    }, String(bigger), [String(Math.min(a, b))]);
  }

  // ---------- U2 なんばんめ ----------
  const ANIMALS = ['いぬ', 'ねこ', 'うさぎ', 'ぞう', 'きつね', 'くま', 'ぱんだ', 'りす'];
  function genOrdinal() {
    const items = shuffle(ANIMALS).slice(0, 5);
    const t = ri(0, 2);
    if (t === 0) { // from front -> which
      const pos = ri(1, 5);
      const ans = items[pos - 1];
      return choice({
        tid: 'ord-front', category: 'まえからなんばんめ',
        q: 'まえ（ひだり）から ' + pos + 'ばんめの どうぶつは どれですか。',
        fig: rowFig(items),
        exp: 'ひだりから じゅんに 1、2、… と かぞえます。' + pos + 'ばんめは 「' + ans + '」です。',
      }, ans, items.filter(function (x) { return x !== ans; }).slice(0, 3));
    }
    if (t === 1) { // from back -> which
      const pos = ri(1, 5);
      const ans = items[items.length - pos];
      return choice({
        tid: 'ord-back', category: 'うしろからなんばんめ',
        q: 'うしろ（みぎ）から ' + pos + 'ばんめの どうぶつは どれですか。',
        fig: rowFig(items),
        exp: 'みぎから じゅんに 1、2、… と かぞえます。' + pos + 'ばんめは 「' + ans + '」です。',
      }, ans, items.filter(function (x) { return x !== ans; }).slice(0, 3));
    }
    // which position (from front), typed number
    const idx = ri(0, 4);
    return typed({
      tid: 'ord-which', category: 'なんばんめかをこたえる',
      q: '「' + items[idx] + '」は まえ（ひだり）から なんばんめですか。すうじで かきましょう。',
      fig: rowFig(items),
      answer: String(idx + 1),
      exp: 'ひだりから かぞえると 「' + items[idx] + '」は ' + (idx + 1) + 'ばんめです。',
    });
  }

  // ---------- U3 いくつといくつ ----------
  function genCompose() {
    const t = ri(0, 2);
    if (t === 0) { // total は a と □
      const total = ri(5, 10), a = ri(1, total - 1);
      return typed({
        tid: 'comp-right', category: 'いくつといくつ',
        q: '□に あてはまる かずを かきましょう。　' + total + ' は ' + a + ' と □',
        answer: String(total - a),
        exp: total + ' を ' + a + ' と □ に わけます。' + a + ' と ' + (total - a) + ' で ' + total + ' です。',
      });
    }
    if (t === 1) { // total は □ と b
      const total = ri(5, 10), b = ri(1, total - 1);
      return typed({
        tid: 'comp-left', category: 'いくつといくつ',
        q: '□に あてはまる かずを かきましょう。　' + total + ' は □ と ' + b,
        answer: String(total - b),
        exp: (total - b) + ' と ' + b + ' で ' + total + ' です。',
      });
    }
    // a と b で いくつ
    const total = ri(5, 10), a = ri(1, total - 1), b = total - a;
    return typed({
      tid: 'comp-make', category: 'あわせていくつ',
      q: a + ' と ' + b + ' で いくつですか。',
      answer: String(total),
      exp: a + ' と ' + b + ' を あわせると ' + total + ' です。',
    });
  }

  // ---------- U4 たしざん(1) — くり上がりなし ----------
  function genAdd1() {
    const t = ri(0, 1);
    if (t === 0) {
      let a = ri(0, 9), b = ri(0, 9 - a); // sum <= 9, no carry
      if (Math.random() < 0.15) { a = ri(1, 5); b = 0; } // include +0
      return typed({
        tid: 'add1-calc', category: 'たしざん（くり上がりなし）',
        q: a + ' + ' + b + ' は いくつですか。',
        answer: String(a + b),
        exp: a + ' に ' + b + ' を たすと ' + (a + b) + ' です。',
      });
    }
    const th = pick(THINGS), name = pick(NAMES);
    const a = ri(1, 6), b = ri(1, 9 - a);
    return typed({
      tid: 'add1-word', category: 'たしざんのぶんしょうだい', unitSuffix: th.c,
      q: name + 'さんは ' + th.n + 'を ' + a + th.c + ' もっています。あとから ' + b + th.c + ' もらいました。ぜんぶで なん' + th.c + 'に なりますか。',
      answer: String(a + b),
      exp: 'しきは ' + a + ' + ' + b + ' = ' + (a + b) + ' です。',
    });
  }

  // ---------- U5 ひきざん(1) — くり下がりなし ----------
  function genSub1() {
    const t = ri(0, 1);
    if (t === 0) {
      const a = ri(2, 10), b = ri(0, a);
      return typed({
        tid: 'sub1-calc', category: 'ひきざん（くり下がりなし）',
        q: a + ' − ' + b + ' は いくつですか。',
        answer: String(a - b),
        exp: a + ' から ' + b + ' を ひくと ' + (a - b) + ' です。',
      });
    }
    const th = pick(THINGS), name = pick(NAMES);
    const a = ri(4, 10), b = ri(1, a - 1);
    const remain = Math.random() < 0.5;
    return typed({
      tid: 'sub1-word', category: 'ひきざんのぶんしょうだい', unitSuffix: th.c,
      q: remain
        ? th.n + 'が ' + a + th.c + ' あります。' + b + th.c + ' たべました。のこりは なん' + th.c + 'ですか。'
        : 'あかい ' + th.n + 'が ' + a + th.c + '、しろい ' + th.n + 'が ' + b + th.c + ' あります。ちがいは なん' + th.c + 'ですか。',
      answer: String(a - b),
      exp: 'しきは ' + a + ' − ' + b + ' = ' + (a - b) + ' です。',
    });
  }

  // ---------- U6 20までのかず ----------
  function genTo20() {
    const t = ri(0, 4);
    if (t === 0) { // 10 と a で
      const a = ri(1, 9);
      return typed({
        tid: 'to20-make', category: '10といくつ',
        q: '10 と ' + a + ' で いくつですか。',
        answer: String(10 + a),
        exp: '10 と ' + a + ' で ' + (10 + a) + ' です。',
      });
    }
    if (t === 1) { // n は 10 と □
      const n = ri(11, 19);
      return typed({
        tid: 'to20-split', category: '10といくつ',
        q: '□に あてはまる かずを かきましょう。　' + n + ' は 10 と □',
        answer: String(n - 10),
        exp: n + ' は 10 と ' + (n - 10) + ' に わけられます。',
      });
    }
    if (t === 2) { // next
      const a = ri(10, 19);
      return typed({
        tid: 'to20-next', category: 'つぎのかず・まえのかず',
        q: a + ' の つぎの かずは いくつですか。',
        answer: String(a + 1),
        exp: a + ' の つぎは ' + (a + 1) + ' です。',
      });
    }
    if (t === 3) { // add/sub within 20, no regroup
      const add = Math.random() < 0.5;
      if (add) {
        const a = ri(11, 15), b = ri(1, 19 - a);
        return typed({
          tid: 'to20-add', category: '20までのたしざん・ひきざん',
          q: a + ' + ' + b + ' は いくつですか。',
          answer: String(a + b),
          exp: a + ' に ' + b + ' を たすと ' + (a + b) + ' です。',
        });
      }
      const a = ri(12, 19), b = ri(1, a - 10);
      return typed({
        tid: 'to20-sub', category: '20までのたしざん・ひきざん',
        q: a + ' − ' + b + ' は いくつですか。',
        answer: String(a - b),
        exp: a + ' から ' + b + ' を ひくと ' + (a - b) + ' です。',
      });
    }
    // compare (no ties)
    let a = ri(11, 20), b = ri(11, 20);
    while (b === a) b = ri(11, 20);
    const bigger = Math.max(a, b);
    return choice({
      tid: 'to20-compare', category: 'かずのおおきさ',
      q: a + ' と ' + b + ' では、どちらが おおきいですか。',
      exp: bigger + ' の ほうが おおきい かずです。',
    }, String(bigger), [String(Math.min(a, b))]);
  }

  // ---------- U7 なんじ・なんじはん ----------
  function genClock() {
    const half = Math.random() < 0.5;
    const h = ri(1, 12);
    if (!half) { // o'clock
      const ans = h + 'じ';
      const nextH = (h % 12) + 1;
      const wrongs = [nextH + 'じ', h + 'じはん', nextH + 'じはん'];
      return choice({
        tid: 'clock-oclock', category: 'なんじ',
        q: 'とけいは なんじですか。',
        fig: clockFig(h, 0),
        exp: 'みじかい はりが ' + h + '、ながい はりが 12 を さして いるので ' + h + 'じ です。',
      }, ans, wrongs);
    }
    // half past
    const ans = h + 'じはん';
    const nextH = (h % 12) + 1;
    const wrongs = [h + 'じ', nextH + 'じはん', nextH + 'じ'];
    return choice({
      tid: 'clock-half', category: 'なんじはん',
      q: 'とけいは なんじですか。',
      fig: clockFig(h, 30),
      exp: 'ながい はりが 6 を さして いるので 「はん」。みじかい はりは ' + h + ' と ' + nextH + ' の あいだなので ' + h + 'じはん です。',
    }, ans, wrongs);
  }

  // ---------- U8 3つのかずのけいさん ----------
  function genThreeTerms() {
    const t = ri(0, 3);
    if (t === 0) { // a + b + c
      let a = ri(1, 5), b = ri(1, 5), c = ri(1, 5);
      while (a + b + c > 10) { a = ri(1, 5); b = ri(1, 4); c = ri(1, 3); }
      return typed({
        tid: 'three-aabb', category: '3つのかずのたしざん',
        q: a + ' + ' + b + ' + ' + c + ' は いくつですか。',
        answer: String(a + b + c),
        exp: 'まえから じゅんに。' + a + ' + ' + b + ' = ' + (a + b) + '、' + (a + b) + ' + ' + c + ' = ' + (a + b + c) + ' です。',
      });
    }
    if (t === 1) { // a - b - c
      let a = ri(6, 10), b = ri(1, 4), c = ri(1, a - b - 0);
      if (a - b - c < 0) c = ri(1, Math.max(1, a - b));
      return typed({
        tid: 'three-subsub', category: '3つのかずのひきざん',
        q: a + ' − ' + b + ' − ' + c + ' は いくつですか。',
        answer: String(a - b - c),
        exp: 'まえから じゅんに。' + a + ' − ' + b + ' = ' + (a - b) + '、' + (a - b) + ' − ' + c + ' = ' + (a - b - c) + ' です。',
      });
    }
    if (t === 2) { // a + b - c
      let a = ri(1, 5), b = ri(1, 5);
      while (a + b > 10) { a = ri(1, 5); b = ri(1, 5); }
      const c = ri(1, a + b);
      return typed({
        tid: 'three-addsub', category: 'たしてひく',
        q: a + ' + ' + b + ' − ' + c + ' は いくつですか。',
        answer: String(a + b - c),
        exp: a + ' + ' + b + ' = ' + (a + b) + '、' + (a + b) + ' − ' + c + ' = ' + (a + b - c) + ' です。',
      });
    }
    // a - b + c
    const a = ri(4, 9), b = ri(1, a);
    let c = ri(1, 5);
    while (a - b + c > 10) c = ri(1, 5);
    return typed({
      tid: 'three-subadd', category: 'ひいてたす',
      q: a + ' − ' + b + ' + ' + c + ' は いくつですか。',
      answer: String(a - b + c),
      exp: a + ' − ' + b + ' = ' + (a - b) + '、' + (a - b) + ' + ' + c + ' = ' + (a - b + c) + ' です。',
    });
  }

  // ---------- U9 たしざん(2) — くり上がり ----------
  function genAdd2() {
    const t = ri(0, 1);
    // ones sum must exceed 10 -> carry. a,b single digit, sum 11..18
    let a = ri(2, 9), b = ri(2, 9);
    while (a + b < 11) { a = ri(2, 9); b = ri(2, 9); }
    if (t === 0) {
      return typed({
        tid: 'add2-calc', category: 'たしざん（くり上がり）',
        q: a + ' + ' + b + ' は いくつですか。',
        answer: String(a + b),
        exp: a + ' に ' + (10 - a) + ' を たして 10、のこり ' + (b - (10 - a)) + ' を たして ' + (a + b) + ' です（さくらんぼけいさん）。',
      });
    }
    const th = pick(THINGS), name = pick(NAMES);
    return typed({
      tid: 'add2-word', category: 'たしざん（くり上がり）のぶんしょうだい', unitSuffix: th.c,
      q: name + 'さんは ' + th.n + 'を ' + a + th.c + ' もっています。' + b + th.c + ' もらいました。ぜんぶで なん' + th.c + 'ですか。',
      answer: String(a + b),
      exp: 'しきは ' + a + ' + ' + b + ' = ' + (a + b) + ' です。',
    });
  }

  // ---------- U10 ひきざん(2) — くり下がり ----------
  function genSub2() {
    const t = ri(0, 1);
    // minuend 11..18, subtrahend single digit, ones(minuend) < subtrahend -> borrow
    let a = ri(11, 18), b = ri(2, 9);
    while (!((a % 10) < b && a - b >= 0 && a - b <= 9)) { a = ri(11, 18); b = ri(2, 9); }
    if (t === 0) {
      return typed({
        tid: 'sub2-calc', category: 'ひきざん（くり下がり）',
        q: a + ' − ' + b + ' は いくつですか。',
        answer: String(a - b),
        exp: a + ' を 10 と ' + (a - 10) + ' に わけ、10 − ' + b + ' = ' + (10 - b) + '、' + (10 - b) + ' + ' + (a - 10) + ' = ' + (a - b) + ' です。',
      });
    }
    const th = pick(THINGS);
    return typed({
      tid: 'sub2-word', category: 'ひきざん（くり下がり）のぶんしょうだい', unitSuffix: th.c,
      q: th.n + 'が ' + a + th.c + ' あります。' + b + th.c + ' つかいました。のこりは なん' + th.c + 'ですか。',
      answer: String(a - b),
      exp: 'しきは ' + a + ' − ' + b + ' = ' + (a - b) + ' です。',
    });
  }

  // ---------- U11 大きいかず（100までのかず） ----------
  function genTo100() {
    const t = ri(0, 4);
    if (t === 0) { // 10が a こ と 1が b こ で
      const a = ri(2, 9), b = ri(1, 9);
      return typed({
        tid: 'to100-compose', category: 'なん十となんいくつ',
        q: '10が ' + a + 'こ と 1が ' + b + 'こ で いくつですか。',
        answer: String(a * 10 + b),
        exp: '10が ' + a + 'こ で ' + (a * 10) + '、それと ' + b + ' で ' + (a * 10 + b) + ' です。',
      });
    }
    if (t === 1) { // n は 10が □ こ と 1が c こ
      const a = ri(2, 9), b = ri(1, 9), n = a * 10 + b;
      return typed({
        tid: 'to100-tens', category: 'くらい（十のくらい）',
        q: '□に あてはまる かずを かきましょう。　' + n + ' は 10が □こ と 1が ' + b + 'こ',
        answer: String(a),
        exp: n + ' の 十のくらいは ' + a + ' なので、10が ' + a + 'こ です。',
      });
    }
    if (t === 2) { // 10が a こ で
      const a = ri(2, 10);
      return typed({
        tid: 'to100-tensonly', category: 'なん十',
        q: '10が ' + a + 'こ で いくつですか。',
        answer: String(a * 10),
        exp: '10が ' + a + 'こ で ' + (a * 10) + ' です。',
      });
    }
    if (t === 3) { // next ten / next number near boundary
      const a = ri(5, 9) * 10;
      return typed({
        tid: 'to100-nextten', category: 'かずのならび',
        q: a + ' より 10 おおきい かずは いくつですか。',
        answer: String(a + 10),
        exp: a + ' より 10 おおきい かずは ' + (a + 10) + ' です。',
      });
    }
    // compare (no ties)
    let a = ri(20, 99), b = ri(20, 99);
    while (b === a) b = ri(20, 99);
    const bigger = Math.max(a, b);
    return choice({
      tid: 'to100-compare', category: 'かずのおおきさ',
      q: a + ' と ' + b + ' では、どちらが おおきいですか。',
      exp: '十のくらいから くらべます。' + bigger + ' の ほうが おおきいです。',
    }, String(bigger), [String(Math.min(a, b))]);
  }

  // ---------- U12 たしざんとひきざん（2けた±1けた・なん十） ----------
  function genAddSub2Digit() {
    const t = ri(0, 3);
    if (t === 0) { // 何十 + 何十
      const a = ri(2, 7) * 10, b = ri(1, 9 - a / 10) * 10;
      return typed({
        tid: 'as2-tens-add', category: 'なん十のたしざん',
        q: a + ' + ' + b + ' は いくつですか。',
        answer: String(a + b),
        exp: '10の まとまりで かんがえます。' + (a / 10) + ' + ' + (b / 10) + ' = ' + (a / 10 + b / 10) + ' なので ' + (a + b) + ' です。',
      });
    }
    if (t === 1) { // 何十 − 何十
      const a = ri(3, 9) * 10, b = ri(1, a / 10 - 1) * 10;
      return typed({
        tid: 'as2-tens-sub', category: 'なん十のひきざん',
        q: a + ' − ' + b + ' は いくつですか。',
        answer: String(a - b),
        exp: '10の まとまりで かんがえます。' + (a / 10) + ' − ' + (b / 10) + ' = ' + (a / 10 - b / 10) + ' なので ' + (a - b) + ' です。',
      });
    }
    if (t === 2) { // 2digit + 1digit, no regroup
      const tens = ri(2, 9) * 10, ones = ri(1, 4), add = ri(1, 9 - ones);
      const a = tens + ones;
      return typed({
        tid: 'as2-add', category: '2けた＋1けた（くり上がりなし）',
        q: a + ' + ' + add + ' は いくつですか。',
        answer: String(a + add),
        exp: '一のくらいだけ たします。' + ones + ' + ' + add + ' = ' + (ones + add) + ' なので ' + (a + add) + ' です。',
      });
    }
    // 2digit - 1digit, no regroup
    const tens = ri(2, 9) * 10, ones = ri(5, 9), sub = ri(1, ones);
    const a = tens + ones;
    return typed({
      tid: 'as2-sub', category: '2けた−1けた（くり下がりなし）',
      q: a + ' − ' + sub + ' は いくつですか。',
      answer: String(a - sub),
      exp: '一のくらいだけ ひきます。' + ones + ' − ' + sub + ' = ' + (ones - sub) + ' なので ' + (a - sub) + ' です。',
    });
  }

  // ---------- U13 どちらがながい／おおい／ひろい ----------
  function genCompare() {
    const kind = ri(0, 2);
    if (kind === 0) { // ながい (length)
      const items = shuffle([['えんぴつ'], ['クレヨン'], ['ストロー'], ['はブラシ']]).slice(0, 2).map(function (x) { return x[0]; });
      let a = ri(6, 16), b = ri(6, 16);
      while (b === a) b = ri(6, 16);
      const longer = a > b ? items[0] : items[1];
      return choice({
        tid: 'cmp-length', category: 'ながさくらべ',
        q: items[0] + 'は ' + a + 'cm、' + items[1] + 'は ' + b + 'cm です。ながいのは どちらですか。',
        exp: 'かずが おおきい ほうが ながいです。' + Math.max(a, b) + 'cm の 「' + longer + '」です。',
      }, longer, [a > b ? items[1] : items[0]]);
    }
    if (kind === 1) { // おおい (volume, cups)
      const items = shuffle([['あかい ボトル'], ['あおい ボトル'], ['きいろい ボトル']]).slice(0, 2).map(function (x) { return x[0]; });
      let a = ri(3, 12), b = ri(3, 12);
      while (b === a) b = ri(3, 12);
      const more = a > b ? items[0] : items[1];
      return choice({
        tid: 'cmp-volume', category: 'かさくらべ',
        q: items[0] + 'は コップ ' + a + 'ぱいぶん、' + items[1] + 'は コップ ' + b + 'はいぶん の 水が はいります。水が おおく はいるのは どちらですか。',
        exp: 'コップの かずが おおい ほうが たくさん はいります。「' + more + '」です。',
      }, more, [a > b ? items[1] : items[0]]);
    }
    // ひろい (area, squares)
    const items = shuffle([['あかい 紙'], ['あおい 紙'], ['みどりの 紙']]).slice(0, 2).map(function (x) { return x[0]; });
    let a = ri(6, 20), b = ri(6, 20);
    while (b === a) b = ri(6, 20);
    const wider = a > b ? items[0] : items[1];
    return choice({
      tid: 'cmp-area', category: 'ひろさくらべ',
      q: items[0] + 'は ますが ' + a + 'こぶん、' + items[1] + 'は ますが ' + b + 'こぶん あります。ひろいのは どちらですか。',
      exp: 'ますの かずが おおい ほうが ひろいです。「' + wider + '」です。',
    }, wider, [a > b ? items[1] : items[0]]);
  }

  // ---------- U14 かたちづくり・いろいろなかたち ----------
  const SOLID_OBJECTS = [
    { obj: 'サイコロ', cat: 'はこの かたち' },
    { obj: 'ティッシュの はこ', cat: 'はこの かたち' },
    { obj: 'つみき（しかくい）', cat: 'はこの かたち' },
    { obj: 'かんジュース', cat: 'つつの かたち' },
    { obj: 'ラップの しん', cat: 'つつの かたち' },
    { obj: 'まきずし', cat: 'つつの かたち' },
    { obj: 'ボール', cat: 'ボールの かたち' },
    { obj: 'ビーだま', cat: 'ボールの かたち' },
    { obj: 'みかん', cat: 'ボールの かたち' },
  ];
  const SOLID_CATS = ['はこの かたち', 'つつの かたち', 'ボールの かたち'];
  const SHAPE2D = [
    { kind: 'tri', name: 'さんかく', corners: 3 },
    { kind: 'sq', name: 'しかく', corners: 4 },
    { kind: 'circle', name: 'まる', corners: 0 },
  ];
  function genShapes() {
    const t = ri(0, 2);
    if (t === 0) { // real object -> solid category
      const it = pick(SOLID_OBJECTS);
      return choice({
        tid: 'shape-solid', category: 'いろいろなかたち',
        q: '「' + it.obj + '」は どの かたちの なかまですか。',
        exp: '「' + it.obj + '」は 「' + it.cat + '」の なかまです。',
      }, it.cat, SOLID_CATS.filter(function (c) { return c !== it.cat; }));
    }
    if (t === 1) { // shape figure -> name
      const s = pick(SHAPE2D);
      return choice({
        tid: 'shape-name', category: 'かたちのなまえ',
        q: 'この かたちの なまえは どれですか。',
        fig: shapeFig(s.kind),
        exp: 'これは 「' + s.name + '」です。',
      }, s.name, SHAPE2D.filter(function (x) { return x.name !== s.name; }).map(function (x) { return x.name; }));
    }
    // corners -> name (unique: 3->さんかく, 4->しかく)
    const s = pick([SHAPE2D[0], SHAPE2D[1]]);
    return choice({
      tid: 'shape-corners', category: 'かどのかず',
      q: 'かどが ' + s.corners + 'つ、へんが ' + s.corners + 'つ ある かたちは どれですか。',
      exp: 'かどが ' + s.corners + 'つ ある かたちは 「' + s.name + '」です。',
    }, s.name, SHAPE2D.filter(function (x) { return x.name !== s.name; }).map(function (x) { return x.name; }));
  }

  // ---------- unit/section table ----------
  const UNITS = [
    { num: 1, key: 'u01_to10', title: '10までのかず', vol: '上', sections: [
      { id: 'u01-to10', title: '10までの かずを かぞえよう', gen: genTo10, n: 10 },
    ]},
    { num: 2, key: 'u02_ordinal', title: 'なんばんめ', vol: '上', sections: [
      { id: 'u02-ordinal', title: 'まえから なんばんめ', gen: genOrdinal, n: 8 },
    ]},
    { num: 3, key: 'u03_compose', title: 'いくつといくつ', vol: '上', sections: [
      { id: 'u03-compose', title: 'いくつと いくつ', gen: genCompose, n: 10 },
    ]},
    { num: 4, key: 'u04_add1', title: 'たしざん(1)', vol: '上', sections: [
      { id: 'u04-add1', title: 'たしざん（くり上がりなし）', gen: genAdd1, n: 10 },
    ]},
    { num: 5, key: 'u05_sub1', title: 'ひきざん(1)', vol: '上', sections: [
      { id: 'u05-sub1', title: 'ひきざん（くり下がりなし）', gen: genSub1, n: 10 },
    ]},
    { num: 6, key: 'u06_to20', title: '20までのかず', vol: '上', sections: [
      { id: 'u06-to20', title: '20までの かず', gen: genTo20, n: 10 },
    ]},
    { num: 7, key: 'u07_clock', title: 'なんじ・なんじはん', vol: '上', sections: [
      { id: 'u07-clock', title: 'とけいを よもう', gen: genClock, n: 8 },
    ]},
    { num: 8, key: 'u08_three_terms', title: '3つのかずのけいさん', vol: '上', sections: [
      { id: 'u08-three', title: '3つの かずの けいさん', gen: genThreeTerms, n: 10 },
    ]},
    { num: 9, key: 'u09_add2', title: 'たしざん(2)', vol: '下', sections: [
      { id: 'u09-add2', title: 'たしざん（くり上がり）', gen: genAdd2, n: 10 },
    ]},
    { num: 10, key: 'u10_sub2', title: 'ひきざん(2)', vol: '下', sections: [
      { id: 'u10-sub2', title: 'ひきざん（くり下がり）', gen: genSub2, n: 10 },
    ]},
    { num: 11, key: 'u11_to100', title: '大きいかず', vol: '下', sections: [
      { id: 'u11-to100', title: '100までの かず', gen: genTo100, n: 10 },
    ]},
    { num: 12, key: 'u12_addsub2digit', title: 'たしざんとひきざん', vol: '下', sections: [
      { id: 'u12-addsub', title: '2けたの たしざん・ひきざん', gen: genAddSub2Digit, n: 10 },
    ]},
    { num: 13, key: 'u13_compare', title: 'どちらがながい・おおい・ひろい', vol: '下', sections: [
      { id: 'u13-compare', title: 'くらべかた', gen: genCompare, n: 8 },
    ]},
    { num: 14, key: 'u14_shapes', title: 'かたちづくり・いろいろなかたち', vol: '下', sections: [
      { id: 'u14-shapes', title: 'いろいろな かたち', gen: genShapes, n: 8 },
    ]},
  ];

  window.SANSU1_DATA = { UNITS };
})();
