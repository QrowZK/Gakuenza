// Structural test for reading-units.js. Run: node reading-units.test.js
// Reading units are a fixed (non-generated) question bank, so this checks the
// invariants the quiz UI relies on: metadata present, exactly 4 distinct
// options per question, the correct answer among them, and globally-unique
// itemRefs (the gradebook groups per-question analysis by itemRef).
//
// DEPTH BAR (content-depth audit, roadmap debt #11 extended to kokugo1–3):
// every reading unit must hold at least DEPTH_BAR distinct questions so no
// unit is thin relative to the shakai5 reference (~10–12/section). The six
// narrative units were filled from 8 -> 11 in the kokugo1-3 depth pass; daizu
// was already at 10. This assertion keeps the bar from silently regressing.
const U = require('../../gakuenza.com/modules/kokugo3/reading-units.js');

const DEPTH_BAR = 10;

let fail = 0;
const err = (m) => { fail++; console.error('FAIL:', m); };
const refs = new Set();

for (const [k, u] of Object.entries(U)) {
  if (!u.title || !u.author || !u.volume || !u.month) err(`${k}: missing metadata`);
  if (!Array.isArray(u.questions) || u.questions.length < 6) err(`${k}: too few questions (${u.questions && u.questions.length})`);
  if (Array.isArray(u.questions) && u.questions.length < DEPTH_BAR) err(`${k}: below depth bar (${u.questions.length} < ${DEPTH_BAR})`);
  u.questions.forEach(q => {
    if (!q.itemRef) return err(`${k}: question missing itemRef`);
    if (refs.has(q.itemRef)) err(`duplicate itemRef ${q.itemRef}`);
    refs.add(q.itemRef);
    if (!q.itemRef.startsWith(`kokugo3/${k}/`)) err(`${q.itemRef}: itemRef prefix doesn't match unit key ${k}`);
    if (!q.category || !q.prompt) err(`${q.itemRef}: missing category/prompt`);
    if (!Array.isArray(q.options) || q.options.length !== 4) err(`${q.itemRef}: options != 4 (${q.options && q.options.length})`);
    if (new Set(q.options).size !== 4) err(`${q.itemRef}: duplicate options`);
    if (!q.options.includes(q.correctAnswer)) err(`${q.itemRef}: correct answer not among options`);
    if (typeof q.correctAnswer !== 'string' || !q.correctAnswer.trim()) err(`${q.itemRef}: empty/invalid correctAnswer`);
    if (q.options.some(o => typeof o !== 'string' || !o.trim())) err(`${q.itemRef}: empty/blank option`);
  });
}

if (fail === 0) console.log(`OK — ${Object.keys(U).length} units, ${refs.size} questions, all structural + depth-bar (>=${DEPTH_BAR}) checks passed.`);
else { console.error(`\n${fail} failure(s).`); process.exit(1); }
