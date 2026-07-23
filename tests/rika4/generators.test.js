// generators.test.js — structural + distractor-collision stress test for rika4.
// Run: node tests/rika4/generators.test.js
//
// Two jobs, matching CLAUDE.md's testing bar (stress at scale + the specific
// "distractor collision" bug class this project has shipped before — a
// 'wrong' option that is secretly also correct):
//
//  1. AUTHORED data (rika4-data.js, STRANDS -> units -> questions):
//     - every choice question: answer present in options exactly once,
//       options distinct, non-empty prompt
//     - every order question: >=2 distinct, non-empty items
//     - unit keys are unique and match RIKA4_DATA.UNIT_KEYS and the module's
//       own modules/rika4/units.js registry (read by the assignment UIs for
//       focus_units — CLAUDE.md's decentralized-unit-registry convention)
//     - each unit's declared `gen` keys resolve to a real generator
//
//  2. GENERATED data (rika4-gen.js, RIKA4_GEN.GENERATORS): driven hundreds-
//     to-thousands of times per generator (RUNS below). For each instance:
//     - options distinct, answer present exactly once
//     - the generator's own `_verify(q)` re-derivation passes (catches a
//       "wrong" option secretly also correct against the generator's stated
//       total order / disjoint label set)
//     - AND an INDEPENDENT re-derivation of the real-world science truth,
//       hardcoded here from scratch (not read from rika4-gen.js internals),
//       so a bug in the module's own _verify can't hide a real collision.
//       This is the actual "don't just trust the module's self-check" check.
//     Also exercises generateFor() (the app's actual selection path) for
//     every unit that declares a `gen` list, checking within-call dedup.

'use strict';
const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '../../gakuenza.com/modules/rika4');

// ---- load the browser globals (window.RIKA4_*) under a window shim --------
const window = {};
global.window = window;
function load(file) {
  const code = fs.readFileSync(path.join(base, file), 'utf8');
  new Function('window', code)(window);
}
load('rika4-data.js');
load('rika4-gen.js');
load('units.js');

const DATA = window.RIKA4_DATA;
const GEN = window.RIKA4_GEN;
const MODULE_UNITS = window.MODULE_UNITS;

const errors = [];
const fail = (m) => errors.push(m);
const norm = (s) => String(s == null ? '' : s).trim();

// =============================================================================
// 1. AUTHORED DATA
// =============================================================================
const allUnits = [];
DATA.STRANDS.forEach((strand) => {
  if (!strand.id || !strand.title || !Array.isArray(strand.units)) {
    fail(`strand malformed: ${JSON.stringify(strand.id)}`);
  }
  strand.units.forEach((u) => allUnits.push({ strandId: strand.id, u }));
});

const seenKeys = new Set();
let authoredChoiceQ = 0, authoredOrderQ = 0;

allUnits.forEach(({ strandId, u }) => {
  const uwhere = `unit ${u.key} (strand ${strandId})`;
  if (!u.key) fail(`${uwhere}: missing key`);
  if (seenKeys.has(u.key)) fail(`duplicate unit key: ${u.key}`);
  seenKeys.add(u.key);
  if (!u.title) fail(`${uwhere}: missing title`);
  if (!Array.isArray(u.questions) || u.questions.length < 1) {
    fail(`${uwhere}: no authored questions`);
  }

  (u.questions || []).forEach((q, i) => {
    const at = `${u.key}#${i}`;
    if (!norm(q.q)) fail(`${at}: missing/empty prompt`);

    if (q.type === 'order') {
      authoredOrderQ++;
      if (!Array.isArray(q.items) || q.items.length < 2) {
        fail(`${at}: order question has <2 items`);
      } else {
        if (q.items.some((it) => !norm(it))) fail(`${at}: order item is empty`);
        if (new Set(q.items.map(norm)).size !== q.items.length) {
          fail(`${at}: duplicate order items -> ${JSON.stringify(q.items)}`);
        }
      }
    } else if (q.type === 'choice') {
      authoredChoiceQ++;
      if (!Array.isArray(q.options) || q.options.length < 2) {
        fail(`${at}: choice question has <2 options`);
      } else {
        if (q.options.some((o) => !norm(o))) fail(`${at}: option is empty`);
        if (new Set(q.options.map(norm)).size !== q.options.length) {
          fail(`${at}: duplicate option text -> ${JSON.stringify(q.options)}`);
        }
        const hits = q.options.filter((o) => norm(o) === norm(q.answer)).length;
        if (hits !== 1) {
          fail(`${at}: answer "${q.answer}" appears ${hits}x among options (want 1) -> ${JSON.stringify(q.options)}`);
        }
      }
    } else {
      fail(`${at}: unknown question type "${q.type}"`);
    }
  });

  // declared gen keys must resolve to a real generator
  (u.gen || []).forEach((g) => {
    if (!GEN.GENERATORS[g]) fail(`${uwhere}: declares unknown generator key '${g}'`);
  });
});

// unit-key registry alignment (the decentralized units.js convention)
const dataKeys = allUnits.map(({ u }) => u.key).sort();
const exportedKeys = (DATA.UNIT_KEYS || []).slice().sort();
if (JSON.stringify(dataKeys) !== JSON.stringify(exportedKeys)) {
  fail(`RIKA4_DATA.UNIT_KEYS mismatch vs actual unit keys\n  units:     ${JSON.stringify(dataKeys)}\n  UNIT_KEYS: ${JSON.stringify(exportedKeys)}`);
}
const registryKeys = ((MODULE_UNITS && MODULE_UNITS.rika4) || []).map((e) => e.key).sort();
if (JSON.stringify(dataKeys) !== JSON.stringify(registryKeys)) {
  fail(`modules/rika4/units.js registry mismatch vs data\n  data:     ${JSON.stringify(dataKeys)}\n  registry: ${JSON.stringify(registryKeys)}`);
}
// every units.js label should carry a distinct key too (sanity on the picker)
if (MODULE_UNITS && MODULE_UNITS.rika4) {
  const regSet = new Set();
  MODULE_UNITS.rika4.forEach((e) => {
    if (regSet.has(e.key)) fail(`units.js: duplicate registry key ${e.key}`);
    regSet.add(e.key);
    if (!norm(e.label)) fail(`units.js: empty label for ${e.key}`);
  });
}

// =============================================================================
// 2. GENERATED DATA — structural + dual (module _verify + independent truth)
// =============================================================================
const RUNS = 4000; // per generator — "hundreds to thousands" per CLAUDE.md
let genQCount = 0;

// ---- Independent, from-scratch re-derivation of the real science, so a bug
// in rika4-gen.js's own _verify() can't mask a real distractor collision.
// These constants are NOT read from rika4-gen.js — they're re-authored here
// from the same real-world facts the module cites in its lesson text.

// u04 電流のはたらき: 直列2個 is strictly the brightest/fastest; 1個 and
// へい列2個 are equal (and both below 直列2個).
function currentLevelOf(label) {
  if (label.indexOf('直列') >= 0) return 2;
  return 1; // "かん電池1個" or へい列2個
}
// u08 とじこめた空気と水: 空気 compresses, 水 does not.
function airCompresses(name) { return name === '空気'; }
// u09 物の体積と温度 (thermal expansion for equal heating): 空気 > 水 > 金属.
const EXPAND_TRUTH = { '空気': 3, '水': 2, '金属': 1 };
// u10 物のあたたまり方: metal subjects conduct (伝どう), fluid subjects
// convect (対流). Independent classification by keyword, not by reading the
// generator's HEAT_SUBJECTS list.
function isMetalSubject(name) {
  return /金属|鉄|銅|アルミ|ぎん|鋼/.test(name);
}
function isFluidSubject(name) {
  return /水|空気|とう油|液体|気体/.test(name);
}

function checkGenerated(key, q, where) {
  genQCount++;
  if (!Array.isArray(q.options) || q.options.length < 2) {
    fail(`${where}: options too few -> ${JSON.stringify(q.options)}`);
    return;
  }
  if (!norm(q.q)) fail(`${where}: empty prompt`);
  if (new Set(q.options.map(norm)).size !== q.options.length) {
    fail(`${where}: duplicate option text -> ${JSON.stringify(q.options)}`);
  }
  const hits = q.options.filter((o) => norm(o) === norm(q.answer)).length;
  if (hits !== 1) {
    fail(`${where}: answer "${q.answer}" appears ${hits}x (want 1) -> ${JSON.stringify(q.options)}`);
  }

  // module's own re-derivation (must exist per rika4-gen.js's contract)
  if (typeof q._verify !== 'function') {
    fail(`${where}: missing _verify()`);
  } else if (!q._verify(q)) {
    fail(`${where}: module _verify FAILED -> ${JSON.stringify({ q: q.q, a: q.answer, o: q.options })}`);
  }

  // independent re-derivation, per generator family
  if (key === 'current') {
    // Two distinct question shapes share this tid; tell them apart by
    // whether the options ARE the connection labels ("かん電池…") or are
    // outcome-adjective strings ("明るくなる" / "変わらない" / …).
    const isConnLabelForm = q.options.every((o) => /かん電池/.test(o));
    if (isConnLabelForm) {
      // "which connection is brightest/fastest" 3-way form: unique max
      // (直列2個) must be the answer.
      const levels = {};
      q.options.forEach((o) => { levels[o] = currentLevelOf(o); });
      const max = Math.max.apply(null, Object.values(levels));
      const winners = q.options.filter((o) => levels[o] === max);
      if (winners.length !== 1 || winners[0] !== q.answer) {
        fail(`${where}: INDEPENDENT current-check failed (winners=${JSON.stringify(winners)}, answer=${q.answer})`);
      }
    } else {
      // series/parallel-vs-1個 outcome form: 直列 -> strictly brighter/
      // faster; へい列 -> unchanged.
      const claimsSeries = /直列/.test(q.q);
      const claimsParallel = /へい列/.test(q.q);
      if (claimsSeries && !/明るく|速く/.test(q.answer)) {
        fail(`${where}: INDEPENDENT current-check: 直列 question answered "${q.answer}" (expected brighter/faster)`);
      }
      if (claimsParallel && q.answer !== '変わらない') {
        fail(`${where}: INDEPENDENT current-check: へい列 question answered "${q.answer}" (expected 変わらない)`);
      }
      if (!claimsSeries && !claimsParallel) {
        fail(`${where}: INDEPENDENT current-check: could not classify question "${q.q}"`);
      }
    }
  } else if (key === 'compress') {
    const m = q.q.match(/「(.+?)」/);
    if (!m) { fail(`${where}: could not extract fluid name from prompt "${q.q}"`); return; }
    const wantCompress = airCompresses(m[1]);
    const answerSaysCompress = /小さくなる|おしちぢめられる(?!ない)/.test(q.answer) && !/おしちぢめられない/.test(q.answer);
    if (answerSaysCompress !== wantCompress) {
      fail(`${where}: INDEPENDENT compress-check failed (subject=${m[1]}, wantCompress=${wantCompress}, answer="${q.answer}")`);
    }
  } else if (key === 'expand') {
    const names = q.options.filter((o) => EXPAND_TRUTH[o] !== undefined);
    if (names.length !== q.options.length) {
      fail(`${where}: expand option not in {空気,水,金属} -> ${JSON.stringify(q.options)}`);
    } else {
      const isMost = /最も大きい|大きいのはどっち|大きいのは/.test(q.q) && !/最も小さい/.test(q.q);
      const isLeast = /最も小さい/.test(q.q);
      const vals = names.map((o) => EXPAND_TRUTH[o]);
      let target;
      if (isLeast) target = Math.min.apply(null, vals);
      else target = Math.max.apply(null, vals); // default/most/pair-bigger all want the max
      const winners = names.filter((o) => EXPAND_TRUTH[o] === target);
      if (winners.length !== 1 || winners[0] !== q.answer) {
        fail(`${where}: INDEPENDENT expand-check failed (q="${q.q}", winners=${JSON.stringify(winners)}, answer=${q.answer})`);
      }
    }
  } else if (key === 'heat') {
    const m = q.q.match(/「(.+?)」/);
    if (!m) { fail(`${where}: could not extract heat subject from prompt "${q.q}"`); return; }
    const subj = m[1];
    const metal = isMetalSubject(subj);
    const fluid = isFluidSubject(subj);
    if (metal === fluid) {
      fail(`${where}: INDEPENDENT heat-check: subject "${subj}" not classifiable (metal=${metal}, fluid=${fluid})`);
    } else {
      const answerSaysConduction = /熱した所から順に/.test(q.answer);
      const answerSaysConvection = /あたためられた部分が上へ動いて/.test(q.answer);
      if (metal && !answerSaysConduction) {
        fail(`${where}: INDEPENDENT heat-check: metal subject "${subj}" answered convection -> "${q.answer}"`);
      }
      if (fluid && !answerSaysConvection) {
        fail(`${where}: INDEPENDENT heat-check: fluid subject "${subj}" answered conduction -> "${q.answer}"`);
      }
    }
  }
}

const genKeys = Object.keys(GEN.GENERATORS);
if (genKeys.length === 0) fail('no generators registered in RIKA4_GEN.GENERATORS');
genKeys.forEach((key) => {
  for (let i = 0; i < RUNS; i++) {
    const q = GEN.GENERATORS[key]();
    checkGenerated(key, q, `gen:${key}#${i}`);
  }
});

// ---- exercise generateFor() (the actual app selection path) for every unit
// that declares a gen list — checks the pipeline used by app.js, not just
// the raw generator functions, and its within-call de-dup behaviour.
const GENFOR_RUNS = 300;
allUnits.forEach(({ u }) => {
  if (!u.gen || !u.gen.length) return;
  for (let r = 0; r < GENFOR_RUNS; r++) {
    const n = 10;
    const out = GEN.generateFor(u.gen, n);
    if (!Array.isArray(out) || out.length === 0) {
      fail(`generateFor(${u.key}, ${n}): produced no questions`);
      continue;
    }
    const sigs = new Set();
    out.forEach((q, i) => {
      checkGenerated(guessGenKey(u.gen, q), q, `generateFor:${u.key}#${r}.${i}`);
      const sig = q.q + ' ' + q.answer;
      if (sigs.has(sig)) fail(`generateFor(${u.key}): duplicate instance within one call -> "${sig}"`);
      sigs.add(sig);
    });
  }
});
// tid -> gen key mapping is stable ('gen_current' etc per rika4-gen.js);
// use tid to recover which independent-truth branch to run.
function guessGenKey(declaredGenKeys, q) {
  const fromTid = q.tid && q.tid.replace(/^gen_/, '');
  if (fromTid && declaredGenKeys.indexOf(fromTid) >= 0) return fromTid;
  return declaredGenKeys[0];
}

// =============================================================================
// Report
// =============================================================================
console.log('rika4 generator + data stress test');
console.log(`  strands: ${DATA.STRANDS.length}, units: ${allUnits.length}`);
console.log(`  authored choice questions: ${authoredChoiceQ}`);
console.log(`  authored order questions:  ${authoredOrderQ}`);
console.log(`  generators: ${genKeys.join(', ')}`);
console.log(`  generated instances checked (raw generators): ${genKeys.length * RUNS}`);
console.log(`  generateFor() calls checked: ${allUnits.filter((x) => x.u.gen && x.u.gen.length).length} unit(s) x ${GENFOR_RUNS} calls`);
console.log(`  total generated questions verified: ${genQCount}`);

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  const uniq = Array.from(new Set(errors));
  uniq.slice(0, 60).forEach((e) => console.error('  - ' + e));
  if (uniq.length > 60) console.error(`  ...and ${uniq.length - 60} more unique`);
  process.exitCode = 1;
} else {
  console.log('\nALL CHECKS PASSED');
}
