// report.test.js — report-path integration test for shakai3 (no browser needed).
// Run: node tests/shakai3/report.test.js
//
// Loads the REAL hub-common.js and shakai-report.js under a minimal window/DOM
// shim with a stubbed Supabase client, then calls Shakai3Report.report(...) with
// a realistic items[] payload and asserts:
//   - context is resolved via enrollments -> classes.school_id (NOT
//     profiles.home_school_id): the enrollments query is what supplies school/class
//   - the write goes through HubCommon.reportActivityWithItems (shared helper),
//     inserting BOTH an activity_results summary row AND per-question
//     activity_result_items rows — this is the regression guard for #126,
//     the fix that stopped shakai3 hand-rolling the activity_results insert
//     and never populating activity_result_items (CLAUDE.md hard rule 2)
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
        if (table === 'modules') return resolve({ data: { id: 'mod-shakai3' }, error: null });
        if (table === 'profiles') return resolve({ data: { display_name: 'テスト 太郎' }, error: null });
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
eval(fs.readFileSync(path.join(base, 'modules/shakai3/shakai-report.js'), 'utf8'));

if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) fail('HubCommon.reportActivityWithItems not loaded');
if (!window.Shakai3Report || !window.Shakai3Report.report) fail('Shakai3Report.report not loaded');

(async () => {
  // Shape matches app.js's finishDrill(): itemRef = q.id (`${sectionId}-${idx}`),
  // category = q.cat (currently always null in the authored bank — see
  // tests/shakai3/data.test.js), correctAnswer = q.a[0] or the order-joined string.
  const items = [
    { itemRef: 'u1s3-0', category: null, prompt: 'この地図記号は何をあらわしていますか。', correct: true,  selectedAnswer: '学校', correctAnswer: '学校' },
    { itemRef: 'u1s3-1', category: null, prompt: 'この地図記号は何をあらわしていますか。', correct: false, selectedAnswer: '交番', correctAnswer: 'ゆうびん局' },
    { itemRef: 'u2s1-5', category: null, prompt: 'やさいがしゅうかくされるまでの農家の仕事を、じゅんばんにならべましょう。', correct: true, selectedAnswer: 'なえを育てる → 畑になえを植える → 水やりや草取りをする → しゅうかくする', correctAnswer: 'なえを育てる → 畑になえを植える → 水やりや草取りをする → しゅうかくする' },
  ];

  const ok = await window.Shakai3Report.report({
    sectionId: 'u1s3',
    sectionTitle: '地図記号',
    unit: 1,
    score: 2,
    total: 3,
    rightIds: ['u1s3-0', 'u2s1-5'],
    wrongIds: ['u1s3-1'],
    items,
  });

  if (ok !== true) fail('report() did not return true');

  // Context resolution used enrollments (not home_school_id).
  if (!queried.includes('enrollments')) fail('did not query enrollments for context');

  // Summary row.
  const arBatches = inserted.activity_results || [];
  if (arBatches.length !== 1) fail(`expected 1 activity_results insert, got ${arBatches.length}`);
  const ar = arBatches[0];
  if (ar.module_id !== 'mod-shakai3') fail(`wrong module_id ${ar.module_id}`);
  if (ar.school_id !== 'sch-1' || ar.class_id !== 'cls-1') fail(`wrong school/class ${ar.school_id}/${ar.class_id}`);
  if (ar.user_id !== 'user-1') fail(`wrong user_id ${ar.user_id}`);
  if (ar.score !== 2 || ar.max_score !== 3) fail(`wrong score/max ${ar.score}/${ar.max_score}`);
  if (!String(ar.activity_ref).startsWith('shakai3/u1s3/')) fail(`activity_ref ${ar.activity_ref}`);

  // payload carries section/unit/right/wrong for the ふくしゅう (review) card.
  if (!ar.payload || ar.payload.section !== '地図記号') fail(`payload.section wrong: ${JSON.stringify(ar.payload)}`);
  if (ar.payload.unit !== 1) fail(`payload.unit wrong: ${JSON.stringify(ar.payload)}`);
  if (!Array.isArray(ar.payload.right) || ar.payload.right.length !== 2) fail(`payload.right wrong: ${JSON.stringify(ar.payload)}`);
  if (!Array.isArray(ar.payload.wrong) || ar.payload.wrong.length !== 1) fail(`payload.wrong wrong: ${JSON.stringify(ar.payload)}`);

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
    // category is legitimately null for shakai3 today (no question sets `cat`
    // — see data.test.js) so we only assert the column made it through, not
    // that it's truthy.
    if (!('category' in r)) fail(`item ${i}: missing category column`);
  });

  console.log('shakai3 report-path integration test');
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
