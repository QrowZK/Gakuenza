// report.test.js — report-path integration test for letstry1 (no browser needed).
// Run: node tests/letstry1/report.test.js
//
// Loads the REAL hub-common.js and letstry1-report.js under a minimal
// window/DOM shim with a stubbed Supabase client, then calls
// window.hk.syncQuizResult(...) (the shim's one method — index.html's
// saveResultToSupabase() calls exactly this) with a realistic quiz-shaped
// payload including items[], and asserts:
//   - context is resolved via enrollments -> classes.school_id (NOT
//     profiles.home_school_id): the enrollments query is what supplies
//     school/class
//   - the write goes through HubCommon.reportActivityWithItems (shared
//     helper), inserting BOTH an activity_results summary row AND
//     per-question activity_result_items rows — the CLAUDE.md hard-rule-2
//     gap that letstry1 itself used to have (#126): this shim used to
//     hand-roll the activity_results insert and never wrote item detail.
//   - item rows carry item_ref / prompt / category / correct /
//     selected_answer / correct_answer
//   - activity_ref is shaped like "letstry1/<level>/<category>/<ts>"
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
        if (table === 'modules') return resolve({ data: { id: 'mod-letstry1' }, error: null });
        if (table === 'profiles') return resolve({ data: { display_name: 'テスト 太郎' }, error: null });
        if (table === 'enrollments') return resolve({ data: [{ class_id: 'cls-1', classes: { school_id: 'sch-1' } }], error: null });
        if (table === 'class_modules') return resolve({ data: [], error: null });
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
// letstry1-report.js renders an account bubble into #module-account-mount
// and reads the session up front (redirecting to login.html if absent), so
// the shim needs a getElementById stub plus the mount's own child lookups.
const elements = {};
function makeEl(id) {
  return {
    id,
    innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
  };
}
global.document = {
  getElementById(id) {
    if (!elements[id]) elements[id] = makeEl(id);
    return elements[id];
  },
  addEventListener() {},
  querySelectorAll: () => [],
};
global.window = {
  supabase: { createClient: makeClient },
  GAKUENZA_CONFIG: { supabaseUrl: 'https://stub.local', supabaseAnonKey: 'stub' },
  location: { href: '' },
  document: global.document,
};

eval(fs.readFileSync(path.join(base, 'hub/hub-common.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'modules/letstry1/letstry1-report.js'), 'utf8'));

(async () => {
  // letstry1-report.js is an async IIFE — give its internal awaits
  // (getSession, the modules/enrollments Promise.all, the account-bubble
  // render) a turn to settle before window.hk is defined.
  for (let i = 0; i < 10 && !window.hk; i++) await new Promise(r => setImmediate(r));

  if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) fail('HubCommon.reportActivityWithItems not loaded');
  if (!window.hk || !window.hk.syncQuizResult) fail('window.hk.syncQuizResult not loaded');

  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s) before call:`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }

  // Quiz-shaped payload matching index.html's saveResultToSupabase() call:
  // level = 'unit'+unitId, setId = 'unit'+unitId, category = actType,
  // correct = score, total = total, items from qResults.
  const items = [
    { itemRef: 'unit0/quiz/0', category: 'quiz', prompt: 'apple', correct: true,  selectedAnswer: 'りんご', correctAnswer: 'りんご' },
    { itemRef: 'unit0/quiz/1', category: 'quiz', prompt: 'dog',   correct: false, selectedAnswer: 'ねこ',   correctAnswer: 'いぬ' },
    { itemRef: 'unit0/quiz/2', category: 'quiz', prompt: 'book',  correct: true,  selectedAnswer: '本',     correctAnswer: '本' },
  ];

  await window.hk.syncQuizResult({
    app_id: 'letstry1',
    level: 'unit0',
    setId: 'unit0',
    category: 'quiz',
    correct: 2,
    total: 3,
    items,
  });

  // Context resolution used enrollments (not home_school_id).
  if (!queried.includes('enrollments')) fail('did not query enrollments for context');

  // Summary row.
  const arBatches = inserted.activity_results || [];
  if (arBatches.length !== 1) fail(`expected 1 activity_results insert, got ${arBatches.length}`);
  const ar = arBatches[0] || {};
  if (ar.module_id !== 'mod-letstry1') fail(`wrong module_id ${ar.module_id}`);
  if (ar.school_id !== 'sch-1' || ar.class_id !== 'cls-1') fail(`wrong school/class ${ar.school_id}/${ar.class_id}`);
  if (ar.user_id !== 'user-1') fail(`wrong user_id ${ar.user_id}`);
  if (ar.score !== 2 || ar.max_score !== 3) fail(`wrong score/max ${ar.score}/${ar.max_score}`);
  if (!String(ar.activity_ref).startsWith('letstry1/unit0/quiz/')) fail(`activity_ref ${ar.activity_ref}`);

  // Per-item rows — THE hard-rule-2 / #126 regression check.
  const itemBatches = inserted.activity_result_items || [];
  if (itemBatches.length !== 1) fail(`expected 1 activity_result_items insert, got ${itemBatches.length}`);
  const rows = itemBatches[0] || [];
  if (rows.length !== 3) fail(`expected 3 item rows, got ${rows.length}`);
  rows.forEach((r, i) => {
    if (r.activity_result_id !== 'ar-1') fail(`item ${i}: not linked to summary row`);
    if (!r.item_ref) fail(`item ${i}: missing item_ref`);
    if (!r.prompt) fail(`item ${i}: missing prompt`);
    if (!r.category) fail(`item ${i}: missing category`);
    if (typeof r.correct !== 'boolean') fail(`item ${i}: correct not boolean`);
    if (r.selected_answer == null) fail(`item ${i}: missing selected_answer`);
    if (r.correct_answer == null) fail(`item ${i}: missing correct_answer`);
  });

  console.log('letstry1 report-path integration test');
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
