// app.js — NH6 Practice main app.
// UI re-skinned 2026-07 to the Gakuenza satoyama design mockup; the quiz
// engine, content (data.js), writing canvas (writing.js), TTS (tts.js), and
// gradebook reporting (eigo6-report.js, via window.hk.syncQuizResult) are
// unchanged. Per-question items still flow through S.answers → syncQuizResult.
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const S = {
  screen:     'menu',
  unit:       null,
  mode:       null,    // 'grammar' | 'response' | 'writing'
  questions:  [],
  qIndex:     0,
  score:      0,
  answered:   false,
  answers:    [],      // per-question detail for activity_result_items (#126)
  writeItems: [],
  writeIdx:   0,
  writeMode:  'trace', // 'trace' | 'copy'
  wcanvas:    null,    // WritingCanvas instance
};

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function ttsBtn(text, extraClass) {
  if (!text) return '';
  const safe = esc(text).replace(/"/g, '&quot;');
  return `<button type="button" class="tts-btn${extraClass ? ' ' + extraClass : ''}" data-tts="${safe}" aria-label="発音を聞く" title="発音を聞く">🔊</button>`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  S.screen = id;
  if (window.NH6TTS) NH6TTS.stop();
  window.scrollTo(0,0);
}

// ── Local stats (client-side; powers the 成績 card) ──────────────────────────
const LETTERS = ['A', 'B', 'C', 'D'];
function dayStamp(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function saveLocalStats(unit, mode, correct, total) {
  const d = JSON.parse(localStorage.getItem('eigo6-stats') || '{}');
  const key = `u${unit}-${mode}`;
  if (!d[key]) d[key] = { correct:0, total:0, sessions:0 };
  d[key].correct  += correct;
  d[key].total    += total;
  d[key].sessions += 1;
  d.overall = d.overall || { correct:0, total:0, sessions:0, lastDay:null, streak:0 };
  d.overall.correct  += correct;
  d.overall.total    += total;
  d.overall.sessions += 1;
  const today = dayStamp(new Date());
  if (d.overall.lastDay !== today) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    d.overall.streak = (d.overall.lastDay === dayStamp(y)) ? ((d.overall.streak || 0) + 1) : 1;
    d.overall.lastDay = today;
  } else if (!d.overall.streak) {
    d.overall.streak = 1;
  }
  localStorage.setItem('eigo6-stats', JSON.stringify(d));
}
function renderMenuStats() {
  const d  = JSON.parse(localStorage.getItem('eigo6-stats') || '{}');
  const ov = d.overall;
  if (!ov || ov.sessions === 0) { $('menu-stats').hidden = true; return; }
  $('menu-stats').hidden = false;
  const pct = ov.total > 0 ? Math.round(ov.correct / ov.total * 100) : 0;
  $('stat-accuracy').innerHTML = pct + '<span class="eg-stat-pct">%</span>';
  $('stat-streak').textContent = String(ov.streak || 0);
}

// ── Main menu ──────────────────────────────────────────────────────────────
function buildMenu() {
  const grid = $('unit-grid');
  $('unit-count-label').textContent = '全' + NH6_UNITS.length + 'ユニット';
  grid.innerHTML = NH6_UNITS.map(u => `
    <button class="eg-unit-row" data-unit="${u.id}" type="button">
      <span class="eg-unit-emoji">${u.emoji}</span>
      <span class="eg-unit-num">Unit ${u.id}</span>
      <span class="eg-unit-titles">
        <span class="eg-unit-en">${esc(u.title)}</span>
        <span class="eg-unit-ja">${esc(u.titleJa)}</span>
      </span>
      <span class="eg-unit-arrow" style="color:${u.color}">→</span>
    </button>`).join('');

  grid.querySelectorAll('.eg-unit-row').forEach(btn => {
    btn.onclick = () => {
      S.unit = parseInt(btn.dataset.unit);
      buildUnitScreen();
      showScreen('screen-unit');
    };
  });
  renderMenuStats();
}

// ── Unit / mode screen ───────────────────────────────────────────────────────
function buildUnitScreen() {
  const u = NH6_UNITS[S.unit - 1];
  $('unit-emoji').textContent = u.emoji;
  $('unit-num').textContent   = `UNIT ${u.id}`;
  $('unit-num').style.color   = u.color;
  $('unit-title').textContent = u.title;
  $('unit-ja').textContent    = u.titleJa;
}

$('back-to-menu').onclick = () => showScreen('screen-menu');
$('mode-grammar').onclick  = () => startQuiz('grammar');
$('mode-response').onclick = () => startQuiz('response');
$('mode-writing').onclick  = () => startWriting();

// ── Quiz engine ────────────────────────────────────────────────────────────
const SESSION = 10;

function startQuiz(mode) {
  S.mode  = mode;
  const pool = mode === 'grammar' ? NH6_GRAMMAR[S.unit] : NH6_RESPONSE[S.unit];
  if (!pool || !pool.length) return;

  S.questions = sample(pool, Math.min(SESSION, pool.length));
  S.qIndex    = 0;
  S.score     = 0;
  S.answered  = false;
  S.answers   = [];
  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = S.questions[S.qIndex];
  if (!q) { showResults(); return; }
  if (window.NH6TTS) NH6TTS.stop();
  S.answered = false;

  const pct = (S.qIndex / S.questions.length) * 100;
  $('quiz-progress-fill').style.width = pct + '%';
  $('quiz-progress-text').textContent = `${S.qIndex + 1} / ${S.questions.length}`;
  $('quiz-score-disp').textContent    = `⭐ ${S.score}`;
  $('question-label').textContent = S.mode === 'grammar' ? '文法練習' : '応答練習';

  if (S.mode === 'grammar') {
    const parts = q.prompt.split('___');
    // TTS reads the completed sentence so the child hears natural English.
    const fullSentence = q.prompt.replace('___', q.choices[q.correct]);
    $('question-prompt').innerHTML =
      `<span class="qp-text">${esc(parts[0])}</span>` +
      `<span class="qp-blank">____</span>` +
      `<span class="qp-text">${esc(parts[1] || '')}</span>` +
      ttsBtn(fullSentence, 'qp-tts');
    $('question-hint').textContent = q.hint || '';
    $('question-hint').style.display = q.hint ? '' : 'none';
  } else {
    $('question-prompt').innerHTML =
      `<span class="qp-question">${esc(q.q)}</span>` +
      ttsBtn(q.q, 'qp-tts');
    $('question-hint').style.display = 'none';
  }

  const grid = $('choices-grid');
  const indexed = q.choices.map((c, i) => ({ text: c, orig: i }));
  const shuffled = shuffle(indexed);
  const correctOrig = q.correct;
  grid.innerHTML = shuffled.map((item, pos) => `
    <div class="choice-btn" role="button" tabindex="0" data-orig="${item.orig}">
      <span class="choice-letter">${LETTERS[pos] || ''}</span>
      <span class="choice-text">${esc(item.text)}</span>
      ${ttsBtn(item.text, 'choice-tts')}
    </div>`).join('');

  grid.querySelectorAll('.choice-btn').forEach(btn => {
    const select = (e) => {
      if (e.target.closest('.tts-btn')) return;
      if (btn.classList.contains('disabled')) return;
      handleAnswer(parseInt(btn.dataset.orig) === correctOrig, btn, q);
    };
    btn.onclick = select;
    btn.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(e); }
    };
  });

  $('feedback-row').classList.add('hidden');
  renderTracker();
}

function renderTracker() {
  const grid = $('tracker-grid');
  grid.innerHTML = '';
  S.questions.forEach((_, i) => {
    const cell = document.createElement('div');
    cell.className = 'eg-tracker-cell';
    const done = i < S.qIndex || (i === S.qIndex && S.answered);
    if (done && S.answers[i]) {
      cell.classList.add(S.answers[i].correct ? 'is-correct' : 'is-wrong');
    } else if (i === S.qIndex) {
      cell.classList.add('is-current');
    }
    cell.textContent = String(i + 1);
    grid.appendChild(cell);
  });
}

function handleAnswer(correct, btn, q) {
  if (S.answered) return;
  S.answered = true;
  const grid = $('choices-grid');
  grid.querySelectorAll('.choice-btn').forEach(b => b.classList.add('disabled'));

  if (correct) {
    btn.classList.add('correct');
    S.score++;
  } else {
    btn.classList.add('wrong');
    grid.querySelectorAll('.choice-btn').forEach(b => {
      if (parseInt(b.dataset.orig) === q.correct) b.classList.add('correct');
    });
  }
  $('quiz-score-disp').textContent = `⭐ ${S.score}`;

  // Record per-question detail for the gradebook (unchanged #126 contract).
  const selIdx = parseInt(btn.dataset.orig);
  S.answers.push({
    itemRef: `u${S.unit}/${S.mode}/${S.qIndex}`,
    category: S.mode,
    prompt: S.mode === 'grammar' ? q.prompt : q.q,
    correct: !!correct,
    selectedAnswer: q.choices[selIdx],
    correctAnswer: q.choices[q.correct],
  });

  // Inline feedback + manual advance (mockup design).
  const fb = $('feedback-text');
  fb.textContent = correct ? '✅ せいかい！' : `❌ こたえ：${q.choices[q.correct]}`;
  fb.style.color = correct ? 'var(--moss-deep)' : 'var(--clay)';
  $('feedback-row').classList.remove('hidden');
  renderTracker();
}

function nextQuestion() {
  S.qIndex++;
  renderQuestion();
}

// ── Writing practice (rich tracing canvas — preserved verbatim) ──────────────
function startWriting() {
  const items = NH6_WRITING[S.unit] || [];
  if (!items.length) return;
  S.writeItems = items;
  S.writeIdx   = 0;
  S.writeMode  = 'trace';

  $('write-back').onclick = () => {
    if (S.wcanvas) S.wcanvas.clear();
    if (window.NH6TTS) NH6TTS.stop();
    showScreen('screen-unit');
  };
  $('write-clear-btn').onclick = () => { if (S.wcanvas) S.wcanvas.clear(); };
  $('write-undo-btn').onclick  = () => { if (S.wcanvas) S.wcanvas.undo(); };
  $('write-prev-btn').onclick  = () => { if (S.writeIdx > 0) { S.writeIdx--; renderWriteItem(); } };
  $('write-next-btn').onclick  = () => {
    S.writeIdx++;
    if (S.writeIdx >= S.writeItems.length) { showResults(); return; }
    renderWriteItem();
  };
  $('write-mode-btn').onclick = toggleWriteMode;

  showScreen('screen-writing');

  // Init canvas
  const canvasEl = $('write-canvas');
  if (S.wcanvas) S.wcanvas.destroy();
  S.wcanvas = new WritingCanvas(canvasEl);

  renderWriteItem();
}

function toggleWriteMode() {
  S.writeMode = S.writeMode === 'trace' ? 'copy' : 'trace';
  $('write-mode-btn').textContent = S.writeMode === 'trace' ? '🙈 コピーモード' : '👀 なぞりモード';
  var overlay = $('guide-overlay');
  if (S.wcanvas) {
    S.wcanvas.setGuide(S.writeMode === 'trace' ? overlay.textContent : '');
  }
}

function renderWriteItem() {
  if (S.wcanvas) S.wcanvas.clear();
  if (window.NH6TTS) NH6TTS.stop();
  const items = S.writeItems;
  const item  = items[S.writeIdx];
  if (!item) return;

  $('write-progress-text').textContent = `${S.writeIdx + 1} / ${items.length}`;
  $('write-progress-fill').style.width = ((S.writeIdx + 1) / items.length * 100) + '%';
  $('write-prev-btn').disabled = S.writeIdx === 0;
  $('write-mode-btn').textContent = S.writeMode === 'trace' ? '🙈 コピーモード' : '👀 なぞりモード';

  const overlay = $('guide-overlay');
  overlay.style.opacity = '0';

  if (item.type === 'letter') {
    overlay.textContent = S.writeMode === 'trace' ? item.upper : '';
    $('write-instruction').innerHTML =
      `<strong>${item.upper}${item.lower}</strong> を書こう &nbsp;
       <span class="write-word-eg">${item.emoji} ${esc(item.word)} = ${esc(item.hint)}</span>
       ${ttsBtn(item.word, 'write-tts')}`;
    $('write-tabs').innerHTML = `
      <button class="wtab active" data-char="${esc(item.upper)}">大文字 ${esc(item.upper)}</button>
      <button class="wtab"        data-char="${esc(item.lower)}">小文字 ${esc(item.lower)}</button>
      <button class="wtab"        data-char="${esc(item.word)}">単語 ${esc(item.word)}</button>`;
  } else if (item.type === 'digraph') {
    overlay.textContent = S.writeMode === 'trace' ? item.chars : '';
    $('write-instruction').innerHTML =
      `<strong>${esc(item.chars)}</strong> を書こう &nbsp;
       <span class="write-word-eg">${item.emoji} ${esc(item.word)} = ${esc(item.hint)}</span>
       ${ttsBtn(item.word, 'write-tts')}`;
    $('write-tabs').innerHTML = `
      <button class="wtab active" data-char="${esc(item.chars)}">${esc(item.chars)}</button>
      <button class="wtab"        data-char="${esc(item.chars.toUpperCase())}">${esc(item.chars.toUpperCase())}</button>
      <button class="wtab"        data-char="${esc(item.word)}">単語 ${esc(item.word)}</button>`;
  } else if (item.type === 'word') {
    overlay.textContent = S.writeMode === 'trace' ? item.word : '';
    $('write-instruction').innerHTML =
      `<strong>${esc(item.word)}</strong> を書こう &nbsp;
       <span class="write-word-eg">${esc(item.hint)}</span>
       ${ttsBtn(item.word, 'write-tts')}`;
    $('write-tabs').innerHTML = '';
  } else if (item.type === 'sentence') {
    overlay.textContent = S.writeMode === 'trace' ? item.text : '';
    $('write-instruction').innerHTML =
      `<span style="font-size:14px">${esc(item.text)}</span>${ttsBtn(item.text, 'write-tts')}<br>
       <span class="write-word-eg">${esc(item.hint)}</span>`;
    $('write-tabs').innerHTML = '';
  }

  // Wire up letter tabs
  document.querySelectorAll('.wtab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.wtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      var charText = tab.dataset.char;
      overlay.textContent = charText;
      if (S.wcanvas) S.wcanvas.setGuide(S.writeMode === 'trace' ? charText : '');
      var ttsBtnEl = document.querySelector('#write-instruction .tts-btn');
      if (ttsBtnEl) ttsBtnEl.setAttribute('data-tts', esc(charText).replace(/"/g, '&quot;'));
    };
  });

  var guideText = overlay.textContent;
  sizeWritingCanvas(item.type);
  if (S.wcanvas) S.wcanvas.setGuide(S.writeMode === 'trace' ? guideText : '');
}

function sizeWritingCanvas(type) {
  var maxW = Math.min(window.innerWidth - 28, 560);
  var wPx, hPx;
  if      (type === 'letter')   { var sq = Math.min(maxW, 300); wPx = sq;   hPx = sq; }
  else if (type === 'digraph')  { wPx = maxW; hPx = 220; }
  else if (type === 'word')     { wPx = maxW; hPx = 210; }
  else                          { wPx = maxW; hPx = 175; }  // sentence
  if (S.wcanvas) S.wcanvas.resizeTo(wPx, hPx);
}

// ── Results / review ─────────────────────────────────────────────────────────
async function showResults() {
  const isWriting = S.mode === 'writing';

  if (isWriting) {
    const total = S.writeItems.length;
    $('result-ring').style.background = 'conic-gradient(var(--moss) 100%, var(--paper-dim) 100%)';
    $('results-score').textContent = '✓';
    $('results-msg').textContent = '書き練習かんりょう！';
    $('results-scoretext').textContent = `${total} 項目 完了`;
    $('results-sync').textContent = '';
    $('results-wrong').innerHTML = '';
    showScreen('screen-results');
    return;
  }

  const score = S.score;
  const total = S.answers.length;
  const pct = total ? Math.round(score / total * 100) : 0;

  $('result-ring').style.background = `conic-gradient(var(--moss) ${pct}%, var(--paper-dim) ${pct}%)`;
  $('results-score').textContent = pct + '%';
  $('results-msg').textContent =
    pct >= 80 ? 'すばらしい！' :
    pct >= 60 ? 'よくがんばりました！' :
    'もう一度チャレンジしよう！';
  $('results-scoretext').textContent = `${score} / ${total} 正解`;
  $('results-sync').textContent = '';

  const wrong = S.answers.filter(a => !a.correct);
  $('results-wrong').innerHTML = wrong.length
    ? `<div class="eg-wrong-head">まちがえた問題</div>` +
      wrong.map(w =>
        `<div class="eg-wrong-item">` +
        `<div class="eg-wrong-prompt">${esc(w.prompt)}</div>` +
        `<div class="eg-wrong-ans">こたえ：${esc(w.correctAnswer)}</div>` +
        `</div>`
      ).join('')
    : '';

  saveLocalStats(S.unit, S.mode, score, total);
  renderMenuStats();

  showScreen('screen-results');

  // Gradebook reporting — unchanged #126 wiring: per-question items flow
  // through the window.hk shim to HubCommon.reportActivityWithItems.
  if (typeof window.hk !== 'undefined') {
    const user = await window.hk.getUser();
    if (user) {
      try {
        await window.hk.syncQuizResult({
          level:    `u${S.unit}`,
          setId:    S.mode,
          category: S.mode,
          correct:  score,
          total,
          app_id:   'eigo6',
          items:    S.answers || []
        });
        $('results-sync').textContent = '✓ 成績を保存しました';
      } catch (e) { console.warn('[NH6] sync error:', e.message); }
    }
  }
}

// ── Buttons / wiring ────────────────────────────────────────────────────────
$('quiz-back').onclick   = () => { if (confirm('やめますか？')) showScreen('screen-unit'); };
$('next-btn').onclick    = () => nextQuestion();
$('results-retry').onclick = () => { if (S.mode === 'writing') startWriting(); else startQuiz(S.mode); };
$('results-unit').onclick  = () => showScreen('screen-unit');
$('results-menu').onclick  = () => { buildMenu(); showScreen('screen-menu'); };

// ── Boot ───────────────────────────────────────────────────────────────────
buildMenu();
