// content.test.js — content-depth + integrity audit for nhvocab's vocab bank.
// Run: node tests/nhvocab/content.test.js
//
// nhvocab is a vocabulary bank: the quiz (app.js) samples a category (or a
// grade/unit slice) and, for each question, draws 3 WRONG choices from the
// SAME category when that category has enough members, else from the whole
// pool. So the meaningful "depth" unit is the per-category word count, and the
// meaningful correctness hazard is a distractor whose displayed text equals the
// correct answer's displayed text (a "wrong" option that is secretly also
// right). en2ja questions show the Japanese reading (`ja`); ja2en show the
// English (`en`).
//
// This test asserts:
//   1. Depth bar: every category carries >= 10 words (~10-12 bar, shakai5 ref).
//   2. Structural integrity: unique ids, no empty en/ja/cat, sane grade/unit.
//   3. No distractor collision: within a category, no two items share `ja`
//      (en2ja) or `en` (ja2en) — except a small, documented PRE-EXISTING
//      baseline of near-synonym pairs in the large `actions`/`descriptions`
//      categories that this depth pass did not touch (changing their shipped
//      Japanese answers is out of scope). The guard FAILS on any collision
//      outside that baseline, so depth-fill additions and future edits cannot
//      introduce new ones.
'use strict';
const fs = require('fs');
const path = require('path');
const VOCAB_FILE = path.resolve(__dirname, '../../gakuenza.com/modules/nhvocab/vocab.js');

const src = fs.readFileSync(VOCAB_FILE, 'utf8');
const m = src.match(/const NH_VOCAB = \[([\s\S]*?)\n\];/);
if (!m) { console.error('could not locate NH_VOCAB array'); process.exit(1); }
const NH_VOCAB = eval('[' + m[1] + ']');

const errors = [];
const fail = msg => errors.push(msg);

const DEPTH_MIN = 10;

// Pre-existing, out-of-scope near-synonym duplicates (see header). Each entry:
// `${cat}|${field}|${value}`. If any of these is ever fixed, remove it here.
const KNOWN_COLLISIONS = new Set([
  'actions|ja|みる',       // look / watch
  'actions|ja|はなす',     // speak / talk
  'actions|ja|みた',       // saw / watched
  'descriptions|ja|すてき', // wonderful / nice
]);

// group by category
const byCat = {};
for (const w of NH_VOCAB) (byCat[w.cat] ??= []).push(w);

// 1. structural integrity
const seenIds = new Set();
for (const w of NH_VOCAB) {
  if (seenIds.has(w.id)) fail(`duplicate id: ${w.id}`);
  seenIds.add(w.id);
  if (!w.id || !w.en || !w.ja || !w.cat) fail(`empty required field on ${JSON.stringify(w)}`);
  if (![5, 6].includes(w.grade) && w.grade !== 'both') fail(`bad grade on ${w.id}: ${w.grade}`);
  if (!Number.isInteger(w.unit) || w.unit < 0 || w.unit > 8) fail(`bad unit on ${w.id}: ${w.unit}`);
  if (!w.emoji) fail(`missing emoji on ${w.id}`);
}

// 2. depth bar + 3. collisions
let newCollisions = 0;
for (const [cat, ws] of Object.entries(byCat)) {
  if (ws.length < DEPTH_MIN) fail(`category "${cat}" is thin: ${ws.length} < ${DEPTH_MIN}`);
  for (const field of ['ja', 'en']) {
    const map = {};
    for (const w of ws) (map[w[field]] ??= []).push(w.id);
    for (const [val, list] of Object.entries(map)) {
      if (list.length < 2) continue;
      const key = `${cat}|${field}|${val}`;
      if (KNOWN_COLLISIONS.has(key)) continue;
      fail(`NEW ${field === 'ja' ? 'en2ja' : 'ja2en'} collision in "${cat}": "${val}" shared by ${list.join(',')}`);
      newCollisions++;
    }
  }
}

console.log('nhvocab content-depth audit');
console.log(`  total words:      ${NH_VOCAB.length}`);
console.log(`  categories:       ${Object.keys(byCat).length}`);
console.log(`  min per-category: ${Math.min(...Object.values(byCat).map(a => a.length))}`);
console.log(`  new collisions:   ${newCollisions} (known pre-existing: ${KNOWN_COLLISIONS.size})`);

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
