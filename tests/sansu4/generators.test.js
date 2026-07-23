// generators.test.js — structural + distractor-collision stress test for sansu4.
// Run: node tests/sansu4/generators.test.js
//
// Asserts the invariants CLAUDE.md's testing bar calls out, at scale:
//   - every generated problem has the required fields (tid, category, q,
//     kind, exp) and a well-formed shape for its kind ('typed' | 'choice')
//   - typed: the generator's own declared canonical answer PASSES
//     SANSU4_CHECK.isCorrect (test-the-actual-checker, not a re-implementation)
//     AND a clearly-wrong value FAILS it (checker is sound, not a rubber stamp)
//   - choice: correctChoice appears in choices exactly once, choices are
//     distinct (both exact-string AND normalized-form, to catch formatting-
//     only "duplicates"), and — the actual bug class CLAUDE.md calls out —
//     no distractor is secretly ALSO correct. Ground truth is re-derived
//     independently of the generator's own claim for every choice-kind tid
//     that has one (big-compare / dec-compare / calc-distrib / line-change).
//   - unit keys declared in generators.js UNITS (window.SANSU4_DATA.UNITS)
//     match modules/sansu4/units.js (window.MODULE_UNITS.sansu4) exactly,
//     modulo the intentionally-excluded mixed-review unit (u15_review).
'use strict';

const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/sansu4');

// ---- load sansu4 globals in a minimal window/document shim ----
const window = {};
global.window = window;
// app.js registers SANSU4_CHECK at top level, then (harmlessly, since it's a
// no-op here) registers a DOMContentLoaded listener — stub just enough of
// `document` for that final call not to throw. Nothing else in app.js runs
// at load time; all other document use is inside functions we never invoke.
global.document = { addEventListener: function () {} };

function loadScript(rel) {
  const code = fs.readFileSync(path.join(base, rel), 'utf8');
  new Function('window', 'document', code)(window, global.document);
}
loadScript('generators.js');
loadScript('units.js');
loadScript('app.js');

const UNITS = window.SANSU4_DATA && window.SANSU4_DATA.UNITS;
const MODULE_UNITS = window.MODULE_UNITS && window.MODULE_UNITS.sansu4;
const CHECK = window.SANSU4_CHECK;

const errors = [];
const fail = (m) => errors.push(m);

if (!Array.isArray(UNITS) || !UNITS.length) {
  console.error('FATAL: window.SANSU4_DATA.UNITS did not load');
  process.exit(1);
}

// ── Data integrity: unit keys ───────────────────────────────────────────────
if (!Array.isArray(MODULE_UNITS) || !MODULE_UNITS.length) {
  fail('units.js did not register window.MODULE_UNITS.sansu4');
}
if (!CHECK || typeof CHECK.isCorrect !== 'function' || typeof CHECK.normalize !== 'function') {
  fail('app.js did not expose window.SANSU4_CHECK.{isCorrect,normalize}');
}

// u15_review (4年のまとめ) is intentionally excluded from units.js — see its
// own header comment — so exclude it here too rather than flag a mismatch.
const genUnitKeys = new Set(UNITS.filter((u) => u.key !== 'u15_review').map((u) => u.key));
const declaredKeys = new Set((MODULE_UNITS || []).map((u) => u.key));
if (genUnitKeys.size !== declaredKeys.size) {
  fail(`unit key count mismatch: generators.js (excl. review) has ${genUnitKeys.size}, units.js has ${declaredKeys.size}`);
}
genUnitKeys.forEach((k) => { if (!declaredKeys.has(k)) fail(`generators.js unit ${k} missing from units.js MODULE_UNITS`); });
declaredKeys.forEach((k) => { if (!genUnitKeys.has(k)) fail(`units.js declares ${k} which no generators.js unit has`); });
if (!UNITS.some((u) => u.key === 'u15_review')) {
  fail('expected a u15_review (mixed review) unit in generators.js but did not find one');
}

// ── Wrong-value probe for the typed-answer checker soundness test ──────────
// Deliberately not derived from any accepted[] value or unitSuffix, and
// contains no digits/letters that could coincidentally normalize into a
// legitimate accepted form.
const OBVIOUSLY_WRONG = '★NOT_AN_ANSWER★';

// ── Semantic ground-truth re-derivation ─────────────────────────────────────
// (the exact bug class CLAUDE.md's kanji generator shipped twice: a "wrong"
// option that's secretly also correct.)
function checkBigCompare(sec, p) {
  const m = p.q.match(/^([\d,]+) と ([\d,]+) では、どちらが大きいですか。/);
  if (!m) { fail(`${sec.id} [${p.tid}]: big-compare q didn't match expected pattern: ${p.q}`); return; }
  const a = Number(m[1].replace(/,/g, '')), b = Number(m[2].replace(/,/g, ''));
  if (a === b) fail(`${sec.id} [${p.tid}]: compare emitted a tie ${a}`);
  const truth = a > b ? m[1] : m[2];
  if (p.correctChoice !== truth) fail(`${sec.id} [${p.tid}]: wrong correctChoice for ${p.q} -> got "${p.correctChoice}", truth "${truth}"`);
}
function checkDecCompare(sec, p) {
  const m = p.q.match(/^([\d.]+) と ([\d.]+) では、どちらが大きいですか。/);
  if (!m) { fail(`${sec.id} [${p.tid}]: dec-compare q didn't match expected pattern: ${p.q}`); return; }
  const a = parseFloat(m[1]), b = parseFloat(m[2]);
  if (a === b) fail(`${sec.id} [${p.tid}]: compare emitted a tie ${a}`);
  const truth = a > b ? m[1] : m[2];
  if (p.correctChoice !== truth) fail(`${sec.id} [${p.tid}]: wrong correctChoice for ${p.q} -> got "${p.correctChoice}", truth "${truth}"`);
}

// Small precedence-aware evaluator for the calc-distrib candidate expression
// strings (e.g. "20×3 ＋ 5×3", "(20−5)×3") so we can independently verify the
// generator's own filter (`x.v !== target`) actually matches what the
// rendered string says, rather than trusting the generator's internal number.
function evalExpr(str) {
  const t = str.replace(/×/g, '*').replace(/＋/g, '+').replace(/[−－]/g, '-').replace(/\s+/g, '');
  let i = 0;
  function num() {
    const start = i;
    while (i < t.length && /[0-9]/.test(t[i])) i++;
    if (start === i) throw new Error('bad expr: ' + str);
    return Number(t.slice(start, i));
  }
  function factor() {
    if (t[i] === '(') { i++; const v = expr(); i++; return v; }
    return num();
  }
  function term() {
    let v = factor();
    while (t[i] === '*') { i++; v *= factor(); }
    return v;
  }
  function expr() {
    let v = term();
    while (t[i] === '+' || t[i] === '-') { const op = t[i]; i++; const v2 = term(); v = op === '+' ? v + v2 : v - v2; }
    return v;
  }
  return expr();
}
function checkCalcDistrib(sec, p) {
  const m = p.q.match(/^(\d+) × (\d+) を、/);
  if (!m) { fail(`${sec.id} [${p.tid}]: calc-distrib q didn't match expected pattern: ${p.q}`); return; }
  const target = Number(m[1]) * Number(m[2]);
  let correctVal;
  try { correctVal = evalExpr(p.correctChoice); } catch (e) { fail(`${sec.id} [${p.tid}]: could not evaluate correctChoice "${p.correctChoice}": ${e.message}`); return; }
  if (correctVal !== target) fail(`${sec.id} [${p.tid}]: correctChoice "${p.correctChoice}" evaluates to ${correctVal}, expected ${target} (q=${p.q})`);
  p.choices.forEach((c) => {
    if (c === p.correctChoice) return;
    let v;
    try { v = evalExpr(c); } catch (e) { fail(`${sec.id} [${p.tid}]: could not evaluate distractor "${c}": ${e.message}`); return; }
    if (v === target) fail(`${sec.id} [${p.tid}]: distractor "${c}" evaluates to ${v}, secretly ALSO equal to target ${target} (q=${p.q})`);
  });
}

// line-change: re-derive which labeled segment has the biggest |Δvalue|
// straight from the rendered SVG (the polyline's y-coordinates are linear in
// the underlying value, so the segment with the biggest |Δy| IS the segment
// with the biggest |Δvalue| — no need to decode the y<->value scale).
function checkLineChange(sec, p) {
  const pathM = p.fig && p.fig.match(/<path d="([^"]+)" fill="none" stroke="#4a6b4f"/);
  if (!pathM) { fail(`${sec.id} [${p.tid}]: could not find polyline path in fig`); return; }
  const pts = [];
  const ptRe = /[ML]([\d.]+) ([\d.]+)/g;
  let pm;
  while ((pm = ptRe.exec(pathM[1]))) pts.push({ x: +pm[1], y: +pm[2] });
  const labelRe = /<text x="[\d.]+" y="222" font-size="12" text-anchor="middle" fill="#1c2530">([^<]*)<\/text>/g;
  const labels = [];
  let lm;
  while ((lm = labelRe.exec(p.fig))) labels.push(lm[1]);
  const xLabelM = p.fig.match(/<text x="[\d.]+" y="222" font-size="11" text-anchor="end" fill="#3a4555">\(([^)]*)\)<\/text>/);
  if (!xLabelM || labels.length !== pts.length || pts.length < 2) {
    fail(`${sec.id} [${p.tid}]: fig parse mismatch (pts=${pts.length}, labels=${labels.length})`);
    return;
  }
  const xLabel = xLabelM[1];
  const deltas = [];
  for (let i = 1; i < pts.length; i++) deltas.push(Math.abs(pts[i].y - pts[i - 1].y));
  let best = 0;
  for (let i = 1; i < deltas.length; i++) if (deltas[i] > deltas[best]) best = i;
  const bestPairStr = labels[best] + xLabel + '〜' + labels[best + 1] + xLabel;
  if (p.correctChoice !== bestPairStr) {
    fail(`${sec.id} [${p.tid}]: correctChoice mismatch, derived "${bestPairStr}" from fig but got "${p.correctChoice}" (q=${p.q})`);
  }
  // collision: no other rendered choice's segment may tie/near-tie the max delta
  const maxDelta = deltas[best];
  for (let i = 0; i < deltas.length; i++) {
    const pairStr = labels[i] + xLabel + '〜' + labels[i + 1] + xLabel;
    if (pairStr !== p.correctChoice && p.choices.includes(pairStr) && Math.abs(deltas[i] - maxDelta) < 0.15) {
      fail(`${sec.id} [${p.tid}]: distractor "${pairStr}" has a delta tying/near-tying the max (possible secretly-also-correct), q=${p.q}`);
    }
  }
}

const SEMANTIC_CHECKS = {
  'big-compare': checkBigCompare,
  'dec-compare': checkDecCompare,
  'calc-distrib': checkCalcDistrib,
  'line-change': checkLineChange,
};

// ── Per-problem structural check ────────────────────────────────────────────
function checkProblem(sec, p) {
  const where = sec.id + ' [' + (p.tid || '?') + ']';
  ['tid', 'category', 'q', 'kind', 'exp'].forEach((k) => {
    if (p[k] == null || p[k] === '') fail(where + ': missing ' + k);
  });
  if (p.fig != null && (typeof p.fig !== 'string' || !p.fig.startsWith('<svg'))) {
    fail(where + ': fig present but not an <svg> string');
  }

  if (p.kind === 'typed') {
    if (!Array.isArray(p.accepted) || !p.accepted.length) {
      fail(where + ': typed missing accepted[]');
      return;
    }
    if (p.inputMode === 'numeric' && !/^-?\d+$/.test(String(p.answer))) {
      fail(where + ': inputMode numeric but answer "' + p.answer + '" is not a plain integer');
    }
    if (!CHECK) return;
    // the generator's own canonical answer must pass its own checker
    if (!CHECK.isCorrect(p.answer, p.accepted, p.unitSuffix)) {
      fail(where + ': canonical answer "' + p.answer + '" fails SANSU4_CHECK.isCorrect (accepted=' + JSON.stringify(p.accepted) + ', unitSuffix=' + JSON.stringify(p.unitSuffix) + ')');
    }
    // checker soundness: a clearly-wrong value must NOT pass
    if (CHECK.isCorrect(OBVIOUSLY_WRONG, p.accepted, p.unitSuffix)) {
      fail(where + ': SANSU4_CHECK.isCorrect accepted a bogus value "' + OBVIOUSLY_WRONG + '" (accepted=' + JSON.stringify(p.accepted) + ')');
    }
  } else if (p.kind === 'choice') {
    if (!Array.isArray(p.choices) || p.choices.length < 2) {
      fail(where + ': choice needs >=2 choices');
      return;
    }
    const cc = String(p.correctChoice);
    const occurrences = p.choices.filter((c) => String(c) === cc).length;
    if (occurrences !== 1) {
      fail(where + ': correctChoice "' + cc + '" appears ' + occurrences + 'x in ' + JSON.stringify(p.choices));
    }
    // exact-string duplicate options
    const seenExact = new Set();
    p.choices.forEach((c) => {
      if (seenExact.has(c)) fail(where + ': duplicate option "' + c + '" in ' + JSON.stringify(p.choices));
      seenExact.add(c);
    });
    // normalized-form duplicate options (distractor-collision via formatting,
    // e.g. full/half-width or trailing-punctuation differences that would
    // read as "the same answer" to a student even though the strings differ)
    if (CHECK) {
      const seenNorm = {};
      p.choices.forEach((c) => {
        const k = CHECK.normalize(c);
        if (seenNorm[k]) fail(where + ': normalized-duplicate option "' + c + '" collides with another choice in ' + JSON.stringify(p.choices));
        seenNorm[k] = true;
      });
    }
    const semantic = SEMANTIC_CHECKS[p.tid];
    if (semantic) semantic(sec, p);
  } else {
    fail(where + ': unknown kind "' + p.kind + '"');
  }
}

// ── Drive every section's generator hundreds–thousands of times ────────────
const PER = 1200;
let totalProblems = 0;
const counts = {};

UNITS.forEach((u) => {
  u.sections.forEach((sec) => {
    for (let i = 0; i < PER; i++) {
      const p = sec.gen();
      totalProblems++;
      counts[sec.id + '/' + p.tid] = (counts[sec.id + '/' + p.tid] || 0) + 1;
      checkProblem(sec, p);
    }
  });
});

// ── Report ──────────────────────────────────────────────────────────────────
const sectionCount = UNITS.reduce((a, u) => a + u.sections.length, 0);
console.log('sansu4 generator stress test');
console.log('  units:              ' + UNITS.length);
console.log('  sections:           ' + sectionCount);
console.log('  instances/section:  ' + PER);
console.log('  total problems:     ' + totalProblems);
console.log('  distinct (section/tid) templates exercised: ' + Object.keys(counts).length);
Object.keys(counts).sort().forEach((k) => console.log('    ' + k + ': ' + counts[k]));

if (errors.length) {
  console.error('\nFAILED with ' + errors.length + ' error(s):');
  const uniq = Array.from(new Set(errors));
  uniq.slice(0, 60).forEach((e) => console.error('  - ' + e));
  if (uniq.length > 60) console.error('  ...and ' + (uniq.length - 60) + ' more unique');
  process.exitCode = 1;
} else {
  console.log('\nALL CHECKS PASSED');
}
