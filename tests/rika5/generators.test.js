// generators.test.js — structural + distractor-collision stress test for rika5,
// plus a per-unit content-DEPTH floor (the Near-term-debt #11 guarantee).
// Run: node tests/rika5/generators.test.js
//
// Three jobs, matching CLAUDE.md's testing bar (stress at scale + the specific
// "distractor collision" bug class this project has shipped before — a 'wrong'
// option that is secretly also correct):
//
//  1. AUTHORED data (rika5-data.js, STRANDS -> units -> questions):
//     structural checks on every choice/order question, unique unit keys that
//     match RIKA5_DATA.UNIT_KEYS and the module's own modules/rika5/units.js
//     registry (read by the assignment UIs for focus_units), and each unit's
//     declared `gen` key resolving to a real generator.
//
//  2. GENERATED data (rika5-gen.js): every generator driven RUNS times. Each
//     instance is checked for structure (distinct options, answer present once)
//     AND against BOTH the module's own `_verify` re-derivation AND an
//     INDEPENDENT, from-scratch re-derivation of the real-world science coded
//     here (not read from rika5-gen.js internals) — so a bug in the module's
//     own _verify can't hide a real collision. Also exercises generateFor()
//     (the app's actual selection path) and its within-call de-dup.
//
//  3. DEPTH FLOOR: the effective distinct-question pool of EVERY unit
//     (authored + distinct generated instances sampled at scale) must be
//     >= DEPTH_FLOOR. This is the assertion that keeps the module from
//     silently regressing below the "deep enough to not repeat within a term"
//     bar — the whole point of the debt item. u09_electromagnet was the floor
//     unit (effective 10, generator only 6 distinct); its generator was
//     enriched (setup comparison + controlled-variable condition templates).

'use strict';
const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname, '../../gakuenza.com/modules/rika5');
const window = {};
global.window = window;
function load(file) {
  const code = fs.readFileSync(path.join(base, file), 'utf8');
  new Function('window', code)(window);
}
load('rika5-data.js');
load('rika5-gen.js');
load('units.js');

const DATA = window.RIKA5_DATA;
const GEN = window.RIKA5_GEN;
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

  (u.gen || []).forEach((g) => {
    if (!GEN.GENERATORS[g]) fail(`${uwhere}: declares unknown generator key '${g}'`);
  });
});

// unit-key registry alignment (decentralized units.js convention)
const dataKeys = allUnits.map(({ u }) => u.key).sort();
const exportedKeys = (DATA.UNIT_KEYS || []).slice().sort();
if (JSON.stringify(dataKeys) !== JSON.stringify(exportedKeys)) {
  fail(`RIKA5_DATA.UNIT_KEYS mismatch vs actual unit keys\n  units:     ${JSON.stringify(dataKeys)}\n  UNIT_KEYS: ${JSON.stringify(exportedKeys)}`);
}
const registryKeys = ((MODULE_UNITS && MODULE_UNITS.rika5) || []).map((e) => e.key).sort();
if (JSON.stringify(dataKeys) !== JSON.stringify(registryKeys)) {
  fail(`modules/rika5/units.js registry mismatch vs data\n  data:     ${JSON.stringify(dataKeys)}\n  registry: ${JSON.stringify(registryKeys)}`);
}
if (MODULE_UNITS && MODULE_UNITS.rika5) {
  const regSet = new Set();
  MODULE_UNITS.rika5.forEach((e) => {
    if (regSet.has(e.key)) fail(`units.js: duplicate registry key ${e.key}`);
    regSet.add(e.key);
    if (!norm(e.label)) fail(`units.js: empty label for ${e.key}`);
  });
}

// =============================================================================
// 2. GENERATED DATA — structural + dual (module _verify + independent truth)
// =============================================================================
const RUNS = 6000; // per generator — "hundreds to thousands" per CLAUDE.md
let genQCount = 0;

// ---- Independent re-derivations. NOT read from rika5-gen.js internals; these
// are re-authored from the same real-world facts the module cites, so a bug in
// the module's own _verify() can't mask a real distractor collision.

// u07 物のとけ方: independently-documented approximate solubilities (g / 100g
// water). 食塩 nearly flat; ミョウバン/ホウ酸 climb steeply with temperature.
const SOL_TRUTH = {
  '食塩': { 0: 36, 20: 36, 60: 37 },
  'ミョウバン': { 0: 6, 20: 11, 60: 57 },
  'ホウ酸': { 0: 3, 20: 5, 60: 15 },
};
const SOL_BIG_GAIN = 5;

// u09 電磁石: more windings and/or more (series) cells -> stronger. A setup that
// is >= on BOTH turns and cells and strictly > on at least one is unambiguously
// the stronger one.
function emParse(label) {
  const m = label.match(/まき数(\d+)回、かん電池(\d+)個/);
  return m ? { turns: +m[1], cells: +m[2] } : null;
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

  // module's own re-derivation (contractually present)
  if (typeof q._verify !== 'function') {
    fail(`${where}: missing _verify()`);
  } else if (!q._verify(q)) {
    fail(`${where}: module _verify FAILED -> ${JSON.stringify({ q: q.q, a: q.answer, o: q.options })}`);
  }

  // independent re-derivation by template id
  const tid = q.tid || '';
  if (tid === 'gen_dissolve_compare') {
    const names = q.q.match(/「(.+?)」と「(.+?)」/);
    const tm = q.q.match(/(\d+)℃/);
    if (!names || !tm) { fail(`${where}: cannot parse compare prompt "${q.q}"`); return; }
    const temp = +tm[1];
    const cands = [names[1], names[2]];
    if (cands.some((n) => !SOL_TRUTH[n])) { fail(`${where}: unknown substance in ${JSON.stringify(cands)}`); return; }
    const vals = cands.map((n) => SOL_TRUTH[n][temp]);
    const max = Math.max.apply(null, vals);
    const winners = cands.filter((n) => SOL_TRUTH[n][temp] === max);
    if (winners.length !== 1 || winners[0] !== q.answer) {
      fail(`${where}: INDEPENDENT dissolve-compare failed (temp=${temp}, winners=${JSON.stringify(winners)}, answer=${q.answer})`);
    }
  } else if (tid === 'gen_dissolve_temp') {
    const m = q.q.match(/「(.+?)」/);
    if (!m || !SOL_TRUTH[m[1]]) { fail(`${where}: cannot parse temp prompt "${q.q}"`); return; }
    const s = m[1];
    const want = (SOL_TRUTH[s][60] - SOL_TRUTH[s][0]) >= SOL_BIG_GAIN ? '大きく増える' : 'ほとんど変わらない';
    if (q.answer !== want) fail(`${where}: INDEPENDENT dissolve-temp failed (${s}: answer=${q.answer}, want=${want})`);
  } else if (tid === 'gen_dissolve_water') {
    if (q.answer !== '約2倍になる') fail(`${where}: INDEPENDENT dissolve-water failed (answer=${q.answer})`);
  } else if (tid === 'gen_em_factor') {
    if (q.answer !== '強くなる') fail(`${where}: INDEPENDENT em_factor failed (answer=${q.answer})`);
  } else if (tid === 'gen_em_strengthen') {
    const strong = ['電流を大きくする', 'コイルのまき数を多くする'];
    const present = q.options.filter((o) => strong.indexOf(o) >= 0);
    if (present.length !== 1 || present[0] !== q.answer) {
      fail(`${where}: INDEPENDENT em_strengthen failed (present=${JSON.stringify(present)}, answer=${q.answer})`);
    }
  } else if (tid === 'gen_em_reverse') {
    if (q.answer !== '電流の向きを逆にする') fail(`${where}: INDEPENDENT em_reverse failed (answer=${q.answer})`);
  } else if (tid === 'gen_em_off') {
    if (q.answer !== '磁石のはたらきがなくなる') fail(`${where}: INDEPENDENT em_off failed (answer=${q.answer})`);
  } else if (tid === 'gen_em_setup') {
    const parsed = q.options.map(emParse);
    if (parsed.some((p) => !p)) { fail(`${where}: cannot parse setup options ${JSON.stringify(q.options)}`); return; }
    const aw = emParse(q.answer);
    const dominatesAll = parsed.every((p) => {
      if (p.turns === aw.turns && p.cells === aw.cells) return true;
      return aw.turns >= p.turns && aw.cells >= p.cells && (aw.turns > p.turns || aw.cells > p.cells);
    });
    if (!dominatesAll) {
      fail(`${where}: INDEPENDENT em_setup failed — answer ${JSON.stringify(aw)} does not Pareto-dominate ${JSON.stringify(parsed)}`);
    }
  } else if (tid === 'gen_em_condition') {
    if (q.answer !== '同じにする（変えない）') fail(`${where}: INDEPENDENT em_condition failed (answer=${q.answer})`);
  } else if (tid === 'gen_pend_factor') {
    if (q.answer !== 'ふりこの長さ') fail(`${where}: INDEPENDENT pend_factor failed (answer=${q.answer})`);
  } else if (tid === 'gen_pend_change') {
    let want;
    if (/ふりこを長くする/.test(q.q)) want = '長くなる';
    else if (/ふりこを短くする/.test(q.q)) want = '短くなる';
    else if (/おもりを重くする|ふれはばを大きくする/.test(q.q)) want = '変わらない';
    if (!want) { fail(`${where}: cannot classify pend_change "${q.q}"`); return; }
    if (q.answer !== want) fail(`${where}: INDEPENDENT pend_change failed (want=${want}, answer=${q.answer})`);
  } else if (tid === 'gen_pend_compare') {
    const lens = q.options.map((o) => parseInt(o.replace(/[^0-9]/g, ''), 10));
    const max = Math.max.apply(null, lens);
    const winners = q.options.filter((o) => parseInt(o.replace(/[^0-9]/g, ''), 10) === max);
    if (winners.length !== 1 || winners[0] !== q.answer) {
      fail(`${where}: INDEPENDENT pend_compare failed (winners=${JSON.stringify(winners)}, answer=${q.answer})`);
    }
  }
}

const genKeys = Object.keys(GEN.GENERATORS);
if (genKeys.length === 0) fail('no generators registered in RIKA5_GEN.GENERATORS');
genKeys.forEach((key) => {
  for (let i = 0; i < RUNS; i++) {
    const q = GEN.GENERATORS[key]();
    checkGenerated(key, q, `gen:${key}#${i}`);
  }
});

// module's own bundled stress test too (belt and suspenders)
const st = GEN.stressTest(20000);
if (!st.ok) fail(`RIKA5_GEN.stressTest reported ${st.errors.length} error(s): ${JSON.stringify(st.errors.slice(0, 5))}`);

// ---- exercise generateFor() (the actual app selection path) --------------
const GENFOR_RUNS = 300;
allUnits.forEach(({ u }) => {
  if (!u.gen || !u.gen.length) return;
  for (let r = 0; r < GENFOR_RUNS; r++) {
    const out = GEN.generateFor(u.gen, 10);
    if (!Array.isArray(out) || out.length === 0) {
      fail(`generateFor(${u.key}, 10): produced no questions`);
      continue;
    }
    const sigs = new Set();
    out.forEach((q, i) => {
      checkGenerated(u.gen[0], q, `generateFor:${u.key}#${r}.${i}`);
      const sig = q.q + ' ' + q.answer;
      if (sigs.has(sig)) fail(`generateFor(${u.key}): duplicate instance within one call -> "${sig}"`);
      sigs.add(sig);
    });
  }
});

// =============================================================================
// 3. DEPTH FLOOR — effective distinct pool per unit (the debt-item guarantee)
// =============================================================================
const DEPTH_FLOOR = 10; // "~10-12 distinct per unit" bar (shakai5 proven-good)
const genDistinctCache = {};
function genDistinct(key) {
  if (genDistinctCache[key] != null) return genDistinctCache[key];
  const seen = new Set();
  for (let i = 0; i < 60000; i++) {
    const q = GEN.GENERATORS[key]();
    seen.add(q.q + '||' + q.answer);
  }
  return (genDistinctCache[key] = seen.size);
}
const depthTable = [];
allUnits.forEach(({ strandId, u }) => {
  const authored = (u.questions || []).length;
  const genPool = (u.gen || []).reduce((a, g) => a + genDistinct(g), 0);
  const effective = authored + genPool;
  depthTable.push({ key: u.key, strandId, authored, genPool, effective });
  if (effective < DEPTH_FLOOR) {
    fail(`DEPTH FLOOR: unit ${u.key} effective distinct pool = ${effective} (< ${DEPTH_FLOOR})`);
  }
});

// =============================================================================
// Report
// =============================================================================
console.log('rika5 generator + data stress test');
console.log(`  strands: ${DATA.STRANDS.length}, units: ${allUnits.length}`);
console.log(`  authored choice questions: ${authoredChoiceQ}`);
console.log(`  authored order questions:  ${authoredOrderQ}`);
console.log(`  generators: ${genKeys.join(', ')}`);
console.log(`  generated instances checked (raw generators): ${genKeys.length * RUNS}`);
console.log(`  total generated questions verified: ${genQCount}`);
console.log('  per-unit effective distinct pool (authored + gen distinct):');
depthTable.forEach((d) => {
  console.log(`    ${d.key.padEnd(18)} [${d.strandId}] authored=${d.authored} gen=${d.genPool} effective=${d.effective}`);
});

if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  const uniq = Array.from(new Set(errors));
  uniq.slice(0, 60).forEach((e) => console.error('  - ' + e));
  if (uniq.length > 60) console.error(`  ...and ${uniq.length - 60} more unique`);
  process.exitCode = 1;
} else {
  console.log('\nALL CHECKS PASSED');
}
