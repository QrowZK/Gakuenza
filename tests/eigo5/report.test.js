// report.test.js — report-path integration test for eigo5 (no browser needed).
// Run: node tests/eigo5/report.test.js
//
// Loads the REAL hub-common.js and eigo5-report.js under a minimal window/DOM
// shim with a stubbed Supabase client, then calls Eigo5Report.report(...) with
// a realistic items[] payload and asserts:
//   - context is resolved via enrollments -> classes.school_id (NOT
//     profiles.home_school_id): the enrollments query is what supplies school/class
//   - the write goes through HubCommon.reportActivityWithItems (shared helper),
//     inserting BOTH an activity_results summary row AND per-question
//     activity_result_items rows (the CLAUDE.md hard-rule-2 gap the ported
//     nh6/nhvocab apps ship — this module must NOT repeat it)
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
    let insertRows = null;
    const b = {
      _table: table,
      select() { return b; },
      eq() { return b; },
      in() { return b; },
      limit() { return b; },
      maybeSingle() { return b; },
      single() { return b; },
      insert(rows) { insertRows = rows; inserted[table] = inserted[table] || []; inserted[table].push(rows); return b; },
      then(resolve) {
        queried.push(table);
        if (table === 'modules') return resolve({ data: { id: 'mod-eigo5' }, error: null });
        if (table === 'profiles') return resolve({ data: { display_name: 'テスト 花子' }, error: null });
        if (table === 'enrollments') return resolve({ data: [{ class_id: 'cls-1', classes: { id: 'cls-1', school_id: 'sch-1' } }], error: null });
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
global.window = {
  supabase: { createClient: makeClient },
  GAKUENZA_CONFIG: { supabaseUrl: 'https://stub.local', supabaseAnonKey: 'stub' },
};
global.document = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] };

eval(fs.readFileSync(path.join(base, 'hub/hub-common.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'modules/eigo5/eigo5-report.js'), 'utf8'));

if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) fail('HubCommon.reportActivityWithItems not loaded');
if (!window.Eigo5Report || !window.Eigo5Report.report) fail('Eigo5Report.report not loaded');

(async () => {
  const items = [
    { itemRef: 'v0101/en2ja/0', category: 'en2ja:u01', prompt: 'name', correct: true,  selectedAnswer: '名前',   correctAnswer: '名前' },
    { itemRef: 's0101/sentence/1', category: 'sentence:u01', prompt: '____ is Ken.', correct: false, selectedAnswer: 'I am name', correctAnswer: 'My name' },
    { itemRef: 'v0105/en2ja/2', category: 'en2ja:u01', prompt: 'like', correct: true,  selectedAnswer: '好きだ', correctAnswer: '好きだ' },
  ];

  const ok = await window.Eigo5Report.report({
    sectionId: 'u01/en2ja',
    sectionTitle: 'Unit 1（英語 → 日本語）',
    unit: 'u01',
    score: 2,
    total: 3,
    items,
  });

  if (ok !== true) fail('report() did not return true');

  // Context resolution used enrollments (not home_school_id).
  if (!queried.includes('enrollments')) fail('did not query enrollments for context');

  // Summary row.
  const arBatches = inserted.activity_results || [];
  if (arBatches.length !== 1) fail(`expected 1 activity_results insert, got ${arBatches.length}`);
  const ar = arBatches[0];
  if (ar.module_id !== 'mod-eigo5') fail(`wrong module_id ${ar.module_id}`);
  if (ar.school_id !== 'sch-1' || ar.class_id !== 'cls-1') fail(`wrong school/class ${ar.school_id}/${ar.class_id}`);
  if (ar.user_id !== 'user-1') fail(`wrong user_id ${ar.user_id}`);
  if (ar.score !== 2 || ar.max_score !== 3) fail(`wrong score/max ${ar.score}/${ar.max_score}`);
  if (!String(ar.activity_ref).startsWith('eigo5/u01/en2ja/')) fail(`activity_ref ${ar.activity_ref}`);

  // Per-item rows — THE hard-rule-2 check.
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

  console.log('eigo5 report-path integration test');
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
