// generators.test.js — structural stress test for sansu5's problem generators.
// Run: node generators.test.js
//
// Loads generators.js + app.js under a minimal DOM shim and generates a large
// batch per section, asserting the invariants this project's own kanji
// generator has shipped bugs against twice:
//   - every typed problem's canonical answer passes its OWN SANSU5_CHECK.isCorrect
//   - a shown unit suffix is accepted; garbage / empty input is rejected
//   - every choice problem has 2..4 distinct options (binary yes/no & compare
//     questions are legitimately 2-option, like sansu4's comparison MCQs),
//     the correct option present exactly once, and NO distractor equal to it
//     (the "secretly-also-correct" distractor-collision bug)
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/sansu5');

function stubEl() {
  return {
    _text: '', innerHTML: '', hidden: false, value: '', disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {}, setAttribute() {}, addEventListener() {}, appendChild() {},
    querySelectorAll() { return []; }, focus() {},
    set textContent(v) { this._text = v; }, get textContent() { return this._text; },
  };
}
global.window = {};
global.document = { createElement: stubEl, getElementById: stubEl, querySelectorAll() { return []; }, addEventListener() {} };

eval(fs.readFileSync(path.join(base, 'generators.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'app.js'), 'utf8'));

const UNITS = window.SANSU5_DATA.UNITS;
const { isCorrect } = window.SANSU5_CHECK;

const PER = 4000;
const REQUIRED = ['tid', 'category', 'q', 'kind', 'exp'];
const errors = [];
let totalTyped = 0, totalChoice = 0, totalProblems = 0;

function checkProblem(p, secId) {
  totalProblems++;
  for (const k of REQUIRED) if (p[k] == null || p[k] === '') errors.push(`${secId} ${p.tid}: missing/empty "${k}"`);
  if (p.kind === 'typed') {
    totalTyped++;
    if (!Array.isArray(p.accepted) || !p.accepted.length) { errors.push(`${secId} ${p.tid}: no accepted[]`); return; }
    if (!isCorrect(p.answer, p.accepted, p.unitSuffix)) errors.push(`${secId} ${p.tid}: canonical "${p.answer}" fails its own checker (${JSON.stringify(p.accepted)})`);
    if (p.unitSuffix && !isCorrect(String(p.answer) + p.unitSuffix, p.accepted, p.unitSuffix)) errors.push(`${secId} ${p.tid}: answer+suffix rejected`);
    if (isCorrect('###zzz###', p.accepted, p.unitSuffix)) errors.push(`${secId} ${p.tid}: garbage accepted`);
    if (isCorrect('', p.accepted, p.unitSuffix)) errors.push(`${secId} ${p.tid}: empty accepted`);
  } else if (p.kind === 'choice') {
    totalChoice++;
    if (!Array.isArray(p.choices)) { errors.push(`${secId} ${p.tid}: no choices[]`); return; }
    if (p.choices.length < 2 || p.choices.length > 4) errors.push(`${secId} ${p.tid}: ${p.choices.length} choices (want 2-4)`);
    if (new Set(p.choices).size !== p.choices.length) errors.push(`${secId} ${p.tid}: duplicate choices ${JSON.stringify(p.choices)}`);
    const nCorrect = p.choices.filter(c => c === p.correctChoice).length;
    if (nCorrect !== 1) errors.push(`${secId} ${p.tid}: correct appears ${nCorrect}x`);
  } else {
    errors.push(`${secId} ${p.tid}: unknown kind "${p.kind}"`);
  }
}

for (const u of UNITS) for (const s of u.sections) for (let i = 0; i < PER; i++) {
  let p;
  try { p = s.gen(); } catch (e) { errors.push(`${s.id}: gen() threw: ${e.message}`); continue; }
  checkProblem(p, s.id);
}

console.log(`Problems: ${totalProblems} (typed=${totalTyped}, choice=${totalChoice}) over ${UNITS.reduce((a, u) => a + u.sections.length, 0)} sections × ${PER}`);
if (errors.length) {
  const uniq = [...new Set(errors)];
  console.log(`\nFAILURES (${errors.length} total, ${uniq.length} unique):`);
  uniq.slice(0, 60).forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
