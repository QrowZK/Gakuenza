// Stress test for kokugo4/grammar-generators.js. Run: node grammar-generators.test.js
// Same discipline the kanji generator earned the hard way: generate at scale and
// check EVERY question for structural bugs AND the distractor-collision bug (a
// "wrong" option that is secretly also a valid answer).
//
// The five kokugo4 grammar units and how each is collision-safe by construction:
//   bushu         — a kanji has exactly ONE radical; distractors are OTHER radicals.
//   jukugo        — a compound is authored into exactly ONE structure category;
//                   distractors are the OTHER category labels.
//   setsuzoku     — connective sets are pairwise DISJOINT and the clause-pair fixes
//                   the relation; distractors come from other relations' sets.
//   shugo_jutsugo — a 4-文節 sentence has exactly one 主語 (が/は noun) and one 述語
//                   (final verb); distractors are the other 文節.
//   kanyouku      — distinct-meaning / distinct-phrase bank; any other entry is a
//                   guaranteed-wrong distractor.
const G = require('../../gakuenza.com/modules/kokugo4/grammar-generators.js');
const { GRAMMAR_UNITS, generateGrammarQuiz } = G;
const {
  RADICALS, BUSHU, JUKUGO_CATS, JUKUGO, SETSUZOKU, SETSUZOKU_KEYS, SETSUZOKU_POOL, KANYOUKU,
} = G._internals;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// ── bank invariants (the source of each generator's collision-safety) ──
{
  // bushu: every entry's radical key is a known radical; no kanji duplicated.
  const seenK = new Set();
  BUSHU.forEach(e => {
    if (!RADICALS[e.r]) fail(`bushu: ${e.k} has unknown radical key ${e.r}`);
    if (seenK.has(e.k)) fail(`bushu: duplicate kanji ${e.k}`);
    seenK.add(e.k);
  });
  if (Object.keys(RADICALS).length < 4) fail(`bushu: need >=4 radicals for 4 options, have ${Object.keys(RADICALS).length}`);
  if (BUSHU.length < 12) fail(`bushu bank unexpectedly small: ${BUSHU.length}`);

  // jukugo: every compound belongs to a known category; no compound duplicated;
  // all 5 categories present.
  const seenW = new Set(); const catsUsed = new Set();
  JUKUGO.forEach(e => {
    if (!JUKUGO_CATS[e.c]) fail(`jukugo: ${e.w} has unknown category ${e.c}`);
    if (seenW.has(e.w)) fail(`jukugo: duplicate compound ${e.w}`);
    seenW.add(e.w); catsUsed.add(e.c);
  });
  if (Object.keys(JUKUGO_CATS).length < 4) fail(`jukugo: need >=4 categories, have ${Object.keys(JUKUGO_CATS).length}`);
  Object.keys(JUKUGO_CATS).forEach(c => { if (!catsUsed.has(c)) fail(`jukugo: category ${c} has no compounds`); });

  // setsuzoku: connective sets must be pairwise DISJOINT (each connective in
  // exactly one relation) — the whole basis of collision-safety.
  const owner = new Map();
  SETSUZOKU_KEYS.forEach(k => SETSUZOKU[k].conj.forEach(c => {
    if (owner.has(c)) fail(`setsuzoku: connective "${c}" is in both ${owner.get(c)} and ${k}`);
    owner.set(c, k);
    // need >=4 total connectives across the pool so 1 correct + 3 distractors fit
  }));
  if (SETSUZOKU_POOL.length < 4) fail(`setsuzoku: pool too small (${SETSUZOKU_POOL.length})`);
  SETSUZOKU_KEYS.forEach(k => {
    if (!SETSUZOKU[k].pairs.length) fail(`setsuzoku: ${k} has no clause-pairs`);
    SETSUZOKU[k].pairs.forEach(p => { if (p.length !== 2) fail(`setsuzoku: ${k} pair not length 2`); });
    // a relation must leave >=3 distractors available in the rest of the pool
    if (SETSUZOKU_POOL.length - SETSUZOKU[k].conj.length < 3) fail(`setsuzoku: ${k} cannot draw 3 distractors`);
  });

  // kanyouku: all meanings distinct AND all phrases distinct.
  const ms = new Set(), ps = new Set();
  KANYOUKU.forEach(e => {
    if (ms.has(e.m)) fail(`duplicate kanyouku meaning: ${e.m}`);
    if (ps.has(e.p)) fail(`duplicate kanyouku phrase: ${e.p}`);
    ms.add(e.m); ps.add(e.p);
  });
  if (KANYOUKU.length < 12) fail(`kanyouku bank unexpectedly small: ${KANYOUKU.length}`);
}

// lookups for collision detection
const radicalOf = new Map(BUSHU.map(e => [e.k, e.r]));
const catOf = new Map(JUKUGO.map(e => [e.w, e.c]));
const phraseByMeaning = new Map(KANYOUKU.map(e => [e.m, e.p]));
const meaningByPhrase = new Map(KANYOUKU.map(e => [e.p, e.m]));
const radLabelToKey = new Map(Object.entries(RADICALS).map(([k, v]) => [v, k]));
const catLabelToKey = new Map(Object.entries(JUKUGO_CATS).map(([k, v]) => [v, k]));

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
    if (key === 'bushu') {
      // itemRef: kokugo4/grammar/bushu/<kanji>. correct label must be the kanji's
      // radical; every distractor label must be a DIFFERENT radical.
      const kanji = q.itemRef.split('/')[3];
      const trueKey = radicalOf.get(kanji);
      if (RADICALS[trueKey] !== q.correctAnswer) fail(`bushu: correct ${q.correctAnswer} != radical of ${kanji}`);
      distractors.forEach(d => {
        const dk = radLabelToKey.get(d);
        if (!dk) fail(`bushu: distractor "${d}" is not a real radical label`);
        if (dk === trueKey) fail(`bushu collision: distractor "${d}" is also ${kanji}'s radical`);
      });
    }
    if (key === 'jukugo') {
      // itemRef: kokugo4/grammar/jukugo/<compound>. correct label must be the
      // compound's category; distractors must be OTHER categories.
      const w = q.itemRef.split('/')[3];
      const trueCat = catOf.get(w);
      if (JUKUGO_CATS[trueCat] !== q.correctAnswer) fail(`jukugo: correct ${q.correctAnswer} != category of ${w}`);
      distractors.forEach(d => {
        const dk = catLabelToKey.get(d);
        if (!dk) fail(`jukugo: distractor "${d}" is not a real category label`);
        if (dk === trueCat) fail(`jukugo collision: distractor "${d}" is also ${w}'s category`);
      });
    }
    if (key === 'setsuzoku') {
      // itemRef: kokugo4/grammar/setsuzoku/<relation>/<pairIdx>. correct must be a
      // connective of that relation; NO distractor may be in that relation's set.
      const rel = q.itemRef.split('/')[3];
      const ownSet = new Set(SETSUZOKU[rel].conj);
      if (!ownSet.has(q.correctAnswer)) fail(`setsuzoku: correct "${q.correctAnswer}" not in ${rel}'s set`);
      distractors.forEach(d => {
        if (!SETSUZOKU_POOL.includes(d)) fail(`setsuzoku: distractor "${d}" is not a real connective`);
        if (ownSet.has(d)) fail(`setsuzoku collision: distractor "${d}" also fits ${rel}`);
      });
    }
    if (key === 'shugo_jutsugo') {
      // correct must be exactly one 文節 of the sentence; the other three options
      // are the remaining 文節. Structurally: 主語 ends in が/は, 述語 ends in 。
      const which = q.itemRef.split('/')[3]; // 'shugo' | 'jutsugo'
      if (which === 'shugo') {
        if (!/(が|は)$/.test(q.correctAnswer)) fail(`shugo: correct "${q.correctAnswer}" is not a subject 文節`);
        // no distractor may itself be a subject 文節 (only one subject exists)
        distractors.forEach(d => { if (/(が|は)$/.test(d)) fail(`shugo collision: distractor "${d}" is also a subject 文節`); });
      } else if (which === 'jutsugo') {
        if (!/。$/.test(q.correctAnswer)) fail(`jutsugo: correct "${q.correctAnswer}" is not a predicate 文節`);
        distractors.forEach(d => { if (/。$/.test(d)) fail(`jutsugo collision: distractor "${d}" is also a predicate 文節`); });
      } else fail(`shugo_jutsugo: unexpected ref ${q.itemRef}`);
    }
    if (key === 'kanyouku') {
      if (q.itemRef.includes('/toM/')) {
        distractors.forEach(d => {
          if (!phraseByMeaning.has(d)) fail(`kanyouku toM: distractor not a real meaning: ${d}`);
          if (phraseByMeaning.get(d) === q.itemRef.split('/toM/')[1]) fail(`kanyouku toM collision: ${d}`);
        });
      } else {
        const targetPhrase = q.itemRef.split('/toP/')[1];
        const targetMeaning = meaningByPhrase.get(targetPhrase);
        distractors.forEach(d => {
          if (meaningByPhrase.get(d) === targetMeaning) fail(`kanyouku toP collision: ${d} shares meaning with ${targetPhrase}`);
        });
      }
    }
  }
}

// coverage: each finite bank/category is actually exercised.
{
  const bushuKanji = new Set(Object.keys(counts.bushu.byRef).map(r => r.split('/')[3]));
  if (bushuKanji.size < BUSHU.length) fail(`bushu did not cover all kanji: ${bushuKanji.size}/${BUSHU.length}`);
  const jukugoW = new Set(Object.keys(counts.jukugo.byRef).map(r => r.split('/')[3]));
  if (jukugoW.size < JUKUGO.length) fail(`jukugo did not cover all compounds: ${jukugoW.size}/${JUKUGO.length}`);
  const setsuRels = new Set(Object.keys(counts.setsuzoku.byRef).map(r => r.split('/')[3]));
  if (setsuRels.size !== SETSUZOKU_KEYS.length) fail(`setsuzoku did not exercise all relations: ${[...setsuRels]}`);
  const sjRefs = new Set(Object.keys(counts.shugo_jutsugo.byRef));
  if (sjRefs.size !== 2) fail(`shugo_jutsugo should ask both 主語 and 述語: ${[...sjRefs]}`);
  const kanyoPhrases = new Set(Object.keys(counts.kanyouku.byRef).map(r => r.split('/').pop()));
  if (kanyoPhrases.size < KANYOUKU.length) fail(`kanyouku did not cover all phrases: ${kanyoPhrases.size}/${KANYOUKU.length}`);
}

// generateGrammarQuiz: right length; finite banks avoid intra-session repeats.
{
  for (const key of Object.keys(GRAMMAR_UNITS)) {
    const quiz = generateGrammarQuiz(key, 10);
    if (quiz.length !== 10) fail(`generateGrammarQuiz(${key},10) length ${quiz.length}`);
  }
  for (let t = 0; t < 500; t++) {
    for (const key of ['bushu', 'jukugo', 'setsuzoku', 'kanyouku']) {
      const quiz = generateGrammarQuiz(key, 10);
      const bases = quiz.map(q => {
        if (key === 'kanyouku') return q.itemRef.replace(/\/(toP|toM)\//, '/');
        return q.itemRef;
      });
      if (new Set(bases).size !== bases.length) fail(`${key} session repeated an item: ${JSON.stringify(bases)}`);
    }
  }
}

if (failures === 0) {
  console.log(`OK — ${Object.keys(GRAMMAR_UNITS).length} generators x ${PER_UNIT} each, all structural + collision checks passed.`);
  console.log('itemRef coverage:', Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Object.keys(v.byRef).length + ' refs'])));
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
