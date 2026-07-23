// generators.test.js — structural + distractor-collision stress test for rika3.
// Run: node tests/rika3/generators.test.js
//
// Asserts the invariants CLAUDE.md's testing bar calls out:
//   AUTHORED (rika3-data.js, STRANDS -> units -> questions):
//     - choice: answer present in options exactly once, options distinct
//       (normalized), non-empty prompt/exp
//     - order: items non-empty (>=2), distinct
//     - unit keys unique and match RIKA3_DATA.UNIT_KEYS
//     - declared `gen` keys resolve to real generators in RIKA3_GEN
//   GENERATED (rika3-gen.js, driven thousands of times per generator):
//     - options array well-formed, distinct, answer present exactly once
//     - semantic distractor-collision check against an INDEPENDENTLY-authored
//       ground-truth table (real-world material/insect facts), not just the
//       generator's own internal `_verify` — a bug baked into the module's
//       own "truth" data (e.g. mislabeling copper as magnetic) would pass
//       self-verification but must be caught here.
'use strict';

const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/rika3');

global.window = {};
require(path.join(base, 'rika3-data.js'));
require(path.join(base, 'rika3-gen.js'));

const RIKA3_DATA = global.window.RIKA3_DATA;
const RIKA3_GEN = global.window.RIKA3_GEN;

const errors = [];
const fail = (m) => errors.push(m);
const norm = (s) => String(s == null ? '' : s).normalize('NFKC').trim();

if (!RIKA3_DATA) fail('RIKA3_DATA did not load onto window');
if (!RIKA3_GEN) fail('RIKA3_GEN did not load onto window');
if (errors.length) {
  console.error('FATAL:', errors.join('; '));
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────
// 1. AUTHORED DATA — structural checks over every strand/unit/question
// ─────────────────────────────────────────────────────────────────────────
const allUnits = [];
RIKA3_DATA.STRANDS.forEach((s) => s.units.forEach((u) => allUnits.push({ strand: s.id, u })));

let authoredChoiceQ = 0, authoredOrderQ = 0;
const seenKeys = new Set();

allUnits.forEach(({ strand, u }) => {
  const uwhere = `${strand}/${u.key}`;
  if (seenKeys.has(u.key)) fail(`duplicate unit key: ${u.key}`);
  seenKeys.add(u.key);

  if (!u.key) fail(`${uwhere}: missing key`);
  if (!u.title) fail(`${uwhere}: missing title`);
  if (!Array.isArray(u.questions) || u.questions.length < 3) {
    fail(`${uwhere}: too few authored questions (${u.questions && u.questions.length})`);
  }

  (u.questions || []).forEach((q, i) => {
    const at = `${uwhere}#${i} [${q.type}]`;
    if (!q.q || !norm(q.q)) fail(`${at}: missing/empty prompt`);
    if (!q.exp || !norm(q.exp)) fail(`${at}: missing/empty explanation`);

    if (q.type === 'order') {
      authoredOrderQ++;
      if (!Array.isArray(q.items) || q.items.length < 2) {
        fail(`${at}: order items too few (${q.items && q.items.length})`);
        return;
      }
      if (q.items.some((it) => !it || !norm(it))) fail(`${at}: order item empty`);
      const distinctItems = new Set(q.items.map(norm));
      if (distinctItems.size !== q.items.length) fail(`${at}: duplicate order items -> ${JSON.stringify(q.items)}`);
    } else if (q.type === 'choice') {
      authoredChoiceQ++;
      if (!Array.isArray(q.options) || q.options.length < 2) {
        fail(`${at}: choice needs >=2 options`);
        return;
      }
      // options distinct (normalized — catches whitespace/width-variant dupes)
      const normed = q.options.map(norm);
      if (new Set(normed).size !== normed.length) {
        fail(`${at}: duplicate option text -> ${JSON.stringify(q.options)}`);
      }
      // answer present exactly once
      const hits = normed.filter((o) => o === norm(q.answer)).length;
      if (hits !== 1) fail(`${at}: answer "${q.answer}" appears ${hits}x in ${JSON.stringify(q.options)}`);
    } else {
      fail(`${at}: unknown question type "${q.type}"`);
    }
  });

  // declared gen keys must resolve to real generators
  (u.gen || []).forEach((g) => {
    if (!RIKA3_GEN.GENERATORS[g]) fail(`${uwhere}: declared gen key '${g}' has no generator`);
  });
});

// unit-key registry alignment (RIKA3_DATA.UNIT_KEYS vs actual unit keys)
const dataKeys = allUnits.map(({ u }) => u.key).sort();
const exportedKeys = (RIKA3_DATA.UNIT_KEYS || []).slice().sort();
if (JSON.stringify(dataKeys) !== JSON.stringify(exportedKeys)) {
  fail(`RIKA3_DATA.UNIT_KEYS mismatch vs actual unit keys\n    units:     ${JSON.stringify(dataKeys)}\n    UNIT_KEYS: ${JSON.stringify(exportedKeys)}`);
}

// units.js is NOT expected to exist for rika3 (unwired per CLAUDE.md as of
// this writing) — but if one shows up later, its keys must line up. Defensive,
// doesn't fail the suite if the file is simply absent.
const unitsJsPath = path.join(base, 'units.js');
let unitsJsNote = 'absent (expected — rika3 is not wired to focus_units yet)';
if (fs.existsSync(unitsJsPath)) {
  const src = fs.readFileSync(unitsJsPath, 'utf8');
  const missing = dataKeys.filter((k) => !src.includes(`'${k}'`) && !src.includes(`"${k}"`));
  if (missing.length) fail(`units.js exists but is missing unit key(s): ${missing.join(', ')}`);
  unitsJsNote = 'present — key alignment checked';
}

// ─────────────────────────────────────────────────────────────────────────
// 2. GENERATED DATA — stress test at scale + independent ground truth
// ─────────────────────────────────────────────────────────────────────────

// Independently-authored ground truth (real-world science facts, NOT read
// from rika3-gen.js's internal MATERIALS/INSECTS tables) used to catch a bug
// baked into the module's own "truth" data, which self-verification (_verify)
// cannot catch since it would just agree with itself.
const MATERIAL_TRUTH = {
  '鉄のくぎ': { conducts: true, magnetic: true },
  'スチールのかん（鉄）': { conducts: true, magnetic: true },
  'アルミのかん': { conducts: true, magnetic: false },
  'どう（銅）の線': { conducts: true, magnetic: false },
  '10円玉（どう）': { conducts: true, magnetic: false },
  '木のわりばし': { conducts: false, magnetic: false },
  'ガラスのコップ': { conducts: false, magnetic: false },
  'プラスチックのじょうぎ': { conducts: false, magnetic: false },
  'ゴムのわ': { conducts: false, magnetic: false },
  '紙': { conducts: false, magnetic: false },
};
const INSECT_TRUTH = new Set(['トンボ', 'バッタ', 'カブトムシ', 'モンシロチョウ', 'アリ', 'セミ', 'テントウムシ', 'ハチ']);
const NOT_INSECT_TRUTH = new Set(['クモ', 'ダンゴムシ', 'ムカデ', 'カタツムリ', 'ミミズ']);

function checkBasicShape(where, q) {
  if (!Array.isArray(q.options) || q.options.length < 2) {
    fail(`${where}: options too few (${q.options && q.options.length})`);
    return false;
  }
  const normed = q.options.map(norm);
  if (new Set(normed).size !== normed.length) {
    fail(`${where}: duplicate option text -> ${JSON.stringify(q.options)}`);
  }
  const hits = normed.filter((o) => o === norm(q.answer)).length;
  if (hits !== 1) {
    fail(`${where}: answer "${q.answer}" appears ${hits}x in ${JSON.stringify(q.options)}`);
    return false;
  }
  if (!q.q || !norm(q.q)) fail(`${where}: missing/empty prompt`);
  if (!q.exp || !norm(q.exp)) fail(`${where}: missing/empty explanation`);
  return true;
}

function extractQuoted(qtext) {
  const m = qtext.match(/「(.+?)」/);
  return m ? m[1] : null;
}

const RUNS = 5000; // per generator key -> 6 generators * 5000 = 30,000 instances
const counts = {};

Object.keys(RIKA3_GEN.GENERATORS).forEach((key) => {
  const gen = RIKA3_GEN.GENERATORS[key];
  counts[key] = 0;
  for (let i = 0; i < RUNS; i++) {
    const q = gen();
    counts[key]++;
    const where = `gen:${key}#${i} (tid=${q.tid})`;
    if (!checkBasicShape(where, q)) continue;

    if (key === 'isInsect') {
      const askingNotInsect = q.q.indexOf('ない') >= 0;
      let unmatched = 0;
      q.options.forEach((o) => {
        const isBug = !INSECT_TRUTH.has(o) && !NOT_INSECT_TRUTH.has(o);
        if (isBug) { unmatched++; return; }
        const wantThisOne = askingNotInsect ? NOT_INSECT_TRUTH.has(o) : INSECT_TRUTH.has(o);
        const isAnswer = norm(o) === norm(q.answer);
        if (wantThisOne && !isAnswer) {
          fail(`${where}: distractor "${o}" is ALSO correct for "${q.q}" (independent ground truth)`);
        }
        if (isAnswer && !wantThisOne) {
          fail(`${where}: answer "${q.answer}" contradicts independent ground truth for "${q.q}"`);
        }
      });
      if (unmatched) fail(`${where}: option(s) not in independent insect/non-insect ground truth -> ${JSON.stringify(q.options)}`);
    }

    if (key === 'conduct' || key === 'magnet' || key === 'conductMagnet4') {
      const name = extractQuoted(q.q);
      const truth = name && MATERIAL_TRUTH[name];
      if (!truth) {
        fail(`${where}: material "${name}" not in independent ground truth table`);
      } else if (key === 'conduct') {
        const want = truth.conducts ? '電気を通す' : '電気を通さない';
        if (norm(q.answer) !== norm(want)) fail(`${where}: "${name}" conducts=${truth.conducts} but answer is "${q.answer}"`);
      } else if (key === 'magnet') {
        const want = truth.magnetic ? 'じしゃくにつく' : 'じしゃくにつかない';
        if (norm(q.answer) !== norm(want)) fail(`${where}: "${name}" magnetic=${truth.magnetic} but answer is "${q.answer}"`);
      } else { // conductMagnet4
        let want;
        if (truth.conducts && truth.magnetic) want = 'どちらもする';
        else if (truth.conducts && !truth.magnetic) want = '電気を通す（じしゃくにはつかない）';
        else if (!truth.conducts && truth.magnetic) want = 'じしゃくにつく（電気は通さない）';
        else want = 'どちらもしない';
        if (norm(q.answer) !== norm(want)) {
          fail(`${where}: "${name}" (conducts=${truth.conducts}, magnetic=${truth.magnetic}) expects "${want}" but answer is "${q.answer}"`);
        }
      }
    }

    if (key === 'force') {
      const strongCue = q.q.indexOf('強く') >= 0 || q.q.indexOf('長くのばす') >= 0;
      const weakCue = q.q.indexOf('弱く') >= 0 || q.q.indexOf('短くのばす') >= 0;
      if (strongCue === weakCue) {
        fail(`${where}: could not independently classify strong/weak cue in "${q.q}"`);
      } else {
        const want = strongCue ? '遠くまで動く' : '近くで止まる';
        if (norm(q.answer) !== norm(want)) fail(`${where}: cue says ${strongCue ? 'strong' : 'weak'} but answer is "${q.answer}" (want "${want}")`);
      }
    }

    if (key === 'weight') {
      if (q.q.indexOf('ねん土を') >= 0) {
        if (norm(q.answer) !== norm('変わらない')) fail(`${where}: reshape scenario must answer 変わらない, got "${q.answer}"`);
      } else if (q.q.indexOf('食塩とさとう') >= 0) {
        if (norm(q.answer) !== norm('物によってちがう')) fail(`${where}: material-compare scenario must answer 物によってちがう, got "${q.answer}"`);
      } else {
        fail(`${where}: unrecognized weight-generator question shape "${q.q}"`);
      }
    }
  }
});

// Also exercise the module's own mandatory stressTest() (rika3-gen.js ships
// one per CLAUDE.md's "kanji generator shipped this twice" precedent) at
// large scale, as an additional independent pass.
const modResult = RIKA3_GEN.stressTest(20000);
if (!modResult.ok) {
  modResult.errors.forEach((e) => fail(`RIKA3_GEN.stressTest: ${e}`));
}

// generateFor() de-dup pool sanity across every unit's declared gen list
allUnits.forEach(({ u }) => {
  if (!u.gen || !u.gen.length) return;
  const pool = RIKA3_GEN.generateFor(u.gen, 30);
  if (!Array.isArray(pool) || pool.length === 0) {
    fail(`generateFor(${u.key}): produced empty pool for gen=${JSON.stringify(u.gen)}`);
  }
  pool.forEach((q, i) => checkBasicShape(`generateFor:${u.key}#${i}`, q));
});

// ─────────────────────────────────────────────────────────────────────────
// Report
// ─────────────────────────────────────────────────────────────────────────
const totalGenerated = Object.values(counts).reduce((a, b) => a + b, 0);
console.log('rika3 generator/data stress test');
console.log(`  strands: ${RIKA3_DATA.STRANDS.length}, units: ${allUnits.length}, unit keys: ${dataKeys.length}`);
console.log(`  authored choice questions: ${authoredChoiceQ}`);
console.log(`  authored order questions:  ${authoredOrderQ}`);
console.log(`  units.js: ${unitsJsNote}`);
console.log(`  generator keys: ${Object.keys(counts).join(', ')}`);
Object.keys(counts).sort().forEach((k) => console.log(`    ${k}: ${counts[k]} instances`));
console.log(`  total generated Qs (independent checks): ${totalGenerated}`);
console.log(`  RIKA3_GEN.stressTest(): checked ${modResult.checked}, ok=${modResult.ok}`);

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  const uniq = Array.from(new Set(errors));
  uniq.slice(0, 50).forEach((e) => console.error('  - ' + e));
  if (uniq.length > 50) console.error(`  ...and ${uniq.length - 50} more unique`);
  process.exitCode = 1;
} else {
  console.log('\nALL CHECKS PASSED');
}
