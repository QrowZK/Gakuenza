// flow.test.mjs — headless end-to-end flow test for sansu1.
// Run: node flow.test.mjs   (requires playwright + chromium already installed)
//
// Serves the site over HTTP, stubs the hub scripts (supabase/config/hub-common)
// so no real backend is needed, drives real sections (a choice-based unit and a
// typed unit) through the actual menu→drill→review UI, and asserts the shared
// reporting helper HubCommon.reportActivityWithItems was called once with the
// right module_id AND a populated per-question `items` array
// (activity_result_items) with an activityRef shaped sansu1/<section>/<ts>.
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
        if (b._table === 'modules') return { data: { id: 'mod-sansu1' }, error: null };
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

async function runSection(page, base, sectionIndex, label) {
  await page.goto(base + '/modules/sansu1/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('.sec-btn');
  await page.evaluate(() => { window.__reports = []; });
  await page.locator('.sec-btn').nth(sectionIndex).click();
  await page.waitForSelector('#screen-drill.active');

  let answered = 0;
  while (answered < 20) {
    const done = await page.evaluate(() => document.getElementById('screen-review').classList.contains('active'));
    if (done) break;
    const isTyped = await page.evaluate(() => !document.getElementById('answerRow').hidden);
    if (isTyped) {
      await page.fill('#answerInput', '1');
      await page.click('#checkBtn');
    } else {
      await page.waitForSelector('.choice-btn:not([disabled])');
      await page.click('.choice-btn:not([disabled])');
    }
    answered++;
    await page.waitForSelector('#nextBtn:not([hidden])');
    await page.click('#nextBtn');
  }
  await page.waitForSelector('#screen-review.active');

  const reports = await page.evaluate(() => window.__reports);
  if (reports.length !== 1) return fail(`${label}: expected 1 report, got ${reports.length}`);
  const r = reports[0];
  if (r.moduleId !== 'mod-sansu1') fail(`${label}: wrong moduleId ${r.moduleId}`);
  if (r.schoolId !== 'sch-1' || r.classId !== 'cls-1') fail(`${label}: wrong school/class ${r.schoolId}/${r.classId}`);
  if (!Array.isArray(r.items) || r.items.length !== answered) fail(`${label}: items not populated (${r.items && r.items.length}, expected ${answered})`);
  const badItem = (r.items || []).find(it => !it.itemRef || typeof it.correct !== 'boolean' || !it.prompt || !it.category || it.correctAnswer == null);
  if (badItem) fail(`${label}: malformed item ${JSON.stringify(badItem)}`);
  if (typeof r.score !== 'number' || r.maxScore !== answered) fail(`${label}: score/maxScore wrong ${r.score}/${r.maxScore}`);
  if (!/^sansu1\/[^/]+\/\d+$/.test(r.activityRef || '')) fail(`${label}: bad activityRef ${r.activityRef}`);
  if (process.exitCode !== 1) console.log(`OK — ${label}: report ok (items=${r.items.length}, score=${r.score}/${r.maxScore}, ref=${r.activityRef})`);
}

const port = await new Promise(res => server.listen(0, () => res(server.address().port)));
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/\/hub\/supabase\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_SUPABASE }));
await page.route(/\/hub\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_CONFIG }));
await page.route(/\/hub\/hub-common\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_HUBCOMMON }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', e => fail('pageerror: ' + e.message));

try {
  // sansu1 has one section per unit. Exercise a typed unit, an all-choice
  // unit, and a mixed typed/choice unit.
  await runSection(page, BASE, 3, 'u04 たしざん(1) — typed');
  await runSection(page, BASE, 6, 'u07 なんじ・なんじはん — choice');
  await runSection(page, BASE, 0, 'u01 10までのかず — mixed');
  await runSection(page, BASE, 13, 'u14 いろいろなかたち — choice');
} finally {
  await browser.close();
  server.close();
}
if (process.exitCode === 1) console.error('\nflow test FAILED');
else console.log('\nflow test PASSED');
