// Stress test for kokugo1/unit-generators.js. Run: node unit-generators.test.js
// Same discipline the kanji generator earned the hard way: generate at scale and
// check EVERY question for structural bugs AND the distractor-collision bug (a
// "wrong" option that is secretly also a valid answer). Grade 1 is かな-first, so
// the four units under test are ひらがな / カタカナ / 助詞(は・を・へ) / 句読点・かぎ.
const U = require('../../gakuenza.com/modules/kokugo1/unit-generators.js');
const { KOKUGO1_UNITS, generateUnitQuiz } = U;
const {
  GOJUON, DAKUTEN, HANDAKUTEN, HIRA_WORDS, KATA_WORDS,
  JOSHI_SENTENCES, JOSHI_TWINS, KUTOUTEN_ITEMS, KUTOUTEN_MARKS,
} = U._internals;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// ── bank invariants (the source of each generator's collision-safety) ──
{
  // gojuon: every sound maps to exactly one hiragana and one katakana; all
  // distinct (so any other kana is a different sound, never also-correct).
  const hs = new Set(), ks = new Set();
  GOJUON.forEach(e => {
    if (hs.has(e.h)) fail(`duplicate hiragana in gojuon: ${e.h}`);
    if (ks.has(e.k)) fail(`duplicate katakana in gojuon: ${e.k}`);
    hs.add(e.h); ks.add(e.k);
  });
  if (GOJUON.length !== 46) fail(`gojuon should have 46 base kana, got ${GOJUON.length}`);

  // dakuten/handakuten: each base maps to exactly one transformed kana; the
  // transformed kana are all distinct.
  const ds = new Set();
  DAKUTEN.forEach(e => { if (ds.has(e.d)) fail(`dup dakuten ${e.d}`); ds.add(e.d); });
  HANDAKUTEN.forEach(e => { if (ds.has(e.d)) fail(`dup handakuten ${e.d}`); ds.add(e.d); });

  // spelling banks: for each entry the correct word is NOT among its own `wrong`
  // list, and every `wrong` is a distinct string (so a distractor can never
  // equal the target — the "alternate valid spelling" trap).
  [...HIRA_WORDS, ...KATA_WORDS].forEach(e => {
    if (e.wrong.includes(e.w)) fail(`spelling: correct "${e.w}" appears in its own wrong list`);
    if (new Set(e.wrong).size !== e.wrong.length) fail(`spelling: duplicate wrongs for ${e.w}`);
    if (e.wrong.length < 3) fail(`spelling: <3 distractors for ${e.w}`);
    if (!e.gloss || e.gloss.includes(e.w)) fail(`spelling: gloss for ${e.w} missing or reveals the word`);
  });
  // The gloss must uniquely identify one word — assert no two entries share a gloss.
  const glosses = new Set();
  [...HIRA_WORDS, ...KATA_WORDS].forEach(e => {
    if (glosses.has(e.gloss)) fail(`spelling: duplicate gloss "${e.gloss}"`);
    glosses.add(e.gloss);
  });

  // joshi: every sentence's particle is one of は/を/へ; twins are exactly {わ,お,え}
  // and never overlap the particles (so a twin is never a valid answer).
  JOSHI_SENTENCES.forEach(s => {
    if (!['は', 'を', 'へ'].includes(s.particle)) fail(`joshi: bad particle ${s.particle} in ${s.id}`);
    if ((s.text.match(/＿/g) || []).length !== 1) fail(`joshi: ${s.id} must have exactly one blank`);
  });
  JOSHI_TWINS.forEach(t => { if (['は', 'を', 'へ'].includes(t)) fail(`joshi twin ${t} collides with a particle`); });
  if (JOSHI_TWINS.length !== 3) fail(`joshi twins should be exactly 3, got ${JOSHI_TWINS.length}`);

  // kutouten: 4 marks; each item's correct mark is one of them and the blank is
  // unique. かぎ items must show the paired bracket literally.
  KUTOUTEN_ITEMS.forEach(it => {
    if (!KUTOUTEN_MARKS.includes(it.correct)) fail(`kutouten: bad correct mark ${it.correct} in ${it.id}`);
    if ((it.text.match(/＿/g) || []).length !== 1) fail(`kutouten: ${it.id} must have exactly one blank`);
    if (it.kind === 'kagi_open' && !it.text.includes('」')) fail(`kutouten: kagi_open ${it.id} should show the closing 」`);
    if (it.kind === 'kagi_close' && !it.text.includes('「')) fail(`kutouten: kagi_close ${it.id} should show the opening 「`);
  });
  if (KUTOUTEN_MARKS.length !== 4) fail(`kutouten should offer exactly 4 marks`);
}

// lookups for collision detection
const hiraBySound = new Map(GOJUON.map(e => [e.k, e.h]));   // katakana -> correct hiragana
const kataBySound = new Map(GOJUON.map(e => [e.h, e.k]));   // hiragana -> correct katakana
const dakuByBase = new Map(DAKUTEN.map(e => [e.base, e.d]));
const handakuByBase = new Map(HANDAKUTEN.map(e => [e.base, e.d]));
const hiraWordByW = new Map(HIRA_WORDS.map(e => [e.w, e]));
const kataWordByW = new Map(KATA_WORDS.map(e => [e.w, e]));
const joshiById = new Map(JOSHI_SENTENCES.map(s => [s.id, s]));
const kutById = new Map(KUTOUTEN_ITEMS.map(it => [it.id, it]));

const PER_UNIT = 5000;
const counts = {};
for (const key of Object.keys(KOKUGO1_UNITS)) {
  counts[key] = { total: 0, byRef: {} };
  for (let n = 0; n < PER_UNIT; n++) {
    const q = KOKUGO1_UNITS[key].gen();
    counts[key].total++;
    counts[key].byRef[q.itemRef] = (counts[key].byRef[q.itemRef] || 0) + 1;

    // ── universal structural checks ──
    if (!q.prompt || !q.category || !q.itemRef) fail(`${key}: missing prompt/category/itemRef`);
    if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${key}: options != 4 (${q.options && q.options.length}) :: ${q.prompt}`);
    if (new Set(q.options).size !== 4) fail(`${key}: duplicate options :: ${JSON.stringify(q.options)}`);
    if (!q.options.includes(q.correctAnswer)) fail(`${key}: correct not among options :: ${q.correctAnswer} / ${JSON.stringify(q.options)}`);
    q.options.forEach(o => { if (o == null || o === '') fail(`${key}: empty option :: ${q.prompt}`); });

    const parts = q.itemRef.split('/'); // kokugo1/<unit>/<sub>/<id...>
    const sub = parts[2];
    const distractors = q.options.filter(o => o !== q.correctAnswer);

    // ── per-unit collision checks ──
    if (key === 'hiragana') {
      if (sub === 'gojuon') {
        const kata = parts[3] && kataBySound.get(parts[3]); // parts[3] is the hiragana id
        // correct must be the hiragana of the shown katakana; and no distractor
        // may be a hiragana whose sound equals the prompt's katakana (only one).
        const h = parts[3];
        if (q.correctAnswer !== h) fail(`hira gojuon: correct ${q.correctAnswer} != id ${h}`);
        distractors.forEach(d => { if (d === h) fail(`hira gojuon collision`); });
      } else if (sub === 'dakuten') {
        const base = parts[3];
        if (q.correctAnswer !== dakuByBase.get(base)) fail(`dakuten: correct ${q.correctAnswer} != ${base}+゛ (${dakuByBase.get(base)})`);
        distractors.forEach(d => { if (d === dakuByBase.get(base)) fail(`dakuten collision on ${base}`); });
      } else if (sub === 'handakuten') {
        const base = parts[3];
        if (q.correctAnswer !== handakuByBase.get(base)) fail(`handakuten: correct ${q.correctAnswer} != ${base}+゜ (${handakuByBase.get(base)})`);
        distractors.forEach(d => { if (d === handakuByBase.get(base)) fail(`handakuten collision on ${base}`); });
      } else if (sub === 'spell') {
        const w = parts[3];
        const entry = hiraWordByW.get(w);
        if (!entry) fail(`hira spell: unknown word ${w}`);
        else {
          if (q.correctAnswer !== w) fail(`hira spell: correct ${q.correctAnswer} != ${w}`);
          distractors.forEach(d => { if (!entry.wrong.includes(d)) fail(`hira spell: distractor "${d}" not an authored mis-spelling of ${w}`); });
        }
      } else fail(`hiragana: unexpected sub ${sub}`);
    }

    if (key === 'katakana') {
      if (sub === 'gojuon') {
        const h = parts[3];
        if (q.correctAnswer !== kataBySound.get(h)) fail(`kata gojuon: correct ${q.correctAnswer} != ${h}->kata (${kataBySound.get(h)})`);
        distractors.forEach(d => { if (d === kataBySound.get(h)) fail(`kata gojuon collision on ${h}`); });
      } else if (sub === 'spell') {
        const w = parts[3];
        const entry = kataWordByW.get(w);
        if (!entry) fail(`kata spell: unknown word ${w}`);
        else {
          if (q.correctAnswer !== w) fail(`kata spell: correct ${q.correctAnswer} != ${w}`);
          distractors.forEach(d => { if (!entry.wrong.includes(d)) fail(`kata spell: distractor "${d}" not an authored mis-spelling of ${w}`); });
        }
      } else fail(`katakana: unexpected sub ${sub}`);
    }

    if (key === 'joshi') {
      const particle = parts[2];
      const id = parts[3];
      const s = joshiById.get(id);
      if (!s) fail(`joshi: unknown id ${id}`);
      else if (s.particle !== particle || q.correctAnswer !== particle) fail(`joshi: ${id} particle mismatch (${particle}/${q.correctAnswer}/${s.particle})`);
      // every distractor is a phonetic twin and never a real particle.
      distractors.forEach(d => {
        if (!JOSHI_TWINS.includes(d)) fail(`joshi: distractor "${d}" is not a twin kana`);
        if (['は', 'を', 'へ'].includes(d)) fail(`joshi: distractor "${d}" is a real particle`);
      });
    }

    if (key === 'kutouten') {
      const kind = parts[2];
      const id = parts[3];
      const it = kutById.get(id);
      if (!it) fail(`kutouten: unknown id ${id}`);
      else if (it.kind !== kind || it.correct !== q.correctAnswer) fail(`kutouten: ${id} mismatch (${kind}/${q.correctAnswer}/${it.correct})`);
      distractors.forEach(d => {
        if (!KUTOUTEN_MARKS.includes(d)) fail(`kutouten: distractor "${d}" not a punctuation mark`);
        if (d === q.correctAnswer) fail(`kutouten: distractor equals correct`);
      });
    }
  }
}

// coverage: each generator exercises every bank item / sub-type at scale.
{
  const hiraSubs = new Set(Object.keys(counts.hiragana.byRef).map(r => r.split('/')[2]));
  ['gojuon', 'dakuten', 'handakuten', 'spell'].forEach(s => { if (!hiraSubs.has(s)) fail(`hiragana never produced sub "${s}"`); });
  const hiraSpellWords = new Set(Object.keys(counts.hiragana.byRef).filter(r => r.includes('/spell/')).map(r => r.split('/')[3]));
  if (hiraSpellWords.size < HIRA_WORDS.length) fail(`hiragana spell missed words: ${hiraSpellWords.size}/${HIRA_WORDS.length}`);

  const kataSubs = new Set(Object.keys(counts.katakana.byRef).map(r => r.split('/')[2]));
  ['gojuon', 'spell'].forEach(s => { if (!kataSubs.has(s)) fail(`katakana never produced sub "${s}"`); });
  const kataSpellWords = new Set(Object.keys(counts.katakana.byRef).filter(r => r.includes('/spell/')).map(r => r.split('/')[3]));
  if (kataSpellWords.size < KATA_WORDS.length) fail(`katakana spell missed words: ${kataSpellWords.size}/${KATA_WORDS.length}`);

  const joshiIds = new Set(Object.keys(counts.joshi.byRef).map(r => r.split('/')[3]));
  if (joshiIds.size < JOSHI_SENTENCES.length) fail(`joshi missed sentences: ${joshiIds.size}/${JOSHI_SENTENCES.length}`);
  const joshiParticles = new Set(Object.keys(counts.joshi.byRef).map(r => r.split('/')[2]));
  ['は', 'を', 'へ'].forEach(p => { if (!joshiParticles.has(p)) fail(`joshi never tested particle ${p}`); });

  const kutIds = new Set(Object.keys(counts.kutouten.byRef).map(r => r.split('/')[3]));
  if (kutIds.size < KUTOUTEN_ITEMS.length) fail(`kutouten missed items: ${kutIds.size}/${KUTOUTEN_ITEMS.length}`);
  const kutKinds = new Set(Object.keys(counts.kutouten.byRef).map(r => r.split('/')[2]));
  ['kuten', 'touten', 'kagi_open', 'kagi_close'].forEach(k => { if (!kutKinds.has(k)) fail(`kutouten never tested kind ${k}`); });
}

// generateUnitQuiz: right length; distinct items within a session where the bank allows.
{
  for (const key of Object.keys(KOKUGO1_UNITS)) {
    const quiz = generateUnitQuiz(key, 10);
    if (quiz.length !== 10) fail(`generateUnitQuiz(${key},10) length ${quiz.length}`);
    quiz.forEach(q => {
      if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4) fail(`generateUnitQuiz(${key}): malformed options`);
      if (!q.options.includes(q.correctAnswer)) fail(`generateUnitQuiz(${key}): correct not in options`);
    });
  }
}

if (failures === 0) {
  console.log(`OK — ${Object.keys(KOKUGO1_UNITS).length} generators x ${PER_UNIT} each, all structural + collision checks passed.`);
  console.log('itemRef coverage:', Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Object.keys(v.byRef).length + ' refs'])));
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
