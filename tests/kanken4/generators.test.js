// generators.test.js — structural + distractor-collision stress test for
// kanken4 (漢字検定4級). Run: node tests/kanken4/generators.test.js
//
// kanken4 is a GENERATOR module (kanken4-generators.js builds each question
// on the fly from kanken4-data.js's 313 level-4 kanji + kanken4-content.js's
// authored word/idiom/pair/etc. bank), not a fixed authored question bank —
// see the header comments in both source files. This is therefore a
// generator stress test, matching kokugo1/kanji-generator.test.js's
// discipline: CLAUDE.md warns this project's kanji generator shipped a
// "wrong option is secretly also correct" collision bug twice, so every
// generator here is stress-tested at scale for exactly that failure mode, on
// top of the universal structural invariants (options length/distinctness,
// correct answer present exactly once, non-empty prompts).
//
// Loaded under a `global.window = {}` shim because kanken4-generators.js is
// an IIFE keyed on `typeof window !== 'undefined'` (browser convention
// shared across this repo's modules); harmless in Node either way since it
// also unconditionally sets `module.exports`, but the shim keeps this test
// exercising the same code path the browser does.
global.window = {};

const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/kanken4');

const { KANKEN4_KANJI: K } = require(path.join(base, 'kanken4-data.js'));
const { KANKEN4_CONTENT: C } = require(path.join(base, 'kanken4-content.js'));
const Gen = require(path.join(base, 'kanken4-generators.js'));

const errors = [];
const fail = (msg) => { errors.push(msg); if (errors.length <= 60) console.error('FAIL:', msg); };

const clean = (r) => String(r == null ? '' : r).replace(/[.\-]/g, '');

// ── generic structural check, shared by every generator ────────────────────
function checkStructural(kind, q, expectedLen) {
  expectedLen = expectedLen || 4;
  if (!q || !q.prompt || String(q.prompt).trim() === '') fail(`${kind}: empty prompt`);
  if (!q.category || String(q.category).trim() === '') fail(`${kind}: empty category`);
  if (!q.itemRef || String(q.itemRef).trim() === '') fail(`${kind}: empty itemRef`);
  if (!Array.isArray(q.options) || q.options.length !== expectedLen) {
    fail(`${kind}: options length ${q.options && q.options.length} (want ${expectedLen}) :: ${q.prompt}`);
    return;
  }
  q.options.forEach(o => { if (o == null || String(o).trim() === '') fail(`${kind}: empty option :: ${q.prompt}`); });
  if (new Set(q.options).size !== expectedLen) fail(`${kind}: duplicate options :: ${JSON.stringify(q.options)}`);
  const nCorrect = q.options.filter(o => o === q.correctAnswer).length;
  if (nCorrect !== 1) fail(`${kind}: correct answer appears ${nCorrect}x among options :: ${q.correctAnswer} / ${JSON.stringify(q.options)}`);
}

// ══════════════════════════════════════════════════════════════════════════
// ── data integrity: kanken4-data.js (K, the 313 level-4 kanji) ─────────────
// ══════════════════════════════════════════════════════════════════════════
if (K.length !== 313) fail(`expected 313 level-4 kanji (per kanken4-data.js's own header claim), got ${K.length}`);
{
  const seen = new Set();
  K.forEach(k => {
    if (seen.has(k.k)) fail(`duplicate kanji in KANKEN4_KANJI: ${k.k}`);
    seen.add(k.k);
    if (!Number.isInteger(k.strokes) || k.strokes < 1) fail(`${k.k}: bad stroke count ${k.strokes}`);
    if (![...k.on, ...k.kun].length) fail(`${k.k}: no on/kun readings at all`);
  });
}
const kanjiByChar = new Map(K.map(k => [k.k, k]));

// ── data integrity: kanken4-content.js (C, the authored practice bank) ─────
{
  if (K.length < 4) fail('K too small to ever fill a 4-option pool');

  // words: kosei tag must be a real koseiLabels key; w/r non-empty
  const koseiKeys = new Set(Object.keys(C.koseiLabels));
  C.words.forEach(w => {
    if (!w.w || !w.r) fail(`word entry missing w/r :: ${JSON.stringify(w)}`);
    if (!koseiKeys.has(w.kosei)) fail(`word ${w.w}: unknown kosei tag "${w.kosei}"`);
  });
  if (C.words.length < 4) fail(`words pool too small (${C.words.length}) for a 4-option yomi/kakitori question`);

  // bushu: radical/name non-empty, kanji chars unique, and (if the kanji is
  // itself one of the 313 level-4 kanji) enough DISTINCT radicals exist in
  // the pool for genBushu to ever fill 3 distractors.
  const seenBushuKanji = new Set();
  C.bushu.forEach(b => {
    if (!b.k || !b.rad || !b.name) fail(`bushu entry missing k/rad/name :: ${JSON.stringify(b)}`);
    if (seenBushuKanji.has(b.k)) fail(`duplicate bushu kanji: ${b.k}`);
    seenBushuKanji.add(b.k);
  });
  const distinctRad = new Set(C.bushu.map(b => b.rad));
  if (distinctRad.size < 4) fail(`too few distinct bushu radicals: ${distinctRad.size}`);

  // okuri: split must land strictly inside the reading, stem non-empty
  C.okuri.forEach(o => {
    if (!o.stem || !o.r) fail(`okuri entry missing stem/r :: ${JSON.stringify(o)}`);
    if (!Number.isInteger(o.split) || o.split < 1 || o.split > o.r.length) {
      fail(`okuri ${o.stem}: split ${o.split} out of range for reading "${o.r}" (len ${o.r.length})`);
    }
  });
  if (C.okuri.length < 4) fail(`okuri pool too small (${C.okuri.length})`);

  // pairs: a/b non-empty, rel is antonym|synonym
  C.pairs.forEach(p => {
    if (!p.a || !p.b) fail(`pair entry missing a/b :: ${JSON.stringify(p)}`);
    if (p.rel !== 'antonym' && p.rel !== 'synonym') fail(`pair ${p.a}: unknown rel "${p.rel}"`);
  });
  if (C.pairs.length < 4) fail(`pairs pool too small (${C.pairs.length})`);

  // doon / goji: dis arrays well-formed. Where the answer kanji happens to
  // also be one of the 313 level-4-NEW kanji in K, cross-check its on-reading
  // matches the reading the question displays — otherwise the "correct"
  // answer wouldn't actually read as claimed. (K is only the newly-added-at-
  // level-4 kanji per kanken4-data.js's header, not the full cumulative 1339
  // the content bank is allowed to draw from — kanken4-content.js's own
  // header says its kanji need only fall within the cumulative set, so an
  // answer kanji absent from K, e.g. an already-known lower-grade kanji, is
  // expected and not itself a fault.)
  C.doon.forEach(d => {
    if (!Array.isArray(d.dis) || d.dis.length < 3) fail(`doon ${d.ans}/${d.read}: <3 distractors`);
    if (new Set(d.dis).size !== d.dis.length) fail(`doon ${d.ans}/${d.read}: duplicate distractors :: ${JSON.stringify(d.dis)}`);
    if (d.dis.includes(d.ans)) fail(`doon ${d.ans}/${d.read}: answer also listed among its own distractors`);
    if (!d.phrase.includes('◯')) fail(`doon ${d.ans}: phrase missing ◯ blank marker`);
    const entry = kanjiByChar.get(d.ans);
    if (entry && !entry.on.map(clean).includes(clean(d.read))) {
      fail(`doon ${d.ans}: reading "${d.read}" not among its recorded on-readings ${JSON.stringify(entry.on)}`);
    }
  });
  C.goji.forEach(g => {
    if (!Array.isArray(g.dis) || g.dis.length < 3) fail(`goji ${g.ans}: <3 distractors`);
    if (new Set(g.dis).size !== g.dis.length) fail(`goji ${g.ans}: duplicate distractors :: ${JSON.stringify(g.dis)}`);
    if (g.dis.includes(g.ans)) fail(`goji ${g.ans}: answer also listed among its own distractors`);
    if (!g.sentence.includes('【') || !g.sentence.includes('】')) fail(`goji ${g.ans}: sentence missing 【】 marker`);
    if (g.dis.includes(g.wrong)) fail(`goji ${g.ans}: the shown wrong kanji "${g.wrong}" also appears among distractor options`);
    if (g.ans === g.wrong) fail(`goji: answer equals the shown wrong kanji "${g.wrong}"`);
    const entry = kanjiByChar.get(g.ans);
    if (entry && !entry.on.map(clean).includes(clean(g.read))) {
      fail(`goji ${g.ans}: reading "${g.read}" not among its recorded on-readings ${JSON.stringify(entry.on)}`);
    }
  });

  // yoji: blank index in range, ans is the character actually at that blank
  C.yoji.forEach(y => {
    if (y.blank < 0 || y.blank >= y.w.length) fail(`yoji ${y.w}: blank index ${y.blank} out of range`);
    else if (y.w[y.blank] !== y.ans) fail(`yoji ${y.w}: char at blank index (${y.w[y.blank]}) != ans (${y.ans})`);
  });
}

// ══════════════════════════════════════════════════════════════════════════
// ── generator stress tests ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
const N = 4000;
let generated = 0;

// ── 読み (yomi): word -> reading. Collision: no distractor reading may equal
// the reading of ANY word sharing the prompt kanji spelling (there's only
// one w/r per entry here, so this reduces to "no distractor === the
// correct reading", which the structural check already covers via the
// exactly-once-correct assertion — still exercised at scale).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genYomi(C, K);
  generated++;
  checkStructural('yomi', q);
}

// ── 書き取り (kakitori): reading -> kanji spelling. Collision: no distractor
// spelling may share the SAME reading as the prompt (that would make it
// also a valid answer to "which kanji reads this way").
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genKakitori(C, K);
  generated++;
  checkStructural('kakitori', q);
  const correctWord = C.words.find(x => x.w === q.correctAnswer);
  if (!correctWord) { fail(`kakitori: correct answer "${q.correctAnswer}" not found in words bank`); continue; }
  q.options.filter(o => o !== q.correctAnswer).forEach(distractorSpelling => {
    // any word entry with this spelling and the SAME reading as the prompt
    // would make the distractor secretly also correct.
    const collide = C.words.some(x => x.w === distractorSpelling && x.r === correctWord.r);
    if (collide) fail(`kakitori collision: "${distractorSpelling}" also reads "${correctWord.r}" :: ${JSON.stringify(q.options)}`);
  });
}

// ── 部首・部首名 (bushu): kanji -> radical label. Collision: no distractor
// may share the SAME radical character as the correct one (a radical char
// can legitimately carry two names across different kanji — offering both
// as options is the exact collision kanken3's stress test caught).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genBushu(C, K);
  generated++;
  checkStructural('bushu', q);
  const b = C.bushu.find(x => `${x.rad}（${x.name}）` === q.correctAnswer);
  if (!b) { fail(`bushu: correct answer "${q.correctAnswer}" not decodable`); continue; }
  q.options.filter(o => o !== q.correctAnswer).forEach(opt => {
    const rad = opt.split('（')[0];
    if (rad === b.rad) fail(`bushu collision: distractor "${opt}" shares radical "${b.rad}" with correct "${q.correctAnswer}"`);
  });
}

// ── 送り仮名 (okuri): reading -> kanji+okurigana spelling. Collision: no
// distractor spelling may equal the correct spelling (structural), and
// none may equal the reading spelled out entirely in kana masquerading as
// the correct form (the generator itself adds the all-kana form as an
// intentional distractor, so it must never collide with `correct`).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genOkuri(C, K);
  generated++;
  checkStructural('okuri', q);
}

// ── 対義語・類義語 (pair): word -> antonym/synonym. Collision: no distractor
// may ALSO be a genuine antonym/synonym of the prompt word elsewhere in the
// data (built from a full relation map across the whole pairs bank, both
// directions, since the relation is symmetric).
{
  const relOf = { antonym: new Map(), synonym: new Map() };
  const addRel = (rel, a, b) => {
    if (!relOf[rel].has(a)) relOf[rel].set(a, new Set());
    relOf[rel].get(a).add(b);
  };
  C.pairs.forEach(p => { addRel(p.rel, p.a, p.b); addRel(p.rel, p.b, p.a); });

  for (let i = 0; i < N; i++) {
    const q = Gen._gens.genPair(C, K);
    generated++;
    checkStructural('pair', q);
    const p = C.pairs.find(x => x.b === q.correctAnswer && `kanken4/${x.rel === 'antonym' ? 'antonym' : 'synonym'}/${x.a}` === q.itemRef);
    if (!p) { fail(`pair: could not resolve source pair for itemRef ${q.itemRef}`); continue; }
    const validPartners = relOf[p.rel].get(p.a) || new Set();
    q.options.filter(o => o !== q.correctAnswer).forEach(d => {
      if (validPartners.has(d)) {
        fail(`pair collision: distractor "${d}" is ALSO a valid ${p.rel} of "${p.a}" :: ${JSON.stringify(q.options)}`);
      }
    });
  }
}

// ── 同音・同訓異字 (doon): fill-in-the-blank with a same-reading kanji.
// Collision would be an authored-data problem (a distractor that also fits
// the sentence) which we can't evaluate semantically, so this generator's
// stress pass is purely structural at scale; the data-integrity block above
// already checks dis/ans non-overlap and reading correctness.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genDoon(C, K);
  generated++;
  checkStructural('doon', q);
}

// ── 誤字訂正 (goji): same shape as doon — structural at scale, semantic
// correctness of distractors checked once in the data-integrity block.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genGoji(C, K);
  generated++;
  checkStructural('goji', q);
}

// ── 四字熟語 (yoji): blank-fill idiom. Collision: no distractor character
// may be one already visible elsewhere in the shown idiom (the generator
// filters this explicitly — verify it holds at scale).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genYoji(C, K);
  generated++;
  checkStructural('yoji', q);
  const y = C.yoji.find(x => x.ans === q.correctAnswer && `kanken4/yoji/${x.w}` === q.itemRef);
  if (!y) { fail(`yoji: could not resolve source idiom for itemRef ${q.itemRef}`); continue; }
  const visible = new Set(y.w.split(''));
  q.options.filter(o => o !== q.correctAnswer).forEach(d => {
    if (visible.has(d)) fail(`yoji collision: distractor "${d}" already visible in idiom "${y.w}" :: ${JSON.stringify(q.options)}`);
  });
}

// ── 熟語の構成 (kosei): word -> structure-type label, 5 fixed options.
// Collision-free by construction (options are the 5 distinct koseiLabels
// values every time) — verify that holds and the tagged structure type is
// correct at scale.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genKosei(C, K);
  generated++;
  checkStructural('kosei', q, 5);
  const w = C.words.find(x => C.koseiLabels[x.kosei] === q.correctAnswer && `kanken4/kosei/${x.w}` === q.itemRef);
  if (!w) fail(`kosei: could not resolve source word for itemRef ${q.itemRef}`);
}

// ══════════════════════════════════════════════════════════════════════════
// ── generateQuiz: mixed + single-category quiz assembly ────────────────────
// ══════════════════════════════════════════════════════════════════════════
{
  const quiz = Gen.generateQuiz(C, K, 'mix', 30);
  if (quiz.length === 0) fail('generateQuiz(mix, 30) returned 0 questions');
  quiz.forEach(q => checkStructural('quiz-mix', q, q.options.length === 5 ? 5 : 4));

  Gen.CATEGORIES.forEach(cat => {
    const catQuiz = Gen.generateQuiz(C, K, cat.key, 12);
    if (catQuiz.length === 0) fail(`generateQuiz(${cat.key}, 12) returned 0 questions`);
    catQuiz.forEach(q => {
      // genPair reports category as '対義語' or '類義語' dynamically (per
      // question) rather than the combined CATEGORIES label '対義語・類義語'.
      const okCategory = cat.key === 'pair'
        ? (q.category === '対義語' || q.category === '類義語')
        : q.category === cat.label;
      if (!okCategory) fail(`generateQuiz(${cat.key}): got category "${q.category}", want "${cat.label}"`);
      checkStructural(`quiz-${cat.key}`, q, cat.key === 'kosei' ? 5 : 4);
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════
if (errors.length) {
  console.error(`\n${errors.length} failure(s) (of ${errors.length > 60 ? 'first 60 shown, ' : ''}${generated} generated questions).`);
  process.exitCode = 1;
} else {
  console.log(`OK — kanken4 generator stress test passed.`);
  console.log(`  ${K.length} kanji (level-4 bank), ${C.words.length} words, ${C.bushu.length} bushu, ${C.okuri.length} okuri, ${C.pairs.length} pairs, ${C.doon.length} doon, ${C.goji.length} goji, ${C.yoji.length} yoji entries.`);
  console.log(`  9 generators x ${N} runs each (${generated} questions total) + generateQuiz(mix) + generateQuiz(each category) — all structural + collision checks passed.`);
}
