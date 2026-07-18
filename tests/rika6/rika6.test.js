// rika6.test.js — generator stress test + data-integrity checks for rika6.
// Run: node rika6.test.js
//
// Two jobs:
//  1. Generators: run every generator at scale and check EVERY instance for
//     structural bugs AND the distractor-collision bug (a "wrong" option that
//     is secretly also correct) via each generator's own _verify — the bug
//     class this project has re-shipped (rika3's stroke generator, twice).
//  2. Authored data: every unit's choice questions have their `answer` present
//     exactly once among `options`; order questions have >=2 distinct items;
//     unit keys are unique and match RIKA6_DATA.UNIT_KEYS and the module's own
//     modules/rika6/units.js registry (which the assignment UIs read for
//     focus_units).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
const fail = (msg) => { failures++; if (failures <= 50) console.error('FAIL:', msg); };

// ---- load the browser globals (window.RIKA6_*) in a sandbox ----------------
const sandbox = { window: {}, console };
vm.createContext(sandbox);
const load = (rel) => vm.runInContext(
  fs.readFileSync(path.resolve(__dirname, rel), 'utf8'), sandbox, { filename: rel });
load('../../gakuenza.com/modules/rika6/rika6-data.js');
load('../../gakuenza.com/modules/rika6/rika6-gen.js');
load('../../gakuenza.com/modules/rika6/units.js');

const DATA = sandbox.window.RIKA6_DATA;
const GEN = sandbox.window.RIKA6_GEN;
const MODULE_UNITS = sandbox.window.MODULE_UNITS;

// ---- 1. generator stress test ----------------------------------------------
const res = GEN.stressTest(20000);
console.log(`generators: checked ${res.checked} instances, ok=${res.ok}`);
if (!res.ok) res.errors.forEach((e) => fail('generator: ' + e));

// ---- 2. authored data integrity --------------------------------------------
const allUnits = [];
DATA.STRANDS.forEach((s) => s.units.forEach((u) => allUnits.push({ strand: s.id, u })));

const seenKeys = new Set();
allUnits.forEach(({ u }) => {
  if (seenKeys.has(u.key)) fail(`duplicate unit key: ${u.key}`);
  seenKeys.add(u.key);
  if (!Array.isArray(u.questions) || u.questions.length < 3)
    fail(`${u.key}: too few authored questions (${u.questions && u.questions.length})`);
  (u.questions || []).forEach((q, i) => {
    const at = `${u.key}#${i}`;
    if (q.type === 'order') {
      if (!Array.isArray(q.items) || q.items.length < 2) fail(`${at}: order items too few`);
      if (new Set(q.items).size !== q.items.length) fail(`${at}: duplicate order items`);
    } else {
      if (!Array.isArray(q.options) || q.options.length < 2) fail(`${at}: options too few`);
      if (new Set(q.options).size !== q.options.length)
        fail(`${at}: duplicate option text -> ${JSON.stringify(q.options)}`);
      const hits = (q.options || []).filter((o) => o === q.answer).length;
      if (hits !== 1) fail(`${at}: answer appears ${hits} times (expected 1) -> ${q.answer}`);
    }
    if (!q.q) fail(`${at}: missing question text`);
  });
  // declared gen keys must resolve to real generators
  (u.gen || []).forEach((g) => {
    if (!GEN.GENERATORS[g]) fail(`${u.key}: unknown generator key '${g}'`);
  });
});

// ---- 3. unit-key registry alignment ----------------------------------------
const dataKeys = allUnits.map(({ u }) => u.key).sort();
const exportedKeys = DATA.UNIT_KEYS.slice().sort();
if (JSON.stringify(dataKeys) !== JSON.stringify(exportedKeys))
  fail(`RIKA6_DATA.UNIT_KEYS mismatch vs actual unit keys\n  units:    ${dataKeys}\n  UNIT_KEYS:${exportedKeys}`);

const registryKeys = (MODULE_UNITS.rika6 || []).map((e) => e.key).sort();
if (JSON.stringify(dataKeys) !== JSON.stringify(registryKeys))
  fail(`modules/rika6/units.js keys mismatch vs module\n  module:  ${dataKeys}\n  registry:${registryKeys}`);

console.log(`data: ${allUnits.length} units, ${dataKeys.length} unique keys; registry entries=${registryKeys.length}`);

if (failures) { console.error(`\nrika6 test FAILED (${failures} failures)`); process.exit(1); }
console.log('\nrika6 test PASSED');
