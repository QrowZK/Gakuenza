// report.test.js — report-path integration test for eiken (英検 practice),
// no browser needed.
// Run: node tests/eiken/report.test.js
//
// eiken's reporting contract is UNLIKE eigo5/nh6/nhvocab/letstry1/letstry2/
// shakai3: eiken-report.js does not define a fresh window.hk or a
// module-level report() function. Instead it WRAPS the plain top-level
// `function recordSession(res){...}` that app.js already declares (comment
// in eiken-report.js: "recordSession is a plain top-level function declared
// in app.js; wrapping it here ... keeps the ported quiz logic completely
// untouched.") In a real classic-script page, `function recordSession(){}`
// declared at the top level of app.js becomes `window.recordSession`
// automatically (global function-declaration hoisting), and eiken-report.js
// captures the original, replaces window.recordSession with a wrapper that:
//   1. still calls the original (`_origRecordSession(res)`) so the
//      on-screen results/stats UI app.js already renders keeps working,
//   2. computes score/total from `res` (`chosen === correct`),
//   3. builds a `ref` using `currentLevel`/`currentSet` — bare identifiers,
//      NOT window.currentLevel — because classic scripts on one page share
//      one global scope, so app.js's top-level `let currentLevel, currentSet,
//      questions` are reachable unqualified from eiken-report.js's IIFE,
//   4. builds a per-question `items[]` from `res` + the `questions` array
//      (itemRef `${cat}:${id}`, category, prompt, correct, selected/correct
//      answer TEXT looked up via q.opts[origChosen]/[origCorrect]),
//   5. reports via window.HubCommon.reportActivityWithItems(sb, {...items}) —
//      eiken DOES pass a full per-question items array (NOT summary-only),
//      so this is NOT one of the CLAUDE.md hard-rule-2 offenders (nh6,
//      nhvocab, letstry1, letstry2, shakai3).
//
// This test does NOT load the real app.js (it's a large DOM-driving UI file
// with no exports — nothing here needs its quiz-flow/rendering code). It
// instead stands in for the two things eiken-report.js actually depends on
// from app.js's shared classic-script scope:
//   - `window.recordSession`, a baseline function to wrap (asserted called)
//   - bare `currentLevel` / `currentSet` / `questions` bindings in the same
//     lexical scope eiken-report.js's `eval`'d IIFE closes over
// then loads the REAL hub-common.js and eiken-report.js and calls the
// wrapped window.recordSession with a realistic `res` array (the same shape
// app.js's own submitAnswer/finishQuiz produce:
// `{qId, chosen, correct, origChosen, origCorrect}`), asserting:
//   - context is resolved via enrollments -> classes.school_id (NOT
//     profiles.home_school_id)
//   - the original recordSession is still invoked (on-screen UI preserved)
//   - the write goes through HubCommon.reportActivityWithItems, inserting
//     BOTH an activity_results summary row AND per-question
//     activity_result_items rows
//   - item rows carry item_ref / prompt / category / correct /
//     selected_answer / correct_answer, with selected/correct answer TEXT
//     (not raw option index) as eiken-report.js's q.opts[...] lookup does
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com');

const errors = [];
const fail = m => errors.push(m);

// ── Capture buffers ─────────────────────────────────────────────────────────
const inserted = { activity_results: [], activity_result_items: [] };
const queried = [];

// ── Stub Supabase client ────────────────────────────────────────────────────
function makeClient() {
  function builder(table) {
    const b = {
      _table: table,
      select() { return b; },
      eq() { return b; },
      in() { return b; },
      limit() { return b; },
      maybeSingle() { return b; },
      single() { return b; },
      insert(rows) { inserted[table] = inserted[table] || []; inserted[table].push(rows); return b; },
      then(resolve) {
        queried.push(table);
        if (table === 'modules') return resolve({ data: { id: 'mod-eiken' }, error: null });
        if (table === 'profiles') return resolve({ data: { display_name: 'テスト 次郎' }, error: null });
        if (table === 'enrollments') return resolve({ data: [{ class_id: 'cls-1', classes: { id: 'cls-1', school_id: 'sch-1' } }], error: null });
        if (table === 'activity_results') return resolve({ data: { id: 'ar-1' }, error: null });
        if (table === 'activity_result_items') return resolve({ data: null, error: null });
        return resolve({ data: [], error: null });
      },
    };
    return b;
  }
  return {
    from: t => builder(t),
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
      signOut: async () => ({}),
    },
  };
}

// ── Window / DOM shim ───────────────────────────────────────────────────────
// eiken-report.js also renders an account bubble into #module-account-mount,
// same as nh6-report.js, so getElementById must hand back a stub element.
function makeStubElement() {
  return {
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
  };
}

global.window = {
  supabase: { createClient: makeClient },
  GAKUENZA_CONFIG: { supabaseUrl: 'https://stub.local', supabaseAnonKey: 'stub' },
  location: { href: '' },
};
global.document = {
  getElementById: () => makeStubElement(),
  addEventListener() {},
  querySelectorAll: () => [],
};

// ── Stand-in for app.js's shared classic-script scope ──────────────────────
// eiken-report.js references `currentLevel`, `currentSet`, and `questions`
// as bare identifiers (not window.X) — real app.js declares them as
// top-level `let currentLevel="5", currentSet="1", questions=[];`. Because
// eiken-report.js is loaded below via a *direct* eval() at this same
// top-level scope (matching every other module's report.test.js pattern),
// those bare-identifier lookups resolve to the `let` bindings declared here.
let currentLevel = '5';
let currentSet = '1';
let questions = [
  { id: 1, cat: 'VOCAB', q: 'I have a ___ in my bag.', opts: ['pen', 'cup', 'bed', 'hat'], ans: 0, exp: 'exp1' },
  { id: 2, cat: 'GRAMMAR', q: 'She ___ happy.', opts: ['is', 'are', 'am', 'be'], ans: 0, exp: 'exp2' },
  { id: 3, cat: 'ORDER', q: 'Choose the correct order.', opts: ['I study English.', 'study English I.', 'English I study.', 'study I English.'], ans: 0, exp: 'exp3' },
];

// Baseline `window.recordSession` — stands in for app.js's real one (which
// only drives on-screen results/stats rendering, irrelevant to reporting).
// eiken-report.js's wrapper must still call this original.
let baseCalls = 0;
let baseCallArg = null;
window.recordSession = function (res) { baseCalls++; baseCallArg = res; };
const _originalFn = window.recordSession;

eval(fs.readFileSync(path.join(base, 'hub/hub-common.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'modules/eiken/eiken-report.js'), 'utf8'));

if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) fail('HubCommon.reportActivityWithItems not loaded');

(async () => {
  // eiken-report.js's top-level IIFE is async (awaits getSession(), then
  // Promise.all for modules/enrollments) before it wraps window.recordSession
  // — poll until the wrap has happened, same pattern as nh6's wait-for-hk.
  for (let i = 0; i < 50 && window.recordSession === _originalFn; i++) {
    await new Promise(r => setImmediate(r));
  }
  if (window.recordSession === _originalFn) fail('window.recordSession was never wrapped by eiken-report.js');
  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s) before recordSession could be called:`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }

  // Realistic `res` — the exact shape app.js's submitAnswer/finishQuiz build:
  // `results[idx] = {qId, chosen, correct, origChosen, origCorrect}`, where
  // chosen/correct are the (possibly shuffled) on-screen positions and
  // origChosen/origCorrect are indices into the RAW (unshuffled) q.opts —
  // eiken-report.js looks up answer TEXT via q.opts[origChosen/origCorrect].
  const res = [
    { qId: 1, chosen: 0, correct: 0, origChosen: 0, origCorrect: 0 },   // correct: chose "pen"
    { qId: 2, chosen: 1, correct: 0, origChosen: 1, origCorrect: 0 },   // wrong: chose "are", correct "is"
    { qId: 3, chosen: 0, correct: 0, origChosen: 0, origCorrect: 0 },   // correct: chose opt 0
  ];

  window.recordSession(res);
  // recordSession is synchronous, but reportActivityWithItems it kicks off is
  // async with TWO sequential internal awaits (activity_results insert, then
  // activity_result_items insert) before its `.then()` callback runs — wait
  // for both buffers to be populated, not just the first.
  for (let i = 0; i < 50 && !((inserted.activity_results || []).length && (inserted.activity_result_items || []).length); i++) {
    await new Promise(r => setImmediate(r));
  }

  // Original recordSession preserved (on-screen results/stats UI untouched).
  if (baseCalls !== 1) fail(`expected original recordSession called once, got ${baseCalls}`);
  if (baseCallArg !== res) fail('original recordSession was not called with the same res array');

  // Context resolution used enrollments (not home_school_id).
  if (!queried.includes('enrollments')) fail('did not query enrollments for context');

  // Summary row.
  const arBatches = inserted.activity_results || [];
  if (arBatches.length !== 1) fail(`expected 1 activity_results insert, got ${arBatches.length}`);
  const ar = arBatches[0] || {};
  if (ar.module_id !== 'mod-eiken') fail(`wrong module_id ${ar.module_id}`);
  if (ar.school_id !== 'sch-1' || ar.class_id !== 'cls-1') fail(`wrong school/class ${ar.school_id}/${ar.class_id}`);
  if (ar.user_id !== 'user-1') fail(`wrong user_id ${ar.user_id}`);
  if (ar.score !== 2 || ar.max_score !== 3) fail(`wrong score/max ${ar.score}/${ar.max_score}`);
  if (!String(ar.activity_ref).startsWith('eiken/5/1/')) fail(`activity_ref "${ar.activity_ref}" doesn't start with eiken/5/1/`);
  if (!ar.payload || ar.payload.level !== '5' || ar.payload.set !== '1') fail(`payload missing/wrong level-set: ${JSON.stringify(ar.payload)}`);

  // Per-item rows — eiken passes real items (not summary-only).
  const itemBatches = inserted.activity_result_items || [];
  if (itemBatches.length !== 1) fail(`expected 1 activity_result_items insert, got ${itemBatches.length}`);
  const rows = itemBatches[0] || [];
  if (rows.length !== 3) fail(`expected 3 item rows, got ${rows.length}`);

  const expected = [
    { item_ref: 'VOCAB:1', category: 'VOCAB', prompt: 'I have a ___ in my bag.', correct: true, selected_answer: 'pen', correct_answer: 'pen' },
    { item_ref: 'GRAMMAR:2', category: 'GRAMMAR', prompt: 'She ___ happy.', correct: false, selected_answer: 'are', correct_answer: 'is' },
    { item_ref: 'ORDER:3', category: 'ORDER', prompt: 'Choose the correct order.', correct: true, selected_answer: 'I study English.', correct_answer: 'I study English.' },
  ];
  rows.forEach((r, i) => {
    const e = expected[i];
    if (r.activity_result_id !== 'ar-1') fail(`item ${i}: not linked to summary row (got ${r.activity_result_id})`);
    if (!e) return;
    if (r.item_ref !== e.item_ref) fail(`item ${i}: item_ref "${r.item_ref}" != "${e.item_ref}"`);
    if (r.category !== e.category) fail(`item ${i}: category "${r.category}" != "${e.category}"`);
    if (r.prompt !== e.prompt) fail(`item ${i}: prompt "${r.prompt}" != "${e.prompt}"`);
    if (typeof r.correct !== 'boolean') fail(`item ${i}: correct not boolean`);
    else if (r.correct !== e.correct) fail(`item ${i}: correct ${r.correct} != ${e.correct}`);
    if (r.selected_answer !== e.selected_answer) fail(`item ${i}: selected_answer "${r.selected_answer}" != "${e.selected_answer}" (text lookup via q.opts[origChosen])`);
    if (r.correct_answer !== e.correct_answer) fail(`item ${i}: correct_answer "${r.correct_answer}" != "${e.correct_answer}" (text lookup via q.opts[origCorrect])`);
  });

  console.log('eiken report-path integration test');
  console.log('  reporting contract: eiken-report.js wraps app.js\'s window.recordSession,');
  console.log('    routes through HubCommon.reportActivityWithItems with a per-question items[] array');
  console.log('    (NOT one of the CLAUDE.md hard-rule-2 summary-only offenders)');
  console.log(`  queried tables:        ${[...new Set(queried)].join(', ')}`);
  console.log(`  original recordSession calls: ${baseCalls}`);
  console.log(`  activity_results rows: ${arBatches.length}`);
  console.log(`  activity_result_items: ${rows.length}`);
  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s):`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})();
