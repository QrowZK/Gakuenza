// data.test.js — data-integrity + answer-sanity for the shakai4 (社会4年)
// authored question bank.
// Run: node tests/shakai4/data.test.js
//
// shakai4 is an AUTHORED bank (window.SHAKAI4_DATA), not a procedural
// generator, so there is no distractor-collision surface like eigo5's
// multiple-choice generators. What *can* silently rot in an authored bank:
//   - a question with an empty prompt or no usable accepted answer
//   - id collisions (ids are assigned at boot in app.js as
//     `${section.id}-${index}` — see questions.js's own header comment)
//   - copy-paste duplicate question text within the same section
//   - a `fig` reference to a figure key that doesn't exist in FIGURES
//   - an `order` question whose `items` aren't a clean, duplicate-free
//     sequence (duplicates break the chip-picking UI in app.js, which
//     filters the pool via `orderPicked.includes(item)` by string value)
//   - unit/section id tagging drifting out of the `u{num}s{n}` convention
//     the module and its report payload (`unit: sec.unitNum`) rely on
//   - unit.key drifting out of sync with modules/shakai4/units.js —
//     app.js's partitionUnits() matches class_modules.focus_units against
//     unit.key directly (`set.has(u.key)`), so a mismatch here silently
//     breaks the focus-unit foregrounding feature for that unit
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/shakai4');

const errors = [];
const fail = m => errors.push(m);

// ── Load SHAKAI4_DATA and MODULE_UNITS the way eigo5's test loads data.js:
// shim `window`, require the files (they self-register), then read them
// back off the shim. ─────────────────────────────────────────────────────
global.window = {};
require(path.join(base, 'questions.js'));
require(path.join(base, 'units.js'));
const { UNITS, FIGURES } = global.window.SHAKAI4_DATA;
const moduleUnits = (global.window.MODULE_UNITS && global.window.MODULE_UNITS.shakai4) || [];

if (!Array.isArray(UNITS) || !UNITS.length) fail('SHAKAI4_DATA.UNITS missing or empty');

const figureKeys = new Set(Object.keys(FIGURES || {}));

// ── units.js cross-check ─────────────────────────────────────────────────
// Every unit.key used by app.js's focus_units matching must be declared in
// units.js (so the assignment UI can actually offer it), and vice versa —
// a units.js entry with no matching UNITS.key would be dead/broken too.
if (!moduleUnits.length) fail('modules/shakai4/units.js: MODULE_UNITS.shakai4 missing or empty');
const declaredUnitKeys = new Set(moduleUnits.map(u => u.key));
const dataUnitKeys = new Set(UNITS.map(u => u.key));
for (const u of UNITS) {
  if (!u.key) fail(`unit ${u.id}: missing key (required for focus_units matching)`);
  else if (!declaredUnitKeys.has(u.key)) fail(`unit ${u.id}: key "${u.key}" not declared in units.js MODULE_UNITS.shakai4`);
}
for (const mu of moduleUnits) {
  if (!dataUnitKeys.has(mu.key)) fail(`units.js: key "${mu.key}" has no matching unit in UNITS`);
}

const seenIds = new Set();
let sectionCount = 0;
let questionCount = 0;
let orderCount = 0;
let typedCount = 0;
const redundantAnswerNotes = [];

// Depth bar: shakai5 (the proven-good exemplar after fix #121) carries a
// per-section floor of 10 questions (median 11). A section thinner than this
// repeats within a term, which is the whole point of Near-term-debt #11.
// Enforce it here so nobody silently re-thins a section.
const MIN_QUESTIONS_PER_SECTION = 10;
const sectionCounts = []; // { id, title, count } for the end-of-run report

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

    // Section id tagging convention: u{num}s... must belong to its unit.
    const expectedPrefix = unit.id + 's';
    if (sec.id && !sec.id.startsWith(expectedPrefix)) {
      fail(`section ${sec.id}: id doesn't start with expected prefix "${expectedPrefix}" for unit ${unit.id}`);
    }

    if (!Array.isArray(sec.questions) || !sec.questions.length) {
      fail(`section ${sec.id}: no questions`);
      return;
    }

    sectionCounts.push({ id: sec.id, title: sec.title, count: sec.questions.length });

    const qTextSeen = new Map(); // "q fig" -> first index

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

      // At least one usable accepted answer.
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
        // order questions shouldn't also carry an `a` array (would be dead data).
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

      // Duplicate question text within the same section. fig is included in
      // the dedup key since a repeated prompt shown against a different
      // figure is not actually a duplicate question.
      const qNorm = String(q.q || '').trim();
      if (qNorm) {
        const dedupKey = qNorm + ' ' + (q.fig || '');
        if (qTextSeen.has(dedupKey)) {
          fail(`${tag}: duplicate question (same text/fig as index ${qTextSeen.get(dedupKey)}): "${qNorm.slice(0, 40)}..."`);
        } else {
          qTextSeen.set(dedupKey, i);
        }
      }

      // fig references must point at real figures.
      if (q.fig && !figureKeys.has(q.fig)) fail(`${tag}: unknown fig key "${q.fig}"`);

      // Distractor-collision guard. shakai4 is an all-typed/order bank: it has
      // NO multiple-choice shape, so there is no fixed wrong-option set that
      // could secretly contain a second correct answer. That property is what
      // makes the collision bug structurally impossible here — assert it stays
      // true. If anyone later adds an `options`/`choices` field (a real MC
      // surface), this fails loudly, forcing them to add real collision testing
      // rather than inheriting a test that only ever looked at typed answers.
      if ('options' in q || 'choices' in q) {
        fail(`${tag}: unexpected multiple-choice field (options/choices) — shakai4 is an all-typed bank; adding MC requires distractor-collision testing (see CLAUDE.md testing bar)`);
      }

      // hint, if present, should not be blank (hintBtn is only hidden when
      // q.hint is falsy — a whitespace-only hint would render an empty
      // "ヒント：" bubble).
      if ('hint' in q && q.hint != null && !String(q.hint).trim()) {
        fail(`${tag}: hint present but empty`);
      }

      // exp (explanation) shown on every review card — should not be blank
      // when present, since finishDrill() renders it verbatim.
      if ('exp' in q && q.exp != null && !String(q.exp).trim()) {
        fail(`${tag}: exp present but empty`);
      }
    });
  });
});

// unit.num should be a clean 1..N sequence (drives report unit tagging).
const nums = UNITS.map((u) => u.num).sort((a, b) => a - b);
nums.forEach((n, i) => {
  if (n !== i + 1) fail(`UNITS.num sequence broken: expected ${i + 1}, found ${JSON.stringify(nums)}`);
});

// Per-section depth bar (Near-term-debt #11): no section below the floor.
sectionCounts.forEach((s) => {
  if (s.count < MIN_QUESTIONS_PER_SECTION) {
    fail(`section ${s.id} ("${s.title}") has only ${s.count} question(s) — below the depth bar of ${MIN_QUESTIONS_PER_SECTION} (shakai5's per-section floor). Add more original questions.`);
  }
});

// lesson.fig references (rendered by figureBox in app.js) must also point
// at real figures — check alongside questions since both draw from FIGURES.
UNITS.forEach((unit) => {
  (unit.sections || []).forEach((sec) => {
    (sec.lessons || []).forEach((lesson, li) => {
      if (lesson.fig && !figureKeys.has(lesson.fig)) {
        fail(`unit ${unit.id} section ${sec.id} lesson[${li}]: unknown fig key "${lesson.fig}"`);
      }
    });
  });
});

// ── Report ──────────────────────────────────────────────────────────────────
console.log('shakai4 data-integrity test');
console.log(`  units:      ${UNITS.length}`);
console.log(`  sections:   ${sectionCount}`);
console.log(`  questions:  ${questionCount}  (typed: ${typedCount}, order: ${orderCount})`);
console.log(`  unique ids: ${seenIds.size}`);
console.log(`  figures:    ${figureKeys.size}`);
console.log(`  MODULE_UNITS.shakai4 keys: ${moduleUnits.length}`);
console.log(`  per-section (floor ${MIN_QUESTIONS_PER_SECTION}):`);
sectionCounts.forEach((s) => {
  console.log(`    ${s.id.padEnd(6)} ${String(s.count).padStart(2)}  ${s.title}`);
});
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
