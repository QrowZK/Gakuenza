// tests/run.mjs — Gakuenza test runner. Zero-dependency for `syntax` and
// `unit`; `e2e` needs Playwright + a Chromium (see package.json / CI).
//
// Usage:
//   node tests/run.mjs syntax   # node --check every module JS + every test file
//   node tests/run.mjs unit     # run every tests/<key>/*.test.js (pure Node)
//   node tests/run.mjs e2e      # run every tests/<key>/flow.test.mjs (Playwright)
//   node tests/run.mjs all      # syntax, then unit, then e2e
//
// Env for e2e (honored by every flow.test.mjs):
//   PLAYWRIGHT_MODULE   module specifier to import (default 'playwright')
//   PW_EXECUTABLE_PATH  path to a Chromium binary (optional; else Playwright's own)
//   PW_LAUNCH_ARGS      space-separated launch args (CI sets '--no-sandbox')
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TESTS = __dirname;
const MODULES = path.join(ROOT, 'gakuenza.com', 'modules');

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (ent.name !== 'node_modules') walk(p, filter, out); }
    else if (filter(p)) out.push(p);
  }
  return out;
}

const rel = p => path.relative(ROOT, p);
function run(label, cmd, args, env) {
  process.stdout.write(`• ${label} … `);
  try {
    execFileSync(cmd, args, { stdio: 'pipe', env: { ...process.env, ...env }, timeout: 180000 });
    console.log('ok');
    return true;
  } catch (e) {
    console.log('FAIL');
    const out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
    if (out.trim()) console.log(out.trim().split('\n').map(l => '    ' + l).join('\n'));
    return false;
  }
}

function syntax() {
  const files = walk(MODULES, p => p.endsWith('.js'))
    .concat(walk(TESTS, p => p.endsWith('.test.js') || p.endsWith('.mjs')));
  let ok = true;
  for (const f of files) ok = run(rel(f), 'node', ['--check', f]) && ok;
  return ok;
}
function unit() {
  const files = walk(TESTS, p => p.endsWith('.test.js')).sort();
  if (!files.length) { console.log('(no unit tests found)'); return true; }
  let ok = true;
  for (const f of files) ok = run(rel(f), 'node', [f]) && ok;
  return ok;
}
function e2e() {
  const files = walk(TESTS, p => path.basename(p) === 'flow.test.mjs').sort();
  if (!files.length) { console.log('(no e2e tests found)'); return true; }
  let ok = true;
  for (const f of files) ok = run(rel(f), 'node', [f]) && ok;
  return ok;
}

const mode = process.argv[2] || 'all';
const steps = mode === 'all' ? ['syntax', 'unit', 'e2e'] : [mode];
const impl = { syntax, unit, e2e };
let allOk = true;
for (const s of steps) {
  if (!impl[s]) { console.error(`unknown mode: ${s}`); process.exit(2); }
  console.log(`\n=== ${s} ===`);
  allOk = impl[s]() && allOk;
}
console.log(`\n${allOk ? '✓ all passed' : '✗ failures'}`);
process.exit(allOk ? 0 : 1);
