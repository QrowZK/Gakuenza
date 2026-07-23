// 理科5年 (rika5) — question generators + a mandatory distractor-collision
// stress test.
//
// Per the spec, the A-strand (物質・エネルギー) units parameterize cleanly into
// property / if-then / prediction questions, so those are what generate here;
// the B-strand (生命・地球) units are authored in rika5-data.js. Generators:
//   - dissolve      (u07): comparative solubility + temperature effect + water
//                          amount (物のとけ方)
//   - electromagnet (u09): controlled-variable strength + polarity, plus a
//                          Pareto-dominant setup comparison (turns + series
//                          cells) and a controlled-variable "condition"
//                          template that give u09 real per-session variety
//                          (電流がうみ出す力)
//   - pendulum      (u10): the grade-5 "control the variables" experiment —
//                          period depends on LENGTH only (ふりこのきまり)
//
// Every generated question is a plain choice question of the same shape the
// authored ones use: { type:'choice', cat, q, options, answer, exp, tid }.
// `tid` is a stable template id used to build the gradebook item_ref.
//
// DISTRACTOR-COLLISION is the bug class the spec calls out specifically for
// this grade's NEW question shape — the pendulum "which variable actually
// matters" question, where a wrong-answer option could accidentally state
// something ALSO true (e.g. "おもりを重くする" as a distractor to "長くする"
// when the real answer is about the period *not* changing). We avoid it
// structurally:
//   - COMPARISON generators derive their answer from a STRICT TOTAL ORDER over
//     a numeric quantity (solubility g/100g; ふりこの長さ cm) and REGENERATE on
//     ties, so a superlative/pairwise winner is provably unique.
//   - CLASSIFICATION / if-then generators map each subject to exactly ONE label
//     from a set of MUTUALLY EXCLUSIVE outcomes (長くなる / 短くなる / 変わらない;
//     大きく増える / ほとんど変わらない) so no distractor can secretly also be
//     correct. The pendulum "change one variable" question only ever changes a
//     SINGLE variable, so its outcome is a single well-defined value — the
//     multi-correct trap (asking "what does NOT affect period", which has two
//     right answers) is never generated.
// stressTest() re-checks a large batch programmatically: option counts, no
// duplicate options, answer present exactly once, and — via each generator's
// own `_verify(q)` — that exactly one option is correct against re-derived
// truth. The app never reads `_verify`; it exists only for the test.

window.RIKA5_GEN = (function () {
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

  // ---- u07: dissolving — solubility (g per 100g water) -----------------------
  // Independently-documented approximate solubilities. The three substances have
  // strictly different values at each of the three temperatures below, and 食塩
  // is nearly flat while ミョウバン/ホウ酸 climb steeply with temperature — so:
  //   * the pairwise "which dissolves more" answer is a UNIQUE max (strict order)
  //   * the temperature-effect answer is a DISJOINT label (食塩→ほとんど変わらない,
  //     the others → 大きく増える), no distractor overlap.
  const SOL = {
    '食塩':       { 0: 36, 20: 36, 60: 37 },
    'ミョウバン': { 0: 6,  20: 11, 60: 57 },
    'ホウ酸':     { 0: 3,  20: 5,  60: 15 },
  };
  const SOL_SUBJECTS = Object.keys(SOL);
  const SOL_TEMPS = [0, 20, 60];
  // "大きく増える" iff the 0→60℃ gain clears this threshold; 食塩(gain 1) stays
  // below, ミョウバン(51)/ホウ酸(12) clear it. Chosen to sit strictly between.
  const SOL_BIG_GAIN = 5;

  function genDissolve() {
    const mode = pick(['compare', 'compare', 'temp', 'water']);

    if (mode === 'compare') {
      // Two substances at one temperature — which dissolves more per 100g water?
      // Strict order guaranteed by regenerating on the (never-occurring here, but
      // defended anyway) equal case.
      let two, temp, a, b, guard = 0;
      do {
        two = sample(SOL_SUBJECTS, 2);
        temp = pick(SOL_TEMPS);
        a = SOL[two[0]][temp];
        b = SOL[two[1]][temp];
      } while (a === b && guard++ < 50);
      const answer = a > b ? two[0] : two[1];
      return {
        type: 'choice', cat: 'とける量のちがい', tid: 'gen_dissolve_compare',
        q: temp + '℃の水100mLに、同じようにとかしたとき、より多くとけるのはどっち？　' +
          '「' + two[0] + '」と「' + two[1] + '」',
        options: shuffle(two.slice()), answer,
        exp: '水の温度によってとける量はちがい、この温度では' + answer + 'のほうが多くとけます。' +
          '（食塩は温度が変わってもとける量があまり変わりません。）',
        _verify: function (item) {
          const vals = item.options.map(function (o) { return SOL[o][temp]; });
          const max = Math.max.apply(null, vals);
          const winners = item.options.filter(function (o) { return SOL[o][temp] === max; });
          return winners.length === 1 && winners[0] === item.answer;
        },
      };
    }

    if (mode === 'temp') {
      // Temperature effect for one substance: raising 0→60℃, does the amount
      // dissolved increase a lot, or hardly change? Disjoint labels.
      const s = pick(SOL_SUBJECTS);
      const gain = SOL[s][60] - SOL[s][0];
      const big = gain >= SOL_BIG_GAIN;
      const answer = big ? '大きく増える' : 'ほとんど変わらない';
      return {
        type: 'choice', cat: '温度ととける量', tid: 'gen_dissolve_temp',
        q: '「' + s + '」を水にとかすとき、水の温度を上げていくと、とける量はどうなる？',
        options: ['大きく増える', 'ほとんど変わらない'], answer,
        exp: big
          ? s + 'は、水の温度を上げると、とける量が大きく増えます。'
          : s + 'は、水の温度を上げても、とける量はほとんど変わりません。',
        _verify: function (item) {
          const want = (SOL[s][60] - SOL[s][0]) >= SOL_BIG_GAIN
            ? '大きく増える' : 'ほとんど変わらない';
          return item.answer === want &&
            item.options.filter(function (o) { return o === want; }).length === 1;
        },
      };
    }

    // water amount: at a fixed temperature, doubling the water doubles the amount
    // that can dissolve (proportional). Single well-defined outcome.
    return {
      type: 'choice', cat: '水の量ととける量', tid: 'gen_dissolve_water',
      q: '同じ温度で、水の量を2倍にすると、とかすことのできる量はどうなる？',
      options: ['約2倍になる', '変わらない', '約半分になる'],
      answer: '約2倍になる',
      exp: '決まった温度では、水の量を2倍にすると、とける量もおよそ2倍になります。',
      _verify: function (item) {
        return item.answer === '約2倍になる' &&
          item.options.filter(function (o) { return o === '約2倍になる'; }).length === 1;
      },
    };
  }

  // ---- u09: electromagnet — controlled-variable strength + polarity ----------
  // Every variant is single-correct with mutually-exclusive / clearly-wrong
  // distractors. The two genuine strengthening methods (bigger current, more
  // turns) are NEVER offered as options together, so a "strengthen" question
  // can't have two right answers.
  //
  // The `setup` template compares two whole electromagnet SETUPS by winding
  // count + number of series cells (current). To keep it single-correct AND
  // solvable by grade-5 reasoning (no ampere-turns arithmetic), the winning
  // setup ALWAYS Pareto-dominates the other: it has at least as many turns AND
  // at least as many cells, and strictly more of at least one. "More windings
  // and/or more batteries → stronger" is then unambiguous — there is never a
  // "more turns but fewer cells" trade-off that could make a distractor
  // secretly also correct. EM_TURNS/EM_CELLS list the winding counts and series
  // cell counts used.
  const EM_TURNS = [50, 100, 150, 200];
  const EM_CELLS = [1, 2, 3];
  function emLabel(turns, cells) {
    return 'まき数' + turns + '回、かん電池' + cells + '個を直列';
  }
  function emParse(label) {
    const m = label.match(/まき数(\d+)回、かん電池(\d+)個/);
    return m ? { turns: +m[1], cells: +m[2] } : null;
  }

  function genElectromagnet() {
    const mode = pick(['turns', 'current', 'strengthen', 'reverse', 'off',
      'setup', 'setup', 'setup', 'condition']);

    if (mode === 'setup') {
      // Build a strictly Pareto-dominant winner vs a dominated loser.
      const kind = pick(['turns', 'cells', 'both']);
      let win, lose;
      if (kind === 'turns') {
        const c = pick(EM_CELLS);
        const two = sample(EM_TURNS, 2);
        const hi = Math.max(two[0], two[1]), lo = Math.min(two[0], two[1]);
        win = { turns: hi, cells: c }; lose = { turns: lo, cells: c };
      } else if (kind === 'cells') {
        const t = pick(EM_TURNS);
        const two = sample(EM_CELLS, 2);
        const hi = Math.max(two[0], two[1]), lo = Math.min(two[0], two[1]);
        win = { turns: t, cells: hi }; lose = { turns: t, cells: lo };
      } else {
        const tt = sample(EM_TURNS, 2);
        const cc = sample(EM_CELLS, 2);
        const thi = Math.max(tt[0], tt[1]), tlo = Math.min(tt[0], tt[1]);
        const chi = Math.max(cc[0], cc[1]), clo = Math.min(cc[0], cc[1]);
        win = { turns: thi, cells: chi }; lose = { turns: tlo, cells: clo };
      }
      const answer = emLabel(win.turns, win.cells);
      const reason = kind === 'turns' ? 'コイルのまき数が多い'
        : kind === 'cells' ? '（直列の）かん電池が多く電流が大きい'
        : 'コイルのまき数が多く、電流も大きい';
      return {
        type: 'choice', cat: '電磁石の強さくらべ', tid: 'gen_em_setup',
        q: '2つの電磁石を、鉄のクリップに近づけました。より多くのクリップを引きつける' +
          '（強い）のはどっち？',
        options: shuffle([answer, emLabel(lose.turns, lose.cells)]), answer,
        exp: reason + 'ほうが、電磁石は強くなります。',
        _verify: function (item) {
          const parsed = item.options.map(emParse);
          if (parsed.some(function (p) { return !p; })) return false;
          const aw = emParse(item.answer);
          // The answer must Pareto-dominate EVERY other option (>= on both,
          // strictly > on at least one) — so no other option can also be a
          // valid "stronger" pick.
          return parsed.every(function (p) {
            if (p.turns === aw.turns && p.cells === aw.cells) return true;
            return aw.turns >= p.turns && aw.cells >= p.cells &&
              (aw.turns > p.turns || aw.cells > p.cells);
          });
        },
      };
    }

    if (mode === 'condition') {
      // Controlled-variable: to test one factor, hold the OTHER factor the same.
      const v = pick([
        { factor: 'まき数', hold: '電流の大きさ', opts: ['大きくする', '小さくする'] },
        { factor: '電流の大きさ', hold: 'コイルのまき数', opts: ['多くする', '少なくする'] },
      ]);
      return {
        type: 'choice', cat: '電磁石の実験の仕方', tid: 'gen_em_condition',
        q: '電磁石の強さが「' + v.factor + '」で変わるかを調べます。' +
          v.factor + 'を変えるとき、' + v.hold + 'はどうする？',
        options: shuffle(['同じにする（変えない）'].concat(v.opts)),
        answer: '同じにする（変えない）',
        exp: '調べたい条件（' + v.factor + '）以外は同じにして比べます。だから' +
          v.hold + 'は変えずに同じにします。',
        _verify: function (item) {
          return item.answer === '同じにする（変えない）' &&
            item.options.filter(function (o) { return o === '同じにする（変えない）'; }).length === 1;
        },
      };
    }

    if (mode === 'turns') {
      return {
        type: 'choice', cat: '電磁石の強さ', tid: 'gen_em_factor',
        q: '流れる電流の大きさは変えずに、コイルのまき数だけを多くすると、電磁石の強さは？',
        options: ['強くなる', '弱くなる', '変わらない'], answer: '強くなる',
        exp: 'コイルのまき数を多くすると、電磁石は強くなります。',
        _verify: function (item) {
          return item.answer === '強くなる' &&
            item.options.filter(function (o) { return o === '強くなる'; }).length === 1;
        },
      };
    }
    if (mode === 'current') {
      return {
        type: 'choice', cat: '電磁石の強さ', tid: 'gen_em_factor',
        q: 'コイルのまき数は変えずに、流れる電流だけを大きくすると、電磁石の強さは？',
        options: ['強くなる', '弱くなる', '変わらない'], answer: '強くなる',
        exp: '流れる電流を大きくすると、電磁石は強くなります。',
        _verify: function (item) {
          return item.answer === '強くなる' &&
            item.options.filter(function (o) { return o === '強くなる'; }).length === 1;
        },
      };
    }
    if (mode === 'strengthen') {
      // Offer exactly ONE genuine strengthening method as the answer; the other
      // genuine method is deliberately excluded from the distractors.
      const correct = pick(['電流を大きくする', 'コイルのまき数を多くする']);
      const distractors = correct === '電流を大きくする'
        ? ['電流を小さくする', 'コイルのまき数を減らす', '電流を止める']
        : ['電流を小さくする', '電流を止める', '鉄しんを外す'];
      const options = shuffle([correct].concat(sample(distractors, 2)));
      return {
        type: 'choice', cat: '電磁石の強さ', tid: 'gen_em_strengthen',
        q: '電磁石をより強くする方法として、正しいのはどれ？',
        options, answer: correct,
        exp: '電磁石は、電流を大きくするか、コイルのまき数を多くすると強くなります。',
        _verify: function (item) {
          // Truth: exactly one of {電流を大きくする, コイルのまき数を多くする}
          // strengthens. By construction only ONE such label is present.
          const strong = ['電流を大きくする', 'コイルのまき数を多くする'];
          const present = item.options.filter(function (o) { return strong.indexOf(o) >= 0; });
          return present.length === 1 && present[0] === item.answer;
        },
      };
    }
    if (mode === 'reverse') {
      const distractors = ['電流を大きくする', 'コイルのまき数を多くする', '鉄しんを太くする', '電流を小さくする'];
      const options = shuffle(['電流の向きを逆にする'].concat(sample(distractors, 3)));
      return {
        type: 'choice', cat: '電磁石の極', tid: 'gen_em_reverse',
        q: '電磁石のN極とS極を入れかえるには、どうすればよい？',
        options, answer: '電流の向きを逆にする',
        exp: '電流の向きを逆にすると、電磁石のN極とS極が入れかわります。強さを変えても極は変わりません。',
        _verify: function (item) {
          return item.answer === '電流の向きを逆にする' &&
            item.options.filter(function (o) { return o === '電流の向きを逆にする'; }).length === 1;
        },
      };
    }
    // off: stopping the current removes the magnetism.
    return {
      type: 'choice', cat: '電流と磁力', tid: 'gen_em_off',
      q: '電磁石に流していた電流を止めると、電磁石はどうなる？',
      options: ['磁石のはたらきがなくなる', '磁石のはたらきが強くなる', '磁石のはたらきは変わらない'],
      answer: '磁石のはたらきがなくなる',
      exp: '電磁石は電流を流したときだけ磁石になり、電流を止めると鉄を引きつけなくなります。',
      _verify: function (item) {
        return item.answer === '磁石のはたらきがなくなる' &&
          item.options.filter(function (o) { return o === '磁石のはたらきがなくなる'; }).length === 1;
      },
    };
  }

  // ---- u10: pendulum — the grade-5 "control the variables" experiment --------
  // Period depends on LENGTH ONLY. This is the new question shape the spec flags
  // for extra distractor-collision scrutiny. Three variants, all single-correct:
  //   factor  — "what changes the period?" -> ふりこの長さ (weight/amplitude are
  //             genuinely wrong, never both-correct)
  //   change  — change ONE named variable, how does the period respond? Outcome
  //             is one of three MUTUALLY EXCLUSIVE labels (長くなる/短くなる/変わらない)
  //   compare — two DIFFERENT lengths (strict order, regenerate on tie), which
  //             takes longer per swing -> the longer one
  const PEND_LENGTHS = [10, 20, 25, 40, 50, 60, 80, 100];

  function genPendulum() {
    const mode = pick(['factor', 'change', 'change', 'compare']);

    if (mode === 'factor') {
      return {
        type: 'choice', cat: 'ふりこのきまり', tid: 'gen_pend_factor',
        q: 'ふりこが1往復する時間を変えるには、何を変えればよい？',
        options: shuffle(['ふりこの長さ', 'おもりの重さ', 'ふれはば']),
        answer: 'ふりこの長さ',
        exp: '1往復する時間はふりこの長さだけで決まります。おもりの重さやふれはばを変えても変わりません。',
        _verify: function (item) {
          // Only ふりこの長さ affects the period; the other two never do.
          return item.answer === 'ふりこの長さ' &&
            item.options.indexOf('ふりこの長さ') >= 0 &&
            item.options.filter(function (o) { return o === 'ふりこの長さ'; }).length === 1;
        },
      };
    }

    if (mode === 'change') {
      // change exactly one variable; the period outcome is a single value.
      const v = pick([
        { var: 'length_long',  q: 'おもりの重さとふれはばは変えずに、ふりこを長くすると', out: '長くなる' },
        { var: 'length_short', q: 'おもりの重さとふれはばは変えずに、ふりこを短くすると', out: '短くなる' },
        { var: 'weight',       q: 'ふりこの長さとふれはばは変えずに、おもりを重くすると', out: '変わらない' },
        { var: 'amplitude',    q: 'ふりこの長さとおもりは変えずに、ふれはばを大きくすると', out: '変わらない' },
      ]);
      return {
        type: 'choice', cat: 'ふりこのきまり', tid: 'gen_pend_change',
        q: v.q + '、1往復する時間はどうなる？',
        options: ['長くなる', '短くなる', '変わらない'], answer: v.out,
        exp: v.var === 'length_long' ? 'ふりこを長くすると、1往復する時間は長くなります。'
          : v.var === 'length_short' ? 'ふりこを短くすると、1往復する時間は短くなります。'
          : v.var === 'weight' ? 'おもりの重さを変えても、1往復する時間は変わりません。'
          : 'ふれはばを変えても、1往復する時間は変わりません。',
        _verify: function (item) {
          // Re-derive: only a length change moves the period; longer->長くなる,
          // shorter->短くなる; weight/amplitude->変わらない.
          const truth = { length_long: '長くなる', length_short: '短くなる',
            weight: '変わらない', amplitude: '変わらない' }[v.var];
          return item.answer === truth &&
            item.options.filter(function (o) { return o === truth; }).length === 1;
        },
      };
    }

    // compare: two different lengths -> longer swings slower (longer period).
    let two, guard = 0;
    do { two = sample(PEND_LENGTHS, 2); } while (two[0] === two[1] && guard++ < 50);
    const longer = two[0] > two[1] ? two[0] : two[1];
    const optA = 'ふりこの長さ' + two[0] + 'cm';
    const optB = 'ふりこの長さ' + two[1] + 'cm';
    const answer = 'ふりこの長さ' + longer + 'cm';
    return {
      type: 'choice', cat: 'ふりこのきまり', tid: 'gen_pend_compare',
      q: 'おもりの重さとふれはばは同じで、長さだけがちがう2つのふりこ。' +
        '1往復する時間が長い（ゆっくりふれる）のはどっち？',
      options: shuffle([optA, optB]), answer,
      exp: 'ふりこは長いほど1往復する時間が長くなります。だから' + longer + 'cmのほうがゆっくりふれます。',
      _verify: function (item) {
        // Parse the length back out of each option and take the unique max.
        const lenOf = function (o) { return parseInt(o.replace(/[^0-9]/g, ''), 10); };
        const vals = item.options.map(lenOf);
        const max = Math.max.apply(null, vals);
        const winners = item.options.filter(function (o) { return lenOf(o) === max; });
        return winners.length === 1 && winners[0] === item.answer;
      },
    };
  }

  const GENERATORS = {
    dissolve: genDissolve,
    electromagnet: genElectromagnet,
    pendulum: genPendulum,
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
      gen_dissolve_compare: 2, gen_dissolve_temp: 2, gen_dissolve_water: 3,
      gen_em_factor: 3, gen_em_strengthen: 3, gen_em_reverse: 4, gen_em_off: 3,
      gen_em_setup: 2, gen_em_condition: 3,
      gen_pend_factor: 3, gen_pend_change: 3, gen_pend_compare: 2,
    };
    let checked = 0;
    Object.keys(GENERATORS).forEach(function (key) {
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
        const hits = q.options.filter(function (o) { return o === q.answer; }).length;
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
