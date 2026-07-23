// data.test.js — data-integrity + distractor-collision stress test for the
// eiken (英検) module.
// Run: node tests/eiken/data.test.js
//
// eiken has THREE data-bearing globals across two files, none of which use
// the eigo5-style `module.exports` dual-export — they are classic-script
// `const X = {...}` declarations meant to be shared via browser global
// scope (see modules/eiken/index.html's <script> load order):
//   - questions.js: `const ALL_SETS = {...}` (2,142 authored MC questions,
//     6 levels × 3 sets × {VOCAB,GRAMMAR,ORDER,CONVERSATION}) and
//     `const LEVEL_CFG = {...}` (per-level display config/labels).
//   - interview.js: `const INTERVIEW_DATA = {...}` (面接 passages/questions
//     for the 4 levels that carry a speaking component).
//
// questions.js has no top-level side effects, so it's safe to execute
// wholesale via `new Function(...)` under a `global.window={}` shim (same
// idea as eigo5's `eval`-based loads, just via Function so top-level
// `const` survives as a return value instead of being eval-scoped away).
//
// interview.js is NOT safe to execute wholesale — it's a full speech-UI
// app (`const synth = window.speechSynthesis; synth.getVoices()` runs at
// load time, plus DOMContentLoaded wiring) that would need a much heavier
// browser shim than this data check needs. INTERVIEW_DATA is authored as a
// single-line `const INTERVIEW_DATA={...};` assignment whose right-hand
// side is plain JSON (double-quoted keys/strings, no computed values), so
// it's extracted by isolating that line and JSON.parse-ing it directly —
// no code execution, no side effects.
//
// Checks (per CLAUDE.md's testing bar — stress-test at real scale,
// checking for structural bugs AND distractor collisions):
//   ALL_SETS (every one of the 2,142 questions, not a sample — it's a
//   finite authored bank, so "at scale" means "all of them"):
//     - non-empty prompt (q.q)
//     - exactly 4 distinct, non-empty options
//     - ans is a valid index into opts
//     - distractor collision: no OTHER option's text equals the correct
//       option's text (a literal duplicate would let a student pick the
//       "wrong" index and still show the identical string as correct —
//       the option-distinctness check below is what would catch it, but
//       it's asserted explicitly here as the named collision check)
//     - cat is one of the 4 known category tags
//   Cross-file consistency:
//     - LEVEL_CFG keys == ALL_SETS levels
//     - IV_LEVELS (app.js) subset of ALL_SETS levels
//     - IV_DATA_KEY (interview.js) keys == IV_LEVELS, values == INTERVIEW_DATA keys
//   INTERVIEW_DATA:
//     - every item has a non-empty topic/passage/illustration
//     - every question has non-empty q/model + a non-empty keywords[] array
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/eiken');
const appBase = path.resolve(__dirname, '../../gakuenza.com/modules/eiken/app.js');

const errors = [];
const fail = m => errors.push(m);
const norm = s => String(s == null ? '' : s).trim();

// ── Load questions.js wholesale (side-effect-free) ─────────────────────────
global.window = {};
const qCode = fs.readFileSync(path.join(base, 'questions.js'), 'utf8');
const { ALL_SETS, LEVEL_CFG } = new Function(
  'window',
  qCode + '\nreturn { ALL_SETS: (typeof ALL_SETS!=="undefined"?ALL_SETS:undefined), LEVEL_CFG: (typeof LEVEL_CFG!=="undefined"?LEVEL_CFG:undefined) };'
)(global.window);

if (!ALL_SETS) fail('questions.js: ALL_SETS not found');
if (!LEVEL_CFG) fail('questions.js: LEVEL_CFG not found');

// ── Extract a single-line literal assignment without executing the file ───
// (used for interview.js's INTERVIEW_DATA, and for the small app.js /
// interview.js const literals that drive level<->grade mapping)
function extractLiteralLine(filePath, varName) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const line = raw.split('\n').find(l => l.trim().startsWith(`const ${varName}=`) || l.trim().startsWith(`const ${varName} =`));
  if (!line) return undefined;
  const eqIdx = line.indexOf('=');
  let text = line.slice(eqIdx + 1).trim();
  if (text.endsWith(';')) text = text.slice(0, -1);
  return new Function('return (' + text + ');')();
}

const INTERVIEW_DATA = extractLiteralLine(path.join(base, 'interview.js'), 'INTERVIEW_DATA');
const IV_DATA_KEY = extractLiteralLine(path.join(base, 'interview.js'), 'IV_DATA_KEY');
const IV_LEVELS = extractLiteralLine(appBase, 'IV_LEVELS');

if (!INTERVIEW_DATA) fail('interview.js: INTERVIEW_DATA not found/parseable');
if (!IV_DATA_KEY) fail('interview.js: IV_DATA_KEY not found/parseable');
if (!IV_LEVELS) fail('app.js: IV_LEVELS not found/parseable');

if (errors.length) {
  console.error('FAILED to load source data — cannot continue:');
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}

// ── Cross-file level consistency ────────────────────────────────────────────
const levelKeys = Object.keys(ALL_SETS).sort();
const cfgKeys = Object.keys(LEVEL_CFG).sort();
if (JSON.stringify(levelKeys) !== JSON.stringify(cfgKeys)) {
  fail(`LEVEL_CFG keys ${JSON.stringify(cfgKeys)} != ALL_SETS levels ${JSON.stringify(levelKeys)}`);
}
IV_LEVELS.forEach(lv => {
  if (!levelKeys.includes(lv)) fail(`IV_LEVELS: level "${lv}" not present in ALL_SETS`);
});
const ivDataKeyLevels = Object.keys(IV_DATA_KEY).sort();
if (JSON.stringify(ivDataKeyLevels) !== JSON.stringify([...IV_LEVELS].sort())) {
  fail(`IV_DATA_KEY keys ${JSON.stringify(ivDataKeyLevels)} != IV_LEVELS ${JSON.stringify(IV_LEVELS)}`);
}
const expectedGradeKeys = Object.values(IV_DATA_KEY).sort();
const interviewGradeKeys = Object.keys(INTERVIEW_DATA).sort();
if (JSON.stringify(expectedGradeKeys) !== JSON.stringify(interviewGradeKeys)) {
  fail(`INTERVIEW_DATA keys ${JSON.stringify(interviewGradeKeys)} != IV_DATA_KEY values ${JSON.stringify(expectedGradeKeys)}`);
}

// ── ALL_SETS: every question, every level/set ───────────────────────────────
const KNOWN_CATS = new Set(['VOCAB', 'GRAMMAR', 'ORDER', 'CONVERSATION']);
let questionCount = 0;
let collisionCount = 0;
const catCounts = {};

for (const lv of levelKeys) {
  const sets = ALL_SETS[lv];
  for (const setKey of Object.keys(sets)) {
    const list = sets[setKey];
    if (!Array.isArray(list) || !list.length) { fail(`ALL_SETS[${lv}][${setKey}]: empty/not an array`); continue; }

    list.forEach((q, i) => {
      questionCount++;
      const tag = `${lv}/${setKey}[${i}] (id=${q.id}, cat=${q.cat})`;

      // Non-empty prompt.
      if (!norm(q.q)) fail(`${tag}: empty/missing prompt (q)`);

      // Category tag known + consistent.
      if (!KNOWN_CATS.has(q.cat)) fail(`${tag}: unknown category "${q.cat}"`);
      else catCounts[q.cat] = (catCounts[q.cat] || 0) + 1;

      // Exactly 4 options, all non-empty.
      if (!Array.isArray(q.opts) || q.opts.length !== 4) {
        fail(`${tag}: expected 4 opts, got ${Array.isArray(q.opts) ? q.opts.length : typeof q.opts}`);
        return;
      }
      q.opts.forEach((o, oi) => { if (!norm(o)) fail(`${tag}: option[${oi}] empty`); });

      // ans is a valid index.
      if (!Number.isInteger(q.ans) || q.ans < 0 || q.ans >= q.opts.length) {
        fail(`${tag}: ans (${q.ans}) is not a valid option index`);
        return;
      }

      // Options distinct (case/whitespace-sensitive exact text match — the
      // UI renders opts verbatim, so two options with identical text are
      // indistinguishable to the student regardless of which index scoring
      // uses).
      const optionTexts = q.opts.map(norm);
      if (new Set(optionTexts).size !== optionTexts.length) {
        fail(`${tag}: duplicate option text ${JSON.stringify(q.opts)}`);
      }

      // Distractor collision: no non-answer option shares the correct
      // option's text (i.e. the correct answer's text appears exactly once
      // across all 4 options — a second occurrence would mean a "wrong"
      // option is textually ALSO correct).
      const answerText = optionTexts[q.ans];
      const occurrences = optionTexts.filter(t => t === answerText).length;
      if (occurrences !== 1) {
        collisionCount++;
        fail(`${tag}: correct answer text "${answerText}" appears ${occurrences}x in opts (distractor collision) — ${JSON.stringify(q.opts)}`);
      }

      // id sanity (not required to be globally/set-unique — app.js scopes
      // lookups by currently-loaded question pool, and VOCAB ids are known
      // to repeat within a set — but it must at least be a real integer).
      if (!Number.isInteger(q.id)) fail(`${tag}: id is not an integer (${JSON.stringify(q.id)})`);
    });
  }
}

// ── INTERVIEW_DATA sanity ───────────────────────────────────────────────────
let interviewItemCount = 0;
let interviewQuestionCount = 0;
for (const grade of interviewGradeKeys) {
  const items = INTERVIEW_DATA[grade];
  if (!Array.isArray(items) || !items.length) { fail(`INTERVIEW_DATA[${grade}]: empty/not an array`); continue; }
  items.forEach((item, i) => {
    interviewItemCount++;
    const tag = `INTERVIEW_DATA.${grade}[${i}] (id=${item.id})`;
    if (!norm(item.topic)) fail(`${tag}: empty/missing topic`);
    if (!norm(item.passage)) fail(`${tag}: empty/missing passage`);
    // Illustration shape varies by grade: grade3/grade2 use a single-picture
    // `illustration` (matches the real 英検3級/2級 一次面接 one-picture
    // narration task); pre2/pre2plus use two-picture `illustration_1` +
    // `illustration_2` (matches the real 準2級/準2級プラス two-picture
    // narration task). Accept either shape, but require it be complete.
    const hasSingle = 'illustration' in item;
    const hasDouble = 'illustration_1' in item || 'illustration_2' in item;
    if (hasSingle && hasDouble) {
      fail(`${tag}: has BOTH illustration and illustration_1/2 — ambiguous shape`);
    } else if (hasSingle) {
      if (!norm(item.illustration)) fail(`${tag}: empty illustration`);
    } else if (hasDouble) {
      if (!norm(item.illustration_1)) fail(`${tag}: empty illustration_1`);
      if (!norm(item.illustration_2)) fail(`${tag}: empty illustration_2`);
    } else {
      fail(`${tag}: missing illustration (neither single nor two-picture shape present)`);
    }
    if (!Array.isArray(item.questions) || !item.questions.length) {
      fail(`${tag}: no questions`);
      return;
    }
    item.questions.forEach((q, qi) => {
      interviewQuestionCount++;
      const qtag = `${tag}.questions[${qi}]`;
      if (!norm(q.q)) fail(`${qtag}: empty/missing q`);
      if (!norm(q.model)) fail(`${qtag}: empty/missing model`);
      if (!Array.isArray(q.keywords) || !q.keywords.length) {
        fail(`${qtag}: keywords missing/empty`);
      } else {
        q.keywords.forEach((kw, ki) => { if (!norm(kw)) fail(`${qtag}: keywords[${ki}] empty`); });
      }
    });
  });
}

// ── Report ──────────────────────────────────────────────────────────────────
console.log('eiken data-integrity test');
console.log(`  levels:              ${levelKeys.join(', ')}`);
console.log(`  ALL_SETS questions:  ${questionCount}`);
console.log(`  by category:         ${Object.entries(catCounts).map(([c, n]) => `${c}=${n}`).join(', ')}`);
console.log(`  distractor collisions found: ${collisionCount}`);
console.log(`  INTERVIEW_DATA grades: ${interviewGradeKeys.join(', ')}`);
console.log(`  interview items:     ${interviewItemCount}`);
console.log(`  interview questions: ${interviewQuestionCount}`);
if (errors.length) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.slice(0, 40).forEach(e => console.error('  - ' + e));
  if (errors.length > 40) console.error(`  ...and ${errors.length - 40} more`);
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
