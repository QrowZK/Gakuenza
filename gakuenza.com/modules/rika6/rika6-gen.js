// 理科6年 (rika6) — question generators + a mandatory distractor-collision
// stress test.
//
// The A-strand (物質・エネルギー) units parameterize cleanly, and grade 6 adds a
// brand-new mechanical-physics shape the earlier rika modules don't have:
//   - lever     (u08): 実験用てこ balance — the clean「きょり×重さ」relation, both
//                       a numeric "how many weights balance?" and a "which side
//                       goes down?" comparison. NEW to this project.
//   - combustion(u01): oxygen supports burning / burning makes CO2 (classification)
//   - electricity(u09): device → energy form it converts electricity into (classify)
//   - solutions (u10): solution nature → litmus-paper result (classification)
//   - body      (u02): B-strand, but the spec explicitly calls out unit 2's four
//                       enumerable body systems as a strong "which organ does X"
//                       classification generator — so it lives here too.
//
// Every generated question is a plain choice question of the same shape the
// authored ones use: { type:'choice', cat, q, options, answer, exp, tid }.
// `tid` is a stable template id used to build the gradebook item_ref.
//
// DISTRACTOR-COLLISION is the bug class the project keeps re-shipping (rika3's
// stroke-count generator did it twice: a "wrong" option secretly also correct).
// We avoid it structurally, exactly as rika4 does:
//   - lever numeric: the balancing count is a UNIQUE integer (a1*w1 / a2), and
//     every distractor is filtered to differ from it — so no wrong count can
//     secretly balance;
//   - lever comparison: the two moments are regenerated until UNEQUAL, so the
//     heavier side is provably unique and 「つり合う」 is provably wrong;
//   - every classification generator maps each subject to exactly ONE label and
//     offers a DISJOINT set of outcome labels, so no distractor can also be the
//     answer (the exact trap the shared-infra doc warns about).
// stressTest() re-checks a large batch programmatically: option counts, no
// duplicate options, answer present exactly once, and — via each generator's own
// `_verify(q)` — that exactly one option is correct against re-derived truth.
// The app never reads `_verify`; it exists only for the test.

window.RIKA6_GEN = (function () {
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
  function randInt(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  // ---- u08: てこ — the new mechanical-physics shape --------------------------
  // Model the 実験用てこ as「支点からのめもり × おもりの数」. Two variants:
  //   balance   — given the left arm, how many おもり on the right balance it?
  //               The count is a UNIQUE integer; every distractor is forced to
  //               differ, so no wrong count can secretly also balance.
  //   heavier   — two arms, which side goes down? The two moments are regenerated
  //               until strictly unequal, so the heavier side is provably unique.
  const POS = ['1', '2', '3', '4', '5', '6']; // めもり positions (support-relative)

  function genLeverBalance() {
    // choose left (a1 めもり, w1 おもり) and a right めもり a2 such that the
    // balancing right count y = a1*w1 / a2 is a whole number in 1..6.
    let a1, w1, a2, y, guard = 0;
    do {
      a1 = randInt(1, 6); w1 = randInt(1, 6); a2 = randInt(1, 6);
      const m = a1 * w1;
      y = m / a2;
      guard++;
    } while ((y !== Math.floor(y) || y < 1 || y > 6) && guard < 200);
    if (y !== Math.floor(y) || y < 1 || y > 6) { a1 = 2; w1 = 3; a2 = 3; y = 2; }

    // build 3 distinct distractors, none equal to y, all in 1..8.
    const cand = [w1, a2, y + 1, y - 1, y + 2, a1, w1 + 1];
    const distractors = [];
    for (const c of cand) {
      if (c >= 1 && c <= 8 && c !== y && distractors.indexOf(c) < 0) distractors.push(c);
      if (distractors.length === 3) break;
    }
    let extra = 1;
    while (distractors.length < 3) {
      const c = y + extra + 2;
      if (c !== y && distractors.indexOf(c) < 0) distractors.push(c);
      extra++;
    }
    const options = shuffle(distractors.concat([y]).map((n) => n + '個'));
    return {
      type: 'choice', cat: 'てこのつり合い', tid: 'gen_lever_balance',
      q: '実験用てこの左のうでで、支点から' + a1 + 'のめもりに、おもりを' + w1 +
        '個つるしました。右のうでの、支点から' + a2 +
        'のめもりに何個つるすと、水平につり合う？',
      options: options, answer: y + '個',
      exp: 'てこは「支点からのきょり × おもりの数」が左右で等しいときつり合います。' +
        '左は ' + a1 + '×' + w1 + '＝' + (a1 * w1) + '。右は ' + a2 +
        '×□＝' + (a1 * w1) + 'より、□＝' + y + '個です。',
      _verify: function (item) {
        const want = (a1 * w1 / a2) + '個';
        return item.answer === want &&
          item.options.filter((o) => o === want).length === 1 &&
          item.options.length === 4;
      },
    };
  }

  function genLeverHeavier() {
    let a1, w1, a2, w2, guard = 0;
    do {
      a1 = randInt(1, 6); w1 = randInt(1, 6);
      a2 = randInt(1, 6); w2 = randInt(1, 6);
      guard++;
    } while (a1 * w1 === a2 * w2 && guard < 200);
    if (a1 * w1 === a2 * w2) { a2 = a2 === 6 ? 5 : a2 + 1; } // guarantee unequal
    const leftDown = a1 * w1 > a2 * w2;
    const answer = leftDown ? '左のうでが下がる' : '右のうでが下がる';
    return {
      type: 'choice', cat: 'てこのつり合い', tid: 'gen_lever_heavier',
      q: '実験用てこの左のうでは、支点から' + a1 + 'のめもりにおもり' + w1 +
        '個、右のうでは支点から' + a2 + 'のめもりにおもり' + w2 +
        '個をつるしました。てこはどうなる？',
      options: shuffle(['左のうでが下がる', '右のうでが下がる', '水平につり合う']),
      answer: answer,
      exp: '左は ' + a1 + '×' + w1 + '＝' + (a1 * w1) + '、右は ' + a2 + '×' + w2 +
        '＝' + (a2 * w2) + '。' + (leftDown ? '左' : '右') + 'のほうが大きいので、' +
        (leftDown ? '左' : '右') + 'のうでが下がります。',
      _verify: function (item) {
        const l = a1 * w1, r = a2 * w2;
        if (l === r) return false; // must never be tie
        const want = l > r ? '左のうでが下がる' : '右のうでが下がる';
        return item.answer === want &&
          item.options.filter((o) => o === want).length === 1 &&
          item.options.length === 3;
      },
    };
  }

  function genLever() {
    return Math.random() < 0.5 ? genLeverBalance() : genLeverHeavier();
  }

  // ---- u01: combustion — oxygen supports burning; burning makes CO2 ----------
  // Disjoint truth: only 酸素 supports burning; the gas that increases after
  // burning is uniquely 二酸化炭素. The two "how does it burn" outcomes are a
  // disjoint pair. No distractor can secretly be the answer.
  function genCombustion() {
    const mode = pick(['supporter', 'increase', 'behaviour']);
    if (mode === 'supporter') {
      return {
        type: 'choice', cat: '物の燃え方', tid: 'gen_combustion',
        q: 'ものが燃えるのを助けるはたらきがある気体はどれ？',
        options: shuffle(['酸素', '窒素', '二酸化炭素']),
        answer: '酸素',
        exp: 'ものを燃やすはたらきがあるのは酸素です。窒素や二酸化炭素の中ではものは燃え続けません。',
        _verify: function (item) {
          return item.answer === '酸素' &&
            item.options.filter((o) => o === '酸素').length === 1 &&
            item.options.indexOf('窒素') >= 0 && item.options.indexOf('二酸化炭素') >= 0;
        },
      };
    }
    if (mode === 'increase') {
      return {
        type: 'choice', cat: '物の燃え方', tid: 'gen_combustion',
        q: 'びんの中でろうそくを燃やしたあと、ふえている気体はどれ？',
        options: shuffle(['二酸化炭素', '酸素', '窒素']),
        answer: '二酸化炭素',
        exp: 'ものが燃えると酸素が使われて減り、かわりに二酸化炭素ができてふえます。',
        _verify: function (item) {
          return item.answer === '二酸化炭素' &&
            item.options.filter((o) => o === '二酸化炭素').length === 1 &&
            item.options.indexOf('酸素') >= 0;
        },
      };
    }
    // behaviour: put a lit candle into a bottle of one gas → burn or go out.
    const gas = pick([
      { name: '酸素', out: false },
      { name: '窒素', out: true },
      { name: '二酸化炭素', out: true },
    ]);
    const answer = gas.out ? '火が消える' : '空気中より激しく燃える';
    return {
      type: 'choice', cat: '物の燃え方', tid: 'gen_combustion',
      q: '「' + gas.name + '」で満たしたびんの中に、火のついたろうそくを入れるとどうなる？',
      options: shuffle(['空気中より激しく燃える', '火が消える']),
      answer: answer,
      exp: gas.out
        ? gas.name + 'にはものを燃やすはたらきがないので、火はすぐに消えます。'
        : '酸素にはものを燃やすはたらきがあるので、空気中より激しく燃えます。',
      _verify: function (item) {
        const want = gas.out ? '火が消える' : '空気中より激しく燃える';
        return item.answer === want &&
          item.options.filter((o) => o === want).length === 1 &&
          item.options.length === 2;
      },
    };
  }

  // ---- u09: electricity — device → energy form it converts to ----------------
  // Disjoint truth: each device converts electricity into exactly ONE of four
  // distinct forms (光/音/熱/運動). The four option labels are always the same
  // disjoint set, so exactly one matches — no collision possible.
  const FORMS = ['光', '音', '熱', '物を動かす運動'];
  const E_DEVICES = [
    { name: '豆電球', form: '光' },
    { name: '発光ダイオード（LED）', form: '光' },
    { name: '電子オルゴール', form: '音' },
    { name: 'スピーカー', form: '音' },
    { name: '電熱線', form: '熱' },
    { name: 'モーター', form: '物を動かす運動' },
  ];
  function genElectricity() {
    const d = pick(E_DEVICES);
    return {
      type: 'choice', cat: '電気の利用', tid: 'gen_electricity',
      q: '「' + d.name + '」は、電気をおもに何に変えるはたらきをする？',
      options: FORMS.slice(),
      answer: d.form,
      exp: d.name + 'は、電気を' + d.form + 'に変えて利用する道具です。',
      _verify: function (item) {
        return item.answer === d.form &&
          item.options.filter((o) => o === d.form).length === 1 &&
          item.options.length === 4;
      },
    };
  }

  // ---- u10: solutions — nature → litmus-paper result -------------------------
  // Disjoint truth for each (solution, litmus colour): a 酸性 solution reddens
  // blue litmus, an アルカリ性 solution blues red litmus, and litmus never turns
  // the colour it already is. The three outcome labels are a disjoint set and
  // the correct one is uniquely determined, so no distractor also holds.
  const SOLUTIONS = [
    { name: '塩酸', nature: 'acid' },
    { name: '炭酸水', nature: 'acid' },
    { name: '食塩水', nature: 'neutral' },
    { name: 'さとう水', nature: 'neutral' },
    { name: '石灰水', nature: 'alkali' },
    { name: 'アンモニア水', nature: 'alkali' },
  ];
  function litmusResult(nature, paper) {
    // paper: 'blue' or 'red'. Return the outcome label.
    if (paper === 'blue') return nature === 'acid' ? '赤色に変わる' : '色は変わらない';
    return nature === 'alkali' ? '青色に変わる' : '色は変わらない';
  }
  function genSolutions() {
    const s = pick(SOLUTIONS);
    const paper = Math.random() < 0.5 ? 'blue' : 'red';
    const paperName = paper === 'blue' ? '青色のリトマス紙' : '赤色のリトマス紙';
    const answer = litmusResult(s.nature, paper);
    // options: the three disjoint outcomes.
    const options = ['赤色に変わる', '青色に変わる', '色は変わらない'];
    const natureJa = s.nature === 'acid' ? '酸性' : s.nature === 'alkali' ? 'アルカリ性' : '中性';
    return {
      type: 'choice', cat: '水溶液の仲間分け', tid: 'gen_solutions',
      q: '「' + s.name + '」に' + paperName + 'をつけると、どうなる？',
      options: shuffle(options),
      answer: answer,
      exp: s.name + 'は' + natureJa + 'の水溶液です。' +
        (answer === '色は変わらない'
          ? paperName + 'の色は変わりません。'
          : paperName + 'は' + answer + 'ます。'),
      _verify: function (item) {
        const want = litmusResult(s.nature, paper);
        return item.answer === want &&
          item.options.filter((o) => o === want).length === 1 &&
          item.options.length === 3;
      },
    };
  }

  // ---- u02: body systems — organ ⇆ its one primary role (classification) -----
  // Disjoint truth: each organ has exactly ONE distinct primary role in this
  // set, so a role uniquely identifies an organ and vice versa. Two variants
  // (organ→role, role→organ); both draw distractors only from OTHER organs, so
  // no distractor can also be correct.
  const ORGANS = [
    { name: '胃', role: '食べ物を消化する' },
    { name: '小腸', role: '養分を吸収する' },
    { name: '肺', role: '酸素を取り入れ、二酸化炭素を出す' },
    { name: '心臓', role: '血液を全身に送り出す' },
    { name: 'かん臓', role: '養分の一部をたくわえる' },
  ];
  function genBody() {
    const target = pick(ORGANS);
    const others = ORGANS.filter((o) => o.name !== target.name);
    if (Math.random() < 0.5) {
      // organ → role
      const distractRoles = sample(others, 3).map((o) => o.role);
      const options = shuffle(distractRoles.concat([target.role]));
      return {
        type: 'choice', cat: '体のはたらき', tid: 'gen_body',
        q: '「' + target.name + '」のおもなはたらきはどれ？',
        options: options, answer: target.role,
        exp: target.name + 'のおもなはたらきは、' + target.role + 'ことです。',
        _verify: function (item) {
          return item.answer === target.role &&
            item.options.filter((o) => o === target.role).length === 1 &&
            item.options.length === 4;
        },
      };
    }
    // role → organ
    const distractOrgans = sample(others, 3).map((o) => o.name);
    const options = shuffle(distractOrgans.concat([target.name]));
    return {
      type: 'choice', cat: '体のはたらき', tid: 'gen_body',
      q: '「' + target.role + '」はたらきをするのは、どのつくり（器官）？',
      options: options, answer: target.name,
      exp: target.role + 'のは' + target.name + 'です。',
      _verify: function (item) {
        return item.answer === target.name &&
          item.options.filter((o) => o === target.name).length === 1 &&
          item.options.length === 4;
      },
    };
  }

  const GENERATORS = {
    lever: genLever,
    combustion: genCombustion,
    electricity: genElectricity,
    solutions: genSolutions,
    body: genBody,
  };

  // Generate `n` questions for a unit's declared gen list, de-duplicating by
  // (question text + answer) within one attempt so a short pool doesn't repeat
  // the same instance.
  function generateFor(genKeys, n) {
    const out = [];
    const seen = new Set();
    let guard = 0;
    const keys = genKeys.slice();
    while (out.length < n && guard++ < n * 60) {
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
    // expected option count per template (null = varies within the generator)
    const optCount = {
      gen_lever_balance: 4, gen_lever_heavier: 3, gen_combustion: null,
      gen_electricity: 4, gen_solutions: 3, gen_body: 4,
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
