// Stress test for kokugo5/grammar-generators.js. Run: node grammar-generators.test.js
// Same discipline the kanji generator earned the hard way: generate at scale and
// check EVERY question for structural bugs AND the distractor-collision bug (a
// "wrong" option that is secretly also a valid answer).
const G = require('../../gakuenza.com/modules/kokugo5/grammar-generators.js');
const { GRAMMAR_UNITS, generateGrammarQuiz } = G;
const { KEIGO_VERBS, KANYOUKU, GOSHU, GOSHU_KEYS, DOUKUN } = G._internals;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// ── bank invariants (the source of each generator's collision-safety) ──
{
  // keigo: for every (verb, category) the correct form is a single string, and
  // no category's form is empty.
  KEIGO_VERBS.forEach(v => ['sonkei', 'kenjou', 'teinei'].forEach(c => {
    if (!v[c]) fail(`keigo: ${v.plain} missing ${c}`);
  }));
  // kanyouku: all meanings distinct AND all phrases distinct (the "no two share
  // a meaning" curation invariant that makes any other entry a safe distractor).
  const ms = new Set(), ps = new Set();
  KANYOUKU.forEach(e => {
    if (ms.has(e.m)) fail(`duplicate kanyouku meaning: ${e.m}`);
    if (ps.has(e.p)) fail(`duplicate kanyouku phrase: ${e.p}`);
    ms.add(e.m); ps.add(e.p);
  });
  if (KANYOUKU.length < 12) fail(`kanyouku bank unexpectedly small: ${KANYOUKU.length}`);
  // goshu: every word belongs to exactly ONE origin category (no word appears in
  // two lists — that would make the "which is the 外来語?" question ambiguous).
  const wordCat = new Map();
  GOSHU_KEYS.forEach(k => GOSHU[k].words.forEach(w => {
    if (wordCat.has(w)) fail(`goshu: "${w}" is in both ${wordCat.get(w)} and ${k}`);
    wordCat.set(w, k);
  }));
  // doukun: each item has exactly 4 distinct option-kanji, correct included, and
  // the distractors are true same-reading homophones (by authoring).
  DOUKUN.forEach(it => {
    const opts = [it.correct, ...it.distractors];
    if (opts.length !== 4) fail(`doukun ${it.reading}: not 4 options`);
    if (new Set(opts).size !== 4) fail(`doukun ${it.reading}: duplicate option kanji ${JSON.stringify(opts)}`);
    if (!it.sentence.includes('＿')) fail(`doukun ${it.reading}: sentence has no blank`);
  });
  if (DOUKUN.length < 8) fail(`doukun bank unexpectedly small: ${DOUKUN.length}`);
}

// build lookups for collision detection
const meaningByPhrase = new Map(KANYOUKU.map(e => [e.p, e.m]));
const phraseByMeaning = new Map(KANYOUKU.map(e => [e.m, e.p]));
const goshuCatOf = new Map();
GOSHU_KEYS.forEach(k => GOSHU[k].words.forEach(w => goshuCatOf.set(w, k)));

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
    if (key === 'keigo') {
      // itemRef: kokugo5/grammar/keigo/<plain>/<cat>. The correct form is the
      // verb's form for that category; no distractor may equal it (guaranteed by
      // the != filter, but assert). Distractors must be REAL honorific forms
      // from the bank, never random strings.
      const [, , , plain, cat] = q.itemRef.split('/');
      const verb = KEIGO_VERBS.find(v => v.plain === plain);
      if (!verb) fail(`keigo: unknown verb ${plain}`);
      else if (verb[cat] !== q.correctAnswer) fail(`keigo: correct ${q.correctAnswer} != ${plain}.${cat} (${verb[cat]})`);
      const allForms = new Set();
      KEIGO_VERBS.forEach(v => [v.sonkei, v.kenjou, v.teinei].forEach(f => allForms.add(f)));
      distractors.forEach(d => { if (!allForms.has(d)) fail(`keigo: distractor "${d}" is not a real honorific form`); });
    }
    if (key === 'kanyouku') {
      if (q.itemRef.includes('/toM/')) {
        // options are meanings; a distractor meaning must map to a DIFFERENT
        // phrase than the correct one (distinct-meaning invariant).
        distractors.forEach(d => {
          if (!phraseByMeaning.has(d)) fail(`kanyouku toM: distractor not a real meaning: ${d}`);
          if (phraseByMeaning.get(d) === q.itemRef.split('/toM/')[1]) fail(`kanyouku toM collision: ${d}`);
        });
      } else {
        // options are phrases; a distractor phrase must NOT share the target's meaning.
        const targetPhrase = q.itemRef.split('/toP/')[1];
        const targetMeaning = meaningByPhrase.get(targetPhrase);
        distractors.forEach(d => {
          if (meaningByPhrase.get(d) === targetMeaning) fail(`kanyouku toP collision: ${d} shares meaning with ${targetPhrase}`);
        });
      }
    }
    if (key === 'goshu') {
      // itemRef: kokugo5/grammar/goshu/<targetCat>/<word>. correct word's origin
      // must equal targetCat; every distractor must be a DIFFERENT origin.
      const targetCat = q.itemRef.split('/')[3];
      if (goshuCatOf.get(q.correctAnswer) !== targetCat) fail(`goshu: ${q.correctAnswer} is ${goshuCatOf.get(q.correctAnswer)}, not ${targetCat}`);
      distractors.forEach(d => {
        if (goshuCatOf.get(d) === targetCat) fail(`goshu collision: distractor "${d}" is also ${targetCat}`);
        if (!goshuCatOf.has(d)) fail(`goshu: distractor "${d}" not in any bank list`);
      });
    }
    if (key === 'doukun') {
      // options must be exactly one authored item's 4 same-reading kanji.
      const reading = q.itemRef.split('/')[3];
      const item = DOUKUN.find(it => it.reading === reading && it.correct === q.correctAnswer);
      if (!item) fail(`doukun: no item for ${reading}/${q.correctAnswer}`);
      else {
        const expected = new Set([item.correct, ...item.distractors]);
        q.options.forEach(o => { if (!expected.has(o)) fail(`doukun: option "${o}" not in item ${reading}`); });
      }
    }
  }
}

// coverage: kanyouku hits every phrase; goshu exercises all 3 categories; doukun
// exercises every authored item; keigo covers all verbs and all 3 categories.
{
  const kanyoRefs = Object.keys(counts.kanyouku.byRef);
  const phrasesSeen = new Set(kanyoRefs.map(r => r.split('/').pop()));
  if (phrasesSeen.size < KANYOUKU.length) fail(`kanyouku did not cover all phrases: ${phrasesSeen.size}/${KANYOUKU.length}`);
  const goshuCats = new Set(Object.keys(counts.goshu.byRef).map(r => r.split('/')[3]));
  if (goshuCats.size !== 3) fail(`goshu did not exercise all 3 categories: ${[...goshuCats]}`);
  const doukunItems = new Set(Object.keys(counts.doukun.byRef).map(r => r.split('/').slice(3).join('/')));
  if (doukunItems.size < DOUKUN.length) fail(`doukun did not cover all items: ${doukunItems.size}/${DOUKUN.length}`);
  const keigoCats = new Set(Object.keys(counts.keigo.byRef).map(r => r.split('/').pop()));
  if (keigoCats.size !== 3) fail(`keigo did not exercise all 3 categories: ${[...keigoCats]}`);
}

// generateGrammarQuiz: right length; finite banks avoid intra-session repeats.
{
  for (const key of Object.keys(GRAMMAR_UNITS)) {
    const quiz = generateGrammarQuiz(key, 10);
    if (quiz.length !== 10) fail(`generateGrammarQuiz(${key},10) length ${quiz.length}`);
  }
  for (let t = 0; t < 500; t++) {
    for (const key of ['kanyouku', 'doukun']) {
      const quiz = generateGrammarQuiz(key, 10);
      const bases = quiz.map(q => {
        if (key === 'kanyouku') return q.itemRef.replace(/\/(toP|toM)\//, '/');
        return q.itemRef; // doukun: each (reading, kanji) is its own item
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
