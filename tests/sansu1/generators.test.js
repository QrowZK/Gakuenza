// Stress test for sansu1 generators — run with: node test-generators.js
// Asserts, over thousands of instances per section:
//  - every problem has required fields (tid, category, q, kind, exp)
//  - typed: canonical answer passes the module's own isCorrect()
//  - choice: correctChoice ∈ choices, appears exactly once, and NO distractor
//    is secretly also correct (the distractor-collision bug class)
//  - numeric-ish answers are well-formed
'use strict';

// ---- load generators.js in a minimal window shim ----
const fs = require('fs');
const path = require('path');
const window = {};
global.window = window;
const code = fs.readFileSync(path.join(__dirname, '../../gakuenza.com/modules/sansu1/generators.js'), 'utf8');
new Function('window', code)(window);

// ---- replicate app.js normalize/isCorrect (test-the-actual-thing) ----
function normalize(s) {
  if (s == null) return '';
  let t = String(s).normalize('NFKC').trim();
  t = t.replace(/[\s　]+/g, '');
  t = t.replace(/[。、．，.,!！?？]+$/g, '');
  t = t.replace(/,/g, '');
  t = t.replace(/[ァ-ヶ]/g, function (ch) {
    return String.fromCharCode(ch.charCodeAt(0) - 0x60);
  });
  return t.toLowerCase();
}
function isCorrect(userInput, accepted, unitSuffix) {
  const u = normalize(userInput);
  if (!u) return false;
  for (let i = 0; i < accepted.length; i++) {
    const a = normalize(accepted[i]);
    if (a === u) return true;
    if (unitSuffix && normalize(String(accepted[i]) + unitSuffix) === u) return true;
  }
  return false;
}

const UNITS = window.SANSU1_DATA.UNITS;
const PER = 4000;
let errors = [];
let counts = {};

function checkProblem(sec, p) {
  const where = sec.id + ' [' + (p.tid || '?') + ']';
  ['tid', 'category', 'q', 'kind', 'exp'].forEach(function (k) {
    if (p[k] == null || p[k] === '') errors.push(where + ': missing ' + k);
  });
  if (p.kind === 'typed') {
    if (!Array.isArray(p.accepted) || !p.accepted.length) {
      errors.push(where + ': typed missing accepted[]');
      return;
    }
    // canonical answer must pass its own checker
    if (!isCorrect(p.answer, p.accepted, p.unitSuffix)) {
      errors.push(where + ': canonical answer "' + p.answer + '" fails isCorrect (accepted=' + JSON.stringify(p.accepted) + ')');
    }
    // answers here are all non-negative integers or simple strings; sanity
    if (/^-/.test(String(p.answer))) errors.push(where + ': negative answer ' + p.answer);
  } else if (p.kind === 'choice') {
    if (!Array.isArray(p.choices) || p.choices.length < 2) {
      errors.push(where + ': choice needs >=2 choices');
      return;
    }
    const cc = String(p.correctChoice);
    const occurrences = p.choices.filter(function (c) { return String(c) === cc; }).length;
    if (occurrences !== 1) {
      errors.push(where + ': correctChoice "' + cc + '" appears ' + occurrences + 'x in ' + JSON.stringify(p.choices));
    }
    // distractor-collision: no two identical options
    const seen = {};
    p.choices.forEach(function (c) {
      const k = normalize(c);
      if (seen[k]) errors.push(where + ': duplicate option "' + c + '" in ' + JSON.stringify(p.choices));
      seen[k] = true;
    });
  } else {
    errors.push(where + ': unknown kind ' + p.kind);
  }
}

// Semantic "is this distractor secretly also correct?" checks for the
// comparison/number families, where the bug class actually lives: any option
// that is NOT the correct one must be a strictly worse answer to the literal
// question. We re-derive the truth from the question text.
function semanticCompareCheck(sec, p) {
  if (p.kind !== 'choice') return;
  // "A と B では、どちらが おおきいですか。" — correct must be max(A,B)
  let m = p.q.match(/^(\d+) と (\d+) では、どちらが おおきいですか/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === b) { errors.push(sec.id + ': compare emitted a tie ' + a); return; }
    const truth = String(Math.max(a, b));
    if (String(p.correctChoice) !== truth) errors.push(sec.id + ': compare wrong correct ' + p.q + ' -> ' + p.correctChoice);
    p.choices.forEach(function (c) {
      if (String(c) !== truth && +c === Math.max(a, b)) errors.push(sec.id + ': compare distractor also-correct ' + p.q);
    });
  }
}

UNITS.forEach(function (u) {
  u.sections.forEach(function (sec) {
    for (let i = 0; i < PER; i++) {
      const p = sec.gen();
      counts[sec.id + '/' + p.tid] = (counts[sec.id + '/' + p.tid] || 0) + 1;
      checkProblem(sec, p);
      semanticCompareCheck(sec, p);
    }
  });
});

console.log('Sections tested:', UNITS.reduce(function (a, u) { return a + u.sections.length; }, 0));
console.log('Instances per section:', PER);
console.log('Distinct (section/tid) templates exercised:', Object.keys(counts).length);
Object.keys(counts).sort().forEach(function (k) { console.log('  ' + k + ': ' + counts[k]); });

if (errors.length) {
  console.error('\nFAILURES (' + errors.length + '):');
  // de-dup for readability
  const uniq = Array.from(new Set(errors));
  uniq.slice(0, 60).forEach(function (e) { console.error('  - ' + e); });
  if (uniq.length > 60) console.error('  ... and ' + (uniq.length - 60) + ' more unique');
  process.exit(1);
} else {
  console.log('\nALL CHECKS PASSED ✓');
}
