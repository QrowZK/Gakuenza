// report.test.js — report-path integration test for nhvocab (no browser needed).
// Run: node tests/nhvocab/report.test.js
//
// nhvocab is a ported app (like nh6): app.js never calls a report()
// function directly — it calls window.hk.getUser() / window.hk.syncQuizResult(),
// a shim DEFINED FRESH by nhvocab-report.js (an async IIFE). This test loads
// the REAL hub-common.js and nhvocab-report.js under a minimal window/DOM
// shim with a stubbed Supabase client, waits for the IIFE to finish setting
// up window.hk, then calls window.hk.syncQuizResult({..., items}) with a
// realistic items[] payload and asserts:
//   - context is resolved via enrollments -> classes.school_id (NOT
//     profiles.home_school_id)
//   - the write goes through HubCommon.reportActivityWithItems (shared
//     helper), inserting BOTH an activity_results summary row AND
//     per-question activity_result_items rows — the #126 fix (this shim used
//     to hand-roll the activity_results insert and never wrote item detail,
//     the CLAUDE.md hard-rule-2 gap). This test locks that fix in.
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
        if (table === 'modules') return resolve({ data: { id: 'mod-nhvocab' }, error: null });
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
      getSession: async () => ({ data: { session: { user: { id: 'user-1', email: 'taro@example.com' } } } }),
      signOut: async () => ({}),
    },
  };
}

// ── Window / DOM shim ───────────────────────────────────────────────────────
global.window = {
  supabase: { createClient: makeClient },
  GAKUENZA_CONFIG: { supabaseUrl: 'https://stub.local', supabaseAnonKey: 'stub' },
  location: {},
};
// getElementById('module-account-mount') -> null so the account-bubble
// renderer inside nhvocab-report.js's IIFE bails out immediately (it's
// fire-and-forget, not awaited by the outer IIFE) instead of needing a full
// DOM.
global.document = { getElementById: () => null, addEventListener() {}, querySelectorAll: () => [] };

eval(fs.readFileSync(path.join(base, 'hub/hub-common.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'modules/nhvocab/nhvocab-report.js'), 'utf8'));

if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) fail('HubCommon.reportActivityWithItems not loaded');

// nhvocab-report.js is a top-level async IIFE (no exported promise to await
// directly) — poll until it has finished its awaits and defined window.hk.
async function waitFor(cond, timeoutMs = 2000) {
  const start = Date.now();
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for window.hk to be defined');
    await new Promise(r => setTimeout(r, 5));
  }
}

(async () => {
  await waitFor(() => window.hk && typeof window.hk.syncQuizResult === 'function');

  if (typeof window.hk.getUser !== 'function') fail('window.hk.getUser not defined');

  const items = [
    { itemRef: 'v-beginner-set3/0', category: 'unit3', prompt: 'apple', correct: true,  selectedAnswer: 'りんご', correctAnswer: 'りんご' },
    { itemRef: 'v-beginner-set3/1', category: 'unit3', prompt: 'dog',   correct: false, selectedAnswer: '猫',     correctAnswer: '犬' },
    { itemRef: 'v-beginner-set3/2', category: 'unit3', prompt: 'book',  correct: true,  selectedAnswer: '本',     correctAnswer: '本' },
  ];

  await window.hk.syncQuizResult({
    level: 'beginner',
    setId: 'set3',
    category: 'unit3',
    correct: 2,
    total: 3,
    app_id: 'newhorizon',
    items,
  });

  // Context resolution used enrollments (not home_school_id).
  if (!queried.includes('enrollments')) fail('did not query enrollments for context');

  // Summary row.
  const arBatches = inserted.activity_results || [];
  if (arBatches.length !== 1) fail(`expected 1 activity_results insert, got ${arBatches.length}`);
  const ar = arBatches[0];
  if (ar.module_id !== 'mod-nhvocab') fail(`wrong module_id ${ar.module_id}`);
  if (ar.school_id !== 'sch-1' || ar.class_id !== 'cls-1') fail(`wrong school/class ${ar.school_id}/${ar.class_id}`);
  if (ar.user_id !== 'user-1') fail(`wrong user_id ${ar.user_id}`);
  if (ar.score !== 2 || ar.max_score !== 3) fail(`wrong score/max ${ar.score}/${ar.max_score}`);
  if (!String(ar.activity_ref).startsWith('nhvocab/beginner/set3/')) fail(`activity_ref ${ar.activity_ref}`);
  if (!ar.payload || ar.payload.app_id !== 'newhorizon') fail(`payload missing app_id: ${JSON.stringify(ar.payload)}`);

  // Per-item rows — THE #126 / hard-rule-2 check.
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

  console.log('nhvocab report-path integration test');
  console.log(`  queried tables:        ${[...new Set(queried)].join(', ')}`);
  console.log(`  activity_results rows: ${arBatches.length}`);
  console.log(`  activity_result_items: ${rows.length}`);
  if (errors.length) {
    console.error(`\nFAILED with ${errors.length} error(s):`);
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('\nALL CHECKS PASSED');
})().catch(e => {
  console.error('FAILED with exception:', e);
  process.exit(1);
});
