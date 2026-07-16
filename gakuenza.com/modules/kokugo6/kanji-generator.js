// kanji-generator.js — procedurally generates kanji practice questions from
// KANJI6 (kanji-data.js). Same "generator, not fixed bank" pattern as
// kokugo3's kanji-generator.js: 191 real grade-6 kanji × multiple question
// types × randomized distractors means this doesn't run out the way a fixed
// question bank would, without needing 191 hand-authored example sentences.
//
// One deliberate difference from kokugo3's generator: kokugo6's readings come
// from KANJIDIC2 (kanjiapi), where the okurigana boundary is「.」and a
// prefix/suffix position is「-」(see kanji-data.js). So the reading-cleaning
// step strips BOTH「.」and「-」— kokugo3 only had「-」to strip. Everything
// else (the two distractor-collision guards below) is the same discipline
// this project's kanji generator earned the hard way (two shipped
// "wrong option secretly also correct" bugs).

// Strip reading markers to the bare kana a learner would type/read.
function cleanReading(r) { return r.replace(/[.-]/g, ''); }

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
function genReadingQuestion(KANJI6) {
  const idx = Math.floor(Math.random() * KANJI6.length);
  const target = KANJI6[idx];
  const allReadings = [...target.on, ...target.kun];
  const correct = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctClean = cleanReading(correct);
  // Every one of the target's OWN readings is excluded from the distractor
  // pool, not just the specific one chosen as correct — a kanji's other
  // reading showing up as a "wrong" option is the same ambiguity bug as the
  // select-question case (caught in kokugo3 stress testing at 2/2000, not
  // zero).
  const targetOwnReadings = allReadings.map(cleanReading);

  const distractorIdxs = pickRandom(KANJI6, 8, idx);
  const distractorPool = [];
  for (const di of distractorIdxs) {
    const k = KANJI6[di];
    [...k.on, ...k.kun].forEach(r => {
      const clean = cleanReading(r);
      if (clean && !targetOwnReadings.includes(clean) && !distractorPool.includes(clean)) distractorPool.push(clean);
    });
  }
  const distractors = shuffle(distractorPool).slice(0, 3);
  const options = shuffle([correctClean, ...distractors]);

  return {
    itemRef: `kanji6/reading/${target.k}/${correctClean}`,
    category: '漢字：読み方',
    prompt: `「${target.k}」の読み方はどれですか。`,
    options,
    correctAnswer: correctClean,
  };
}

// ── question type 2: 漢字えらびクイズ — given a reading, pick the matching
//    kanji from 4 options (1 real + 3 distractors that do NOT have this
//    reading, drawn from the rest of the set). ──────────────────────────
function genKanjiSelectQuestion(KANJI6) {
  const idx = Math.floor(Math.random() * KANJI6.length);
  const target = KANJI6[idx];
  const allReadings = [...target.on, ...target.kun];
  const correctReading = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctReadingClean = cleanReading(correctReading);

  // Exclude any kanji that ALSO legitimately has this exact reading — not just
  // the target kanji itself. Homophone kanji are common in this set (供/胸/郷
  // all キョウ, 呼/誤/后/孝 all コウ, …) — a distractor sharing the correct
  // reading makes the question genuinely ambiguous, not just wrong. This is
  // the exact collision class the kanji generator shipped twice before; it is
  // guarded by construction here and asserted by the stress test.
  const candidates = KANJI6.filter((k, i) =>
    i !== idx && ![...k.on, ...k.kun].some(r => cleanReading(r) === correctReadingClean)
  );
  const distractors = shuffle(candidates).slice(0, 3).map(k => k.k);
  const options = shuffle([target.k, ...distractors]);

  return {
    itemRef: `kanji6/select/${target.k}/${correctReadingClean}`,
    category: '漢字：漢字えらび',
    prompt: `「${correctReadingClean}」の読み方をする漢字はどれですか。`,
    options,
    correctAnswer: target.k,
  };
}

// ── question type 3: 画数クイズ — given a kanji, pick its correct stroke count. ──
function genStrokeCountQuestion(KANJI6) {
  const idx = Math.floor(Math.random() * KANJI6.length);
  const target = KANJI6[idx];
  const correct = target.strokes;

  // Draw distractors from the FULL 191-kanji stroke-count pool, not a small
  // random sample — a small sample can fail to contain 3 distinct values
  // different from the target's (caught by stress-testing in kokugo3, not
  // assumed safe from a handful of examples).
  const allOtherStrokes = [...new Set(KANJI6.map(k => k.strokes).filter(s => s !== correct))];
  const distractors = shuffle(allOtherStrokes).slice(0, 3);
  const options = shuffle([correct, ...distractors]).map(String);

  return {
    itemRef: `kanji6/strokes/${target.k}/${correct}`,
    category: '漢字：画数',
    prompt: `「${target.k}」は何画ですか。`,
    options,
    correctAnswer: String(correct),
  };
}

const GENERATORS = [genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion];

function generateKanjiQuiz(KANJI6, count) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const gen = GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
    questions.push(gen(KANJI6));
  }
  return questions;
}

if (typeof module !== 'undefined') {
  module.exports = { generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion, cleanReading };
}
