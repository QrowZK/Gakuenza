// app.js — 外国語 5年 (eigo5) main application logic.
// UI re-skinned 2026-07 to the Gakuenza satoyama design mockup; the quiz
// engine, question generators (generators.js), content (data.js), TTS
// (tts.js), and gradebook reporting (eigo5-report.js) are unchanged.
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SESSION_SIZE = 10;

// Modes selectable per unit. `accent` maps to the design mockup's per-mode
// card top-border color.
const MODES = [
  { id: 'en2ja',    label: '英語 → 日本語', desc: '英語を見て意味を選ぼう', emoji: '🇬🇧', accent: 'var(--moss)' },
  { id: 'ja2en',    label: '日本語 → 英語', desc: '意味を見て英語を選ぼう', emoji: '🇯🇵', accent: 'var(--gold)' },
  { id: 'sentence', label: '文の練習',      desc: '文にあう語を選ぼう',   emoji: '📝', accent: 'var(--clay)' },
];

// Cycled accent colors for the unit-list rows (matches the mockup).
const UNIT_ACCENTS = ['var(--moss-deep)', 'var(--gold-deep)', 'var(--clay)'];
const LETTERS = ['A', 'B', 'C', 'D'];

const state = {
  screen: 'menu',
  unitKey: null,   // 'u01'..'u08' or 'all'
  mode: null,      // 'en2ja' | 'ja2en' | 'sentence'
  questions: [],
  qIndex: 0,
  score: 0,
  answered: false, // whether the current question has been answered
  results: [],     // { itemRef, category, prompt, correct, selectedAnswer, correctAnswer }
  focusUnits: null,
};

const Gen = window.Eigo5Gen;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  state.screen = id;
  if (window.Eigo5TTS) Eigo5TTS.stop();
}

function ttsBtn(text) {
  if (!text) return '';
  const safe = esc(text).replace(/"/g, '&quot;');
  return `<button type="button" class="tts-btn" data-tts="${safe}" aria-label="発音を聞く" title="発音を聞く">🔊</button>`;
}

// ── Unit-scoped vocab/sentence helpers ──────────────────────────────────────
function vocabForUnit(unitKey) {
  return unitKey === 'all'
    ? window.EIGO5_VOCAB.slice()
    : window.EIGO5_VOCAB.filter(w => w.unit === unitKey);
}
function sentencesForUnit(unitKey) {
  return unitKey === 'all'
    ? window.EIGO5_SENTENCES.slice()
    : window.EIGO5_SENTENCES.filter(s => s.unit === unitKey);
}
function unitMeta(unitKey) {
  return window.EIGO5_UNITS.find(u => u.key === unitKey) || null;
}
function unitLabel(unitKey) {
  if (unitKey === 'all') return 'すべてのUnit';
  const m = unitMeta(unitKey);
  return m ? `Unit ${m.num}　${m.ja}` : unitKey;
}

// ── Local stats (client-side only) ──────────────────────────────────────────
// Powers the "あなたの成績" card in the mockup with real numbers instead of
// placeholders. Purely a localStorage convenience — the authoritative record
// is always the gradebook (activity_results), written by eigo5-report.js.
const STATS_KEY = 'eigo5-stats';
function todayStamp() {
  const d = new Date();
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function loadStats() {
  try {
    const s = JSON.parse(localStorage.getItem(STATS_KEY) || '{}');
    return { correct: s.correct || 0, total: s.total || 0, lastDay: s.lastDay || null, streak: s.streak || 0 };
  } catch (e) { return { correct: 0, total: 0, lastDay: null, streak: 0 }; }
}
function updateStats(score, total) {
  const s = loadStats();
  s.correct += score;
  s.total += total;
  const today = todayStamp();
  if (s.lastDay !== today) {
    // consecutive-calendar-day streak: +1 if yesterday, reset to 1 otherwise.
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStamp = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    s.streak = (s.lastDay === yStamp) ? (s.streak + 1) : 1;
    s.lastDay = today;
  } else if (!s.streak) {
    s.streak = 1;
  }
  try { localStorage.setItem(STATS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
function renderStats() {
  const s = loadStats();
  if (!s.total) { $('statsCard').hidden = true; return; }
  $('statsCard').hidden = false;
  $('statAccuracy').innerHTML = Math.round(s.correct / s.total * 100) + '<span class="eg-stat-pct">%</span>';
  $('statStreak').textContent = String(s.streak || 0);
}

// ── Menu ────────────────────────────────────────────────────────────────────
function buildMenu() {
  const list = $('unitList');
  list.innerHTML = '';
  $('focusNoteMount').innerHTML = '';

  // Respect focus_units when scoped: only show assigned units (fail soft to all).
  const focus = Array.isArray(state.focusUnits) && state.focusUnits.length
    ? new Set(state.focusUnits) : null;
  const units = window.EIGO5_UNITS.filter(u => !focus || focus.has(u.key));

  $('unitCountLabel').textContent = '全' + units.length + 'ユニット';

  if (focus) {
    const note = document.createElement('p');
    note.className = 'eg-focus-note';
    note.textContent = '先生が指定したUnitだけ表示しています。';
    $('focusNoteMount').appendChild(note);
  }

  units.forEach((u, i) => {
    const n = window.EIGO5_VOCAB.filter(w => w.unit === u.key).length;
    const accent = UNIT_ACCENTS[i % UNIT_ACCENTS.length];
    const row = document.createElement('button');
    row.className = 'eg-unit-row';
    row.type = 'button';
    row.innerHTML =
      `<span class="eg-unit-emoji">${u.emoji}</span>` +
      `<span class="eg-unit-num">Unit ${u.num}</span>` +
      `<span class="eg-unit-ja">${esc(u.ja)}</span>` +
      `<span class="eg-unit-count">${n}語</span>` +
      `<span class="eg-unit-arrow" style="color:${accent}">→</span>`;
    row.onclick = () => openUnit(u.key);
    list.appendChild(row);
  });

  renderStats();
}

// ── Mode select ─────────────────────────────────────────────────────────────
function openUnit(unitKey) {
  state.unitKey = unitKey;
  const m = unitMeta(unitKey);
  $('modeEmoji').textContent = unitKey === 'all' ? '🎯' : (m ? m.emoji : '🎯');
  $('modeEyebrow').textContent = unitKey === 'all' ? 'CHALLENGE' : ('UNIT ' + (m ? m.num : ''));
  $('modeTitle').textContent = unitKey === 'all' ? 'すべてのUnit' : (m ? m.ja : unitKey);

  const grid = $('modeGrid');
  grid.innerHTML = '';
  MODES.forEach(mode => {
    // Sentence mode only when the unit actually has sentence items.
    if (mode.id === 'sentence' && sentencesForUnit(unitKey).length === 0) return;
    const card = document.createElement('button');
    card.className = 'eg-mode-card';
    card.type = 'button';
    card.style.borderTopColor = mode.accent;
    card.innerHTML =
      `<span class="eg-mode-emoji-lg">${mode.emoji}</span>` +
      `<span class="eg-mode-label">${mode.label}</span>` +
      `<span class="eg-mode-desc">${mode.desc}</span>`;
    card.onclick = () => startQuiz(mode.id);
    grid.appendChild(card);
  });
  showScreen('screen-mode');
}

// ── Quiz engine ─────────────────────────────────────────────────────────────
function startQuiz(mode) {
  state.mode = mode;
  state.qIndex = 0;
  state.score = 0;
  state.answered = false;
  state.results = [];
  state.questions = buildQuestions(mode, state.unitKey);
  showScreen('screen-quiz');
  renderQuestion();
}

function buildQuestions(mode, unitKey) {
  if (mode === 'sentence') {
    const items = Gen.sample(sentencesForUnit(unitKey), SESSION_SIZE);
    return items.map(it => Gen.buildSentenceQuestion(it));
  }
  const vocab = vocabForUnit(unitKey);
  // Distractor pool = the whole vocab set so single-unit drills still get
  // plausible-but-distinct wrong answers; collision safety is enforced in
  // buildVocabQuestion regardless of pool.
  const pool = window.EIGO5_VOCAB;
  const chosen = Gen.sample(vocab, Math.min(SESSION_SIZE, vocab.length));
  return chosen.map(w => Gen.buildVocabQuestion(w, pool, mode));
}

function modeBadge() {
  const m = MODES.find(x => x.id === state.mode);
  return m ? m.label : '';
}

function renderQuestion() {
  const q = state.questions[state.qIndex];
  if (!q) { finish(); return; }
  if (window.Eigo5TTS) Eigo5TTS.stop();
  state.answered = false;

  const pct = (state.qIndex / state.questions.length) * 100;
  $('quizFill').style.width = pct + '%';
  $('quizCounter').textContent = `${state.qIndex + 1} / ${state.questions.length}`;
  $('quizScore').textContent = `⭐ ${state.score}`;

  const isSentence = state.mode === 'sentence';
  $('qLabel').textContent = modeBadge();

  if (isSentence) {
    $('qPrompt').innerHTML = esc(q.text);
    $('qHint').textContent = q.hint || '';
    $('qHint').style.display = q.hint ? '' : 'none';
  } else if (state.mode === 'en2ja') {
    $('qPrompt').innerHTML = `${esc(q.prompt)} ${ttsBtn(q.ttsText)}`;
    $('qHint').style.display = 'none';
  } else {
    $('qPrompt').innerHTML = esc(q.prompt);
    $('qHint').style.display = 'none';
  }

  const grid = $('choicesGrid');
  grid.innerHTML = '';
  const englishChoices = state.mode === 'ja2en' || state.mode === 'sentence';
  q.choices.forEach((choice, idx) => {
    // div+role=button so we can nest a speaker <button> for English choices.
    const btn = document.createElement('div');
    btn.className = 'choice-btn';
    btn.setAttribute('role', 'button');
    btn.tabIndex = 0;
    btn.dataset.idx = String(idx);
    btn.innerHTML =
      `<span class="choice-letter">${LETTERS[idx] || ''}</span>` +
      `<span class="choice-text">${esc(choice)}</span>` +
      (englishChoices ? ttsBtn(choice) : '');
    const select = (e) => {
      if (e.target.closest('.tts-btn')) return;
      if (btn.classList.contains('disabled')) return;
      handleAnswer(idx, q);
    };
    btn.onclick = select;
    btn.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(e); }
    };
    grid.appendChild(btn);
  });

  $('feedbackRow').classList.add('hidden');
  renderTracker();
}

function renderTracker() {
  const grid = $('trackerGrid');
  grid.innerHTML = '';
  state.questions.forEach((_, i) => {
    const cell = document.createElement('div');
    cell.className = 'eg-tracker-cell';
    const done = i < state.qIndex || (i === state.qIndex && state.answered);
    if (done && state.results[i]) {
      cell.classList.add(state.results[i].correct ? 'is-correct' : 'is-wrong');
    } else if (i === state.qIndex) {
      cell.classList.add('is-current');
    }
    cell.textContent = String(i + 1);
    grid.appendChild(cell);
  });
}

function handleAnswer(idx, q) {
  if (state.answered) return;
  state.answered = true;
  const correct = idx === q.correctIndex;
  const grid = $('choicesGrid');
  grid.querySelectorAll('.choice-btn').forEach(b => b.classList.add('disabled'));
  const chosenBtn = grid.querySelector(`.choice-btn[data-idx="${idx}"]`);
  const correctBtn = grid.querySelector(`.choice-btn[data-idx="${q.correctIndex}"]`);

  if (correct) {
    chosenBtn.classList.add('correct');
    state.score++;
  } else {
    chosenBtn.classList.add('wrong');
    if (correctBtn) correctBtn.classList.add('correct');
  }
  $('quizScore').textContent = `⭐ ${state.score}`;

  // Record for gradebook per-item reporting (unchanged contract).
  const isSentence = state.mode === 'sentence';
  state.results.push({
    itemRef: (isSentence ? q.id : q.word.id) + '/' + state.mode + '/' + state.qIndex,
    category: isSentence ? 'sentence:' + q.unit : state.mode + ':' + q.word.unit,
    prompt: isSentence ? q.rawText : q.prompt,
    correct,
    selectedAnswer: q.choices[idx],
    correctAnswer: q.choices[q.correctIndex],
  });

  // Inline feedback + manual advance (mockup design).
  const fb = $('feedbackText');
  fb.textContent = correct ? '✅ せいかい！' : `❌ こたえ：${q.choices[q.correctIndex]}`;
  fb.style.color = correct ? 'var(--moss-deep)' : 'var(--clay)';
  $('feedbackRow').classList.remove('hidden');
  renderTracker();
}

function nextQuestion() {
  state.qIndex++;
  renderQuestion();
}

// ── Finish / report ─────────────────────────────────────────────────────────
function finish() {
  const score = state.score;
  const total = state.results.length;
  const pct = total ? Math.round(score / total * 100) : 0;

  $('resultRing').style.background = `conic-gradient(var(--moss) ${pct}%, var(--paper-dim) ${pct}%)`;
  $('resultsPct').textContent = pct + '%';
  $('resultsScore').textContent = `${score} / ${total} 正解`;
  $('resultsMsg').textContent =
    pct >= 80 ? 'すばらしい！' :
    pct >= 60 ? 'よくがんばりました！' :
    'もう一度チャレンジしよう！';
  $('syncStatus').textContent = '';

  // Wrong-answer review list.
  const wrong = state.results.filter(r => !r.correct);
  const wrapEl = $('wrongList');
  if (wrong.length) {
    wrapEl.innerHTML =
      `<div class="eg-wrong-head">まちがえた問題</div>` +
      wrong.map(w =>
        `<div class="eg-wrong-item">` +
        `<div class="eg-wrong-prompt">${esc(w.prompt)}</div>` +
        `<div class="eg-wrong-ans">こたえ：${esc(w.correctAnswer)}</div>` +
        `</div>`
      ).join('');
  } else {
    wrapEl.innerHTML = '';
  }

  // Local stats (best-effort, client-side).
  if (total) updateStats(score, total);

  // Gradebook reporting — best-effort, never blocks the child's flow.
  if (window.Eigo5Report) {
    const modeLabel = (MODES.find(m => m.id === state.mode) || {}).label || state.mode;
    window.Eigo5Report.report({
      sectionId: state.unitKey + '/' + state.mode,
      sectionTitle: unitLabel(state.unitKey) + '（' + modeLabel + '）',
      unit: state.unitKey,
      score,
      total,
      items: state.results,
    }).then(ok => {
      $('syncStatus').textContent = ok ? '✓ 成績を保存しました' : '';
    });
  }

  showScreen('screen-results');
}

// ── Buttons / wiring ────────────────────────────────────────────────────────
$('challengeBtn').onclick = () => openUnit('all');
$('modeBack').onclick = () => showScreen('screen-menu');
$('quizBack').onclick = () => { if (confirm('やめますか？')) showScreen('screen-mode'); };
$('nextBtn').onclick = () => nextQuestion();
$('resultsRetry').onclick = () => startQuiz(state.mode);
$('resultsMenu').onclick = () => { buildMenu(); showScreen('screen-menu'); };

// ── Account bubble + focus units ────────────────────────────────────────────
async function initAccount() {
  try {
    const profile = window.Eigo5Report ? await window.Eigo5Report.getProfile() : null;
    if (profile && profile.display_name) {
      const bubble = $('accountBubble');
      bubble.hidden = false;
      const given = profile.display_name.trim().split(/\s+/)[0] || profile.display_name;
      $('bubbleAvatar').textContent = (given.charAt(0) || '?');
      $('bubbleName').textContent = profile.display_name + 'さん';
      $('bubbleBtn').onclick = () => bubble.classList.toggle('open');
      document.addEventListener('click', (e) => {
        if (!bubble.contains(e.target)) bubble.classList.remove('open');
      });
      $('signoutBtn').onclick = async () => {
        await window.Eigo5Report.signOut();
        window.location.href = '../../hub/login.html';
      };
    }
  } catch (e) { /* not logged in — silent, module still usable */ }

  try {
    state.focusUnits = window.Eigo5Report ? await window.Eigo5Report.getFocusUnits() : null;
  } catch (e) { state.focusUnits = null; }
  buildMenu();
}

buildMenu();      // render immediately (works logged-out)
initAccount();    // then refine with account + focus units
