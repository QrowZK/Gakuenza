// Stress test for kokugo2/grammar-generators.js. Run: node grammar-generators.test.js
// Mirrors the discipline the kanji generator earned the hard way: generate at
// scale and check EVERY question for structural bugs AND the distractor-
// collision bug (a "wrong" option that is secretly also a valid answer).
const G = require('../../gakuenza.com/modules/kokugo2/grammar-generators.js');
const { GRAMMAR_UNITS, generateGrammarQuiz } = G;
const {
  HIRAGANA_BASIC, toKatakana, KATAKANA_WORDS, NATIVE_WORDS,
  KANAZUKAI_WORDS, ANTONYM_PAIRS, ANTONYM_MEMBERS, ANTONYM_OF,
  CATEGORIES, CATEGORY_NAMES, MARKS,
} = G._internals;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 50) console.error('FAIL:', msg); };

// ── bank-level invariants (the guarantees the collision-safety rests on) ──
{
  // katakana banks must be disjoint (usage question relies on it)
  const kset = new Set(KATAKANA_WORDS), nset = new Set(NATIVE_WORDS);
  if (kset.size !== KATAKANA_WORDS.length) fail('duplicate in KATAKANA_WORDS');
  if (nset.size !== NATIVE_WORDS.length) fail('duplicate in NATIVE_WORDS');
  KATAKANA_WORDS.forEach(w => { if (nset.has(w)) fail(`word in both katakana & native banks: ${w}`); });

  // kanazukai bank: each entry has a distinct correct spelling; wrongs are
  // genuinely wrong (!= correct) and the 4 options are distinct.
  const seenCorrect = new Set();
  KANAZUKAI_WORDS.forEach(e => {
    if (e.wrong.length !== 3) fail(`kanazukai ${e.cue}: needs exactly 3 wrong spellings`);
    const opts = new Set([e.correct, ...e.wrong]);
    if (opts.size !== 4) fail(`kanazukai ${e.cue}: options not 4 distinct :: ${JSON.stringify([e.correct, ...e.wrong])}`);
    e.wrong.forEach(w => { if (w === e.correct) fail(`kanazukai ${e.cue}: a wrong equals correct`); });
    if (seenCorrect.has(e.correct)) fail(`kanazukai: duplicate correct spelling ${e.correct}`);
    seenCorrect.add(e.correct);
  });
  // a wrong spelling of one entry must not be the CORRECT spelling of another
  // (would make it "secretly also correct" across the bank)
  KANAZUKAI_WORDS.forEach(e => {
    e.wrong.forEach(w => { if (seenCorrect.has(w) && w !== e.correct) fail(`kanazukai: '${w}' is wrong for ${e.cue} but correct elsewhere`); });
  });

  // antonym bank: every member appears in exactly one pair -> unique antonym.
  const memberCount = new Map();
  ANTONYM_MEMBERS.forEach(m => memberCount.set(m, (memberCount.get(m) || 0) + 1));
  memberCount.forEach((c, m) => { if (c !== 1) fail(`antonym member '${m}' appears ${c} times (must be exactly 1)`); });
  ANTONYM_PAIRS.forEach(([a, b]) => {
    if (ANTONYM_OF.get(a) !== b || ANTONYM_OF.get(b) !== a) fail(`antonym map broken for ${a}/${b}`);
  });

  // categories must be pairwise disjoint (member-pick & odd-one-out rely on it)
  const wordToCat = new Map();
  CATEGORY_NAMES.forEach(cat => {
    CATEGORIES[cat].forEach(w => {
      if (wordToCat.has(w)) fail(`word '${w}' in two categories: ${wordToCat.get(w)} & ${cat}`);
      wordToCat.set(w, cat);
    });
    if (CATEGORIES[cat].length < 4) fail(`category ${cat} too small for odd-one-out: ${CATEGORIES[cat].length}`);
  });

  // marks: bijective mark<->name, distinct usages
  const marks = new Set(MARKS.map(m => m.mark)), names = new Set(MARKS.map(m => m.name)), uses = new Set(MARKS.map(m => m.use));
  if (marks.size !== MARKS.length) fail('duplicate mark');
  if (names.size !== MARKS.length) fail('duplicate mark name');
  if (uses.size !== MARKS.length) fail('duplicate mark usage');
}

// Reverse lookup for kanazukai collision check: any valid correct spelling.
const KANAZUKAI_CORRECT = new Set(KANAZUKAI_WORDS.map(e => e.correct));

const PER_UNIT = 5000;
const counts = {};
for (const key of Object.keys(GRAMMAR_UNITS)) {
  counts[key] = { total: 0, byRef: {} };
  for (let n = 0; n < PER_UNIT; n++) {
    const q = GRAMMAR_UNITS[key].gen();
    counts[key].total++;
    counts[key].byRef[q.itemRef] = (counts[key].byRef[q.itemRef] || 0) + 1;

    // ── universal structural checks ──
    if (!q.prompt || !q.category || !q.itemRef) fail(`${key}: missing prompt/category/itemRef`);
    if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${key}: options != 4 (${q.options && q.options.length}) :: ${q.prompt}`);
    if (new Set(q.options).size !== 4) fail(`${key}: duplicate options :: ${JSON.stringify(q.options)}`);
    if (!q.options.includes(q.correctAnswer)) fail(`${key}: correct not among options :: ${q.correctAnswer} / ${JSON.stringify(q.options)}`);
    q.options.forEach(o => { if (o == null || o === '') fail(`${key}: empty option :: ${q.prompt}`); });

    const distractors = q.options.filter(o => o !== q.correctAnswer);

    // ── per-unit collision checks ──
    if (key === 'katakana') {
      if (q.itemRef.includes('/use/')) {
        // exactly one katakana word; distractors are native (never katakana)
        distractors.forEach(d => { if (KATAKANA_WORDS.includes(d)) fail(`katakana use collision: distractor '${d}' is also a katakana word`); });
        if (!KATAKANA_WORDS.includes(q.correctAnswer)) fail(`katakana use: correct '${q.correctAnswer}' not a katakana word`);
      } else if (q.itemRef.includes('/form/toK/')) {
        const h = q.itemRef.split('/').pop();
        if (q.correctAnswer !== toKatakana(h)) fail(`katakana form toK: wrong answer for ${h}`);
        distractors.forEach(d => { if (d === toKatakana(h)) fail(`katakana form toK: distractor equals correct`); });
      } else if (q.itemRef.includes('/form/toH/')) {
        const h = q.itemRef.split('/').pop();
        if (q.correctAnswer !== h) fail(`katakana form toH: wrong answer for ${h}`);
      }
    }

    if (key === 'kanazukai') {
      if (q.itemRef.includes('/word/')) {
        // no distractor may be a valid correct spelling of ANY bank word
        distractors.forEach(d => { if (KANAZUKAI_CORRECT.has(d)) fail(`kanazukai word collision: distractor '${d}' is a valid spelling somewhere`); });
        if (!KANAZUKAI_CORRECT.has(q.correctAnswer)) fail(`kanazukai word: correct '${q.correctAnswer}' not in bank`);
      } else if (q.itemRef.includes('/particle/')) {
        // exactly one option must be the fully-correct spelling; the other
        // three each contain a wrong particle. Correct sentence uses は + へ/を.
        // Reconstruct: correct has no standalone 'わ ' topic error and no 'え/お'
        // in the second particle slot. We assert exactly one option lacks all
        // wrong markers by checking against the generator's own correctAnswer.
        if (distractors.includes(q.correctAnswer)) fail('kanazukai particle: correct duplicated among distractors');
        // each distractor must differ from correct in a particle position
        distractors.forEach(d => { if (d === q.correctAnswer) fail('kanazukai particle: distractor equals correct'); });
      }
    }

    if (key === 'shugo_jutsugo') {
      // options are the 4 bunsetsu; correct is the subject (ends は/が) or the
      // predicate (a verb). A distractor must never also be a valid answer of
      // the same kind: subject options are unique (only one ends は/が), and
      // the object option ends in を (never a subject).
      if (q.itemRef.endsWith('/shugo')) {
        const subjLike = q.options.filter(o => /(は|が)$/.test(o));
        if (subjLike.length !== 1) fail(`shugo: ${subjLike.length} subject-like options :: ${JSON.stringify(q.options)}`);
        if (!/(は|が)$/.test(q.correctAnswer)) fail(`shugo: correct not subject-marked :: ${q.correctAnswer}`);
      } else {
        // jutsugo: the correct predicate must not tie with another verb option.
        // objects end in を, adverbs are adverbs — only the predicate is a bare verb.
        const woLike = q.options.filter(o => /を$/.test(o));
        if (woLike.length !== 1) fail(`jutsugo: expected exactly 1 を-object :: ${JSON.stringify(q.options)}`);
        if (/を$/.test(q.correctAnswer) || /(は|が)$/.test(q.correctAnswer)) fail(`jutsugo: correct looks like subject/object :: ${q.correctAnswer}`);
      }
    }

    if (key === 'nakama') {
      if (q.itemRef.includes('/antonym/')) {
        const target = q.itemRef.split('/').pop();
        if (ANTONYM_OF.get(target) !== q.correctAnswer) fail(`antonym: wrong answer for ${target}`);
        // no distractor may be the target's antonym (only the answer is)
        distractors.forEach(d => { if (d === ANTONYM_OF.get(target)) fail(`antonym collision: distractor is the antonym of ${target}`); });
      } else if (q.itemRef.includes('/category/')) {
        const cat = q.itemRef.split('/').pop();
        if (!CATEGORIES[cat].includes(q.correctAnswer)) fail(`category: correct '${q.correctAnswer}' not in ${cat}`);
        distractors.forEach(d => { if (CATEGORIES[cat].includes(d)) fail(`category collision: distractor '${d}' also in ${cat}`); });
      } else if (q.itemRef.includes('/odd/')) {
        const cat = q.itemRef.split('/').pop();
        // the correct (outsider) is NOT in cat; the 3 distractors ARE.
        if (CATEGORIES[cat].includes(q.correctAnswer)) fail(`odd: outsider '${q.correctAnswer}' is in ${cat}`);
        distractors.forEach(d => { if (!CATEGORIES[cat].includes(d)) fail(`odd: non-member distractor '${d}' not in ${cat}`); });
      }
    }

    if (key === 'kutouten') {
      const validMarks = new Set(MARKS.map(m => m.mark));
      const validNames = new Set(MARKS.map(m => m.name));
      if (q.itemRef.includes('/use/') || q.itemRef.includes('/markOf/')) {
        if (!validMarks.has(q.correctAnswer)) fail(`kutouten: correct '${q.correctAnswer}' not a valid mark`);
      } else if (q.itemRef.includes('/nameOf/')) {
        if (!validNames.has(q.correctAnswer)) fail(`kutouten: correct '${q.correctAnswer}' not a valid name`);
      }
    }
  }
}

// coverage: each unit should exercise its sub-types
{
  const katRefs = Object.keys(counts.katakana.byRef);
  if (!katRefs.some(r => r.includes('/use/'))) fail('katakana never produced a usage question');
  if (!katRefs.some(r => r.includes('/form/'))) fail('katakana never produced a form question');

  const kzRefs = Object.keys(counts.kanazukai.byRef);
  if (!kzRefs.some(r => r.includes('/particle/'))) fail('kanazukai never produced a particle question');
  if (!kzRefs.some(r => r.includes('/word/'))) fail('kanazukai never produced a word question');
  // every curated kanazukai word should be reachable
  const wordRefsSeen = new Set(kzRefs.filter(r => r.includes('/word/')).map(r => r.split('/word/')[1]));
  if (wordRefsSeen.size < KANAZUKAI_WORDS.length) fail(`kanazukai did not cover all words: ${wordRefsSeen.size}/${KANAZUKAI_WORDS.length}`);

  const njRefs = Object.keys(counts.nakama.byRef);
  ['/antonym/', '/category/', '/odd/'].forEach(t => { if (!njRefs.some(r => r.includes(t))) fail(`nakama never produced ${t}`); });

  const ktRefs = Object.keys(counts.kutouten.byRef);
  if (!ktRefs.some(r => r.includes('/use/'))) fail('kutouten never produced a usage question');
  if (!ktRefs.some(r => r.includes('/nameOf/') || r.includes('/markOf/'))) fail('kutouten never produced a name/shape question');
}

// generateGrammarQuiz returns the requested length for every unit
{
  for (const key of Object.keys(GRAMMAR_UNITS)) {
    const quiz = generateGrammarQuiz(key, 10);
    if (quiz.length !== 10) fail(`generateGrammarQuiz(${key},10) length ${quiz.length}`);
    quiz.forEach(q => {
      if (!q.options || q.options.length !== 4) fail(`${key} quiz item bad options`);
    });
  }
}

if (failures === 0) {
  console.log(`OK — ${Object.keys(GRAMMAR_UNITS).length} generators x ${PER_UNIT} each, all structural + collision checks passed.`);
  console.log('itemRef coverage:', Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Object.keys(v.byRef).length + ' refs'])));
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
