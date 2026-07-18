// app.js — 外国語 5年 (eigo5) main application logic.
'use strict';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const SESSION_SIZE = 10;

// Modes selectable per unit.
const MODES = [
  { id: 'en2ja',    label: '英語 → 日本語', desc: '英語を見て意味を選ぼう', emoji: '🇬🇧' },
  { id: 'ja2en',    label: '日本語 → 英語', desc: '意味を見て英語を選ぼう', emoji: '🇯🇵' },
  { id: 'sentence', label: '文の練習',      desc: '文にあう語を選ぼう',   emoji: '📝' },
];

const state = {
  screen: 'menu',
  unitKey: null,   // 'u01'..'u08' or 'all'
  mode: null,      // 'en2ja' | 'ja2en' | 'sentence'
  questions: [],
  qIndex: 0,
  score: 0,
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

// ── Menu ────────────────────────────────────────────────────────────────────
function buildMenu() {
  const list = $('unitList');
  list.innerHTML = '';

  // Respect focus_units when scoped: only show assigned units (fail soft to all).
  const focus = Array.isArray(state.focusUnits) && state.focusUnits.length
    ? new Set(state.focusUnits) : null;
  const units = window.EIGO5_UNITS.filter(u => !focus || focus.has(u.key));

  if (focus) {
    const note = document.createElement('p');
    note.className = 'focus-note';
    note.textContent = '先生が指定したUnitだけ表示しています。';
    list.appendChild(note);
  }

  // "All" card first (over the visible/allowed set).
  const allCard = document.createElement('button');
  allCard.className = 'unit-card unit-card--all';
  allCard.type = 'button';
  const allVocab = focus
    ? window.EIGO5_VOCAB.filter(w => focus.has(w.unit)).length
    : window.EIGO5_VOCAB.length;
  allCard.innerHTML =
    `<span class="unit-emoji">🎯</span>` +
    `<span class="unit-title">すべてのUnit</span>` +
    `<span class="unit-count">${allVocab}語</span>`;
  allCard.onclick = () => openUnit('all');
  list.appendChild(allCard);

  units.forEach(u => {
    const n = window.EIGO5_VOCAB.filter(w => w.unit === u.key).length;
    const card = document.createElement('button');
    card.className = 'unit-card';
    card.type = 'button';
    card.innerHTML =
      `<span class="unit-emoji">${u.emoji}</span>` +
      `<span class="unit-title">Unit ${u.num}　${esc(u.ja)}</span>` +
      `<span class="unit-count">${n}語</span>`;
    card.onclick = () => openUnit(u.key);
    list.appendChild(card);
  });
}

// ── Mode select ─────────────────────────────────────────────────────────────
function openUnit(unitKey) {
  state.unitKey = unitKey;
  $('modeTitle').textContent = unitLabel(unitKey);
  const grid = $('modeGrid');
  grid.innerHTML = '';
  MODES.forEach(m => {
    // Sentence mode only when the unit actually has sentence items.
    if (m.id === 'sentence' && sentencesForUnit(unitKey).length === 0) return;
    const card = document.createElement('button');
    card.className = 'mode-card';
    card.type = 'button';
    card.innerHTML =
      `<span class="mode-emoji">${m.emoji}</span>` +
      `<span class="mode-label">${m.label}</span>` +
      `<span class="mode-desc">${m.desc}</span>`;
    card.onclick = () => startQuiz(m.id);
    grid.appendChild(card);
  });
  showScreen('screen-mode');
}

// ── Quiz engine ─────────────────────────────────────────────────────────────
function startQuiz(mode) {
  state.mode = mode;
  state.qIndex = 0;
  state.score = 0;
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

function renderQuestion() {
  const q = state.questions[state.qIndex];
  if (!q) { finish(); return; }
  if (window.Eigo5TTS) Eigo5TTS.stop();

  const pct = (state.qIndex / state.questions.length) * 100;
  $('quizFill').style.width = pct + '%';
  $('quizCounter').textContent = `${state.qIndex + 1} / ${state.questions.length}`;
  $('quizScore').textContent = `⭐ ${state.score}`;

  const isSentence = state.mode === 'sentence';
  $('qEmoji').textContent = isSentence ? '📝' : (q.emoji || '📖');
  $('qEmoji').style.display = isSentence ? 'none' : '';

  if (isSentence) {
    $('qLabel').textContent = '文にあう語を選ぼう';
    $('qPrompt').innerHTML = esc(q.text);
    $('qHint').textContent = q.hint || '';
  } else if (state.mode === 'en2ja') {
    $('qLabel').textContent = '英語';
    $('qPrompt').innerHTML = `${esc(q.prompt)} ${ttsBtn(q.ttsText)}`;
    $('qHint').textContent = '意味をえらんでね';
  } else {
    $('qLabel').textContent = '日本語';
    $('qPrompt').innerHTML = esc(q.prompt);
    $('qHint').textContent = '英語をえらんでね';
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
    btn.innerHTML = `<span class="choice-text">${esc(choice)}</span>` +
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

  $('resultOverlay').classList.add('hidden');
}

function handleAnswer(idx, q) {
  const correct = idx === q.correctIndex;
  const grid = $('choicesGrid');
  grid.querySelectorAll('.choice-btn').forEach(b => b.classList.add('disabled'));
  const chosenBtn = grid.querySelector(`.choice-btn[data-idx="${idx}"]`);
  const correctBtn = grid.querySelector(`.choice-btn[data-idx="${q.correctIndex}"]`);

  if (correct) {
    chosenBtn.classList.add('correct');
    state.score++;
    showOverlay('✅', 'せいかい！');
  } else {
    chosenBtn.classList.add('wrong');
    if (correctBtn) correctBtn.classList.add('correct');
    showOverlay('❌', `こたえ：${q.choices[q.correctIndex]}`);
  }

  // Record for gradebook per-item reporting.
  const isSentence = state.mode === 'sentence';
  state.results.push({
    itemRef: (isSentence ? q.id : q.word.id) + '/' + state.mode + '/' + state.qIndex,
    category: isSentence ? 'sentence:' + q.unit : state.mode + ':' + q.word.unit,
    prompt: isSentence ? q.rawText : q.prompt,
    correct,
    selectedAnswer: q.choices[idx],
    correctAnswer: q.choices[q.correctIndex],
  });

  setTimeout(() => { state.qIndex++; renderQuestion(); }, 1150);
}

function showOverlay(icon, msg) {
  $('resultOverlay').classList.remove('hidden');
  $('resultIcon').textContent = icon;
  $('resultMsg').textContent = msg;
}

// ── Finish / report ─────────────────────────────────────────────────────────
function finish() {
  const score = state.score;
  const total = state.results.length;
  const pct = total ? Math.round(score / total * 100) : 0;

  $('resultsEmoji').textContent = pct >= 80 ? '🎉' : pct >= 60 ? '😊' : '💪';
  $('resultsScore').textContent = `${score} / ${total} 正解 (${pct}%)`;
  $('resultsBar').style.width = pct + '%';
  $('resultsMsg').textContent =
    pct >= 80 ? 'すばらしい！よくできました！' :
    pct >= 60 ? 'よくがんばりました！' :
    'もう一度チャレンジしよう！';
  $('syncStatus').textContent = '';

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
$('modeBack').onclick = () => showScreen('screen-menu');
$('quizBack').onclick = () => { if (confirm('やめますか？')) showScreen('screen-mode'); };
$('resultsRetry').onclick = () => startQuiz(state.mode);
$('resultsMenu').onclick = () => showScreen('screen-menu');

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
