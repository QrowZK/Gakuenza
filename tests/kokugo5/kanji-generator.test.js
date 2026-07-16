// Stress test for kokugo5/kanji-generator.js. Run: node kanji-generator.test.js
// kokugo3's kanji generator shipped TWO real "a wrong option is secretly also
// correct" bugs that only surfaced at scale, not from manual spot-checks:
//   (1) stroke-count questions with fewer than 4 distinct options, and
//   (2) a same-reading kanji sneaking in as a secretly-also-correct distractor
//       on reading / select questions.
// This regenerates thousands of instances of each type and asserts, per
// question, that neither can occur here — plus the universal structural checks.
const KANJI5 = require('../../gakuenza.com/modules/kokugo5/kanji-data.js');
const {
  generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion,
} = require('../../gakuenza.com/modules/kokugo5/kanji-generator.js');

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// ── data integrity ──
if (KANJI5.length !== 193) fail(`expected 193 grade-5 kanji, got ${KANJI5.length}`);
{
  const seen = new Set();
  KANJI5.forEach(k => {
    if (seen.has(k.k)) fail(`duplicate kanji in data: ${k.k}`);
    seen.add(k.k);
    if (!Number.isInteger(k.strokes) || k.strokes < 1) fail(`${k.k}: bad stroke count ${k.strokes}`);
    if (![...k.on, ...k.kun].length) fail(`${k.k}: no readings at all`);
  });
  const distinctStrokes = new Set(KANJI5.map(k => k.strokes));
  // stroke-count questions need >=4 distinct values in the pool to ever fill 4
  // options; assert the pool is comfortably above that.
  if (distinctStrokes.size < 4) fail(`too few distinct stroke counts: ${distinctStrokes.size}`);
}

const clean = (r) => r.replace(/-/g, '');

const N = 6000;
for (let i = 0; i < N; i++) {
  // ── reading question ──
  {
    const q = genReadingQuestion(KANJI5);
    checkStructural('reading', q);
    // collision: no distractor may be a valid reading of the SAME kanji.
    const kanji = q.itemRef.split('/')[2];
    const entry = KANJI5.find(k => k.k === kanji);
    const ownReadings = new Set([...entry.on, ...entry.kun].map(clean));
    q.options.filter(o => o !== q.correctAnswer).forEach(d => {
      if (ownReadings.has(d)) fail(`reading collision: "${d}" is also a reading of ${kanji} :: ${JSON.stringify(q.options)}`);
    });
  }
  // ── select question ──
  {
    const q = genKanjiSelectQuestion(KANJI5);
    checkStructural('select', q);
    const reading = q.itemRef.split('/')[3];
    // collision: no distractor kanji may ALSO have the shown reading.
    q.options.filter(o => o !== q.correctAnswer).forEach(dk => {
      const de = KANJI5.find(k => k.k === dk);
      if (de && [...de.on, ...de.kun].some(r => clean(r) === reading)) {
        fail(`select collision: ${dk} also reads ${reading} :: ${JSON.stringify(q.options)}`);
      }
    });
    // the correct kanji must genuinely have the shown reading.
    const ce = KANJI5.find(k => k.k === q.correctAnswer);
    if (!ce || ![...ce.on, ...ce.kun].some(r => clean(r) === reading)) fail(`select: correct ${q.correctAnswer} lacks reading ${reading}`);
  }
  // ── stroke-count question ──
  {
    const q = genStrokeCountQuestion(KANJI5);
    checkStructural('strokes', q);
    // all options numeric; exactly one equals the true stroke count.
    const nums = q.options.map(Number);
    if (nums.some(n => !Number.isInteger(n))) fail(`strokes: non-integer option :: ${JSON.stringify(q.options)}`);
    const kanji = q.itemRef.split('/')[2];
    const entry = KANJI5.find(k => k.k === kanji);
    const matches = nums.filter(n => n === entry.strokes).length;
    if (matches !== 1) fail(`strokes: ${matches} options equal true count ${entry.strokes} :: ${JSON.stringify(q.options)}`);
  }
}

function checkStructural(kind, q) {
  if (!q.prompt || !q.category || !q.itemRef) fail(`${kind}: missing prompt/category/itemRef`);
  if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${kind}: options != 4 (${q.options && q.options.length}) :: ${q.prompt}`);
  if (new Set(q.options).size !== 4) fail(`${kind}: duplicate options :: ${JSON.stringify(q.options)}`);
  if (!q.options.includes(q.correctAnswer)) fail(`${kind}: correct not among options :: ${q.correctAnswer} / ${JSON.stringify(q.options)}`);
  q.options.forEach(o => { if (o == null || o === '') fail(`${kind}: empty option :: ${q.prompt}`); });
}

// generateKanjiQuiz returns the requested count, all well-formed.
{
  const quiz = generateKanjiQuiz(KANJI5, 10);
  if (quiz.length !== 10) fail(`generateKanjiQuiz(10) length ${quiz.length}`);
  quiz.forEach(q => checkStructural('quiz', q));
}

if (failures === 0) {
  console.log(`OK — ${KANJI5.length} kanji, 3 generators x ${N} each, all structural + collision checks passed.`);
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
