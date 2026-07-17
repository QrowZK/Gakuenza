// flow.test.mjs — headless end-to-end flow test for sansu2.
// Run: node tests/sansu2/flow.test.mjs   (requires playwright + chromium)
//
// Serves the site over HTTP, stubs the hub scripts (supabase/config/hub-common)
// so no real backend is needed, drives sections through the actual quiz UI
// (menu → answer each question → result), and asserts that the shared reporting
// helper HubCommon.reportActivityWithItems was called with the right module_id
// AND a fully-populated per-question `items` array (activity_result_items) —
// the exact gap the shared-infra doc (hard rule 2) warns modules keep shipping.
//
// It exercises BOTH answer kinds across a representative spread, including the
// grade-2 かけ算九九 centerpiece (whole-table + missing-factor), answering every
// question with the *correct* value (read out of the live problem object via
// window.SANSU2_DATA) so we also confirm the report's score equals maxScore.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const pwUrl = process.env.PLAYWRIGHT_MODULE || 'playwright';
const pw = await import(pwUrl);
const chromium = pw.chromium || (pw.default && pw.default.chromium);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(__dirname, '../../gakuenza.com');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const filePath = path.join(SITE_ROOT, urlPath);
  if (!filePath.startsWith(SITE_ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
  });
});

const STUB_SUPABASE = `
window.supabase = { createClient: function () {
  function builder(table) {
    var b = {
      _table: table,
      select: function(){ return b; }, eq: function(){ return b; },
      in: function(){ return b; }, limit: function(){ return b; },
      maybeSingle: function(){ return b; },
      then: function(resolve){ resolve(b._result()); },
      _result: function(){
        if (b._table === 'modules') return { data: { id: 'mod-sansu2' }, error: null };
        if (b._table === 'profiles') return { data: { display_name: 'テスト' }, error: null };
        if (b._table === 'enrollments') return { data: [{ class_id: 'cls-1', classes: { id: 'cls-1', school_id: 'sch-1' } }], error: null };
        if (b._table === 'class_modules') return { data: [], error: null };
        return { data: [], error: null };
      }
    };
    return b;
  }
  return {
    from: function(t){ return builder(t); },
    auth: {
      getSession: async function(){ return { data: { session: { user: { id: 'user-1' } } } }; },
      signOut: async function(){ return {}; }
    }
  };
} };
`;
const STUB_CONFIG = `window.GAKUENZA_CONFIG = { supabaseUrl: 'https://stub.local', supabaseAnonKey: 'stub-anon' };`;
const STUB_HUBCOMMON = `
window.__reports = [];
window.HubCommon = {
  reportActivityWithItems: async function(sb, args){ window.__reports.push(args); return { ok: true }; }
};
`;

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 1; }

// Drive one section to the result screen, answering every question correctly by
// reading the current problem object out of the module's own state.
async function runSection(page, label, unitNum, sectionId, expectN) {
  await page.evaluate(() => { window.__reports = []; });
  await page.goto(BASE + '/modules/sansu2/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.sec-btn');

  // Click the section button for this unit/section. Reset the candidate queue
  // first so it captures ONLY this section's generated problems (startSection
  // runs synchronously inside the click handler).
  const clicked = await page.evaluate((sid) => {
    const units = window.SANSU2_DATA.UNITS;
    let target = null;
    for (const u of units) for (const s of u.sections) if (s.id === sid) { target = s; }
    if (!target) return false;
    const btns = Array.from(document.querySelectorAll('.sec-btn'));
    const btn = btns.find(b => b.querySelector('.sec-title') && b.querySelector('.sec-title').textContent === target.title);
    if (!btn) return false;
    window.__pq = [];
    btn.click();
    return true;
  }, sectionId);
  if (!clicked) return fail(`${label}: could not open section ${sectionId}`);

  await page.waitForSelector('#screen-drill.active');

  // Reconstruct the exact ordered list of problems this attempt kept, by
  // replaying app.js's own dedup over the queue of generated candidates (see
  // the addInitScript probe). This maps question index -> problem object
  // deterministically, even when several problems share identical prompt text.
  const kept = await page.evaluate(() => {
    const seen = new Set(); const out = [];
    for (const p of window.__pq) {
      const sig = p.q + ' ' + (p.kind === 'typed' ? p.answer : p.correctChoice);
      if (seen.has(sig)) continue;
      seen.add(sig); out.push({ kind: p.kind, answer: String(p.answer), correctChoice: String(p.correctChoice == null ? '' : p.correctChoice) });
    }
    return out;
  });

  let answered = 0;
  while (answered < 60) {
    const done = await page.evaluate(() => document.getElementById('screen-review').classList.contains('active'));
    if (done) break;
    const p = kept[answered];
    if (!p) return fail(`${label}: ran out of reconstructed problems at q${answered}`);
    if (p.kind === 'typed') {
      await page.fill('#answerInput', p.answer);
      await page.click('#checkBtn');
    } else {
      // Click the choice button whose exact text is the correct choice.
      const ok = await page.evaluate((want) => {
        const btn = Array.from(document.querySelectorAll('.choice-btn')).find(b => b.textContent === want);
        if (!btn) return false; btn.click(); return true;
      }, p.correctChoice);
      if (!ok) return fail(`${label}: correct choice "${p.correctChoice}" not found at q${answered}`);
    }
    await page.waitForSelector('#nextBtn:not([hidden])');
    await page.click('#nextBtn');
    answered++;
  }

  await page.waitForSelector('#screen-review.active');
  const reports = await page.evaluate(() => window.__reports);
  if (reports.length !== 1) return fail(`${label}: expected 1 report, got ${reports.length}`);
  const r = reports[0];
  if (r.moduleId !== 'mod-sansu2') fail(`${label}: wrong moduleId ${r.moduleId}`);
  if (r.schoolId !== 'sch-1' || r.classId !== 'cls-1') fail(`${label}: wrong school/class ${r.schoolId}/${r.classId}`);
  if (!Array.isArray(r.items) || r.items.length !== expectN) fail(`${label}: items not populated (${r.items && r.items.length}, expected ${expectN})`);
  const badItem = (r.items || []).find(it => !it.itemRef || typeof it.correct !== 'boolean' || !it.prompt || !it.category || it.correctAnswer == null);
  if (badItem) fail(`${label}: malformed item ${JSON.stringify(badItem)}`);
  if (typeof r.score !== 'number' || r.maxScore !== expectN) fail(`${label}: score/maxScore wrong ${r.score}/${r.maxScore}`);
  if (r.score !== expectN) fail(`${label}: expected all-correct score ${expectN}, got ${r.score}`);
  if (!r.activityRef.startsWith('sansu2/' + sectionId + '/')) fail(`${label}: activityRef ${r.activityRef}`);
  if (!r.payload || !r.payload.unit || r.payload.unit.indexOf(String(unitNum) + '.') !== 0) fail(`${label}: payload.unit ${JSON.stringify(r.payload)}`);
  if (process.exitCode !== 1) console.log(`OK — ${label}: report ok (items=${r.items.length}, score=${r.score}/${r.maxScore}, ref=${r.activityRef})`);
}

let BASE;
const port = await new Promise(res => server.listen(0, () => res(server.address().port)));
BASE = `http://127.0.0.1:${port}`;
// Prefer the environment's pre-installed chromium when the pinned playwright
// build doesn't match the downloaded browser revision.
const launchOpts = process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {};
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
await page.route(/\/hub\/supabase\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_SUPABASE }));
await page.route(/\/hub\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_CONFIG }));
await page.route(/\/hub\/hub-common\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_HUBCOMMON }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', e => fail('pageerror: ' + e.message));

// Expose the current problem's canonical answer/correctChoice for the driver.
// app.js keeps `state` in a closure, so we wrap each section's gen() to stash
// every produced problem in a queue, then replay the dedup to map question
// index -> problem object. Runs via addInitScript (re-applied on every
// navigation), polling until SANSU2_DATA exists so the wrap lands after the
// module loads but before any section starts.
await page.addInitScript(() => {
  const iv = setInterval(() => {
    if (window.SANSU2_DATA && !window.__probeInstalled) {
      window.__probeInstalled = true;
      window.__pq = [];
      const units = window.SANSU2_DATA.UNITS;
      for (const u of units) for (const s of u.sections) {
        const orig = s.gen;
        s.gen = function () { const p = orig(); window.__pq.push(p); return p; };
      }
      clearInterval(iv);
    }
  }, 5);
});

try {
  // Representative spread across answer kinds and figures:
  //   u01 graphs — choice + typed, figure;  u02 add — all typed;
  //   u07 clock read — all choice, figure;  u12 九九 whole-table — typed+choice;
  //   u12 missing-factor — all typed (the □ centerpiece).
  await runSection(page, 'u01_tables_graphs', 1, 'u01-graph', 8);
  await runSection(page, 'u02_add_column', 2, 'u02-keisan', 10);
  await runSection(page, 'u07_time(read)', 7, 'u07-yomu', 8);
  await runSection(page, 'u12_mult2(whole)', 12, 'u12-zenbu', 12);
  await runSection(page, 'u12_mult2(missing)', 12, 'u12-missing', 8);
} finally {
  await browser.close();
  server.close();
}
if (process.exitCode === 1) console.error('\nflow test FAILED');
else console.log('\nflow test PASSED');
