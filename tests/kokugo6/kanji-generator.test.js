// Stress test for kokugo6's kanji generator + data. Run:
//   node tests/kokugo6/kanji-generator.test.js
// Mirrors the discipline the kanji generator earned the hard way (two shipped
// "a wrong option is secretly also correct" bugs): generate at scale and check
// EVERY question for structural integrity AND the distractor-collision bug.
const KANJI6 = require('../../gakuenza.com/modules/kokugo6/kanji-data.js');
const gen = require('../../gakuenza.com/modules/kokugo6/kanji-generator.js');
const { generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion, cleanReading } = gen;

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// ── data-level checks ──────────────────────────────────────────────────────
if (KANJI6.length !== 191) fail(`KANJI6 length ${KANJI6.length}, expected 191 (grade-6 配当漢字, 2020 revision)`);
{
  const seen = new Set();
  for (const e of KANJI6) {
    if (seen.has(e.k)) fail(`duplicate kanji in data: ${e.k}`);
    seen.add(e.k);
    if (!e.k || [...e.k].length !== 1) fail(`bad kanji entry: ${JSON.stringify(e)}`);
    if (typeof e.strokes !== 'number' || e.strokes <= 0) fail(`bad strokes for ${e.k}: ${e.strokes}`);
    const readings = [...(e.on || []), ...(e.kun || [])];
    if (readings.length === 0) fail(`${e.k} has no readings`);
    readings.forEach(r => { if (!cleanReading(r)) fail(`${e.k} cleans to empty reading from '${r}'`); });
  }
}

// Precompute: for every kanji, the set of its cleaned readings; and a map from
// cleaned reading -> set of kanji that legitimately have it (for the select
// collision check that mirrors the generator's own guard).
const cleanedReadingsOf = new Map();
const kanjiByReading = new Map();
for (const e of KANJI6) {
  const set = new Set([...(e.on || []), ...(e.kun || [])].map(cleanReading));
  cleanedReadingsOf.set(e.k, set);
  for (const r of set) {
    if (!kanjiByReading.has(r)) kanjiByReading.set(r, new Set());
    kanjiByReading.get(r).add(e.k);
  }
}

function structural(q, label) {
  if (!q.prompt || !q.category || !q.itemRef) fail(`${label}: missing prompt/category/itemRef`);
  if (!Array.isArray(q.options) || q.options.length !== 4) fail(`${label}: options != 4 (${q.options && q.options.length}) :: ${q.prompt}`);
  if (new Set(q.options).size !== 4) fail(`${label}: duplicate options :: ${JSON.stringify(q.options)}`);
  if (!q.options.includes(q.correctAnswer)) fail(`${label}: correct not among options :: ${q.correctAnswer} / ${JSON.stringify(q.options)}`);
  q.options.forEach(o => { if (o == null || o === '') fail(`${label}: empty option :: ${q.prompt}`); });
}

const N = 8000;
for (let i = 0; i < N; i++) {
  // ── reading question ──
  {
    const q = genReadingQuestion(KANJI6);
    structural(q, 'reading');
    // target kanji is encoded in the itemRef: kanji6/reading/<K>/<reading>
    const target = q.itemRef.split('/')[2];
    const ownReadings = cleanedReadingsOf.get(target);
    // no distractor may be a valid reading of the SAME target kanji
    q.options.filter(o => o !== q.correctAnswer).forEach(d => {
      if (ownReadings.has(d)) fail(`reading collision: '${d}' is also a valid reading of ${target}`);
    });
    // and the correct answer must genuinely be a reading of the target
    if (!ownReadings.has(q.correctAnswer)) fail(`reading: '${q.correctAnswer}' is not a reading of ${target}`);
  }
  // ── select question ──
  {
    const q = genKanjiSelectQuestion(KANJI6);
    structural(q, 'select');
    // itemRef: kanji6/select/<K>/<reading>
    const parts = q.itemRef.split('/');
    const target = parts[2];
    const reading = parts.slice(3).join('/'); // reading has no slashes, but be safe
    // the correct kanji must have this reading
    if (!cleanedReadingsOf.get(target).has(reading)) fail(`select: ${target} does not have reading ${reading}`);
    // NO distractor kanji may also legitimately have the correct reading
    q.options.filter(o => o !== q.correctAnswer).forEach(dk => {
      if (cleanedReadingsOf.get(dk) && cleanedReadingsOf.get(dk).has(reading)) {
        fail(`select collision: distractor ${dk} also reads ${reading} (target ${target})`);
      }
    });
  }
  // ── stroke question ──
  {
    const q = genStrokeCountQuestion(KANJI6);
    structural(q, 'strokes');
    q.options.forEach(o => { if (!/^\d+$/.test(o)) fail(`strokes: non-numeric option ${o}`); });
    const target = q.itemRef.split('/')[2];
    const entry = KANJI6.find(e => e.k === target);
    if (String(entry.strokes) !== q.correctAnswer) fail(`strokes: wrong answer for ${target}: ${q.correctAnswer} vs ${entry.strokes}`);
    // no distractor may equal the correct stroke count
    if (q.options.filter(o => o === q.correctAnswer).length !== 1) fail(`strokes: correct value appears >1x`);
  }
}

// generateKanjiQuiz returns the requested count of well-formed questions.
{
  const quiz = generateKanjiQuiz(KANJI6, 10);
  if (quiz.length !== 10) fail(`generateKanjiQuiz(10) length ${quiz.length}`);
  quiz.forEach((q, i) => structural(q, `quiz[${i}]`));
}

if (failures === 0) {
  console.log(`OK — KANJI6 = ${KANJI6.length} chars; 3 generators × ${N} each, all structural + collision checks passed.`);
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
