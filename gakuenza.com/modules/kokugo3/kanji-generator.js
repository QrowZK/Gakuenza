// kanji-generator.js — procedurally generates kanji practice questions from
// KANJI3 (kanji-data.js). Same "generator, not fixed bank" pattern as
// sansu3 — 200 real kanji × multiple question types × randomized
// distractors means this doesn't run out the way a fixed question bank
// would, without needing 200 hand-authored example sentences to start.

function pickRandom(arr, n, excludeIdx) {
  const pool = arr.map((v, i) => i).filter(i => i !== excludeIdx);
  const out = [];
  while (out.length < n && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── question type 1: 読み方クイズ — given a kanji, pick its correct reading
//    from 4 options (1 real + 3 distractors drawn from OTHER kanji's own
//    readings, so every option is always a real, valid reading of SOME
//    kanji — never an invented non-reading). ─────────────────────────────
function genReadingQuestion(KANJI3) {
  const idx = Math.floor(Math.random() * KANJI3.length);
  const target = KANJI3[idx];
  const allReadings = [...target.on, ...target.kun];
  const correct = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctClean = correct.replace(/-/g, '');
  // Every one of the target's OWN readings is excluded from the
  // distractor pool, not just the specific one chosen as correct — a
  // kanji's other reading showing up as a "wrong" option is the same
  // ambiguity bug as the select-question case, just rarer (caught at
  // 2/2000 in stress testing, not zero).
  const targetOwnReadings = allReadings.map(r => r.replace(/-/g, ''));

  const distractorIdxs = pickRandom(KANJI3, 8, idx);
  const distractorPool = [];
  for (const di of distractorIdxs) {
    const k = KANJI3[di];
    [...k.on, ...k.kun].forEach(r => {
      const clean = r.replace(/-/g, '');
      if (!targetOwnReadings.includes(clean) && !distractorPool.includes(clean)) distractorPool.push(clean);
    });
  }
  const distractors = shuffle(distractorPool).slice(0, 3);
  const options = shuffle([correctClean, ...distractors]);

  return {
    itemRef: `kanji3/reading/${target.k}/${correctClean}`,
    category: '漢字：読み方',
    prompt: `「${target.k}」の読み方はどれですか。`,
    options,
    correctAnswer: correctClean,
  };
}

// ── question type 2: 漢字えらびクイズ — given a reading, pick the matching
//    kanji from 4 options (1 real + 3 distractors that do NOT have this
//    reading, drawn from the rest of the set). ──────────────────────────
function genKanjiSelectQuestion(KANJI3) {
  const idx = Math.floor(Math.random() * KANJI3.length);
  const target = KANJI3[idx];
  const allReadings = [...target.on, ...target.kun];
  const correctReading = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctReadingClean = correctReading.replace(/-/g, '');

  // Exclude any kanji that ALSO legitimately has this exact reading —
  // not just the target kanji itself. Homophone kanji are common in
  // this set (界/開 both カイ, 飲/院 both イン, 旅/度 both たび) — a
  // distractor sharing the correct reading makes the question genuinely
  // ambiguous, not just wrong. Caught by stress-testing 2000 generated
  // questions and checking each distractor's own readings, not assumed
  // safe from excluding only the target's index.
  const candidates = KANJI3.filter((k, i) =>
    i !== idx && ![...k.on, ...k.kun].some(r => r.replace(/-/g, '') === correctReadingClean)
  );
  const distractors = shuffle(candidates).slice(0, 3).map(k => k.k);
  const options = shuffle([target.k, ...distractors]);

  return {
    itemRef: `kanji3/select/${target.k}/${correctReadingClean}`,
    category: '漢字：漢字えらび',
    prompt: `「${correctReadingClean}」の読み方をする漢字はどれですか。`,
    options,
    correctAnswer: target.k,
  };
}

// ── question type 3: 画数クイズ — given a kanji, pick its correct stroke count. ──
function genStrokeCountQuestion(KANJI3) {
  const idx = Math.floor(Math.random() * KANJI3.length);
  const target = KANJI3[idx];
  const correct = target.strokes;

  // Draw distractors from the FULL 200-kanji stroke-count pool, not a
  // small random sample — a small sample can fail to contain 3 distinct
  // values different from the target's (caught by stress-testing 500
  // generated questions, not assumed safe from a handful of examples).
  const allOtherStrokes = [...new Set(KANJI3.map(k => k.strokes).filter(s => s !== correct))];
  const distractors = shuffle(allOtherStrokes).slice(0, 3);
  const options = shuffle([correct, ...distractors]).map(String);

  return {
    itemRef: `kanji3/strokes/${target.k}/${correct}`,
    category: '漢字：画数',
    prompt: `「${target.k}」は何画ですか。`,
    options,
    correctAnswer: String(correct),
  };
}

const GENERATORS = [genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion];

function generateKanjiQuiz(KANJI3, count) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const gen = GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
    questions.push(gen(KANJI3));
  }
  return questions;
}

if (typeof module !== 'undefined') {
  module.exports = { generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion };
}
