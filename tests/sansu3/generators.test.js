// generators.test.js — structural + distractor-collision stress test for sansu3.
// Run: node tests/sansu3/generators.test.js
//
// Asserts the invariants CLAUDE.md's testing bar calls out, at scale:
//   - every generated problem has the required fields (tid, category, q,
//     kind, exp) and a well-formed shape for its kind ('typed' | 'choice')
//   - typed: the generator's own declared canonical answer PASSES
//     SANSU3_CHECK.isCorrect (test-the-actual-checker, not a re-implementation)
//     AND a clearly-wrong value FAILS it (checker is sound, not a rubber stamp)
//   - choice: correctChoice appears in choices exactly once, choices are
//     distinct (both exact-string AND normalized-form, to catch formatting-
//     only "duplicates"), and — the actual bug class CLAUDE.md calls out —
//     no distractor is secretly ALSO correct. For the three "which is
//     bigger" comparison families (big-compare / dec-compare / frac-compare)
//     we re-derive the true answer from the question text itself and check
//     the generator's correctChoice against ground truth, not against its
//     own claim.
//   - unit keys declared in generators.js UNITS match modules/sansu3/units.js
//     (window.MODULE_UNITS.sansu3) exactly — same set, same count.
'use strict';

const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/sansu3');

// ---- load sansu3 globals in a minimal window/document shim ----
const window = {};
global.window = window;
// app.js registers SANSU3_CHECK at top level, then (harmlessly, since it's a
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

const UNITS = window.SANSU3_DATA.UNITS;
const MODULE_UNITS = window.MODULE_UNITS && window.MODULE_UNITS.sansu3;
const CHECK = window.SANSU3_CHECK;

const errors = [];
const fail = (m) => errors.push(m);

// ── Data integrity: unit keys ───────────────────────────────────────────────
if (!Array.isArray(MODULE_UNITS) || !MODULE_UNITS.length) {
  fail('units.js did not register window.MODULE_UNITS.sansu3');
}
if (!CHECK || typeof CHECK.isCorrect !== 'function' || typeof CHECK.normalize !== 'function') {
  fail('app.js did not expose window.SANSU3_CHECK.{isCorrect,normalize}');
}

function unitKey(u) { return 'u' + String(u.num).padStart(2, '0'); }
const genUnitKeys = new Set(UNITS.map(unitKey));
const declaredKeys = new Set((MODULE_UNITS || []).map((u) => u.key));
if (genUnitKeys.size !== declaredKeys.size) {
  fail(`unit key count mismatch: generators.js has ${genUnitKeys.size}, units.js has ${declaredKeys.size}`);
}
genUnitKeys.forEach((k) => { if (!declaredKeys.has(k)) fail(`generators.js unit ${k} missing from units.js MODULE_UNITS`); });
declaredKeys.forEach((k) => { if (!genUnitKeys.has(k)) fail(`units.js declares ${k} which no generators.js unit has`); });

// ── Wrong-value probe for the typed-answer checker soundness test ──────────
// Deliberately not derived from any accepted[] value or unitSuffix, and
// contains no digits/letters that could coincidentally normalize into a
// legitimate accepted form.
const OBVIOUSLY_WRONG = '★NOT_AN_ANSWER★';

// ── Semantic ground-truth re-derivation for the "which is bigger" families ──
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
  const m = p.q.match(/^(\d+\.\d) と (\d+\.\d) では、どちらが大きいですか。/);
  if (!m) { fail(`${sec.id} [${p.tid}]: dec-compare q didn't match expected pattern: ${p.q}`); return; }
  const a = parseFloat(m[1]), b = parseFloat(m[2]);
  if (a === b) fail(`${sec.id} [${p.tid}]: compare emitted a tie ${a}`);
  const truth = a > b ? m[1] : m[2];
  if (p.correctChoice !== truth) fail(`${sec.id} [${p.tid}]: wrong correctChoice for ${p.q} -> got "${p.correctChoice}", truth "${truth}"`);
}
function fracVal(tok) {
  if (tok === '1') return 1;
  const parts = tok.split('/');
  if (parts.length !== 2) return NaN;
  return Number(parts[0]) / Number(parts[1]);
}
function checkFracCompare(sec, p) {
  const m = p.q.match(/^(\S+) と (\S+) では、どちらが大きいですか。/);
  if (!m) { fail(`${sec.id} [${p.tid}]: frac-compare q didn't match expected pattern: ${p.q}`); return; }
  const a = fracVal(m[1]), b = fracVal(m[2]);
  if (Number.isNaN(a) || Number.isNaN(b)) { fail(`${sec.id} [${p.tid}]: couldn't parse fraction tokens "${m[1]}"/"${m[2]}"`); return; }
  if (a === b) fail(`${sec.id} [${p.tid}]: compare emitted a tie ${m[1]}=${m[2]}`);
  const truth = a > b ? m[1] : m[2];
  if (p.correctChoice !== truth) fail(`${sec.id} [${p.tid}]: wrong correctChoice for ${p.q} -> got "${p.correctChoice}", truth "${truth}"`);
}
const SEMANTIC_CHECKS = {
  'big-compare': checkBigCompare,
  'dec-compare': checkDecCompare,
  'frac-compare': checkFracCompare,
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
    if (!CHECK) return;
    // the generator's own canonical answer must pass its own checker
    if (!CHECK.isCorrect(p.answer, p.accepted, p.unitSuffix)) {
      fail(where + ': canonical answer "' + p.answer + '" fails SANSU3_CHECK.isCorrect (accepted=' + JSON.stringify(p.accepted) + ', unitSuffix=' + JSON.stringify(p.unitSuffix) + ')');
    }
    // checker soundness: a clearly-wrong value must NOT pass
    if (CHECK.isCorrect(OBVIOUSLY_WRONG, p.accepted, p.unitSuffix)) {
      fail(where + ': SANSU3_CHECK.isCorrect accepted a bogus value "' + OBVIOUSLY_WRONG + '" (accepted=' + JSON.stringify(p.accepted) + ')');
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

// ── Drive every section's generator hundreds of times ───────────────────────
const PER = 600;
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
console.log('sansu3 generator stress test');
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
