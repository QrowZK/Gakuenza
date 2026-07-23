// report.test.js — report-path integration test for nh6 (New Horizons 6),
// no browser needed.
// Run: node tests/nh6/report.test.js
//
// nh6 does NOT expose a report() function like eigo5 — instead
// nh6-report.js is an async IIFE that defines window.hk with
// `async syncQuizResult({ level, setId, category, correct, total, app_id, items })`,
// called by app.js's showResults() with `items: S.answers` (the #126 fix).
//
// Loads the REAL hub-common.js and nh6-report.js under a minimal window/DOM
// shim with a stubbed Supabase client, then calls window.hk.syncQuizResult(...)
// with a realistic items[] payload and asserts:
//   - context is resolved via enrollments -> classes.school_id (NOT
//     profiles.home_school_id): the enrollments query is what supplies school/class
//   - the write goes through HubCommon.reportActivityWithItems (shared helper),
//     inserting BOTH an activity_results summary row AND per-question
//     activity_result_items rows (CLAUDE.md hard-rule-2 — nh6 used to hand-roll
//     the activity_results insert and never write item detail; #126 fixed it)
//   - item rows carry item_ref / prompt / category / correct / selected_answer /
//     correct_answer
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
        if (table === 'modules') return resolve({ data: { id: 'mod-nh6' }, error: null });
        if (table === 'profiles') return resolve({ data: { display_name: 'テスト 太郎' }, error: null });
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
      getSession: async () => ({ data: { session: { user: { id: 'user-1', email: 'taro@example.com' } } } }),
      signOut: async () => ({}),
    },
  };
}

// ── Window / DOM shim ───────────────────────────────────────────────────────
// nh6-report.js renders an account bubble into #module-account-mount (and
// then queries the elements it just created via innerHTML), so — unlike
// eigo5, which has no such code — getElementById must hand back a stub
// element (with innerHTML/classList/addEventListener) rather than null.
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

eval(fs.readFileSync(path.join(base, 'hub/hub-common.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'modules/nh6/nh6-report.js'), 'utf8'));

if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) fail('HubCommon.reportActivityWithItems not loaded');

(async () => {
  // nh6-report.js's top-level IIFE (and its context-resolution awaits) is
  // async — give it a tick to finish and define window.hk before we call it.
  for (let i = 0; i < 50 && !window.hk; i++) {
    await new Promise(r => setImmediate(r));
  }
  if (!window.hk || !window.hk.syncQuizResult) fail('window.hk.syncQuizResult not defined');
  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s) before syncQuizResult could be called:`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }

  const items = [
    { itemRef: 'u1/grammar/0', category: 'grammar', prompt: 'I ___ a student.', correct: true,  selectedAnswer: 'am',  correctAnswer: 'am' },
    { itemRef: 'u1/grammar/1', category: 'grammar', prompt: 'She ___ to school.', correct: false, selectedAnswer: 'go', correctAnswer: 'goes' },
    { itemRef: 'u1/grammar/2', category: 'grammar', prompt: 'They ___ happy.', correct: true,  selectedAnswer: 'are', correctAnswer: 'are' },
  ];

  await window.hk.syncQuizResult({
    level: 'u1', setId: 'grammar', category: 'grammar',
    correct: 2, total: 3, app_id: 'nh6',
    items,
  });

  // Context resolution used enrollments (not home_school_id).
  if (!queried.includes('enrollments')) fail('did not query enrollments for context');

  // Summary row.
  const arBatches = inserted.activity_results || [];
  if (arBatches.length !== 1) fail(`expected 1 activity_results insert, got ${arBatches.length}`);
  const ar = arBatches[0];
  if (ar.module_id !== 'mod-nh6') fail(`wrong module_id ${ar.module_id}`);
  if (ar.school_id !== 'sch-1' || ar.class_id !== 'cls-1') fail(`wrong school/class ${ar.school_id}/${ar.class_id}`);
  if (ar.user_id !== 'user-1') fail(`wrong user_id ${ar.user_id}`);
  if (ar.score !== 2 || ar.max_score !== 3) fail(`wrong score/max ${ar.score}/${ar.max_score}`);
  if (!String(ar.activity_ref).startsWith('nh6/')) fail(`activity_ref ${ar.activity_ref}`);

  // Per-item rows — THE hard-rule-2 / #126 regression check.
  const itemBatches = inserted.activity_result_items || [];
  if (itemBatches.length !== 1) fail(`expected 1 activity_result_items insert, got ${itemBatches.length}`);
  const rows = itemBatches[0] || [];
  if (rows.length !== 3) fail(`expected 3 item rows, got ${rows.length}`);
  rows.forEach((r, i) => {
    if (r.activity_result_id !== 'ar-1') fail(`item ${i}: not linked to summary row`);
    if (!r.item_ref) fail(`item ${i}: missing item_ref`);
    if (!r.prompt) fail(`item ${i}: missing prompt`);
    if (typeof r.correct !== 'boolean') fail(`item ${i}: correct not boolean`);
    if (r.selected_answer == null) fail(`item ${i}: missing selected_answer`);
    if (r.correct_answer == null) fail(`item ${i}: missing correct_answer`);
  });

  console.log('nh6 report-path integration test');
  console.log(`  queried tables:        ${[...new Set(queried)].join(', ')}`);
  console.log(`  activity_results rows: ${arBatches.length}`);
  console.log(`  activity_result_items: ${rows.length}`);
  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s):`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})();
