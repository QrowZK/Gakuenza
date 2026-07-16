// Stress test for kokugo6's grammar-generators.js. Run:
//   node tests/kokugo6/grammar-generators.test.js
// Same discipline as kokugo3's grammar test: generate at scale and check EVERY
// question for structural bugs AND the distractor-collision bug (a "wrong"
// option that is secretly also a valid answer), plus the per-unit curated
// invariants each generator's collision-safety relies on.
const G = require('../../gakuenza.com/modules/kokugo6/grammar-generators.js');
const { GRAMMAR_UNITS, generateGrammarQuiz } = G;
const {
  KEIGO, sonForms, kenForms,
  JUKUGO_CATS, JUKUGO_WORDS, JUKUGO_WORD_CAT,
  GOSHU_LABEL, GOSHU_WORDS, GOSHU_WORD_TYPE,
  YOJI,
} = G._internals;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 50) console.error('FAIL:', msg); };

// ── curated-invariant checks (the foundation every collision guard rests on) ──
{
  // keigo (a): son-forms unique, ken-forms unique, son ∩ ken = ∅.
  const sonSet = new Set(), kenSet = new Set();
  sonForms.forEach(f => { if (sonSet.has(f)) fail(`duplicate son form: ${f}`); sonSet.add(f); });
  kenForms.forEach(f => { if (kenSet.has(f)) fail(`duplicate ken form: ${f}`); kenSet.add(f); });
  sonForms.forEach(f => { if (kenSet.has(f)) fail(`form is both son and ken: ${f}`); });
  if (sonForms.length < 4) fail(`too few son forms for 4-option questions: ${sonForms.length}`);
  if (kenForms.length < 4) fail(`too few ken forms for 4-option questions: ${kenForms.length}`);
  // keigo (b): each multi-verb special form maps to at most one bank entry.
  ['いらっしゃる', '参る', 'いただく', 'おいでになる'].forEach(shared => {
    const hits = KEIGO.filter(e => e.son === shared || e.ken === shared).length;
    if (hits > 1) fail(`shared keigo form ${shared} used by ${hits} entries (collision risk)`);
  });

  // jukugo: single-membership — no word appears under two categories.
  const jseen = new Map();
  for (const cat of Object.keys(JUKUGO_WORDS)) {
    for (const w of JUKUGO_WORDS[cat]) {
      if (jseen.has(w)) fail(`jukugo word ${w} in two categories: ${jseen.get(w)} & ${cat}`);
      jseen.set(w, cat);
      if ([...w].length !== 2) fail(`jukugo word not 2 chars: ${w}`);
    }
  }
  // goshu: single-membership.
  const gseen = new Map();
  for (const t of Object.keys(GOSHU_WORDS)) {
    for (const w of GOSHU_WORDS[t]) {
      if (gseen.has(w)) fail(`goshu word ${w} in two types: ${gseen.get(w)} & ${t}`);
      gseen.set(w, t);
    }
  }
  // yoji: distinct idioms AND distinct meanings.
  const ps = new Set(), ms = new Set();
  YOJI.forEach(e => {
    if (ps.has(e.p)) fail(`duplicate yoji idiom: ${e.p}`);
    if (ms.has(e.m)) fail(`duplicate yoji meaning: ${e.m}`);
    ps.add(e.p); ms.add(e.m);
  });
  if (YOJI.length < 8) fail(`yoji bank too small: ${YOJI.length}`);
}

// Lookups for collision detection.
const meaningByIdiom = new Map(YOJI.map(e => [e.p, e.m]));
const idiomByMeaning = new Map(YOJI.map(e => [e.m, e.p]));
const jukugoLabelToCat = Object.fromEntries(Object.entries(JUKUGO_CATS).map(([k, v]) => [v, k]));

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
      const parts = q.itemRef.split('/'); // kokugo6/grammar/keigo/(form|classify)/<type>/...
      const form = parts[3], type = parts[4];
      if (form === 'form') {
        // correct is the target's own son/ken; NO distractor may also be a
        // valid form of the SAME plain verb & type. Since a plain verb has
        // exactly one bank form per type, that means: no distractor equals a
        // form of the target entry.
        const plain = parts[5];
        const entry = KEIGO.find(e => e.plain === plain);
        if (!entry || entry[type] !== q.correctAnswer) fail(`keigo form: ${plain} ${type} != ${q.correctAnswer}`);
        // every option must be a real form of the SAME type (tests the "which
        // verb maps here" skill), and none other than the correct one may be a
        // valid form of `plain`.
        const validForType = new Set(type === 'son' ? sonForms : kenForms);
        distractors.forEach(d => {
          if (!validForType.has(d)) fail(`keigo form: distractor '${d}' not a ${type} form`);
          if (d === entry[type]) fail(`keigo form collision: '${d}' also the ${type} of ${plain}`);
        });
      } else {
        // classify: the asked type is `type`; correct is a form OF that type;
        // every distractor must be of the OTHER type (never also the asked type).
        const askedIsSon = type === 'son';
        const askedForms = new Set(askedIsSon ? sonForms : kenForms);
        const otherForms = new Set(askedIsSon ? kenForms : sonForms);
        if (!askedForms.has(q.correctAnswer)) fail(`keigo classify: correct '${q.correctAnswer}' not a ${type} form`);
        distractors.forEach(d => {
          if (askedForms.has(d)) fail(`keigo classify collision: distractor '${d}' is also ${type}`);
          if (!otherForms.has(d)) fail(`keigo classify: distractor '${d}' not a valid keigo form`);
        });
      }
    }

    if (key === 'jukugo') {
      const parts = q.itemRef.split('/'); // .../jukugo/(type|pick)/...
      const form = parts[3];
      if (form === 'type') {
        // options are the 4 category labels; correct is the word's category.
        const word = parts[4];
        const cat = JUKUGO_WORD_CAT[word];
        if (JUKUGO_CATS[cat] !== q.correctAnswer) fail(`jukugo type: ${word} label mismatch`);
        // all four labels present exactly once → covered by option checks.
        distractors.forEach(d => {
          const dcat = jukugoLabelToCat[d];
          if (dcat === cat) fail(`jukugo type collision: distractor label equals correct category`);
        });
      } else {
        // pick: correct is a word of the asked category; distractors must be
        // words NOT of that category (single-membership guarantees it).
        const cat = parts[4], word = parts[5];
        if (JUKUGO_WORD_CAT[word] !== cat) fail(`jukugo pick: ${word} not in ${cat}`);
        distractors.forEach(d => {
          if (JUKUGO_WORD_CAT[d] === cat) fail(`jukugo pick collision: distractor ${d} also in ${cat}`);
        });
      }
    }

    if (key === 'goshu') {
      const parts = q.itemRef.split('/'); // .../goshu/<type>/<word>
      const type = parts[3], word = parts[4];
      if (GOSHU_WORD_TYPE[word] !== type) fail(`goshu: ${word} not ${type}`);
      distractors.forEach(d => {
        if (GOSHU_WORD_TYPE[d] === type) fail(`goshu collision: distractor ${d} also ${type}`);
      });
    }

    if (key === 'yoji') {
      if (q.itemRef.includes('/toP/')) {
        // options are idioms; correct is the idiom for a given meaning. A
        // distractor idiom must not share the meaning (unique meanings ⇒ safe).
        distractors.forEach(d => {
          if (!meaningByIdiom.has(d)) fail(`yoji toP: distractor not a real idiom: ${d}`);
          if (meaningByIdiom.get(d) === meaningByIdiom.get(q.correctAnswer)) fail(`yoji toP collision: ${d}`);
        });
      } else {
        // options are meanings; correct is the meaning of a given idiom. A
        // distractor meaning must belong to a different idiom.
        distractors.forEach(d => {
          if (!idiomByMeaning.has(d)) fail(`yoji toM: distractor not a real meaning: ${d}`);
          if (d === q.correctAnswer) fail(`yoji toM: distractor equals correct`);
        });
      }
    }
  }
}

// coverage sanity
{
  const yojiRefs = new Set(Object.keys(counts.yoji.byRef).map(r => r.split('/').pop()));
  if (yojiRefs.size < YOJI.length) fail(`yoji did not cover all idioms: ${yojiRefs.size}/${YOJI.length}`);
  ['son', 'ken'].forEach(t => {
    const anyForm = Object.keys(counts.keigo.byRef).some(r => r.includes(`/form/${t}/`));
    const anyClass = Object.keys(counts.keigo.byRef).some(r => r.includes(`/classify/${t}/`));
    if (!anyForm) fail(`keigo: no form question for ${t}`);
    if (!anyClass) fail(`keigo: no classify question for ${t}`);
  });
  Object.keys(JUKUGO_CATS).forEach(cat => {
    const seen = Object.keys(counts.jukugo.byRef).some(r => r.includes(`/pick/${cat}/`));
    if (!seen) fail(`jukugo: category ${cat} never used in pick form`);
  });
  Object.keys(GOSHU_LABEL).forEach(t => {
    const seen = Object.keys(counts.goshu.byRef).some(r => r.includes(`/goshu/${t}/`));
    if (!seen) fail(`goshu: type ${t} never used`);
  });
}

// generateGrammarQuiz: right length; yoji avoids intra-session duplicate idiom.
{
  for (const key of Object.keys(GRAMMAR_UNITS)) {
    const quiz = generateGrammarQuiz(key, 10);
    if (quiz.length !== 10) fail(`generateGrammarQuiz(${key},10) length ${quiz.length}`);
  }
  for (let t = 0; t < 500; t++) {
    const quiz = generateGrammarQuiz('yoji', 10);
    const bases = quiz.map(q => q.itemRef.replace(/\/(toP|toM)\//, '/'));
    if (new Set(bases).size !== bases.length) fail(`yoji session repeated an idiom: ${JSON.stringify(bases)}`);
  }
}

if (failures === 0) {
  console.log(`OK — ${Object.keys(GRAMMAR_UNITS).length} generators × ${PER_UNIT} each, all structural + collision + invariant checks passed.`);
  console.log('itemRef coverage:', Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Object.keys(v.byRef).length + ' refs'])));
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
