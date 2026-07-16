// flow.test.mjs — headless end-to-end flow test for rika5.
// Run: node flow.test.mjs   (requires playwright + chromium already installed;
// set PLAYWRIGHT_MODULE to point at a non-local playwright install if needed).
//
// Serves the site over HTTP, stubs the hub scripts (supabase/config/hub-common)
// so no real backend is needed, drives a B-strand unit (authored only) AND an
// A-strand unit (authored + generated) through the actual menu → lesson → drill
// → review UI, and asserts the shared reporting helper
// HubCommon.reportActivityWithItems was called with the right module_id AND a
// populated per-question `items` array (activity_result_items) — the exact gap
// the shared-infra doc warns modules keep shipping (hand-rolled inserts that
// never write the item rows).
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
        if (b._table === 'modules') return { data: { id: 'mod-rika5' }, error: null };
        if (b._table === 'enrollments') return { data: [{ class_id: 'cls-1', classes: { id: 'cls-1', school_id: 'sch-1' } }], error: null };
        if (b._table === 'class_modules') return { data: [], error: null };
        return { data: [], error: null };
      }
    };
    return b;
  }
  return {
    from: function(t){ return builder(t); },
    auth: { getSession: async function(){ return { data: { session: { user: { id: 'user-1' } } } }; }, signOut: async function(){} }
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

// Drive one unit (by its data-unit key) from the menu to the review screen,
// answering every question, and validate the single emitted report.
async function runUnit(page, label, unitKey, expect) {
  await page.goto(BASE + '/modules/rika5/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { window.__reports = []; });
  await page.waitForSelector('.unit-card[data-unit="' + unitKey + '"]');
  await page.click('.unit-card[data-unit="' + unitKey + '"]');

  // Lesson screen appears first (every unit has a lesson) — skip to the drill.
  await page.waitForSelector('#screen-lesson.active');
  await page.click('#lessonSkip');
  await page.waitForSelector('#screen-drill.active');

  let answered = 0;
  while (answered < 30) {
    const onReview = await page.evaluate(() => document.getElementById('screen-review').classList.contains('active'));
    if (onReview) break;

    // Order question? (order UI visible) — tap the pool chips in the correct
    // order using the app's known-correct sequence, then 答え合わせ.
    const isOrder = await page.evaluate(() => !document.getElementById('orderArea').hidden);
    if (isOrder) {
      const correct = await page.evaluate(() => window.__rika5Test.state.questions[window.__rika5Test.state.qIdx].items);
      for (const item of correct) {
        await page.click('xpath=//div[@id="orderPool"]//button[normalize-space(.)="' + item + '"]');
      }
      await page.click('#checkBtn');
    } else {
      await page.waitForSelector('#choiceArea .choice-btn:not(:disabled)');
      // Click the known-correct option (from the exposed test state) so this is
      // a deterministic all-correct run — which also verifies grading maps the
      // answer text to the right button.
      const answer = await page.evaluate(() => window.__rika5Test.state.questions[window.__rika5Test.state.qIdx].answer);
      await page.click('xpath=//div[@id="choiceArea"]//button[normalize-space(.)=' + JSON.stringify(answer) + ']');
    }
    answered++;
    await page.waitForSelector('#nextBtn:not([hidden])');
    await page.click('#nextBtn');
  }

  await page.waitForSelector('#screen-review.active');
  const reports = await page.evaluate(() => window.__reports);
  if (reports.length !== 1) return fail(`${label}: expected 1 report, got ${reports.length}`);
  const r = reports[0];
  if (r.moduleId !== 'mod-rika5') fail(`${label}: wrong moduleId ${r.moduleId}`);
  if (!Array.isArray(r.items) || r.items.length !== answered)
    fail(`${label}: items not populated (${r.items && r.items.length}, expected ${answered})`);
  const badItem = (r.items || []).find(it => !it.itemRef || typeof it.correct !== 'boolean' || !it.prompt || !it.correctAnswer);
  if (badItem) fail(`${label}: malformed item ${JSON.stringify(badItem)}`);
  if (typeof r.score !== 'number' || r.maxScore !== answered) fail(`${label}: score/maxScore wrong ${r.score}/${r.maxScore}`);
  if (r.score !== answered) fail(`${label}: expected all-correct run to score ${answered}, got ${r.score}`);
  if (!expect(r)) fail(`${label}: activityRef/payload check failed :: ${r.activityRef} ${JSON.stringify(r.payload)}`);
  if (process.exitCode !== 1)
    console.log(`OK — ${label}: report ok (moduleId=${r.moduleId}, items=${r.items.length}, score=${r.score}/${r.maxScore}, ref=${r.activityRef})`);
}

let BASE;
const port = await new Promise(res => server.listen(0, () => res(server.address().port)));
BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
);
const page = await browser.newPage();
await page.route(/\/hub\/supabase\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_SUPABASE }));
await page.route(/\/hub\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_CONFIG }));
await page.route(/\/hub\/hub-common\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_HUBCOMMON }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', e => fail('pageerror: ' + e.message));

try {
  // B-strand: authored-only unit with an order question (u01_weather).
  await runUnit(page, 'B:u01_weather', 'u01_weather',
    r => r.activityRef.startsWith('rika5/u01_weather/') && r.payload.strand === 'B' && r.payload.unitKey === 'u01_weather');

  // A-strand: authored + generated pool (u10_pendulum — the new control-the-
  // variables generator). Confirms generated questions flow through reporting.
  await runUnit(page, 'A:u10_pendulum', 'u10_pendulum',
    r => r.activityRef.startsWith('rika5/u10_pendulum/') && r.payload.strand === 'A' && r.payload.unitKey === 'u10_pendulum');

  // A-strand: dissolving (comparative solubility generator).
  await runUnit(page, 'A:u07_dissolving', 'u07_dissolving',
    r => r.activityRef.startsWith('rika5/u07_dissolving/') && r.payload.strand === 'A');
} finally {
  await browser.close();
  server.close();
}
if (process.exitCode === 1) console.error('\nflow test FAILED');
else console.log('\nflow test PASSED');
