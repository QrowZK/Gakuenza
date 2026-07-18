// generators.test.js — structural + distractor-collision stress test for eigo5.
// Run: node tests/eigo5/generators.test.js
//
// Asserts the invariants CLAUDE.md's testing bar calls out:
//   VOCAB (en2ja & ja2en):
//     - exactly 4 distinct choices, correct present exactly once at correctIndex
//     - NO distractor equal to the answer
//     - NO distractor gloss that is ALSO a valid translation of the prompt word
//       (synonym-leakage collision) — checked against a full valid-translation
//       map built from the whole vocab set, not just id inequality
//   SENTENCES (fill-in):
//     - exactly 4 distinct choices, answer present exactly once at correctIndex
//     - NO distractor equal to the answer (exactly-one-correct by construction)
//   DATA INTEGRITY:
//     - every vocab/sentence unit tag is a declared unit key
//     - unit keys match modules/eigo5/units.js exactly
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/eigo5');

const { EIGO5_UNITS, EIGO5_VOCAB, EIGO5_SENTENCES } = require(path.join(base, 'data.js'));
const Gen = require(path.join(base, 'generators.js'));

const norm = s => String(s == null ? '' : s).trim().toLowerCase();
const errors = [];
const fail = m => errors.push(m);

// ── Build valid-translation maps (for the collision check) ──────────────────
// en(normalized) -> set of every ja that is a legitimate translation of it
// ja(normalized) -> set of every en that is a legitimate translation of it
const enToJa = new Map();
const jaToEn = new Map();
for (const w of EIGO5_VOCAB) {
  const e = norm(w.en), j = norm(w.ja);
  if (!enToJa.has(e)) enToJa.set(e, new Set());
  if (!jaToEn.has(j)) jaToEn.set(j, new Set());
  enToJa.get(e).add(j);
  jaToEn.get(j).add(e);
}

// ── Data integrity ──────────────────────────────────────────────────────────
const unitKeys = new Set(EIGO5_UNITS.map(u => u.key));
const unitsJs = fs.readFileSync(path.join(base, 'units.js'), 'utf8');
for (const u of EIGO5_UNITS) {
  if (!unitsJs.includes(`'${u.key}'`)) fail(`units.js missing unit key ${u.key}`);
}
for (const w of EIGO5_VOCAB) if (!unitKeys.has(w.unit)) fail(`vocab ${w.id}: unknown unit ${w.unit}`);
for (const s of EIGO5_SENTENCES) {
  if (!unitKeys.has(s.unit)) fail(`sentence ${s.id}: unknown unit ${s.unit}`);
  if (!s.text.includes('____')) fail(`sentence ${s.id}: no blank marker ____`);
  if (!Array.isArray(s.distractors) || s.distractors.length < 3) fail(`sentence ${s.id}: <3 distractors`);
  // authoring hygiene: answer must not appear inside its own distractor pool
  if (s.distractors.some(d => norm(d) === norm(s.answer))) fail(`sentence ${s.id}: distractor equals answer`);
  if (new Set(s.distractors.map(norm)).size !== s.distractors.length) fail(`sentence ${s.id}: duplicate distractors`);
}

// ── Vocab generation stress ─────────────────────────────────────────────────
const RUNS = 300;
let vocabQ = 0;
for (const qtype of ['en2ja', 'ja2en']) {
  for (const w of EIGO5_VOCAB) {
    for (let r = 0; r < RUNS; r++) {
      const q = Gen.buildVocabQuestion(w, EIGO5_VOCAB, qtype);
      vocabQ++;
      const tag = `${qtype} ${w.id}`;

      if (q.choices.length !== 4) fail(`${tag}: ${q.choices.length} choices (want 4)`);
      if (new Set(q.choices.map(norm)).size !== q.choices.length) fail(`${tag}: duplicate choices ${JSON.stringify(q.choices)}`);
      if (q.choices[q.correctIndex] !== q.answer) fail(`${tag}: correctIndex mismatch`);
      const nCorrect = q.choices.filter(c => norm(c) === norm(q.answer)).length;
      if (nCorrect !== 1) fail(`${tag}: answer appears ${nCorrect}x`);

      // Collision: every distractor's displayed text must NOT be a valid
      // translation of the prompt word.
      const validSet = qtype === 'en2ja'
        ? enToJa.get(norm(w.en))   // valid ja glosses of prompt en
        : jaToEn.get(norm(w.ja));  // valid en words for prompt ja
      for (const c of q.choices) {
        if (norm(c) === norm(q.answer)) continue;
        if (validSet && validSet.has(norm(c))) {
          fail(`${tag}: distractor "${c}" is ALSO a valid translation of "${q.prompt}"`);
        }
      }
    }
  }
}

// ── Sentence generation stress ──────────────────────────────────────────────
let sentQ = 0;
for (const item of EIGO5_SENTENCES) {
  for (let r = 0; r < RUNS; r++) {
    const q = Gen.buildSentenceQuestion(item);
    sentQ++;
    const tag = `sentence ${item.id}`;
    if (q.choices.length !== 4) fail(`${tag}: ${q.choices.length} choices (want 4)`);
    if (new Set(q.choices.map(norm)).size !== q.choices.length) fail(`${tag}: duplicate choices ${JSON.stringify(q.choices)}`);
    if (q.choices[q.correctIndex] !== q.answer) fail(`${tag}: correctIndex mismatch`);
    const nCorrect = q.choices.filter(c => norm(c) === norm(q.answer)).length;
    if (nCorrect !== 1) fail(`${tag}: answer appears ${nCorrect}x`);
    if (q.text.includes('____')) fail(`${tag}: raw blank leaked into rendered text`);
  }
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log(`eigo5 generator stress test`);
console.log(`  units:      ${EIGO5_UNITS.length}`);
console.log(`  vocab:      ${EIGO5_VOCAB.length} words`);
console.log(`  sentences:  ${EIGO5_SENTENCES.length} items`);
console.log(`  vocab Qs generated:    ${vocabQ}`);
console.log(`  sentence Qs generated: ${sentQ}`);
if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.slice(0, 40).forEach(e => console.error('  - ' + e));
  if (errors.length > 40) console.error(`  ...and ${errors.length - 40} more`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
