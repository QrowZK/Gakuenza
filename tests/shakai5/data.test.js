// data.test.js — data-integrity + answer-sanity for the shakai5 (社会5年)
// authored question bank.
// Run: node tests/shakai5/data.test.js
//
// shakai5 is an AUTHORED bank (window.SHAKAI5_DATA), not a procedural
// generator, so there is no distractor-collision surface like eigo5's
// multiple-choice generators. What *can* silently rot in an authored bank:
//   - a question with an empty prompt or no usable accepted answer
//   - id collisions (ids are assigned at boot as `${section.id}-${index}` —
//     see questions.js's own header comment; append-only edits keep history
//     stable)
//   - copy-paste duplicate question text within the same section
//   - a `fig` reference to a figure key that doesn't exist in FIGURES
//   - an `order` question whose `items` aren't a clean, duplicate-free
//     sequence
//   - unit/section id tagging drifting out of the `u{num}s{n}` convention
//   - a unit's `key` (used for class_modules.focus_units) drifting out of
//     sync with modules/shakai5/units.js's MODULE_UNITS.shakai5 registry —
//     CLAUDE.md's decentralized-units convention requires these to match
//     exactly since the assignment UI can't load this module's generators
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/shakai5');

const errors = [];
const fail = m => errors.push(m);

// ── Load SHAKAI5_DATA and MODULE_UNITS the way eigo5's/shakai3's tests do:
// shim `window`, require the files (they self-register), read back off the
// shim. ──────────────────────────────────────────────────────────────────
global.window = {};
require(path.join(base, 'questions.js'));
require(path.join(base, 'units.js'));
const { UNITS, FIGURES } = global.window.SHAKAI5_DATA;
const MODULE_UNITS = global.window.MODULE_UNITS;

if (!Array.isArray(UNITS) || !UNITS.length) fail('SHAKAI5_DATA.UNITS missing or empty');
if (!MODULE_UNITS || !Array.isArray(MODULE_UNITS.shakai5) || !MODULE_UNITS.shakai5.length) {
  fail('MODULE_UNITS.shakai5 missing or empty (units.js)');
}

const figureKeys = new Set(Object.keys(FIGURES || {}));
const declaredUnitKeys = new Set((MODULE_UNITS && MODULE_UNITS.shakai5 || []).map(u => u.key));

const seenIds = new Set();
let sectionCount = 0;
let questionCount = 0;
let orderCount = 0;
let typedCount = 0;
const redundantAnswerNotes = [];

UNITS.forEach((unit) => {
  if (!unit.id) fail(`unit missing id: ${JSON.stringify(unit).slice(0, 80)}`);
  if (!unit.title) fail(`unit ${unit.id}: missing title`);
  if (!unit.key) fail(`unit ${unit.id}: missing key (focus_units alignment)`);
  if (unit.key && !declaredUnitKeys.has(unit.key)) {
    fail(`unit ${unit.id}: key "${unit.key}" not declared in units.js's MODULE_UNITS.shakai5`);
  }
  if (!Array.isArray(unit.sections) || !unit.sections.length) {
    fail(`unit ${unit.id}: no sections`);
    return;
  }

  unit.sections.forEach((sec) => {
    sectionCount++;
    if (!sec.id) fail(`unit ${unit.id}: section missing id`);
    if (!sec.title) fail(`section ${sec.id}: missing title`);

    // Section id tagging convention: u{num}s... must belong to its unit.
    const expectedPrefix = unit.id + 's';
    if (sec.id && !sec.id.startsWith(expectedPrefix)) {
      fail(`section ${sec.id}: id doesn't start with expected prefix "${expectedPrefix}" for unit ${unit.id}`);
    }

    if (!Array.isArray(sec.questions) || !sec.questions.length) {
      fail(`section ${sec.id}: no questions`);
      return;
    }

    const qTextSeen = new Map(); // "q fig" -> first index

    sec.questions.forEach((q, i) => {
      questionCount++;
      const id = sec.id + '-' + i; // mirrors boot-time QUESTION_INDEX assignment
      const tag = `${sec.id}[${i}] (id=${id})`;

      // Unique id (ids derive from sectionId-index, so this also catches
      // any section id collision across units).
      if (seenIds.has(id)) fail(`${tag}: duplicate question id ${id}`);
      seenIds.add(id);

      // Non-empty prompt.
      if (!q.q || !String(q.q).trim()) fail(`${tag}: empty/missing q`);

      // At least one usable accepted answer (typed) / clean items (order).
      if (q.type === 'order') {
        orderCount++;
        if (!Array.isArray(q.items) || q.items.length < 2) {
          fail(`${tag}: order question needs >=2 items`);
        } else {
          const empties = q.items.filter((it) => !it || !String(it).trim());
          if (empties.length) fail(`${tag}: order question has empty item(s)`);
          const dupCheck = new Set(q.items.map((it) => String(it).trim()));
          if (dupCheck.size !== q.items.length) {
            fail(`${tag}: order question has duplicate items ${JSON.stringify(q.items)} — breaks chip-picking UI`);
          }
        }
      } else {
        typedCount++;
        if (!Array.isArray(q.a) || !q.a.length || !q.a[0] || !String(q.a[0]).trim()) {
          fail(`${tag}: typed question missing non-empty a[0]`);
        } else {
          const emptyAnswers = q.a.filter((a) => !a || !String(a).trim());
          if (emptyAnswers.length) fail(`${tag}: typed question has empty accepted-answer entr(y/ies) in a[]`);
          // Case-insensitive duplicate accepted answers are harmless (the
          // app's own normalize step lowercases before comparing) — not a
          // hard failure, just noted for authoring hygiene.
          const dupAnswers = new Set(q.a.map((a) => String(a).trim().toLowerCase()));
          if (dupAnswers.size !== q.a.length) {
            redundantAnswerNotes.push(`${tag}: redundant case-insensitive duplicate in a[] ${JSON.stringify(q.a)}`);
          }
        }
      }

      // Duplicate question text within the same section (fig-aware: a
      // legitimate re-use of identical prompt text with a DIFFERENT figure
      // would not actually be a duplicate; none currently exist in shakai5
      // but the dedup key stays fig-aware for consistency with shakai3).
      const qNorm = String(q.q || '').trim();
      if (qNorm) {
        const dedupKey = qNorm + ' ' + (q.fig || '');
        if (qTextSeen.has(dedupKey)) {
          fail(`${tag}: duplicate question (same text/fig as index ${qTextSeen.get(dedupKey)}): "${qNorm.slice(0, 40)}..."`);
        } else {
          qTextSeen.set(dedupKey, i);
        }
      }

      // fig reference must point at a real figure asset.
      if (q.fig && !figureKeys.has(q.fig)) fail(`${tag}: unknown fig key "${q.fig}"`);

      // exp (explanation) shown on every review card — should not be blank
      // when present.
      if ('exp' in q && q.exp != null && !String(q.exp).trim()) {
        fail(`${tag}: exp present but empty`);
      }

      // hint, if present, should not be blank either.
      if ('hint' in q && q.hint != null && !String(q.hint).trim()) {
        fail(`${tag}: hint present but empty`);
      }
    });
  });
});

// unit.num should be a clean 1..N sequence (drives report unit tagging).
const nums = UNITS.map((u) => u.num).sort((a, b) => a - b);
nums.forEach((n, i) => {
  if (n !== i + 1) fail(`UNITS.num sequence broken: expected ${i + 1}, found ${JSON.stringify(nums)}`);
});

// Every unit key declared in units.js should also be used by some unit in
// questions.js (catches a stale/renamed entry left behind in the registry).
if (MODULE_UNITS && Array.isArray(MODULE_UNITS.shakai5)) {
  const usedUnitKeys = new Set(UNITS.map(u => u.key));
  MODULE_UNITS.shakai5.forEach(({ key }) => {
    if (!usedUnitKeys.has(key)) {
      fail(`units.js declares key "${key}" that no unit in questions.js uses`);
    }
  });
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('shakai5 data-integrity test');
console.log(`  units:      ${UNITS.length}`);
console.log(`  sections:   ${sectionCount}`);
console.log(`  questions:  ${questionCount}  (typed: ${typedCount}, order: ${orderCount})`);
console.log(`  unique ids: ${seenIds.size}`);
if (redundantAnswerNotes.length) {
  console.log(`  note: ${redundantAnswerNotes.length} question(s) have a harmless case-insensitive duplicate in a[] (informational, not a failure):`);
  redundantAnswerNotes.forEach(n => console.log('    - ' + n));
}
if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.slice(0, 40).forEach(e => console.error('  - ' + e));
  if (errors.length > 40) console.error(`  ...and ${errors.length - 40} more`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
