// Stress test for kokugo1/kanji-generator.js. Run: node kanji-generator.test.js
// kokugo3's kanji generator shipped TWO real "a wrong option is secretly also
// correct" bugs that only surfaced at scale, not from manual spot-checks:
//   (1) stroke-count questions with fewer than 4 distinct options, and
//   (2) a same-reading kanji sneaking in as a secretly-also-correct distractor
//       on reading / select questions.
// This regenerates thousands of instances of each type and asserts, per
// question, that neither can occur here — plus the universal structural checks.
const KANJI1 = require('../../gakuenza.com/modules/kokugo1/kanji-data.js');
const {
  generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion,
} = require('../../gakuenza.com/modules/kokugo1/kanji-generator.js');

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// ── data integrity ──
if (KANJI1.length !== 80) fail(`expected 80 grade-1 kanji, got ${KANJI1.length}`);
{
  const seen = new Set();
  KANJI1.forEach(k => {
    if (seen.has(k.k)) fail(`duplicate kanji in data: ${k.k}`);
    seen.add(k.k);
    if (!Number.isInteger(k.strokes) || k.strokes < 1) fail(`${k.k}: bad stroke count ${k.strokes}`);
    if (![...k.on, ...k.kun].length) fail(`${k.k}: no readings at all`);
  });
  const distinctStrokes = new Set(KANJI1.map(k => k.strokes));
  // stroke-count questions need >=4 distinct values in the pool to ever fill 4
  // options; assert the pool is comfortably above that.
  if (distinctStrokes.size < 4) fail(`too few distinct stroke counts: ${distinctStrokes.size}`);
}

const clean = (r) => r.replace(/-/g, '');

const N = 6000;
for (let i = 0; i < N; i++) {
  // ── reading question ──
  {
    const q = genReadingQuestion(KANJI1);
    checkStructural('reading', q);
    // collision: no distractor may be a valid reading of the SAME kanji.
    const kanji = q.itemRef.split('/')[3];
    const entry = KANJI1.find(k => k.k === kanji);
    const ownReadings = new Set([...entry.on, ...entry.kun].map(clean));
    q.options.filter(o => o !== q.correctAnswer).forEach(d => {
      if (ownReadings.has(d)) fail(`reading collision: "${d}" is also a reading of ${kanji} :: ${JSON.stringify(q.options)}`);
    });
  }
  // ── select question ──
  {
    const q = genKanjiSelectQuestion(KANJI1);
    checkStructural('select', q);
    const reading = q.itemRef.split('/')[4];
    // collision: no distractor kanji may ALSO have the shown reading.
    q.options.filter(o => o !== q.correctAnswer).forEach(dk => {
      const de = KANJI1.find(k => k.k === dk);
      if (de && [...de.on, ...de.kun].some(r => clean(r) === reading)) {
        fail(`select collision: ${dk} also reads ${reading} :: ${JSON.stringify(q.options)}`);
      }
    });
    // the correct kanji must genuinely have the shown reading.
    const ce = KANJI1.find(k => k.k === q.correctAnswer);
    if (!ce || ![...ce.on, ...ce.kun].some(r => clean(r) === reading)) fail(`select: correct ${q.correctAnswer} lacks reading ${reading}`);
  }
  // ── stroke-count question ──
  {
    const q = genStrokeCountQuestion(KANJI1);
    checkStructural('strokes', q);
    const nums = q.options.map(Number);
    if (nums.some(n => !Number.isInteger(n))) fail(`strokes: non-integer option :: ${JSON.stringify(q.options)}`);
    const kanji = q.itemRef.split('/')[3];
    const entry = KANJI1.find(k => k.k === kanji);
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
  const quiz = generateKanjiQuiz(KANJI1, 10);
  if (quiz.length !== 10) fail(`generateKanjiQuiz(10) length ${quiz.length}`);
  quiz.forEach(q => checkStructural('quiz', q));
}

if (failures === 0) {
  console.log(`OK — ${KANJI1.length} kanji, 3 generators x ${N} each, all structural + collision checks passed.`);
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
