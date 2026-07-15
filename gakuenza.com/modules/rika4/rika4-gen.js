// 理科4年 (rika4) — question generators + a mandatory distractor-collision
// stress test.
//
// Per the spec, the A-strand (物質・エネルギー) units parameterize cleanly into
// cause-effect / comparison questions, so those are what generate here; the
// B-strand (生命・地球) units are authored in rika4-data.js. Generators:
//   - current  (u04): series vs parallel battery → bulb/motor (comparison)
//   - compress (u08): enclosed air vs water → compressible? (classification)
//   - expand   (u09): air vs water vs metal → thermal expansion (comparison)
//   - heat     (u10): metal vs fluid → conduction vs convection (classification)
//
// Every generated question is a plain choice question of the same shape the
// authored ones use: { type:'choice', cat, q, options, answer, exp, tid }.
// `tid` is a stable template id used to build the gradebook item_ref.
//
// DISTRACTOR-COLLISION is the bug class the spec calls out (rika3's kanji-
// adjacent stroke-count generator shipped it twice: a "wrong" option that was
// secretly also correct). The shared-infra doc names the exact trap for A-strand
// science: a heat question where the distractor and the answer both happen to be
// good conductors. We avoid it structurally:
//   - every comparison generator derives its answer from a STRICT TOTAL ORDER
//     (空気 > 水 > 金属 for expansion; 直列2 > 1個 = へい列2 for brightness) so a
//     superlative/pairwise winner is provably unique;
//   - every classification generator maps each subject to exactly ONE label from
//     a DISJOINT label set (air→compressible/water→not; metal→conduction/
//     fluid→convection) so no distractor can secretly also be the answer.
// stressTest() re-checks a large batch programmatically: option counts, no
// duplicate options, answer present exactly once, and — via each generator's own
// `_verify(q)` — that exactly one option is correct against re-derived truth.
// The app never reads `_verify`; it exists only for the test.

window.RIKA4_GEN = (function () {
  'use strict';

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function sample(arr, n) { return shuffle(arr).slice(0, n); }

  // ---- u04: electric current — connection → brightness/speed ----------------
  // Strict total order of "how much current / how bright": 直列2個 is the unique
  // maximum; かん電池1個 and へい列2個 are equal and both below it. Encoding this
  // as numeric levels lets _verify prove a superlative winner is unique.
  const CONN = {
    one:      { label: 'かん電池1個',           level: 1 },
    series:   { label: 'かん電池2個の直列つなぎ', level: 2 },
    parallel: { label: 'かん電池2個のへい列つなぎ', level: 1 },
  };
  function genCurrent() {
    const device = pick([
      { name: '豆電球', bright: '明るく光る', more: '明るくなる', comp: '明るさ' },
      { name: 'モーター', bright: '速く回る', more: '速くなる', comp: '回る速さ' },
    ]);
    const variant = pick(['brightest', 'series', 'parallel']);

    if (variant === 'brightest') {
      // 3-way: which connection makes it brightest / fastest? Unique max = 直列.
      const opts = [CONN.one.label, CONN.series.label, CONN.parallel.label];
      const answer = CONN.series.label;
      return {
        type: 'choice', cat: '電流とつなぎ方', tid: 'gen_current',
        q: device.name + 'がいちばん' + device.bright + 'のは、どのつなぎ方？',
        options: opts, answer,
        exp: '直列つなぎにすると電流がいちばん大きくなるので、' + device.name +
          'は最も' + device.bright + '。へい列つなぎは1個のときと同じくらいです。',
        _verify: function (item) {
          const lv = { [CONN.one.label]: CONN.one.level,
            [CONN.series.label]: CONN.series.level,
            [CONN.parallel.label]: CONN.parallel.level };
          const max = Math.max.apply(null, item.options.map((o) => lv[o]));
          const winners = item.options.filter((o) => lv[o] === max);
          return winners.length === 1 && winners[0] === item.answer;
        },
      };
    }
    // series / parallel: compared with 1個, what happens?
    const isSeries = variant === 'series';
    const opts = [device.more, device.more === '明るくなる' ? '暗くなる' : 'おそくなる', '変わらない'];
    const answer = isSeries ? device.more : '変わらない';
    return {
      type: 'choice', cat: '電流とつなぎ方', tid: 'gen_current',
      q: 'かん電池2個を' + (isSeries ? '直列' : 'へい列') + 'つなぎにすると、1個のときとくらべて' +
        device.name + 'の' + device.comp + 'は？',
      options: opts, answer,
      exp: isSeries
        ? '直列つなぎは電流が大きくなるので、1個のときより' + device.more + '。'
        : 'へい列つなぎでは、' + device.comp + 'は1個のときとほとんど変わりません（長く使えるようになります）。',
      _verify: function (item) {
        const want = isSeries ? device.more : '変わらない';
        return item.answer === want &&
          item.options.filter((o) => o === want).length === 1;
      },
    };
  }

  // ---- u08: enclosed air vs water — compressible? ---------------------------
  // Disjoint truth: 空気 compresses, 水 does not. Two variants (体積 / できる?).
  const FLUIDS = [
    { name: '空気', compress: true },
    { name: '水', compress: false },
  ];
  function genCompress() {
    const f = pick(FLUIDS);
    const askVolume = Math.random() < 0.5;
    let options, answer, q, exp;
    if (askVolume) {
      q = 'つつにとじこめた「' + f.name + '」を、ぼうで強くおすと、体積はどうなる？';
      options = ['小さくなる', '変わらない'];
      answer = f.compress ? '小さくなる' : '変わらない';
      exp = f.compress
        ? '空気はおしちぢめられるので、おすと体積が小さくなります。'
        : '水はおしちぢめられないので、強くおしても体積は変わりません。';
    } else {
      q = 'とじこめた「' + f.name + '」は、おしちぢめることができる？';
      options = ['おしちぢめられる', 'おしちぢめられない'];
      answer = f.compress ? 'おしちぢめられる' : 'おしちぢめられない';
      exp = f.compress
        ? '空気はおしちぢめられ、手をはなすと元の体積にもどります。'
        : '水はおしちぢめられません。ここが空気とのちがいです。';
    }
    return {
      type: 'choice', cat: 'とじこめた空気と水', tid: 'gen_compress',
      q, options, answer, exp,
      _verify: function (item) {
        // Re-derive: air compresses, water doesn't; pick the matching label.
        const wantCompress = f.compress;
        const want = item.options.length === 2 && item.options.indexOf('小さくなる') >= 0
          ? (wantCompress ? '小さくなる' : '変わらない')
          : (wantCompress ? 'おしちぢめられる' : 'おしちぢめられない');
        return item.answer === want &&
          item.options.filter((o) => o === want).length === 1;
      },
    };
  }

  // ---- u09: thermal expansion — air vs water vs metal -----------------------
  // Strict total order of "how much体積 grows for the same温度上げ":
  //   空気(3) > 水(2) > 金属(1).  All three ranks distinct, so any superlative or
  // pairwise winner is provably unique (no "secretly also correct" distractor).
  const EXPAND_RANK = { '空気': 3, '水': 2, '金属': 1 };
  function genExpand() {
    const mode = pick(['most', 'least', 'pair']);
    if (mode === 'pair') {
      const two = sample(['空気', '水', '金属'], 2);
      const answer = EXPAND_RANK[two[0]] > EXPAND_RANK[two[1]] ? two[0] : two[1];
      return {
        type: 'choice', cat: '体積と温度', tid: 'gen_expand',
        q: '「' + two[0] + '」と「' + two[1] +
          '」を同じように熱したとき、体積のふえ方が大きいのはどっち？',
        options: shuffle(two.slice()), answer,
        exp: '同じように熱したときの体積のふえ方は、空気 ＞ 水 ＞ 金属 の順に大きくなります。',
        _verify: function (item) {
          const max = Math.max.apply(null, item.options.map((o) => EXPAND_RANK[o]));
          const winners = item.options.filter((o) => EXPAND_RANK[o] === max);
          return winners.length === 1 && winners[0] === item.answer;
        },
      };
    }
    const most = mode === 'most';
    const options = ['空気', '水', '金属'];
    const answer = most ? '空気' : '金属';
    return {
      type: 'choice', cat: '体積と温度', tid: 'gen_expand',
      q: '空気・水・金属を同じように熱したとき、体積のふえ方が最も' +
        (most ? '大きい' : '小さい') + 'のはどれ？',
      options: options.slice(), answer,
      exp: '体積のふえ方は、空気 ＞ 水 ＞ 金属 の順です。最も大きいのは空気、最も小さいのは金属です。',
      _verify: function (item) {
        const vals = item.options.map((o) => EXPAND_RANK[o]);
        const target = most ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
        const winners = item.options.filter((o) => EXPAND_RANK[o] === target);
        return winners.length === 1 && winners[0] === item.answer;
      },
    };
  }

  // ---- u10: heat transfer — conduction (metal) vs convection (fluid) --------
  // Disjoint truth: every metal subject → conduction; every fluid subject →
  // convection. The two mechanism labels are the only options, so a distractor
  // can never also be the answer (the exact heat-question collision the shared
  // infra doc warns about is avoided by construction).
  const COND = '熱した所から順に、全体へ伝わる';
  const CONV = 'あたためられた部分が上へ動いて、全体があたたまる';
  const HEAT_SUBJECTS = [
    { name: '金属のぼう', kind: 'metal' },
    { name: '鉄のフライパン', kind: 'metal' },
    { name: '銅の板', kind: 'metal' },
    { name: 'ビーカーの水', kind: 'fluid' },
    { name: 'なべの中の水', kind: 'fluid' },
    { name: '部屋の空気', kind: 'fluid' },
  ];
  function genHeat() {
    const s = pick(HEAT_SUBJECTS);
    const isMetal = s.kind === 'metal';
    const answer = isMetal ? COND : CONV;
    return {
      type: 'choice', cat: 'もののあたたまり方', tid: 'gen_heat',
      q: '「' + s.name + '」を熱すると、どのようにあたたまる？',
      options: shuffle([COND, CONV]), answer,
      exp: isMetal
        ? '金属は、熱した所から順に全体へ熱が伝わります（伝どう）。'
        : '水や空気は、あたためられた部分が上へ動いて、全体があたたまります（対流）。',
      _verify: function (item) {
        const want = s.kind === 'metal' ? COND : CONV;
        return item.answer === want &&
          item.options.filter((o) => o === want).length === 1 &&
          item.options.length === 2;
      },
    };
  }

  const GENERATORS = {
    current: genCurrent,
    compress: genCompress,
    expand: genExpand,
    heat: genHeat,
  };

  // Generate `n` questions for a unit's declared gen list, de-duplicating by
  // (question text + answer) within one attempt so a short pool doesn't repeat
  // the same instance.
  function generateFor(genKeys, n) {
    const out = [];
    const seen = new Set();
    let guard = 0;
    const keys = genKeys.slice();
    while (out.length < n && guard++ < n * 50) {
      const q = GENERATORS[pick(keys)]();
      const sig = q.q + ' ' + q.answer;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(q);
    }
    return out;
  }

  // ---- distractor-collision stress test (mandatory per spec) ----------------
  // Runs every generator `iters` times and validates structure + semantics.
  // Returns { ok, checked, errors:[...] }.
  function stressTest(iters) {
    iters = iters || 5000;
    const errors = [];
    const optCount = { // expected option count per template (null = varies)
      gen_current: 3, gen_compress: 2, gen_expand: null, gen_heat: 2,
    };
    let checked = 0;
    Object.keys(GENERATORS).forEach((key) => {
      for (let i = 0; i < iters; i++) {
        const q = GENERATORS[key]();
        checked++;
        const where = key + '#' + i;
        // 1. options is a non-trivial array
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push(where + ': options too few'); continue;
        }
        // 2. expected option count (when fixed)
        const want = optCount[q.tid];
        if (want && q.options.length !== want) {
          errors.push(where + ': expected ' + want + ' options, got ' + q.options.length);
        }
        // 3. no duplicate option text (surface-level distractor collision)
        if (new Set(q.options).size !== q.options.length) {
          errors.push(where + ': duplicate option text -> ' + JSON.stringify(q.options));
        }
        // 4. answer is present, exactly once
        const hits = q.options.filter((o) => o === q.answer).length;
        if (hits !== 1) {
          errors.push(where + ': answer appears ' + hits + ' times (expected 1)');
        }
        // 5. semantic collision: re-derive truth via the generator's own
        //    verifier — catches a "wrong" option that is secretly also correct.
        if (typeof q._verify === 'function' && !q._verify(q)) {
          errors.push(where + ': semantic verify failed -> ' +
            JSON.stringify({ q: q.q, a: q.answer, o: q.options }));
        }
      }
    });
    return { ok: errors.length === 0, checked, errors: errors.slice(0, 40) };
  }

  return { GENERATORS, generateFor, stressTest };
})();
