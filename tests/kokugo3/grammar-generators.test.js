// Stress test for grammar-generators.js. Run: node grammar-generators.test.js
// Mirrors the discipline the kanji generator earned the hard way: generate at
// scale and check EVERY question for structural bugs AND the distractor-
// collision bug (a "wrong" option that is secretly also a valid answer).
const G = require('../../gakuenza.com/modules/kokugo3/grammar-generators.js');
const { GRAMMAR_UNITS, generateGrammarQuiz } = G;
const { KOTOWAZA, ROMAJI_BANK, romanizeKunrei, toHepburn } = G._internals;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// Build a lookup: for kotowaza, meaning<->proverb; for romaji, kana<->romaji,
// so we can detect a distractor that is ALSO a correct answer.
const proverbByMeaning = new Map(KOTOWAZA.map(e => [e.m, e.p]));
const meaningByProverb = new Map(KOTOWAZA.map(e => [e.p, e.m]));
// romaji: which kana map to a given kunrei string, and set of valid romaji per kana
const kanaByRomaji = new Map();
ROMAJI_BANK.forEach(e => {
  if (!kanaByRomaji.has(e.rom)) kanaByRomaji.set(e.rom, new Set());
  kanaByRomaji.get(e.rom).add(e.kana);
});

// Sanity: no two bank meanings/proverbs collide (curation invariant).
{
  const ms = new Set(), ps = new Set();
  KOTOWAZA.forEach(e => {
    if (ms.has(e.m)) fail(`duplicate kotowaza meaning: ${e.m}`);
    if (ps.has(e.p)) fail(`duplicate kotowaza proverb: ${e.p}`);
    ms.add(e.m); ps.add(e.p);
  });
  // no two bank words share a kunrei romaji (would make romaji->kana ambiguous)
  const seen = new Map();
  ROMAJI_BANK.forEach(e => {
    if (seen.has(e.rom)) fail(`two kana share kunrei romaji ${e.rom}: ${seen.get(e.rom)} / ${e.kana}`);
    seen.set(e.rom, e.kana);
  });
  if (ROMAJI_BANK.length < 30) fail(`romaji bank unexpectedly small: ${ROMAJI_BANK.length}`);
}

const PER_UNIT = 4000;
const counts = {};
for (const key of Object.keys(GRAMMAR_UNITS)) {
  counts[key] = { total: 0, byRef: {} };
  for (let n = 0; n < PER_UNIT; n++) {
    const q = GRAMMAR_UNITS[key].gen();
    counts[key].total++;
    counts[key].byRef[q.itemRef] = (counts[key].byRef[q.itemRef] || 0) + 1;

    // ── universal structural checks ──
    if (!q.prompt || !q.category) fail(`${key}: missing prompt/category`);
    if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${key}: options != 4 (${q.options && q.options.length}) :: ${q.prompt}`);
    const uniq = new Set(q.options);
    if (uniq.size !== 4) fail(`${key}: duplicate options :: ${JSON.stringify(q.options)}`);
    if (!q.options.includes(q.correctAnswer)) fail(`${key}: correct answer not among options :: ${q.correctAnswer} / ${JSON.stringify(q.options)}`);
    q.options.forEach(o => { if (o == null || o === '') fail(`${key}: empty option :: ${q.prompt}`); });

    // ── per-unit collision checks (a distractor secretly also correct) ──
    const distractors = q.options.filter(o => o !== q.correctAnswer);
    if (key === 'kotowaza') {
      if (q.itemRef.includes('/toM/')) {
        // options are meanings; the target proverb's true meaning is q.correctAnswer.
        // any distractor meaning must NOT also be a valid meaning of the same proverb
        // (guaranteed by unique meanings, but assert it).
        distractors.forEach(d => {
          if (!proverbByMeaning.has(d)) fail(`kotowaza toM: distractor not a real meaning: ${d}`);
        });
      } else {
        // options are proverbs; distractor proverb must not share meaning with target
        const targetMeaning = q.prompt; // contains the meaning text
        distractors.forEach(d => {
          const dm = meaningByProverb.get(d);
          // if a distractor proverb had the SAME meaning as the correct one it'd be a collision
          if (dm && proverbByMeaning.get(dm) === q.correctAnswer) fail(`kotowaza toP collision: ${d}`);
        });
      }
    }
    if (key === 'romaji') {
      if (q.itemRef.includes('/toR/')) {
        // hiragana -> romaji. distractor must not be a valid romanization
        // (kunrei OR hepburn) of the SAME kana word.
        const kana = q.itemRef.split('/toR/')[1];
        const validForKana = new Set([romanizeKunrei(kana), toHepburn(romanizeKunrei(kana))]);
        distractors.forEach(d => {
          if (validForKana.has(d)) fail(`romaji toR collision: '${d}' is a valid romaji of ${kana}`);
          // also must not be the kunrei of some OTHER bank kana that equals this word's sound
        });
      } else {
        // romaji -> hiragana. the shown romaji must map to exactly the correct kana.
        const shownRomaji = q.correctAnswer && romanizeKunrei(q.correctAnswer);
        distractors.forEach(d => {
          // a distractor kana must NOT romanize to the same string as the answer
          if (romanizeKunrei(d) === shownRomaji) fail(`romaji toK collision: ${d} romanizes same as ${q.correctAnswer}`);
        });
      }
    }
    if (key === 'kosoado' || key === 'shuushoku') {
      // answer must be exactly one of the option set and distractors distinct — covered above.
      // extra: for shuushoku the 4 options are the 4 bunsetsu; correct is adj or adv only.
    }
  }
}

// coverage: kotowaza should hit a broad set of proverbs; romaji both directions
{
  const kotoRefs = Object.keys(counts.kotowaza.byRef);
  const proverbsSeen = new Set(kotoRefs.map(r => r.split('/').pop()));
  if (proverbsSeen.size < KOTOWAZA.length) fail(`kotowaza did not cover all proverbs: ${proverbsSeen.size}/${KOTOWAZA.length}`);
  const romajiDirs = new Set(Object.keys(counts.romaji.byRef).map(r => (r.includes('/toR/') ? 'toR' : 'toK')));
  if (romajiDirs.size !== 2) fail(`romaji did not exercise both directions: ${[...romajiDirs]}`);
}

// generateGrammarQuiz: right length, kotowaza avoids intra-session dup proverb
{
  for (const key of Object.keys(GRAMMAR_UNITS)) {
    const quiz = generateGrammarQuiz(key, 10);
    if (quiz.length !== 10) fail(`generateGrammarQuiz(${key},10) length ${quiz.length}`);
  }
  for (let t = 0; t < 500; t++) {
    const quiz = generateGrammarQuiz('kotowaza', 10);
    const bases = quiz.map(q => q.itemRef.replace(/\/(toP|toM)\//, '/'));
    if (new Set(bases).size !== bases.length) fail(`kotowaza session repeated a proverb: ${JSON.stringify(bases)}`);
  }
}

if (failures === 0) {
  console.log(`OK — ${Object.keys(GRAMMAR_UNITS).length} generators x ${PER_UNIT} each, all structural + collision checks passed.`);
  console.log('itemRef coverage:', Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Object.keys(v.byRef).length + ' refs'])));
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
