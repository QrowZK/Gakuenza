// Stress test for kokugo2/kanji-generator.js + data integrity for kanji-data.js.
// Run: node kanji-generator.test.js
// kokugo3's kanji generator shipped TWO real "a wrong option is secretly also
// correct" bugs that only surfaced at scale:
//   (1) stroke-count questions with fewer than 4 distinct options, and
//   (2) a same-reading kanji sneaking in as a secretly-also-correct distractor.
// This regenerates thousands of instances of each type and asserts, per
// question, that neither can occur — plus the universal structural checks and
// a verification that the data file is exactly the official 160-character
// grade-2 set (count AND membership), not a truncated/padded fragment.
const KANJI2 = require('../../gakuenza.com/modules/kokugo2/kanji-data.js');
const {
  generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion,
} = require('../../gakuenza.com/modules/kokugo2/kanji-generator.js');

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.error('FAIL:', msg); };

// ── data integrity: the official MEXT grade-2 set (160 characters) ──
// Reference set (order-independent), cross-checked against the published
// 学年別漢字配当表 grade-2 list. If the module's list drifts from this exact
// membership the test fails loudly.
const GRADE2_REFERENCE = (
  '引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸' +
  '古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少' +
  '場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当' +
  '東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話'
).split('');

if (KANJI2.length !== 160) fail(`expected 160 grade-2 kanji, got ${KANJI2.length}`);
{
  const refSet = new Set(GRADE2_REFERENCE);
  if (refSet.size !== 160) fail(`reference set is not 160 unique chars: ${refSet.size}`);
  const dataSet = new Set(KANJI2.map(k => k.k));
  if (dataSet.size !== KANJI2.length) fail('duplicate kanji in data file');
  // every data kanji must be in the reference, and vice versa
  KANJI2.forEach(k => { if (!refSet.has(k.k)) fail(`kanji not in official grade-2 set: ${k.k}`); });
  GRADE2_REFERENCE.forEach(c => { if (!dataSet.has(c)) fail(`official grade-2 kanji missing from data: ${c}`); });

  KANJI2.forEach(k => {
    if (!Number.isInteger(k.strokes) || k.strokes < 1 || k.strokes > 30) fail(`${k.k}: bad stroke count ${k.strokes}`);
    if (![...k.on, ...k.kun].length) fail(`${k.k}: no readings at all`);
    // okurigana hyphen sanity: readings are non-empty strings
    [...k.on, ...k.kun].forEach(r => { if (!r) fail(`${k.k}: empty reading`); });
  });
  const distinctStrokes = new Set(KANJI2.map(k => k.strokes));
  if (distinctStrokes.size < 4) fail(`too few distinct stroke counts: ${distinctStrokes.size}`);
}

const clean = (r) => r.replace(/-/g, '');

const N = 6000;
for (let i = 0; i < N; i++) {
  // ── reading question ──
  {
    const q = genReadingQuestion(KANJI2);
    checkStructural('reading', q);
    const kanji = q.itemRef.split('/')[3];
    const entry = KANJI2.find(k => k.k === kanji);
    const ownReadings = new Set([...entry.on, ...entry.kun].map(clean));
    q.options.filter(o => o !== q.correctAnswer).forEach(d => {
      if (ownReadings.has(d)) fail(`reading collision: "${d}" is also a reading of ${kanji} :: ${JSON.stringify(q.options)}`);
    });
    if (!ownReadings.has(q.correctAnswer)) fail(`reading: correct ${q.correctAnswer} is not a reading of ${kanji}`);
  }
  // ── select question ──
  {
    const q = genKanjiSelectQuestion(KANJI2);
    checkStructural('select', q);
    const reading = q.itemRef.split('/')[4];
    q.options.filter(o => o !== q.correctAnswer).forEach(dk => {
      const de = KANJI2.find(k => k.k === dk);
      if (de && [...de.on, ...de.kun].some(r => clean(r) === reading)) {
        fail(`select collision: ${dk} also reads ${reading} :: ${JSON.stringify(q.options)}`);
      }
    });
    const ce = KANJI2.find(k => k.k === q.correctAnswer);
    if (!ce || ![...ce.on, ...ce.kun].some(r => clean(r) === reading)) fail(`select: correct ${q.correctAnswer} lacks reading ${reading}`);
  }
  // ── stroke-count question ──
  {
    const q = genStrokeCountQuestion(KANJI2);
    checkStructural('strokes', q);
    const nums = q.options.map(Number);
    if (nums.some(n => !Number.isInteger(n))) fail(`strokes: non-integer option :: ${JSON.stringify(q.options)}`);
    const kanji = q.itemRef.split('/')[3];
    const entry = KANJI2.find(k => k.k === kanji);
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

{
  const quiz = generateKanjiQuiz(KANJI2, 10);
  if (quiz.length !== 10) fail(`generateKanjiQuiz(10) length ${quiz.length}`);
  quiz.forEach(q => checkStructural('quiz', q));
}

if (failures === 0) {
  console.log(`OK — ${KANJI2.length} grade-2 kanji (matches official set), 3 generators x ${N} each, all structural + collision checks passed.`);
} else {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
