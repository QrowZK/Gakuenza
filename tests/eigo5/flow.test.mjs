// flow.test.mjs — headless end-to-end flow test for eigo5.
// Run: node tests/eigo5/flow.test.mjs   (requires playwright + chromium)
//
// Serves the site over HTTP, stubs the hub scripts (supabase/config/hub-common)
// so no real backend is needed, drives a unit through the actual quiz UI
// (menu → mode → answer every question → results), and asserts that the shared
// reporting helper HubCommon.reportActivityWithItems was called with the right
// module_id AND a fully-populated per-question `items` array — the exact gap the
// ported nh6/nhvocab apps ship (CLAUDE.md hard rule 2).
//
// The module keeps `state` in a closure, so we wrap Eigo5Gen's builders via
// addInitScript to stash each produced question (with its correctIndex) in a
// queue; that queue is in the SAME order app.js consumes, so we can click the
// correct choice for every question and confirm score === maxScore.
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
      maybeSingle: function(){ return b; }, single: function(){ return b; },
      insert: function(){ return b; },
      then: function(resolve){ resolve(b._result()); },
      _result: function(){
        if (b._table === 'modules') return { data: { id: 'mod-eigo5' }, error: null };
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
} };`;
const STUB_CONFIG = `window.GAKUENZA_CONFIG = { supabaseUrl: 'https://stub.local', supabaseAnonKey: 'stub-anon' };`;
const STUB_HUBCOMMON = `
window.__reports = [];
window.HubCommon = {
  reportActivityWithItems: async function(sb, args){ window.__reports.push(args); return { ok: true }; }
};`;

function fail(msg) { console.error('FAIL:', msg); process.exitCode = 1; }

async function runUnit(page, label, unitIndex, modeIndex, mode, expectN) {
  await page.goto(BASE + '/modules/eigo5/index.html', { waitUntil: 'networkidle' });
  await page.waitForSelector('#unitList .eg-unit-row');
  await page.evaluate(() => { window.__reports = []; window.__pq = []; });

  // Open the unit whose row is labelled "Unit <n>". (Post-redesign the unit
  // list holds only real unit rows; the "all" set moved to #challengeBtn.)
  const opened = await page.evaluate((num) => {
    const rows = Array.from(document.querySelectorAll('#unitList .eg-unit-row'));
    const row = rows.find(r => {
      const n = r.querySelector('.eg-unit-num');
      return n && n.textContent.trim() === 'Unit ' + num;
    });
    if (!row) return false;
    row.click();
    return true;
  }, unitIndex);
  if (!opened) return fail(`${label}: could not open unit ${unitIndex}`);

  await page.waitForSelector('#screen-mode.active');
  // Pick the mode card matching `mode`.
  const modeOk = await page.evaluate((wantMode) => {
    const cards = Array.from(document.querySelectorAll('#modeGrid .eg-mode-card'));
    const labels = { en2ja: '英語 → 日本語', ja2en: '日本語 → 英語', sentence: '文の練習' };
    const btn = cards.find(c => c.querySelector('.eg-mode-label') && c.querySelector('.eg-mode-label').textContent === labels[wantMode]);
    if (!btn) return false;
    btn.click();
    return true;
  }, mode);
  if (!modeOk) return fail(`${label}: mode "${mode}" card not found`);

  await page.waitForSelector('#screen-quiz.active');

  // The stashed queue __pq now holds this session's questions in order.
  // Post-redesign: answering shows inline feedback + a manual 「次へ」 (#nextBtn)
  // advance (no auto-advance), so click the correct choice then #nextBtn.
  let answered = 0;
  while (answered < 40) {
    const done = await page.evaluate(() => document.getElementById('screen-results').classList.contains('active'));
    if (done) break;
    const ci = await page.evaluate((i) => (window.__pq[i] ? window.__pq[i].correctIndex : null), answered);
    if (ci == null) return fail(`${label}: no stashed question at index ${answered}`);
    const clicked = await page.evaluate((idx) => {
      const btn = document.querySelector('#choicesGrid .choice-btn[data-idx="' + idx + '"]');
      if (!btn) return false;
      btn.click();
      return true;
    }, ci);
    if (!clicked) return fail(`${label}: correct choice button [${ci}] not found at q${answered}`);
    answered++;
    await page.waitForSelector('#feedbackRow:not(.hidden)', { timeout: 3000 }).catch(() => {});
    await page.evaluate(() => { const n = document.getElementById('nextBtn'); if (n) n.click(); });
    await page.waitForTimeout(120);
  }

  await page.waitForSelector('#screen-results.active');
  const reports = await page.evaluate(() => window.__reports);
  if (reports.length !== 1) return fail(`${label}: expected 1 report, got ${reports.length}`);
  const r = reports[0];
  if (r.moduleId !== 'mod-eigo5') fail(`${label}: wrong moduleId ${r.moduleId}`);
  if (r.schoolId !== 'sch-1' || r.classId !== 'cls-1') fail(`${label}: wrong school/class`);
  if (!Array.isArray(r.items) || r.items.length !== expectN) fail(`${label}: items not populated (${r.items && r.items.length}, want ${expectN})`);
  const bad = (r.items || []).find(it => !it.itemRef || typeof it.correct !== 'boolean' || !it.prompt || !it.category || it.correctAnswer == null);
  if (bad) fail(`${label}: malformed item ${JSON.stringify(bad)}`);
  if (r.maxScore !== expectN) fail(`${label}: maxScore ${r.maxScore} want ${expectN}`);
  if (r.score !== expectN) fail(`${label}: expected all-correct ${expectN}, got ${r.score}`);
  if (!String(r.activityRef).startsWith('eigo5/')) fail(`${label}: activityRef ${r.activityRef}`);
  if (process.exitCode !== 1) console.log(`OK — ${label}: report ok (items=${r.items.length}, score=${r.score}/${r.maxScore}, ref=${r.activityRef})`);
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

// Wrap Eigo5Gen builders so every produced question is stashed in order.
await page.addInitScript(() => {
  const iv = setInterval(() => {
    if (window.Eigo5Gen && !window.__probeInstalled) {
      window.__probeInstalled = true;
      window.__pq = [];
      const wrap = (fn) => function () {
        const q = fn.apply(this, arguments);
        window.__pq.push({ correctIndex: q.correctIndex, answer: q.answer });
        return q;
      };
      window.Eigo5Gen.buildVocabQuestion = wrap(window.Eigo5Gen.buildVocabQuestion);
      window.Eigo5Gen.buildSentenceQuestion = wrap(window.Eigo5Gen.buildSentenceQuestion);
      clearInterval(iv);
    }
  }, 5);
});

try {
  // Unit 2 (months) en2ja — 15 words -> full session of 10.
  await runUnit(page, 'u02_en2ja', 2, 0, 'en2ja', 10);
  // Unit 1 ja2en — 12 words -> 10.
  await runUnit(page, 'u01_ja2en', 1, 1, 'ja2en', 10);
  // Unit 5 sentence — 11 items (deepened, #162) -> full session of 10, same
  // cap as the vocab modes above. (Was 5 items -> 5 before the depth fill.)
  await runUnit(page, 'u05_sentence', 5, 2, 'sentence', 10);
} finally {
  await browser.close();
  server.close();
}
if (process.exitCode === 1) console.error('\nflow test FAILED');
else console.log('\nflow test PASSED');
