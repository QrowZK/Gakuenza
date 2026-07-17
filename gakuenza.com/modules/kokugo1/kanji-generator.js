// kanji-generator.js — procedurally generates kanji practice questions from
// KANJI1 (kanji-data.js). Same "generator, not fixed bank" pattern as
// kokugo3/5: 80 real grade-1 kanji × three question types × randomized,
// collision-checked distractors. The distractor discipline here is the one
// kokugo3's generator earned the hard way (it shipped the "a wrong option is
// secretly also correct" bug twice) — see the per-generator notes.

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

// ── question type 1: 読み方クイズ — given a kanji, pick its correct reading.
//    Distractors are drawn from OTHER kanji's own readings (always real
//    readings of SOME kanji), and EVERY reading of the target kanji is
//    excluded from the pool — not just the one chosen as correct — so a
//    kanji's alternate reading can never sneak in as a "wrong" option that is
//    secretly also right. ────────────────────────────────────────────────
function genReadingQuestion(KANJI1) {
  const idx = Math.floor(Math.random() * KANJI1.length);
  const target = KANJI1[idx];
  const allReadings = [...target.on, ...target.kun];
  const correct = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctClean = correct.replace(/-/g, '');
  const targetOwnReadings = allReadings.map(r => r.replace(/-/g, ''));

  const distractorIdxs = pickRandom(KANJI1, 12, idx);
  const distractorPool = [];
  for (const di of distractorIdxs) {
    const k = KANJI1[di];
    [...k.on, ...k.kun].forEach(r => {
      const clean = r.replace(/-/g, '');
      if (!targetOwnReadings.includes(clean) && !distractorPool.includes(clean)) distractorPool.push(clean);
    });
  }
  const distractors = shuffle(distractorPool).slice(0, 3);
  const options = shuffle([correctClean, ...distractors]);

  return {
    itemRef: `kokugo1/kanji/reading/${target.k}/${correctClean}`,
    category: '漢字：よみかた',
    prompt: `「${target.k}」の よみかたは どれですか。`,
    options,
    correctAnswer: correctClean,
  };
}

// ── question type 2: 漢字えらびクイズ — given a reading, pick the matching
//    kanji. Any kanji that ALSO legitimately has this exact reading is
//    excluded from the distractor pool (not just the target's index) — grade-1
//    homophones are common (生/正/青 all セイ, 花/火 both か-ish on-yomi カ,
//    上/下 share directional kun etc.), so a distractor sharing the reading
//    would make the question genuinely ambiguous. ───────────────────────────
function genKanjiSelectQuestion(KANJI1) {
  const idx = Math.floor(Math.random() * KANJI1.length);
  const target = KANJI1[idx];
  const allReadings = [...target.on, ...target.kun];
  const correctReading = allReadings[Math.floor(Math.random() * allReadings.length)];
  const correctReadingClean = correctReading.replace(/-/g, '');

  const candidates = KANJI1.filter((k, i) =>
    i !== idx && ![...k.on, ...k.kun].some(r => r.replace(/-/g, '') === correctReadingClean)
  );
  const distractors = shuffle(candidates).slice(0, 3).map(k => k.k);
  const options = shuffle([target.k, ...distractors]);

  return {
    itemRef: `kokugo1/kanji/select/${target.k}/${correctReadingClean}`,
    category: '漢字：かんじえらび',
    prompt: `「${correctReadingClean}」と よむ かんじは どれですか。`,
    options,
    correctAnswer: target.k,
  };
}

// ── question type 3: 画数クイズ — given a kanji, pick its correct stroke count.
//    Distractors are drawn from the FULL 80-kanji stroke-count pool (deduped,
//    excluding the true count), so there are always ≥3 distinct wrong values
//    and no distractor ever equals the true count. ──────────────────────────
function genStrokeCountQuestion(KANJI1) {
  const idx = Math.floor(Math.random() * KANJI1.length);
  const target = KANJI1[idx];
  const correct = target.strokes;

  const allOtherStrokes = [...new Set(KANJI1.map(k => k.strokes).filter(s => s !== correct))];
  const distractors = shuffle(allOtherStrokes).slice(0, 3);
  const options = shuffle([correct, ...distractors]).map(String);

  return {
    itemRef: `kokugo1/kanji/strokes/${target.k}/${correct}`,
    category: '漢字：かくすう',
    prompt: `「${target.k}」は なんかくですか。`,
    options,
    correctAnswer: String(correct),
  };
}

const GENERATORS = [genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion];

function generateKanjiQuiz(KANJI1, count) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const gen = GENERATORS[Math.floor(Math.random() * GENERATORS.length)];
    questions.push(gen(KANJI1));
  }
  return questions;
}

if (typeof module !== 'undefined') {
  module.exports = { generateKanjiQuiz, genReadingQuestion, genKanjiSelectQuestion, genStrokeCountQuestion };
}
