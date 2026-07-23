// flow.test.mjs — headless end-to-end flow test for rika6.
// Run: PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright node flow.test.mjs
//
// Serves the site over HTTP, stubs the hub scripts (supabase/config/hub-common)
// so no real backend is needed, drives a unit through the actual quiz UI
// (choice + order questions) to the result screen, and asserts that the shared
// reporting helper HubCommon.reportActivityWithItems was called with the right
// module_id AND a populated per-question `items` array (activity_result_items)
// — the exact gap the shared-infra doc warns modules keep shipping.
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

// Stub hub scripts. A chainable Supabase query builder that resolves table-
// appropriately, plus a HubCommon that captures every reportActivityWithItems call.
const STUB_SUPABASE = `
window.supabase = { createClient: function () {
  function builder(table) {
    var b = {
      _table: table, _single: false,
      select: function(){ return b; }, eq: function(){ return b; },
      in: function(){ return b; }, limit: function(){ return b; },
      maybeSingle: function(){ b._single = true; return b; },
      then: function(resolve){ resolve(b._result()); },
      _result: function(){
        if (b._table === 'modules') return { data: { id: 'mod-rika6' }, error: null };
        if (b._table === 'profiles') return { data: { id: 'user-1', display_name: 'テスト太郎' }, error: null };
        if (b._table === 'enrollments') return { data: [{ class_id: 'cls-1', classes: { id: 'cls-1', school_id: 'sch-1' } }], error: null };
        if (b._table === 'class_modules') return { data: [], error: null };
        return { data: [], error: null };
      }
    };
    return b;
  }
  return { from: function(t){ return builder(t); }, auth: {
    getSession: async function(){ return { data: { session: { user: { id: 'user-1' } } } }; },
    signOut: async function(){}
  } };
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

// Drive one unit (identified by its unit-card title text) all the way to the
// result screen, answering every question. Handles both choice and order Qs.
async function runUnit(page, label, unitKey, expect) {
  await page.evaluate(() => { window.__reports = []; });
  await page.goto(BASE + '/modules/rika6/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.unit-card[data-unit="' + unitKey + '"]');
  await page.click('.unit-card[data-unit="' + unitKey + '"]');

  // If a lesson screen shows first, skip straight to the drill.
  const onLesson = await page.evaluate(() =>
    document.getElementById('screen-lesson').classList.contains('active'));
  if (onLesson) {
    await page.click('#lessonSkip');
  }
  await page.waitForSelector('#screen-drill.active');

  let answered = 0;
  while (answered < 30) {
    const onReview = await page.evaluate(() =>
      document.getElementById('screen-review').classList.contains('active'));
    if (onReview) break;

    const isOrder = await page.evaluate(() =>
      !document.getElementById('orderArea').hidden);

    if (isOrder) {
      // tap every pool chip in DOM order, then 答え合わせ.
      let guard = 0;
      while (guard++ < 12) {
        const remaining = await page.evaluate(() =>
          document.querySelectorAll('#orderPool .order-chip').length);
        if (remaining === 0) break;
        await page.click('#orderPool .order-chip');
      }
      await page.waitForSelector('#checkBtn:not([disabled])');
      await page.click('#checkBtn');
    } else {
      await page.waitForSelector('#choiceArea .choice-btn:not(:disabled)');
      await page.click('#choiceArea .choice-btn:not(:disabled)');
    }
    answered++;
    await page.waitForSelector('#nextBtn:not([hidden])');
    await page.click('#nextBtn');
    // after last question, nextBtn leads to review; loop re-checks.
    await page.waitForFunction(() =>
      document.getElementById('screen-review').classList.contains('active') ||
      document.querySelectorAll('#choiceArea .choice-btn:not(:disabled)').length > 0 ||
      !document.getElementById('orderArea').hidden);
  }

  await page.waitForSelector('#screen-review.active');
  const reports = await page.evaluate(() => window.__reports);
  if (reports.length !== 1) return fail(`${label}: expected 1 report, got ${reports.length}`);
  const r = reports[0];
  if (r.moduleId !== 'mod-rika6') fail(`${label}: wrong moduleId ${r.moduleId}`);
  if (!Array.isArray(r.items) || r.items.length !== answered)
    fail(`${label}: items not populated (${r.items && r.items.length}, expected ${answered})`);
  const badItem = (r.items || []).find(it => !it.itemRef || typeof it.correct !== 'boolean' || !it.prompt);
  if (badItem) fail(`${label}: malformed item ${JSON.stringify(badItem)}`);
  if (typeof r.score !== 'number' || r.maxScore !== answered)
    fail(`${label}: score/maxScore wrong ${r.score}/${r.maxScore}`);
  if (r.schoolId !== 'sch-1' || r.classId !== 'cls-1')
    fail(`${label}: context wrong school=${r.schoolId} class=${r.classId}`);
  if (!expect(r)) fail(`${label}: activityRef/payload check failed :: ${r.activityRef} ${JSON.stringify(r.payload)}`);
  if (process.exitCode !== 1)
    console.log(`OK — ${label}: report ok (items=${r.items.length}, ref=${r.activityRef}, score=${r.score}/${r.maxScore})`);
}

let BASE;
const port = await new Promise(res => server.listen(0, () => res(server.address().port)));
BASE = `http://127.0.0.1:${port}`;
const launchOpts = {
  ...(process.env.PW_EXECUTABLE_PATH ? { executablePath: process.env.PW_EXECUTABLE_PATH } : {}),
  ...(process.env.PW_LAUNCH_ARGS ? { args: process.env.PW_LAUNCH_ARGS.split(' ').filter(Boolean) } : {}),
};
const browser = await chromium.launch(launchOpts);
const page = await browser.newPage();
await page.route(/\/hub\/supabase\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_SUPABASE }));
await page.route(/\/hub\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_CONFIG }));
await page.route(/\/hub\/hub-common\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_HUBCOMMON }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', e => fail('pageerror: ' + e.message));

try {
  // A-strand unit with a generator + an order-free question set.
  await runUnit(page, 'u08_lever (A, generator)', 'u08_lever',
    r => r.activityRef.startsWith('rika6/u08_lever/') && r.payload.strand === 'A' && r.payload.unitKey === 'u08_lever');

  // B-strand unit that contains an ORDER question (exercises the order path).
  await runUnit(page, 'u02_animal_body (B, order + generator)', 'u02_animal_body',
    r => r.activityRef.startsWith('rika6/u02_animal_body/') && r.payload.strand === 'B');

  // A-strand solutions unit (classification generator).
  await runUnit(page, 'u10_solutions (A, generator)', 'u10_solutions',
    r => r.activityRef.startsWith('rika6/u10_solutions/') && r.payload.strand === 'A');
} finally {
  await browser.close();
  server.close();
}
if (process.exitCode === 1) console.error('\nflow test FAILED');
else console.log('\nflow test PASSED');
