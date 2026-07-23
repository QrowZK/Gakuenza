// generators.test.js — structural + distractor-collision stress test for
// kanken3 (漢字検定3級). Run: node tests/kanken3/generators.test.js
//
// kanken3 is a GENERATOR module (kanken3-generators.js builds each question
// fresh from kanken3-data.js's 284 配当漢字 + kanken3-content.js's authored
// word/pair/yoji/okuri/doon/shikibetsu/goji/bushu banks — see the design note
// at the top of kanken3-generators.js), so this mirrors the kokugo1 kanji
// generator stress test rather than an authored-bank data-integrity test.
//
// CLAUDE.md's testing bar + kanken3-generators.js's own header both flag the
// exact hazard this project's kanji generator has shipped TWICE: a "wrong"
// option that turns out to also be a legitimate correct answer. This test
// regenerates thousands of instances of each of the 10 question categories
// and asserts, per question:
//   - options array is the right length (4, except 熟語の構成 = 5)
//   - all options are distinct, non-empty
//   - the correct answer is present in options EXACTLY once
//   - no distractor is ALSO a valid correct answer for the same prompt
//     (collision), checked structurally against the data wherever the data
//     lets us determine "also valid" mechanically:
//       - 読み/書き取り: no duplicate 熟語→複数の読み ambiguity in the data
//       - 同音・同訓異字/誤字訂正: NOTE these two categories intentionally
//         show several kanji that all share one reading (that IS the puzzle
//         — only one fits the phrase contextually, and for 誤字訂正 the
//         reading isn't even shown to the player) — so "distractor shares
//         the reading" is not itself a collision here. What we DO check is
//         that the ANSWER genuinely carries its claimed reading, per the
//         284-字 配当漢字 reading table.
//       - 対義語・類義語: no distractor that is registered elsewhere in the
//         pairs table as a legitimate partner of the prompt word
//       - 四字熟語/漢字識別: no distractor character already visible in the
//         shown idiom/words (which would make the puzzle nonsensical or the
//         distractor trivially excludable, not what we're testing here, but
//         also guards a same-position collision)
//       - 部首: no two options share the same 部首 character (the "same
//         radical, two names" collision the module's own comment calls out)
// plus data-integrity checks on the underlying banks themselves.
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/kanken3');

global.window = {};
const { KANKEN3_KANJI } = require(path.join(base, 'kanken3-data.js'));
const { KANKEN3_CONTENT } = require(path.join(base, 'kanken3-content.js'));
const Gen = require(path.join(base, 'kanken3-generators.js'));

const errors = [];
const fail = (m) => errors.push(m);
const clean = (r) => String(r).replace(/[.\-]/g, '');

// ── Data integrity: KANKEN3_KANJI (284 配当漢字) ────────────────────────────
if (KANKEN3_KANJI.length !== 284) fail(`expected 284 kanken3 kanji, got ${KANKEN3_KANJI.length}`);
{
  const seen = new Set();
  KANKEN3_KANJI.forEach((k) => {
    if (seen.has(k.k)) fail(`duplicate kanji in KANKEN3_KANJI: ${k.k}`);
    seen.add(k.k);
    if (!Number.isInteger(k.strokes) || k.strokes < 1) fail(`${k.k}: bad stroke count ${k.strokes}`);
    if (![...k.on, ...k.kun].length) fail(`${k.k}: no readings at all`);
  });
}
// reading map built from the 284-字 table, used below for cross-checking
// doon/goji distractors against readings this project actually documents.
const READING_MAP = new Map(); // kanji char -> Set of cleaned readings
KANKEN3_KANJI.forEach((k) => {
  READING_MAP.set(k.k, new Set([...k.on, ...k.kun].map(clean)));
});

// ── Data integrity: KANKEN3_CONTENT ─────────────────────────────────────────
const C = KANKEN3_CONTENT;
{
  const koseiKeys = new Set(Object.keys(C.koseiLabels));
  C.words.forEach((w) => {
    if (!w.w || !w.r) fail(`words: empty w/r :: ${JSON.stringify(w)}`);
    if (!koseiKeys.has(w.kosei)) fail(`words: unknown kosei "${w.kosei}" for ${w.w}`);
  });
  // duplicate-w-different-r would make 読み ambiguous (two valid readings for
  // the same displayed 熟語) — the exact "answer key itself is ambiguous"
  // failure mode.
  const wToR = new Map();
  C.words.forEach((w) => {
    if (wToR.has(w.w) && wToR.get(w.w) !== w.r) {
      fail(`words: "${w.w}" has two different readings in the data: ${wToR.get(w.w)} / ${w.r}`);
    }
    wToR.set(w.w, w.r);
  });

  C.pairs.forEach((p) => {
    if (!p.a || !p.b || !p.ar || !p.br) fail(`pairs: missing field :: ${JSON.stringify(p)}`);
    if (p.a === p.b) fail(`pairs: a === b :: ${JSON.stringify(p)}`);
    if (p.rel !== 'antonym' && p.rel !== 'synonym') fail(`pairs: bad rel "${p.rel}"`);
  });

  C.yoji.forEach((y) => {
    if (y.w.length !== 4) fail(`yoji: "${y.w}" is not 4 characters`);
    if (y.blank < 0 || y.blank > 3) fail(`yoji: bad blank index ${y.blank} for ${y.w}`);
    if (y.w[y.blank] !== y.ans) fail(`yoji: ${y.w}[${y.blank}] = "${y.w[y.blank]}" !== ans "${y.ans}"`);
    if (!y.gloss) fail(`yoji: ${y.w} missing gloss`);
  });

  C.okuri.forEach((o) => {
    if (o.split < 1 || o.split >= o.r.length) fail(`okuri: ${o.stem} bad split ${o.split} for reading "${o.r}" (len ${o.r.length})`);
  });

  C.doon.forEach((d) => {
    if (!Array.isArray(d.dis) || d.dis.length < 3) fail(`doon: ${d.ans}/${d.read} has <3 distractors`);
    if (d.dis.includes(d.ans)) fail(`doon: ${d.ans}/${d.read} distractor list includes the answer`);
    if (!d.phrase.includes('◯')) fail(`doon: ${d.ans}/${d.read} phrase missing ◯ marker`);
    // NOTE: unlike kokugo3's single-kanji reading question, 同音・同訓異字 by
    // design shows several kanji that ALL share the prompt reading (that's
    // the whole point of the category — only one actually fits the phrase
    // contextually) — so "distractor also has this reading" is NOT a
    // collision here, it's the intended puzzle shape. What we CAN verify
    // mechanically is that the ANSWER itself genuinely carries the reading
    // it's claimed to, per this project's own 284-字 reading table.
    const ansReadings = READING_MAP.get(d.ans);
    if (ansReadings && !ansReadings.has(clean(d.read))) {
      fail(`doon: answer "${d.ans}" does NOT read "${d.read}" per KANKEN3_KANJI (has: ${[...ansReadings].join(',')})`);
    }
  });

  C.shikibetsu.forEach((s) => {
    if (!s.k || !Array.isArray(s.words) || s.words.length < 3) fail(`shikibetsu: bad entry :: ${JSON.stringify(s)}`);
    s.words.forEach((w) => { if (!w.includes(s.k)) fail(`shikibetsu: "${w}" does not contain "${s.k}"`); });
  });

  C.goji.forEach((g) => {
    if (!g.sent.includes(g.wrong)) fail(`goji: sentence missing wrong char "${g.wrong}" :: ${g.sent}`);
    if (g.wrong === g.correct) fail(`goji: wrong === correct :: ${JSON.stringify(g)}`);
    if (!Array.isArray(g.dis) || g.dis.length < 3) fail(`goji: ${g.correct} has <3 distractors`);
    if (g.dis.includes(g.correct)) fail(`goji: ${g.correct} distractor list includes the answer`);
    // NOTE: g.read is never shown to the student (genGoji doesn't render it —
    // it's only carried in itemRef), so a distractor sharing that reading is
    // not a visible-to-the-player collision. What IS worth checking
    // mechanically: the answer itself genuinely carries the claimed reading.
    const correctReadings = READING_MAP.get(g.correct);
    if (correctReadings && !correctReadings.has(clean(g.read))) {
      fail(`goji: correct "${g.correct}" does NOT read "${g.read}" per KANKEN3_KANJI (has: ${[...correctReadings].join(',')})`);
    }
  });

  C.bushu.forEach((b) => {
    if (!b.k || !b.rad || !b.name) fail(`bushu: bad entry :: ${JSON.stringify(b)}`);
  });

  // pair "partner map": word -> every word registered as its antonym/synonym
  // partner ANYWHERE in the table (either side), so we can flag a distractor
  // that's secretly a legitimate answer even though it came from a different
  // row than the prompt's.
  var PARTNER_MAP = new Map();
  const addPartner = (x, y) => {
    if (!PARTNER_MAP.has(x)) PARTNER_MAP.set(x, new Set());
    PARTNER_MAP.get(x).add(y);
  };
  C.pairs.forEach((p) => { addPartner(p.a, p.b); addPartner(p.b, p.a); });
}

// ── generic structural checker ──────────────────────────────────────────────
function checkStructural(kind, q, expectedLen) {
  if (!q.prompt) fail(`${kind}: empty prompt`);
  if (!q.category) fail(`${kind}: empty category`);
  if (!q.itemRef) fail(`${kind}: empty itemRef`);
  if (!Array.isArray(q.options) || q.options.length !== expectedLen) {
    fail(`${kind}: options.length ${q.options && q.options.length} !== ${expectedLen} :: ${q.prompt}`);
    return;
  }
  if (new Set(q.options).size !== expectedLen) fail(`${kind}: duplicate options :: ${JSON.stringify(q.options)}`);
  const nCorrect = q.options.filter((o) => o === q.correctAnswer).length;
  if (nCorrect !== 1) fail(`${kind}: correct answer appears ${nCorrect}x :: ${JSON.stringify(q.options)} / ${q.correctAnswer}`);
  q.options.forEach((o) => { if (o == null || o === '') fail(`${kind}: empty option :: ${q.prompt}`); });
}

const N = 3000;
let total = 0;

// ── 読み ─────────────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genYomi(C, KANKEN3_KANJI);
  total++;
  checkStructural('yomi', q, 4);
  // collision: no distractor reading may ALSO be a valid reading of the
  // SAME displayed 熟語 (i.e. a second row of words[] with this w but a
  // different r would leak in as a "wrong" option that's really also right).
  const kanjiWord = q.itemRef.split('/')[2];
  const sameWordReadings = new Set(C.words.filter((w) => w.w === kanjiWord).map((w) => w.r));
  q.options.filter((o) => o !== q.correctAnswer).forEach((d) => {
    if (sameWordReadings.has(d)) fail(`yomi collision: "${d}" is also a documented reading of "${kanjiWord}" :: ${JSON.stringify(q.options)}`);
  });
}

// ── 書き取り ─────────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genKakitori(C, KANKEN3_KANJI);
  total++;
  checkStructural('kakitori', q, 4);
  // collision: no distractor kanji-form may ALSO be a valid spelling for the
  // shown reading (i.e. share the prompt's r).
  const reading = q.prompt.match(/「(.+)」/)[1];
  q.options.filter((o) => o !== q.correctAnswer).forEach((dw) => {
    const entry = C.words.find((w) => w.w === dw);
    if (entry && entry.r === reading) fail(`kakitori collision: "${dw}" also reads "${reading}" :: ${JSON.stringify(q.options)}`);
  });
}

// ── 熟語の構成 (5択) ─────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genKosei(C, KANKEN3_KANJI);
  total++;
  checkStructural('kosei', q, 5);
}

// ── 対義語・類義語 ────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genPair(C, KANKEN3_KANJI);
  total++;
  checkStructural('pair', q, 4);
  const promptWord = q.prompt.match(/「(.+)（/)[1];
  const partners = PARTNER_MAP.get(promptWord) || new Set();
  q.options.filter((o) => o !== q.correctAnswer).forEach((d) => {
    if (partners.has(d)) fail(`pair collision: "${d}" is ALSO a registered partner of "${promptWord}" :: ${JSON.stringify(q.options)}`);
  });
}

// ── 四字熟語 ─────────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genYoji(C, KANKEN3_KANJI);
  total++;
  checkStructural('yoji', q, 4);
  const idiom = q.itemRef.split('/')[2];
  // no distractor char may equal any character OTHER than the blank position
  // (the ones actually shown in the masked idiom).
  const entry = C.yoji.find((y) => y.w === idiom);
  const visibleChars = new Set(entry.w.split('').filter((_, idx) => idx !== entry.blank));
  q.options.filter((o) => o !== q.correctAnswer).forEach((d) => {
    if (visibleChars.has(d)) fail(`yoji collision: distractor "${d}" is already visible in "${entry.w}" :: ${JSON.stringify(q.options)}`);
  });
}

// ── 送り仮名 ─────────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genOkuri(C, KANKEN3_KANJI);
  total++;
  checkStructural('okuri', q, 4);
}

// ── 同音・同訓異字 ────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genDoon(C, KANKEN3_KANJI);
  total++;
  checkStructural('doon', q, 4);
  // (same-reading options are the intended puzzle shape here — see the
  // data-integrity pass above for the collision check that actually applies.)
}

// ── 漢字識別 ─────────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genShikibetsu(C, KANKEN3_KANJI);
  total++;
  checkStructural('shikibetsu', q, 4);
  const kanjiK = q.correctAnswer;
  const entry = C.shikibetsu.find((s) => s.k === kanjiK);
  const visible = new Set(entry.words.join('').split(''));
  q.options.filter((o) => o !== q.correctAnswer).forEach((d) => {
    if (visible.has(d)) fail(`shikibetsu collision: distractor "${d}" already visible in "${entry.words.join('・')}" :: ${JSON.stringify(q.options)}`);
  });
}

// ── 誤字訂正 ─────────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genGoji(C, KANKEN3_KANJI);
  total++;
  checkStructural('goji', q, 4);
  // (g.read is never shown to the player — see the data-integrity pass
  // above for the collision check that actually applies.)
}

// ── 部首 ─────────────────────────────────────────────────────────────────
for (let i = 0; i < N; i++) {
  const q = Gen._gens.genBushu(C, KANKEN3_KANJI);
  total++;
  checkStructural('bushu', q, 4);
  // no two options may share the same 部首 character (the "same radical, two
  // names" collision the module's own comment calls out).
  const rads = q.options.map((o) => o.match(/^(.+?)（/)[1]);
  if (new Set(rads).size !== rads.length) fail(`bushu collision: two options share a radical char :: ${JSON.stringify(q.options)}`);
}

// ── generateQuiz wrapper — mixed & single-category ──────────────────────
{
  const quiz = Gen.generateQuiz(C, KANKEN3_KANJI, 'mix', 60);
  total += quiz.length;
  if (quiz.length !== 60) fail(`generateQuiz(mix,60) length ${quiz.length}`);
  quiz.forEach((q) => {
    const cat = Gen.CATEGORIES.find((c) => c.label === q.category);
    checkStructural('quiz-mix', q, cat && cat.key === 'kosei' ? 5 : 4);
  });

  Gen.CATEGORIES.forEach((cat) => {
    const single = Gen.generateQuiz(C, KANKEN3_KANJI, cat.key, 20);
    total += single.length;
    single.forEach((q) => checkStructural(`quiz-${cat.key}`, q, cat.key === 'kosei' ? 5 : 4));
  });
}

// ── report ───────────────────────────────────────────────────────────────
if (errors.length === 0) {
  console.log(`OK — ${KANKEN3_KANJI.length} kanken3 kanji, 10 generators x ${N} each (+ generateQuiz passes), ${total} questions total, all structural + collision checks passed.`);
} else {
  console.error(`\n${errors.length} failure(s):`);
  errors.slice(0, 40).forEach((e) => console.error('FAIL:', e));
  if (errors.length > 40) console.error(`  ...and ${errors.length - 40} more`);
  process.exitCode = 1;
}
