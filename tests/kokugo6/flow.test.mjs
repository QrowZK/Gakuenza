// flow.test.mjs — headless end-to-end flow test for kokugo6.
// Run: node tests/kokugo6/flow.test.mjs   (needs playwright + chromium)
//
// Serves the site over HTTP, stubs the hub scripts (supabase/config/hub-common)
// so no real backend is needed, drives each mode (kanji / grammar) through the
// actual quiz UI to the result screen, and asserts the shared reporting helper
// HubCommon.reportActivityWithItems was called with the right module_id AND a
// populated per-question `items` array (activity_result_items) — the exact gap
// the shared-infra doc warns modules keep shipping.
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
      _table: table, _single: false,
      select: function(){ return b; }, eq: function(){ return b; },
      in: function(){ return b; }, limit: function(){ return b; },
      maybeSingle: function(){ b._single = true; return b; },
      then: function(resolve){ resolve(b._result()); },
      _result: function(){
        if (b._table === 'modules') return { data: { id: 'mod-kokugo6' }, error: null };
        if (b._table === 'enrollments') return { data: [{ class_id: 'cls-1', classes: { id: 'cls-1', school_id: 'sch-1' } }], error: null };
        if (b._table === 'class_modules') return { data: [], error: null };
        return { data: [], error: null };
      }
    };
    return b;
  }
  return { from: function(t){ return builder(t); }, auth: {} };
} };
`;
const STUB_CONFIG = `window.GAKUENZA_CONFIG = { supabaseUrl: 'https://stub.local', supabaseAnonKey: 'stub-anon' };`;
const STUB_HUBCOMMON = `
window.__reports = [];
window.HubCommon = {
  requireSession: async function(){ return { user: { id: 'user-1', email: 'kid@example.com' } }; },
  mountModuleAccount: function(){},
  reportActivityWithItems: async function(sb, args){ window.__reports.push(args); return { ok: true }; }
};
`;

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 1; }

async function runMode(page, label, openSteps, expect) {
  await page.evaluate(() => { window.__reports = []; });
  await page.goto(BASE + '/modules/kokugo6/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#btn-mode-kanji');
  await openSteps(page);
  let answered = 0;
  while (answered < 40) {
    const done = await page.evaluate(() => document.getElementById('view-result').style.display === 'block');
    if (done) break;
    await page.waitForSelector('.k6-opt:not(:disabled)');
    await page.click('.k6-opt:not(:disabled)');
    answered++;
    await page.waitForFunction(() =>
      document.getElementById('view-result').style.display === 'block' ||
      document.querySelectorAll('.k6-opt:not(:disabled)').length > 0
    );
  }
  await page.waitForSelector('#view-result', { state: 'visible' });
  const expectedItems = answered;
  const reports = await page.evaluate(() => window.__reports);
  if (reports.length !== 1) return fail(`${label}: expected 1 report, got ${reports.length}`);
  const r = reports[0];
  if (r.moduleId !== 'mod-kokugo6') fail(`${label}: wrong moduleId ${r.moduleId}`);
  if (!Array.isArray(r.items) || r.items.length !== expectedItems) fail(`${label}: items not populated (${r.items && r.items.length}, expected ${expectedItems})`);
  const badItem = (r.items || []).find(it => !it.itemRef || typeof it.correct !== 'boolean' || !it.prompt);
  if (badItem) fail(`${label}: malformed item ${JSON.stringify(badItem)}`);
  if (typeof r.score !== 'number' || r.maxScore !== expectedItems) fail(`${label}: score/maxScore wrong ${r.score}/${r.maxScore}`);
  if (!expect(r)) fail(`${label}: activityRef/payload check failed :: ${r.activityRef} ${JSON.stringify(r.payload)}`);
  if (process.exitCode !== 1) console.log(`OK — ${label}: report ok (moduleId=${r.moduleId}, items=${r.items.length}, ref=${r.activityRef})`);
}

let BASE;
const port = await new Promise(res => server.listen(0, () => res(server.address().port)));
BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(/\/hub\/supabase\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_SUPABASE }));
await page.route(/\/hub\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_CONFIG }));
await page.route(/\/hub\/hub-common\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: STUB_HUBCOMMON }));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', e => fail('pageerror: ' + e.message));

try {
  await runMode(page, 'kanji',
    async p => { await p.click('#btn-mode-kanji'); },
    r => r.activityRef.startsWith('kokugo6/kanji/') && r.payload.mode === 'kanji');

  for (const unit of ['keigo', 'jukugo', 'goshu', 'yoji']) {
    await runMode(page, `grammar:${unit}`,
      async p => {
        await p.click('#btn-mode-grammar');
        await p.click(`[data-gunit="${unit}"]`);
      },
      r => r.activityRef.startsWith(`kokugo6/grammar/${unit}/`) && r.payload.mode === 'grammar' && r.payload.unit === unit);
  }
} finally {
  await browser.close();
  server.close();
}
if (process.exitCode === 1) console.error('\nflow test FAILED');
else console.log('\nflow test PASSED');
