// generators.test.js — structural stress test for sansu2's problem generators.
// Run: node tests/sansu2/generators.test.js
//
// Loads generators.js + app.js under a minimal DOM shim and generates a large
// batch per section, asserting the invariants this project's own kanji
// generator has shipped bugs against twice:
//   - every typed problem's canonical answer passes its OWN SANSU2_CHECK.isCorrect
//   - a shown unit suffix is accepted; garbage / empty input is rejected
//   - every choice problem has 2..4 distinct options (binary yes/no & compare
//     questions are legitimately 2-option, like sansu4's comparison MCQs),
//     the correct option present exactly once, and NO distractor equal to it
//     (the "secretly-also-correct" distractor-collision bug)
//
// PLUS a dedicated かけ算九九 pass (the grade-2 centerpiece, spec §Distractor-
// collision cautions), which:
//   - ENUMERATES all 81 ordered (x,y) cells and confirms the whole space is hit
//   - confirms every 九九 answer equals x*y and no numeric distractor == answer
//   - confirms missing-factor answers (□×k=prod) are UNIQUE in 1..9 given the
//     shown operand (the 12 = 2×6 = 3×4 trap)
const fs = require('fs');
const path = require('path');
const base = path.resolve(__dirname, '../../gakuenza.com/modules/sansu2');

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

const UNITS = window.SANSU2_DATA.UNITS;
const { isCorrect } = window.SANSU2_CHECK;

const PER = 5000;
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

// ---- dedicated かけ算九九 pass (centerpiece) ----
const kukuSecs = [];
for (const u of UNITS) for (const s of u.sections) if (/kuku|zenbu|missing/.test(s.id)) kukuSecs.push(s);

const cellSeen = new Set(); // "x*y" ordered cells hit by the whole-table section
let kukuChecked = 0, missingChecked = 0;
for (const s of kukuSecs) {
  for (let i = 0; i < 40000; i++) {
    const p = s.gen();
    if (p.tid === 'kuku-missing') {
      const m = p.q.match(/(\d+|□)\s*×\s*(\d+|□)\s*＝\s*(\d+)/);
      if (!m) { errors.push(`missing parse fail: ${p.q}`); continue; }
      const prod = +m[3];
      const known = m[1] === '□' ? +m[2] : +m[1];
      const ans = +p.answer;
      if (known * ans !== prod) errors.push(`missing arithmetic wrong: ${p.q} ans=${ans}`);
      let count = 0; for (let a = 1; a <= 9; a++) if (known * a === prod) count++;
      if (count !== 1) errors.push(`missing NOT unique in 1..9: ${p.q} (${count} solutions)`);
      missingChecked++;
      continue;
    }
    const m = p.q.match(/(\d+)\s*×\s*(\d+)/);
    if (!m) { errors.push(`kuku parse fail: ${p.q}`); continue; }
    const x = +m[1], y = +m[2], prod = x * y;
    cellSeen.add(`${x}*${y}`);
    if (p.kind === 'typed') {
      if (+p.answer !== prod) errors.push(`kuku typed wrong: ${p.q} -> ${p.answer} (want ${prod})`);
    } else {
      if (+p.correctChoice !== prod) errors.push(`kuku choice wrong correct: ${p.q} -> ${p.correctChoice}`);
      for (const c of p.choices) if (c !== p.correctChoice && +c === prod) errors.push(`kuku distractor == answer: ${p.q} ${JSON.stringify(p.choices)}`);
    }
    kukuChecked++;
  }
}
let cells = 0;
for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (cellSeen.has(`${a}*${b}`)) cells++;
if (cells < 81) errors.push(`九九 space not fully covered: only ${cells}/81 ordered (x,y) cells hit`);
console.log(`九九 pass: ${cells}/81 cells covered; kuku=${kukuChecked}, missing=${missingChecked} checked`);

if (errors.length) {
  const uniq = [...new Set(errors)];
  console.log(`\nFAILURES (${errors.length} total, ${uniq.length} unique):`);
  uniq.slice(0, 60).forEach(e => console.log('  - ' + e));
  process.exit(1);
}
console.log('\nALL CHECKS PASSED');
