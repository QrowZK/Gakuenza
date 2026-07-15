// Structural test for reading-units.js. Run: node reading-units.test.js
// Reading units are a fixed (non-generated) question bank, so this checks the
// invariants the quiz UI relies on: metadata present, exactly 4 distinct
// options per question, the correct answer among them, and globally-unique
// itemRefs (the gradebook groups per-question analysis by itemRef).
const U = require('../../gakuenza.com/modules/kokugo3/reading-units.js');

let fail = 0;
const err = (m) => { fail++; console.error('FAIL:', m); };
const refs = new Set();

for (const [k, u] of Object.entries(U)) {
  if (!u.title || !u.author || !u.volume || !u.month) err(`${k}: missing metadata`);
  if (!Array.isArray(u.questions) || u.questions.length < 6) err(`${k}: too few questions (${u.questions && u.questions.length})`);
  u.questions.forEach(q => {
    if (!q.itemRef) return err(`${k}: question missing itemRef`);
    if (refs.has(q.itemRef)) err(`duplicate itemRef ${q.itemRef}`);
    refs.add(q.itemRef);
    if (!q.itemRef.startsWith(`kokugo3/${k}/`)) err(`${q.itemRef}: itemRef prefix doesn't match unit key ${k}`);
    if (!q.category || !q.prompt) err(`${q.itemRef}: missing category/prompt`);
    if (!Array.isArray(q.options) || q.options.length !== 4) err(`${q.itemRef}: options != 4 (${q.options && q.options.length})`);
    if (new Set(q.options).size !== 4) err(`${q.itemRef}: duplicate options`);
    if (!q.options.includes(q.correctAnswer)) err(`${q.itemRef}: correct answer not among options`);
  });
}

if (fail === 0) console.log(`OK — ${Object.keys(U).length} units, ${refs.size} questions, all structural checks passed.`);
else { console.error(`\n${fail} failure(s).`); process.exit(1); }
