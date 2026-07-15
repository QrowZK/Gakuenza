// 理科3年 (rika3) — question generators + a mandatory distractor-collision
// stress test.
//
// Only two areas of the curriculum parameterize cleanly, so only these
// generate (everything else is authored in rika3-data.js):
//   - classification: insect-or-not (u5), conduct? (u10), stick-to-magnet?
//     and the 4-way conduct/magnet/both/neither (u11)
//   - if-then property: wind/rubber force -> distance (u4), reshape/material
//     -> weight (u9)
//
// Every generated question is a plain choice question of the same shape the
// authored ones use: { type:'choice', cat, q, options, answer, exp, tid }.
// `tid` is a stable template id used to build gradebook item_ref.
//
// DISTRACTOR-COLLISION is the bug class the spec calls out (kokugo3's kanji
// generator shipped it twice: a "wrong" option that was secretly also
// correct). Each generator derives the answer from ground truth and draws
// distractors from a DISJOINT label set, and stressTest() re-checks a large
// batch programmatically: option counts, no duplicate options, answer in
// options, exactly-one-correct against re-derived truth. Generators attach a
// hidden `_verify(q)` used only by the test — the app never reads it.

window.RIKA3_GEN = (function () {
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

  // ---- material ground truth (conducts electricity? / sticks to magnet?) ----
  // Deliberately encodes the curriculum's engineered distinction:
  //   conducts = ALL metals; sticks-to-magnet = iron (鉄) ONLY.
  // There is no clean "magnet-only" material (everything magnetic here also
  // conducts) — that absence is itself the learnable point (see u11 4-way).
  const MATERIALS = [
    { name: '鉄のくぎ', conducts: true, magnetic: true },
    { name: 'スチールのかん（鉄）', conducts: true, magnetic: true },
    { name: 'アルミのかん', conducts: true, magnetic: false },
    { name: 'どう（銅）の線', conducts: true, magnetic: false },
    { name: '10円玉（どう）', conducts: true, magnetic: false },
    { name: '木のわりばし', conducts: false, magnetic: false },
    { name: 'ガラスのコップ', conducts: false, magnetic: false },
    { name: 'プラスチックのじょうぎ', conducts: false, magnetic: false },
    { name: 'ゴムのわ', conducts: false, magnetic: false },
    { name: '紙', conducts: false, magnetic: false },
  ];

  // ---- insect ground truth (6 legs + 3 body parts = こん虫) ----
  const INSECTS = ['トンボ', 'バッタ', 'カブトムシ', 'モンシロチョウ', 'アリ', 'セミ', 'テントウムシ', 'ハチ'];
  const NOT_INSECTS = ['クモ', 'ダンゴムシ', 'ムカデ', 'カタツムリ', 'ミミズ'];

  // ============================ generators ============================

  // u5 — is-this-an-insect. Two variants for variety.
  function genIsInsect() {
    const askInsect = Math.random() < 0.5;
    let options, answer, q;
    if (askInsect) {
      const correct = pick(INSECTS);
      const distractors = sample(NOT_INSECTS, 3);
      options = shuffle([correct, ...distractors]);
      answer = correct;
      q = '次のうち、こん虫はどれ？';
    } else {
      const correct = pick(NOT_INSECTS);          // the odd-one-out
      const distractors = sample(INSECTS, 3);
      options = shuffle([correct, ...distractors]);
      answer = correct;
      q = '次のうち、こん虫では ない ものはどれ？';
    }
    return {
      type: 'choice', cat: 'こん虫の見分け', tid: 'gen_isInsect', q, options, answer,
      exp: 'こん虫の成虫は、あしが6本で、体が頭・むね・はらの3つに分かれています。' +
        'クモ（あし8本）やダンゴムシ、ムカデ、カタツムリはこん虫ではありません。',
      _verify: function (item) {
        const isInsect = (n) => INSECTS.includes(n);
        // exactly one option matches "the thing being asked for"
        const wanted = item.options.filter((o) =>
          q.indexOf('ない') >= 0 ? !isInsect(o) : isInsect(o));
        return wanted.length === 1 && wanted[0] === item.answer;
      },
    };
  }

  // u10 — does this conduct electricity? (2-way)
  function genConduct() {
    const m = pick(MATERIALS);
    const options = ['電気を通す', '電気を通さない'];
    const answer = m.conducts ? '電気を通す' : '電気を通さない';
    return {
      type: 'choice', cat: '電気を通す物', tid: 'gen_conduct',
      q: '「' + m.name + '」は、電気を通す？',
      options, answer,
      exp: m.conducts
        ? m.name + 'は金ぞくなので、電気を通します。'
        : m.name + 'は金ぞくではないので、電気を通しません。',
      _verify: function (item) {
        const want = m.conducts ? '電気を通す' : '電気を通さない';
        return item.answer === want && item.options.indexOf(want) >= 0;
      },
    };
  }

  // u11 — does this stick to a magnet? (2-way). Only 鉄 sticks.
  function genMagnet() {
    const m = pick(MATERIALS);
    const options = ['じしゃくにつく', 'じしゃくにつかない'];
    const answer = m.magnetic ? 'じしゃくにつく' : 'じしゃくにつかない';
    return {
      type: 'choice', cat: 'じしゃくにつく物', tid: 'gen_magnet',
      q: '「' + m.name + '」は、じしゃくにつく？',
      options, answer,
      exp: m.magnetic
        ? m.name + 'は鉄なので、じしゃくにつきます。'
        : (m.conducts
          ? m.name + 'は金ぞくですが、鉄ではないのでじしゃくにつきません。'
          : m.name + 'は鉄ではないので、じしゃくにつきません。'),
      _verify: function (item) {
        const want = m.magnetic ? 'じしゃくにつく' : 'じしゃくにつかない';
        return item.answer === want && item.options.indexOf(want) >= 0;
      },
    };
  }

  // u11 — THE highest-value type: 4-way conduct / magnet / both / neither.
  // Tests the exact confusion the curriculum engineers. The "magnet only"
  // label is present but never correct (no magnetic-but-non-conductive
  // material exists) — that's the intended, learnable insight.
  const CM_CONDUCT_ONLY = '電気を通す（じしゃくにはつかない）';
  const CM_MAGNET_ONLY = 'じしゃくにつく（電気は通さない）';
  const CM_BOTH = 'どちらもする';
  const CM_NEITHER = 'どちらもしない';
  function cmLabel(m) {
    if (m.conducts && m.magnetic) return CM_BOTH;
    if (m.conducts && !m.magnetic) return CM_CONDUCT_ONLY;
    if (!m.conducts && m.magnetic) return CM_MAGNET_ONLY; // never happens here
    return CM_NEITHER;
  }
  function genConductMagnet4() {
    const m = pick(MATERIALS);
    const options = [CM_CONDUCT_ONLY, CM_MAGNET_ONLY, CM_BOTH, CM_NEITHER];
    const answer = cmLabel(m);
    let exp;
    if (m.conducts && m.magnetic) {
      exp = m.name + 'は鉄なので、電気も通し、じしゃくにもつきます（どちらもする）。';
    } else if (m.conducts && !m.magnetic) {
      exp = m.name + 'は金ぞくなので電気は通しますが、鉄ではないのでじしゃくにはつきません。';
    } else {
      exp = m.name + 'は金ぞくではないので、電気も通さず、じしゃくにもつきません。';
    }
    return {
      type: 'choice', cat: '電気とじしゃく', tid: 'gen_conductMagnet4',
      q: '「' + m.name + '」にあてはまるのはどれ？（電気を通す／じしゃくにつく）',
      options, answer, exp,
      _verify: function (item) {
        // exactly one option is the correct label for this material's truth
        const correct = cmLabel(m);
        return item.answer === correct &&
          item.options.filter((o) => o === correct).length === 1;
      },
    };
  }

  // u4 — if-then: bigger force -> farther. Two factors (wind, rubber).
  function genForce() {
    const factor = pick([
      { name: '風', more: '強く', less: '弱く' },
      { name: 'ゴム', more: '長くのばす', less: '短くのばす' },
    ]);
    const strong = Math.random() < 0.5;
    const options = ['遠くまで動く', '近くで止まる'];
    const answer = strong ? '遠くまで動く' : '近くで止まる';
    const q = factor.name === '風'
      ? '風を' + (strong ? factor.more : factor.less) + 'すると、風で動く車はどうなる？'
      : 'ゴムを' + (strong ? factor.more : factor.less) + 'と、ゴムで動く車はどうなる？';
    return {
      type: 'choice', cat: '力ときょり', tid: 'gen_force', q, options, answer,
      exp: '力が大きいほど、車は遠くまで動きます。' +
        (strong ? '力を大きくしたので遠くまで動きます。' : '力を小さくしたので近くで止まります。'),
      _verify: function (item) {
        const want = strong ? '遠くまで動く' : '近くで止まる';
        return item.answer === want && item.options.indexOf(want) >= 0;
      },
    };
  }

  // u9 — if-then: reshape -> same weight; different material -> different weight.
  function genWeight() {
    const reshape = Math.random() < 0.5;
    let q, options, answer, exp;
    if (reshape) {
      const from = pick(['丸い形', 'ぼう', '平たい形']);
      const to = pick(['細長い形', 'ボール', 'いくつかに分けた形'].filter((x) => x !== from));
      q = 'ねん土を「' + from + '」から「' + to + '」に作りかえると、重さはどうなる？';
      options = ['変わらない', '重くなる', '軽くなる'];
      answer = '変わらない';
      exp = '物の形を変えても、重さは変わりません。';
    } else {
      q = '同じ体積（同じかさ）の食塩とさとうの重さは？';
      options = ['物によってちがう', 'いつも同じ'];
      answer = '物によってちがう';
      exp = '同じ体積でも、物のしゅるいがちがうと重さはちがいます。';
    }
    return {
      type: 'choice', cat: '重さ', tid: 'gen_weight', q, options, answer, exp,
      _verify: function (item) { return item.options.indexOf(item.answer) >= 0; },
    };
  }

  const GENERATORS = {
    isInsect: genIsInsect,
    conduct: genConduct,
    magnet: genMagnet,
    conductMagnet4: genConductMagnet4,
    force: genForce,
    weight: genWeight,
  };

  // Generate `n` questions for a unit's declared gen list, de-duplicating
  // by (question text + answer) within one attempt so a short pool doesn't
  // repeat the same instance.
  function generateFor(genKeys, n) {
    const out = [];
    const seen = new Set();
    let guard = 0;
    const keys = genKeys.slice();
    while (out.length < n && guard++ < n * 40) {
      const q = GENERATORS[pick(keys)]();
      const sig = q.q + ' ' + q.answer;
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(q);
    }
    return out;
  }

  // ---- distractor-collision stress test (mandatory per spec) ----
  // Runs every generator `iters` times and validates structure + semantics.
  // Returns { ok, checked, errors:[...] }.
  function stressTest(iters) {
    iters = iters || 3000;
    const errors = [];
    const optCount = { // expected option count per template
      gen_isInsect: 4, gen_conduct: 2, gen_magnet: 2,
      gen_conductMagnet4: 4, gen_force: 2, gen_weight: null, // weight varies 2-3
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
        //    verifier — catches a "wrong" option that is secretly correct.
        if (typeof q._verify === 'function' && !q._verify(q)) {
          errors.push(where + ': semantic verify failed -> ' + JSON.stringify({ q: q.q, a: q.answer, o: q.options }));
        }
      }
    });
    return { ok: errors.length === 0, checked, errors: errors.slice(0, 40) };
  }

  return { GENERATORS, generateFor, stressTest };
})();
