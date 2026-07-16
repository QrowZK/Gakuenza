// kanji-generator.js — procedurally generates kanji practice questions from
// KANJI5 (kanji-data.js). Same "generator, not fixed bank" pattern as kokugo3's
// kanji drill: 193 real grade-5 kanji × multiple question types × randomized
// distractors, so it doesn't run out the way a fixed question bank would.
//
// COLLISION DISCIPLINE: kokugo3's kanji generator shipped two real "a wrong
// option is secretly also correct" bugs that only surfaced at scale — a
// same-reading kanji sneaking in as a secretly-valid distractor, and fewer than
// 4 distinct options on stroke-count questions. Both are guarded against here by
// construction and asserted in kanji-generator.test.js at 500–5000 instances.

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
//    readings, so every option is always a real, valid reading of SOME kanji —
//    never an invented non-reading). ──────────────────────────────────────────
function genReadingQuestion(KANJI5) {
  const idx = Math.floor(Math.random() * KANJI5.length);
  const target = KANJI5[idx];
  const allReadings = [...target.on, ...target.kun];
  const correct = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctClean = correct.replace(/-/g, '');
  // Every one of the target's OWN readings is excluded from the distractor
  // pool, not just the specific one chosen as correct — a kanji's other
  // reading appearing as a "wrong" option is the same ambiguity bug as the
  // select-question case, just rarer (kokugo3 caught it at 2/2000).
  const targetOwnReadings = allReadings.map(r => r.replace(/-/g, ''));

  const distractorIdxs = pickRandom(KANJI5, 8, idx);
  const distractorPool = [];
  for (const di of distractorIdxs) {
    const k = KANJI5[di];
    [...k.on, ...k.kun].forEach(r => {
      const clean = r.replace(/-/g, '');
      if (!targetOwnReadings.includes(clean) && !distractorPool.includes(clean)) distractorPool.push(clean);
    });
  }
  const distractors = shuffle(distractorPool).slice(0, 3);
  const options = shuffle([correctClean, ...distractors]);

  return {
    itemRef: `kanji5/reading/${target.k}/${correctClean}`,
    category: '漢字：読み方',
    prompt: `「${target.k}」の読み方はどれですか。`,
    options,
    correctAnswer: correctClean,
  };
}

// ── question type 2: 漢字えらびクイズ — given a reading, pick the matching
//    kanji from 4 options (1 real + 3 distractors that do NOT have this
//    reading, drawn from the rest of the set). ──────────────────────────────
function genKanjiSelectQuestion(KANJI5) {
  const idx = Math.floor(Math.random() * KANJI5.length);
  const target = KANJI5[idx];
  const allReadings = [...target.on, ...target.kun];
  const correctReading = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctReadingClean = correctReading.replace(/-/g, '');

  // Exclude any kanji that ALSO legitimately has this exact reading — not just
  // the target itself. Grade-5 is dense with homophones (可・仮・価・河・過 all
  // カ; 紀・基・寄・規・喜 all キ), so a distractor sharing the correct reading
  // makes the question genuinely ambiguous, not merely wrong. Checked against
  // each distractor's own readings, not assumed safe from excluding the index.
  const candidates = KANJI5.filter((k, i) =>
    i !== idx && ![...k.on, ...k.kun].some(r => r.replace(/-/g, '') === correctReadingClean)
  );
  const distractors = shuffle(candidates).slice(0, 3).map(k => k.k);
  const options = shuffle([target.k, ...distractors]);

  return {
    itemRef: `kanji5/select/${target.k}/${correctReadingClean}`,
    category: '漢字：漢字えらび',
    prompt: `「${correctReadingClean}」の読み方をする漢字はどれですか。`,
    options,
    correctAnswer: target.k,
  };
}

// ── question type 3: 画数クイズ — given a kanji, pick its correct stroke count. ──
function genStrokeCountQuestion(KANJI5) {
  const idx = Math.floor(Math.random() * KANJI5.length);
  const target = KANJI5[idx];
  const correct = target.strokes;

  // Draw distractors from the FULL 193-kanji stroke-count pool, not a small
  // random sample — a small sample can fail to contain 3 distinct values
  // different from the target's (kokugo3 caught this at 500 instances).
  const allOtherStrokes = [...new Set(KANJI5.map(k => k.strokes).filter(s => s !== correct))];
  const distractors = shuffle(allOtherStrokes).slice(0, 3);
  const options = shuffle([correct, ...distractors]).map(String);

  return {
    itemRef: `kanji5/strokes/${target.k}/${correct}`,
    category: '漢字：画数',
    prompt: `「${target.k}」は何画ですか。`,
    options,
    correctAnswer: String(correct),
  };
}

const GENERATORS = [genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion];

function generateKanjiQuiz(KANJI5, count) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const gen = GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
    questions.push(gen(KANJI5));
  }
  return questions;
}

if (typeof module !== 'undefined') {
  module.exports = { generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion };
}
