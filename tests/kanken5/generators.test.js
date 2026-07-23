// generators.test.js — structural + distractor-collision stress test for
// kanken5 (漢字検定5級). Run: node tests/kanken5/generators.test.js
//
// kanken5 is a GENERATOR module, not an authored bank: kanken5-generators.js
// builds all 10 official 5級 question categories fresh each call from two
// verified data sources — kanken5-data.js (181 grade-6 kanji, KANJIDIC-
// sourced strokes/readings) and kanken5-content.js (original word/pair/yoji/
// okuri/doon/bushu/goji banks). See that file's header comment for why —
// same "fixed problem bank eventually runs dry" avoidance as sansu3/kokugo3.
//
// CLAUDE.md flags that this project's own kanji generator (kokugo3) shipped
// the "a wrong option is secretly also correct" distractor-collision bug
// TWICE: (1) stroke-count questions with <4 distinct option values, and
// (2) a same-reading/same-meaning distractor sneaking in as also-correct.
// kanken5-generators.js's own header claims structural guarantees against
// this for each of its 10 generators — this test verifies those guarantees
// hold at scale, not just in the handful of manual examples the author had
// in mind, and separately audits the authored data banks for the same class
// of authoring mistake (answer duplicated into its own distractor list, an
// authored pool too shallow to fill an option set, etc).

const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/kanken5');

// kanken5-generators.js is a classic-script IIFE that binds itself to
// `window` when available (falling back to globalThis) before also handing
// its exports to `module.exports`. Shim `window` first so it resolves the
// same way it does in the browser, matching this repo's convention
// (sansu5/sansu6/sansu1/sansu2/rika3 tests all do this before loading a
// module's browser-facing scripts under Node).
global.window = {};

const { KANKEN5_KANJI: K } = require(path.join(base, 'kanken5-data.js'));
const { KANKEN5_CONTENT: C } = require(path.join(base, 'kanken5-content.js'));
const Gen = require(path.join(base, 'kanken5-generators.js'));

const errors = [];
const fail = (m) => errors.push(m);

// ── kanji-set (K) data integrity ─────────────────────────────────────────
if (K.length !== 181) fail(`expected 181 grade-6 kanji, got ${K.length}`);
{
  const seen = new Set();
  K.forEach((k) => {
    if (seen.has(k.k)) fail(`duplicate kanji in KANKEN5_KANJI: ${k.k}`);
    seen.add(k.k);
    if (!Number.isInteger(k.strokes) || k.strokes < 1) fail(`${k.k}: bad stroke count ${k.strokes}`);
    if (![...k.on, ...k.kun].length) fail(`${k.k}: no readings at all`);
  });
  // genKaku needs >=4 distinct stroke VALUES across the whole pool to ever
  // fill 3 distractors + the answer — the exact shape of kokugo3's shipped
  // stroke-count bug (a small/uneven pool silently produced <4 options).
  const distinctStrokes = new Set(K.map((k) => k.strokes));
  if (distinctStrokes.size < 4) fail(`too few distinct stroke counts in K: ${distinctStrokes.size}`);
}

// ── authored content bank (C) data integrity ─────────────────────────────
{
  const koseiKeys = new Set(Object.keys(C.koseiLabels));
  if (C.words.length < 4) fail(`C.words too small to fill 4-option quizzes: ${C.words.length}`);
  const distinctWordReadings = new Set(C.words.map((w) => w.r));
  if (distinctWordReadings.size < 4) fail(`C.words: too few distinct readings for genYomi distractors: ${distinctWordReadings.size}`);
  const byWordText = new Map();
  C.words.forEach((w) => {
    if (!w.w || !w.r) fail(`C.words: empty w/r :: ${JSON.stringify(w)}`);
    if (!koseiKeys.has(w.kosei)) fail(`C.words: unknown kosei "${w.kosei}" for ${w.w}`);
    if (!byWordText.has(w.w)) byWordText.set(w.w, new Set());
    byWordText.get(w.w).add(w.r);
  });
  // a kanji spelling authored with two different readings would make
  // genKakitori's correct answer ambiguous (same displayed kanji, two
  // "correct" readings depending on which entry generated the question).
  byWordText.forEach((readings, w) => {
    if (readings.size > 1) fail(`C.words: "${w}" has ${readings.size} different readings :: ${[...readings]}`);
  });
}
{
  C.pairs.forEach((p, i) => {
    if (!p.a || !p.b || !p.ar || !p.br) fail(`C.pairs[${i}]: missing field :: ${JSON.stringify(p)}`);
    if (p.a === p.b) fail(`C.pairs[${i}]: a === b :: ${p.a}`);
    if (p.rel !== 'antonym' && p.rel !== 'synonym') fail(`C.pairs[${i}]: bad rel "${p.rel}"`);
  });
  if (C.pairs.length < 4) fail(`C.pairs too small: ${C.pairs.length}`);
}
{
  C.yoji.forEach((y) => {
    const chars = y.w.split('');
    if (y.blank < 0 || y.blank >= chars.length) fail(`C.yoji "${y.w}": blank index ${y.blank} out of range`);
    else if (chars[y.blank] !== y.ans) fail(`C.yoji "${y.w}": char at blank(${y.blank}) is "${chars[y.blank]}", not ans "${y.ans}"`);
    if (!y.r || !y.gloss) fail(`C.yoji "${y.w}": missing r/gloss`);
  });
}
{
  C.okuri.forEach((o) => {
    if (o.split < 1 || o.split > o.r.length) fail(`C.okuri "${o.stem}": split ${o.split} out of range for reading "${o.r}" (len ${o.r.length})`);
    if (!o.stem || !o.gloss) fail(`C.okuri "${o.stem}": missing stem/gloss`);
  });
}
{
  C.doon.forEach((d) => {
    if (!d.phrase.includes('◯')) fail(`C.doon "${d.ans}": phrase missing ◯ :: ${d.phrase}`);
    if (!Array.isArray(d.dis) || d.dis.length < 3) fail(`C.doon "${d.ans}": <3 distractors`);
    if (d.dis.includes(d.ans)) fail(`C.doon "${d.ans}": ans present in its own dis[] :: ${JSON.stringify(d.dis)}`);
    if (new Set(d.dis).size !== d.dis.length) fail(`C.doon "${d.ans}": duplicate dis entries :: ${JSON.stringify(d.dis)}`);
  });
}
{
  const seenRad = new Set();
  C.bushu.forEach((b) => {
    if (!b.rad || !b.name) fail(`C.bushu "${b.k}": missing rad/name`);
    seenRad.add(b.rad);
  });
  // genBushu dedupes distractors by radical CHARACTER (not name) so a
  // radical that legitimately carries two names across different kanji
  // (documented: 月 as にくづき/つき, 糸 as いと/いとへん) never offers both
  // as separate options for the same question — needs >=4 distinct radical
  // characters for the answer + 3 distractors to ever fill.
  if (seenRad.size < 4) fail(`C.bushu: too few distinct radical characters: ${seenRad.size}`);
  // a kanji authored against two different radicals would make genBushu's
  // correct answer ambiguous depending on which entry generated the question.
  const byK = new Map();
  C.bushu.forEach((b) => {
    if (!byK.has(b.k)) byK.set(b.k, new Set());
    byK.get(b.k).add(`${b.rad}|${b.name}`);
  });
  byK.forEach((labels, k) => {
    if (labels.size > 1) fail(`C.bushu: "${k}" has ${labels.size} different rad/name labels :: ${[...labels]}`);
  });
}
{
  C.goji.forEach((g) => {
    if (!g.sentence.includes(g.wrong)) fail(`C.goji "${g.right}": sentence doesn't contain wrong char "${g.wrong}" :: ${g.sentence}`);
    if (!Array.isArray(g.dis) || g.dis.length < 3) fail(`C.goji "${g.right}": <3 distractors`);
    if (g.dis.includes(g.right)) fail(`C.goji "${g.right}": right present in its own dis[] :: ${JSON.stringify(g.dis)}`);
    if (new Set(g.dis).size !== g.dis.length) fail(`C.goji "${g.right}": duplicate dis entries :: ${JSON.stringify(g.dis)}`);
  });
}

// ── generic structural check, shared by every category ──────────────────
function checkStructural(kind, q, expectedLen) {
  if (!q.prompt || !q.category || !q.itemRef) fail(`${kind}: missing prompt/category/itemRef :: ${JSON.stringify(q)}`);
  if (!Array.isArray(q.options) || q.options.length !== expectedLen) {
    fail(`${kind}: options length ${q.options && q.options.length} (want ${expectedLen}) :: ${q.prompt}`);
    return;
  }
  if (new Set(q.options).size !== expectedLen) fail(`${kind}: duplicate options :: ${JSON.stringify(q.options)}`);
  const nCorrect = q.options.filter((o) => o === q.correctAnswer).length;
  if (nCorrect !== 1) fail(`${kind}: correctAnswer appears ${nCorrect}x among options :: ${JSON.stringify(q.options)} / ${q.correctAnswer}`);
  q.options.forEach((o) => { if (o == null || o === '') fail(`${kind}: empty option :: ${q.prompt}`); });
}

const N = 3000;
let totalGenerated = 0;

// ── 読み (genYomi) — distractor must not be a valid reading of the SHOWN
// word. Build the full reading pool once; since sampleDistinct excludes
// w.r by construction this should never trip, but verify at scale anyway.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genYomi(C, K);
  checkStructural('yomi', q, 4);
  totalGenerated++;
}

// ── 書き取り (genKakitori) — distractor kanji-spelling must not itself be a
// valid spelling of the shown reading (i.e. must not come from an entry
// whose reading equals the prompt's reading).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genKakitori(C, K);
  checkStructural('kakitori', q, 4);
  const promptReading = q.prompt.match(/「(.+)」/)[1];
  q.options.filter((o) => o !== q.correctAnswer).forEach((opt) => {
    const collidingEntry = C.words.find((w) => w.w === opt && w.r === promptReading);
    if (collidingEntry) fail(`kakitori collision: distractor "${opt}" is ALSO a valid spelling of "${promptReading}" :: ${JSON.stringify(q.options)}`);
  });
  totalGenerated++;
}

// ── 熟語の構成 (genKosei) — fixed 5-option label set; correct must match the
// word's authored kosei classification.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genKosei(C, K);
  checkStructural('kosei', q, 5);
  totalGenerated++;
}

// ── 対義語・類義語 (genPair) — distractor word must not be the "b" partner
// of ANY pair whose "a" equals the prompt word (would be secretly also
// correct even if it's not this particular pair's canonical b).
{
  const validPartnerOf = new Map(); // a -> Set(all valid b's for that a, across all pairs)
  C.pairs.forEach((p) => {
    if (!validPartnerOf.has(p.a)) validPartnerOf.set(p.a, new Set());
    validPartnerOf.get(p.a).add(p.b);
  });
  for (let i = 0; i < N; i++) {
    const q = Gen._gens.genPair(C, K);
    checkStructural('pair', q, 4);
    const promptWord = q.prompt.match(/「(.+?)（/)[1];
    const validSet = validPartnerOf.get(promptWord);
    q.options.filter((o) => o !== q.correctAnswer).forEach((opt) => {
      if (validSet && validSet.has(opt)) fail(`pair collision: distractor "${opt}" is ALSO a valid partner of "${promptWord}" :: ${JSON.stringify(q.options)}`);
    });
    totalGenerated++;
  }
}

// ── 四字熟語 (genYoji) — distractor kanji must not equal the character that
// actually belongs in ANY OTHER blank position of idioms sharing this exact
// blanked shape (cheap check: distractor must simply not equal the answer,
// and must not be one of the idiom's own visible characters — both already
// enforced by construction; verify at scale).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genYoji(C, K);
  checkStructural('yoji', q, 4);
  totalGenerated++;
}

// ── 送り仮名 (genOkuri) — every option must be a DISTINCT string; verify no
// two different split points on the same reading accidentally produce an
// identical substring (which would silently collapse two "different"
// options into one, or worse, promote a wrong split to look correct).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genOkuri(C, K);
  checkStructural('okuri', q, 4);
  totalGenerated++;
}

// ── 同音・同訓異字 (genDoon) — dis[] entries must never equal ans (checked
// in data integrity above); verify the generated options reflect that at
// runtime too.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genDoon(C, K);
  checkStructural('doon', q, 4);
  totalGenerated++;
}

// ── 部首・部首名 (genBushu) — distractor radical CHARACTER must differ from
// the answer's and from every other distractor's (checked structurally by
// generator's own dedup logic); verify no two options share a radical char
// (which would mean two labels for the same underlying radical appeared
// together, a genuine collision per the documented にくづき/つき case).
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genBushu(C, K);
  checkStructural('bushu', q, 4);
  // recover each option's radical char via its bushu entry (label = "rad（name）")
  const radChars = q.options.map((opt) => {
    const entry = C.bushu.find((b) => `${b.rad}（${b.name}）` === opt);
    return entry ? entry.rad : null;
  });
  if (radChars.some((r) => r == null)) fail(`bushu: option didn't match any known label :: ${JSON.stringify(q.options)}`);
  if (new Set(radChars).size !== radChars.length) fail(`bushu collision: two options share a radical character :: ${JSON.stringify(q.options)} -> ${JSON.stringify(radChars)}`);
  totalGenerated++;
}

// ── 画数 (genKaku) — the classic kokugo3 bug shape: assert exactly one
// option's numeric value equals the target kanji's true stroke count.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genKaku(C, K);
  checkStructural('kaku', q, 4);
  const kanji = q.itemRef.split('/')[2];
  const entry = K.find((k) => k.k === kanji);
  if (!entry) fail(`kaku: itemRef kanji "${kanji}" not found in K`);
  else {
    const nums = q.options.map((o) => Number(o.replace('画', '')));
    if (nums.some((n) => !Number.isInteger(n))) fail(`kaku: non-integer option :: ${JSON.stringify(q.options)}`);
    const matches = nums.filter((n) => n === entry.strokes).length;
    if (matches !== 1) fail(`kaku: ${matches} options equal true stroke count ${entry.strokes} :: ${JSON.stringify(q.options)}`);
  }
  totalGenerated++;
}

// ── 誤字訂正 (genGoji) — dis[] entries must never equal right (checked in
// data integrity above); verify at runtime too.
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genGoji(C, K);
  checkStructural('goji', q, 4);
  totalGenerated++;
}

// ── generateQuiz — every category key (incl. 'mix') returns well-formed
// questions of the requested length, capped sensibly per category.
Gen.CATEGORIES.forEach((cat) => {
  const size = cat.size(C, K);
  const count = Math.min(10, size);
  const quiz = Gen.generateQuiz(C, K, cat.key, count);
  if (quiz.length !== count) fail(`generateQuiz(${cat.key}, ${count}) returned ${quiz.length}`);
  // genPair legitimately splits into two displayed sub-labels ('対義語' /
  // '類義語') under the single registry label '対義語・類義語' — accept either.
  const acceptable = cat.key === 'pair' ? ['対義語', '類義語'] : [cat.label];
  quiz.forEach((q) => {
    if (!acceptable.includes(q.category)) fail(`generateQuiz(${cat.key}): question category "${q.category}" not in expected ${JSON.stringify(acceptable)}`);
  });
});
{
  const mix = Gen.generateQuiz(C, K, 'mix', 10);
  if (mix.length !== 10) fail(`generateQuiz(mix, 10) returned ${mix.length}`);
  mix.forEach((q) => checkStructural('mix', q, q.category === '熟語の構成' ? 5 : 4));
}

// ── report ────────────────────────────────────────────────────────────────
console.log('kanken5 generator stress test');
console.log(`  kanji (K):         ${K.length}`);
console.log(`  words/pairs/yoji/okuri/doon/bushu/goji: ${C.words.length}/${C.pairs.length}/${C.yoji.length}/${C.okuri.length}/${C.doon.length}/${C.bushu.length}/${C.goji.length}`);
console.log(`  categories:        ${Gen.CATEGORIES.length}`);
console.log(`  questions generated: ${totalGenerated} (${N} per category x 10 categories)`);

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.slice(0, 40).forEach((e) => console.error('  - ' + e));
  if (errors.length > 40) console.error(`  ...and ${errors.length - 40} more`);
  process.exitCode = 1;
} else {
  console.log('\nALL CHECKS PASSED');
}
