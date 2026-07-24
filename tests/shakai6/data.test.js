// data.test.js — data-integrity + answer-sanity for the shakai6 (社会6年)
// authored question bank.
// Run: node tests/shakai6/data.test.js
//
// shakai6 is an AUTHORED bank (window.SHAKAI6_DATA), not a procedural
// generator, so there is no distractor-collision surface like eigo5's
// multiple-choice generators. What *can* silently rot in an authored bank:
//   - a question with an empty prompt or no usable accepted answer
//   - id collisions (ids are assigned at boot in app.js as
//     `${section.id}-${index}` — see app.js's own header comment)
//   - copy-paste duplicate question PRESENTATION within the same section
//     (text + fig/sym, since a section could legitimately reuse identical
//     prompt text against different figures/symbols — mirrors shakai3)
//   - a `fig`/`sym` reference to a figure/symbol key that doesn't exist
//   - an `order` question whose `items` aren't a clean, duplicate-free
//     sequence (duplicates break the chip-picking UI in app.js, which
//     filters the pool via `.includes(item)` by string value)
//   - section `key` (focus_units tag) drifting out of sync with
//     modules/shakai6/units.js's declared keys — shakai6 matches
//     focus_units at the SECTION level (12 distinct history keys +
//     2 unit-level keys), unlike sansu3/kokugo3's unit-level match, so
//     this drift is easy to introduce by typo
//   - section id tagging drifting out of the convention app.js's
//     QUESTION_INDEX relies on (`${section.id}-${index}`), and section id
//     no longer nesting under its unit id (u1s1/u2a/u3s1 all start with
//     their unit's `u{n}` prefix, even though unit 2's sections use a
//     letter suffix instead of unit 3's `s{n}` suffix)
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/shakai6');

const errors = [];
const fail = m => errors.push(m);

// ── Load SHAKAI6_DATA / MODULE_UNITS the way eigo5's test loads data.js:
// shim `window`, require the files (they self-register via
// `window.SHAKAI6_DATA = ...` / `window.MODULE_UNITS.shakai6 = ...`), then
// read them back off the shim. ───────────────────────────────────────────
global.window = {};
require(path.join(base, 'questions.js'));
require(path.join(base, 'units.js'));
const { UNITS, FIGURES } = global.window.SHAKAI6_DATA;
const moduleUnits = (global.window.MODULE_UNITS || {}).shakai6;

if (!Array.isArray(UNITS) || !UNITS.length) fail('SHAKAI6_DATA.UNITS missing or empty');
if (!Array.isArray(moduleUnits) || !moduleUnits.length) fail('MODULE_UNITS.shakai6 missing or empty');

const figureKeys = new Set(Object.keys(FIGURES || {}));
// shakai6's authored bank doesn't currently use a MAP_SYMBOLS-style symbol
// map (unlike shakai3) — but check defensively in case one is added later,
// mirroring exactly how a `sym` reference would be validated against `fig`.
const symbolKeys = new Set(Object.keys((global.window.SHAKAI6_DATA || {}).MAP_SYMBOLS || {}));

const declaredUnitKeys = new Set(moduleUnits.map(u => u.key));
const usedUnitKeys = new Set();

const seenIds = new Set();
let sectionCount = 0;
let questionCount = 0;
let orderCount = 0;
let typedCount = 0;
const redundantAnswerNotes = [];

UNITS.forEach((unit) => {
  if (!unit.id) fail(`unit missing id: ${JSON.stringify(unit).slice(0, 80)}`);
  if (!unit.title) fail(`unit ${unit.id}: missing title`);
  if (!Array.isArray(unit.sections) || !unit.sections.length) {
    fail(`unit ${unit.id}: no sections`);
    return;
  }

  unit.sections.forEach((sec) => {
    sectionCount++;
    if (!sec.id) fail(`unit ${unit.id}: section missing id`);
    if (!sec.title) fail(`section ${sec.id}: missing title`);

    // Section id must nest under its unit id (u1s1/u2a/u3s1 all start with
    // the owning unit's `u{n}` prefix — the suffix convention differs
    // between unit 2 (letters) and units 1/3 (`s{n}`), so only the
    // unit-id-prefix part is checked, not a single shared suffix pattern.
    if (sec.id && !sec.id.startsWith(unit.id)) {
      fail(`section ${sec.id}: id doesn't start with owning unit id "${unit.id}"`);
    }

    // Section `key` (focus_units tag) must be a real, declared units.js key.
    if (!sec.key) {
      fail(`section ${sec.id}: missing focus_units key`);
    } else {
      if (!declaredUnitKeys.has(sec.key)) {
        fail(`section ${sec.id}: key "${sec.key}" not declared in units.js`);
      }
      usedUnitKeys.add(sec.key);
    }

    if (!Array.isArray(sec.questions) || !sec.questions.length) {
      fail(`section ${sec.id}: no questions`);
      return;
    }

    // Dedup key includes sym/fig: a section could legitimately reuse
    // identical prompt text against a DIFFERENT figure/symbol, so only flag
    // it when the full presentation (text + sym + fig) repeats.
    const qTextSeen = new Map(); // "q sym fig" -> first index

    sec.questions.forEach((q, i) => {
      questionCount++;
      const id = sec.id + '-' + i; // mirrors app.js's QUESTION_INDEX assignment
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
            fail(`${tag}: order question has duplicate items ${JSON.stringify(q.items)} — breaks chip-picking UI (app.js filters pool via includes())`);
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
          // app's own normalize() lowercases before comparing) — not a hard
          // failure, just noted for authoring hygiene.
          const dupAnswers = new Set(q.a.map((a) => String(a).trim().toLowerCase()));
          if (dupAnswers.size !== q.a.length) {
            redundantAnswerNotes.push(`${tag}: redundant case-insensitive duplicate in a[] ${JSON.stringify(q.a)}`);
          }
        }
      }

      // Duplicate question PRESENTATION within the same section (see
      // dedup-key note above): keyed on q + sym + fig, not q alone.
      const qNorm = String(q.q || '').trim();
      if (qNorm) {
        const dedupKey = qNorm + ' ' + (q.sym || '') + ' ' + (q.fig || '');
        if (qTextSeen.has(dedupKey)) {
          fail(`${tag}: duplicate question (same text/sym/fig as index ${qTextSeen.get(dedupKey)}): "${qNorm.slice(0, 40)}..."`);
        } else {
          qTextSeen.set(dedupKey, i);
        }
      }

      // sym / fig references must point at real assets.
      if (q.sym && !symbolKeys.has(q.sym)) fail(`${tag}: unknown sym key "${q.sym}"`);
      if (q.fig && !figureKeys.has(q.fig)) fail(`${tag}: unknown fig key "${q.fig}"`);

      // exp (explanation) shown on every review card — should not be blank
      // when present.
      if ('exp' in q && q.exp != null && !String(q.exp).trim()) {
        fail(`${tag}: exp present but empty`);
      }

      // hint, if present, should not be blank.
      if ('hint' in q && q.hint != null && !String(q.hint).trim()) {
        fail(`${tag}: hint present but empty`);
      }
    });
  });
});

// Per-section depth floor: every section must carry at least DEPTH_FLOOR
// questions so no unit is thin in the quiz picker. Matches the shakai5
// reference bank (10–12/section). Content-depth audit, roadmap debt #11.
const DEPTH_FLOOR = 10;
UNITS.forEach((unit) => {
  (unit.sections || []).forEach((sec) => {
    const n = Array.isArray(sec.questions) ? sec.questions.length : 0;
    if (n < DEPTH_FLOOR) {
      fail(`section ${sec.id}: only ${n} question(s), below depth floor of ${DEPTH_FLOOR}`);
    }
  });
});

// unit.num should be a clean 1..N sequence (drives report/focus_units unit tagging).
const nums = UNITS.map((u) => u.num).sort((a, b) => a - b);
nums.forEach((n, i) => {
  if (n !== i + 1) fail(`UNITS.num sequence broken: expected ${i + 1}, found ${JSON.stringify(nums)}`);
});

// Every units.js-declared key should actually be used by >=1 section —
// an unused declared key is dead data in the assignment-UI picker.
for (const k of declaredUnitKeys) {
  if (!usedUnitKeys.has(k)) fail(`units.js declares key "${k}" that no section uses`);
}

// Every FIGURES entry should be referenced by at least one QUESTION —
// informational only, since a figure used only in a lesson body (not a
// quiz question) is legitimate content, not dead data. Just surfaced in
// case it turns out to be an oversight (a fig meant for a question that
// never got wired up).
const figKeysUsed = new Set();
UNITS.forEach(u => u.sections.forEach(s => s.questions.forEach(q => { if (q.fig) figKeysUsed.add(q.fig); })));
const unusedFigNotes = [...figureKeys].filter(k => !figKeysUsed.has(k)).map(k => `FIGURES["${k}"] is never referenced by a quiz question (may still be used in a lesson body)`);

// ── Report ──────────────────────────────────────────────────────────────────
console.log('shakai6 data-integrity test');
console.log(`  units:        ${UNITS.length}`);
console.log(`  sections:     ${sectionCount}`);
console.log(`  questions:    ${questionCount}  (typed: ${typedCount}, order: ${orderCount})`);
console.log(`  unique ids:   ${seenIds.size}`);
console.log(`  focus keys:   ${declaredUnitKeys.size} declared, ${usedUnitKeys.size} used`);
console.log(`  figures:      ${figureKeys.size} declared, ${figKeysUsed.size} used`);
if (redundantAnswerNotes.length) {
  console.log(`  note: ${redundantAnswerNotes.length} question(s) have a harmless case-insensitive duplicate in a[] (informational, not a failure):`);
  redundantAnswerNotes.forEach(n => console.log('    - ' + n));
}
if (unusedFigNotes.length) {
  console.log(`  note: ${unusedFigNotes.length} unused figure(s) (informational, not a failure):`);
  unusedFigNotes.forEach(n => console.log('    - ' + n));
}
if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.slice(0, 40).forEach(e => console.error('  - ' + e));
  if (errors.length > 40) console.error(`  ...and ${errors.length - 40} more`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
