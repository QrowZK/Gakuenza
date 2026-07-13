// app.js — NH Vocab main application logic
'use strict';

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  screen:      'menu',
  mode:        null,   // 'category' | 'grade5' | 'grade6' | 'romaji'
  grade:       null,   // 5 | 6
  unit:        null,   // 1-8
  category:    null,   // category id string
  qtype:       null,   // 'en2ja' | 'ja2en' | 'flash'
  pool:        [],     // current vocab pool
  questions:   [],     // shuffled session questions
  qIndex:      0,
  score:       0,
  answers:     [],
  theme:       localStorage.getItem('nh-theme') || 'light',
  loginTab:    'email',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// Builds a speaker-icon button that reads `text` aloud via tts.js.
// `text` is the RAW (unescaped) string to be spoken; this escapes it for the
// data attribute so callers don't need to worry about quoting.
function ttsBtn(text, extraClass) {
  if (!text) return '';
  const safe = esc(text).replace(/"/g, '&quot;');
  return `<button type="button" class="tts-btn${extraClass ? ' ' + extraClass : ''}" data-tts="${safe}" aria-label="発音を聞く" title="発音を聞く">🔊</button>`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sample(arr, n) { return shuffle(arr).slice(0, n); }
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  state.screen = id;
  if (window.NHTTS) NHTTS.stop();
}

// ── Theme ─────────────────────────────────────────────────────────────────
function applyTheme() {
  document.body.classList.toggle('dark', state.theme === 'dark');
  $('theme-toggle').textContent = state.theme === 'dark' ? '☀️' : '🌙';
}
$('theme-toggle').onclick = () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('nh-theme', state.theme);
  applyTheme();
};
applyTheme();

// ── Menu ───────────────────────────────────────────────────────────────────
document.querySelectorAll('.mode-card').forEach(btn => {
  btn.onclick = () => {
    const mode = btn.dataset.mode;
    state.mode = mode;
    if (mode === 'category') buildCategoryScreen();
    else if (mode === 'grade5' || mode === 'grade6') buildUnitScreen(mode === 'grade5' ? 5 : 6);
    else if (mode === 'romaji') startRomaji();
  };
});

// Back buttons
document.querySelectorAll('.back-btn[data-back]').forEach(btn => {
  btn.onclick = () => showScreen('screen-' + btn.dataset.back);
});

// ── Category screen ────────────────────────────────────────────────────────
function buildCategoryScreen() {
  const grid = $('cat-grid');
  grid.innerHTML = '';
  NH_CATEGORIES.forEach(cat => {
    const words = NH_VOCAB.filter(w => w.cat === cat.id);
    if (words.length === 0) return;
    const card = document.createElement('button');
    card.className = 'cat-card';
    card.style.setProperty('--cat-color', cat.color);
    card.innerHTML = `
      <style>#cat-${cat.id}::before { background: ${cat.color}; }</style>
      <span class="cat-emoji">${cat.emoji}</span>
      <span class="cat-ja">${cat.ja}</span>
      <span class="cat-en">${cat.en}</span>
      <span class="cat-count">${words.length}語</span>`;
    card.id = 'cat-' + cat.id;
    card.onclick = () => {
      state.category = cat.id;
      state.pool = words;
      showQtypeScreen(`📂 ${cat.ja}`, `${words.length}語`);
    };
    grid.appendChild(card);
  });
  showScreen('screen-category');
}

// ── Unit screen ────────────────────────────────────────────────────────────
function buildUnitScreen(grade) {
  state.grade = grade;
  $('unit-screen-title').textContent = `${grade}年生 — Unitを選ぼう`;
  const grid = $('unit-grid');
  grid.innerHTML = '';
  // "All" option
  const allCard = document.createElement('button');
  allCard.className = 'unit-card';
  allCard.innerHTML = `<span>全</span><span class="unit-card-label">すべて</span>`;
  allCard.onclick = () => {
    state.pool = NH_VOCAB.filter(w => w.grade === grade);
    showQtypeScreen(`${grade}年生 全Unit`, `${state.pool.length}語`);
  };
  grid.appendChild(allCard);

  for (let u = 1; u <= 8; u++) {
    const words = NH_VOCAB.filter(w => w.grade === grade && w.unit === u);
    const card = document.createElement('button');
    card.className = 'unit-card';
    card.innerHTML = `<span>${u}</span><span class="unit-card-label">${words.length}語</span>`;
    card.onclick = () => {
      if (words.length === 0) return;
      state.unit = u;
      state.pool = words;
      showQtypeScreen(`${grade}年生 Unit ${u}`, `${words.length}語`);
    };
    if (words.length === 0) card.style.opacity = '.4';
    grid.appendChild(card);
  }
  showScreen('screen-unit');
}

// ── Quiz type screen ───────────────────────────────────────────────────────
function showQtypeScreen(title, subtitle) {
  $('qtype-title').textContent = title;
  $('qtype-info').innerHTML = `<span>📚</span> ${subtitle}`;
  $('qtype-back').onclick = () => {
    if (state.mode === 'category') showScreen('screen-category');
    else showScreen('screen-unit');
  };
  document.querySelectorAll('.qtype-card').forEach(card => {
    card.onclick = () => {
      state.qtype = card.dataset.qtype;
      if (state.qtype === 'flash') startFlash();
      else startQuiz();
    };
  });
  showScreen('screen-qtype');
}

// ── Quiz engine ────────────────────────────────────────────────────────────
const SESSION_SIZE = 10;

function startQuiz() {
  state.questions = sample(state.pool, Math.min(SESSION_SIZE, state.pool.length));
  state.qIndex = 0;
  state.score  = 0;
  state.answers = [];
  $('quiz-back').onclick = () => {
    if (confirm('やめますか？')) showScreen('screen-qtype');
  };
  showScreen('screen-quiz');
  renderQuestion();
}

function renderQuestion() {
  const q = state.questions[state.qIndex];
  if (!q) { showResults(); return; }

  // Stop any in-progress speech when moving to a new question
  if (window.NHTTS) NHTTS.stop();

  // Progress
  const pct = (state.qIndex / state.questions.length) * 100;
  $('progress-fill').style.width = pct + '%';
  $('progress-text').textContent = `${state.qIndex + 1} / ${state.questions.length}`;
  $('quiz-score').textContent = `⭐ ${state.score}`;

  // Question
  $('q-emoji').textContent = q.emoji || '📖';
  $('result-overlay').classList.add('hidden');

  // Only the ENGLISH word should ever get a speaker button. In en2ja mode
  // the question itself is English, so the button goes on the prompt and
  // the (Japanese) choices get none. In ja2en mode the question is Japanese
  // (no button), and the English choices each get their own button below.
  if (state.qtype === 'en2ja') {
    $('q-label').textContent = '英語';
    $('q-word').innerHTML    = `${esc(q.en)} ${ttsBtn(q.en, 'qword-tts')}`;
    $('q-hint').textContent  = '';
  } else {
    $('q-label').textContent = '日本語';
    $('q-word').textContent  = q.ja;
    $('q-hint').textContent  = q.emoji || '';
  }

  // Choices — pick 3 wrong from same category, then shuffle
  const sameCat = NH_VOCAB.filter(w => w.cat === q.cat && w.id !== q.id);
  const otherPool = NH_VOCAB.filter(w => w.id !== q.id);
  let wrongPool = sameCat.length >= 3 ? sameCat : otherPool;
  const wrong = sample(wrongPool, 3);
  const choices = shuffle([q, ...wrong]);

  const grid = $('choices-grid');
  grid.innerHTML = '';
  choices.forEach(choice => {
    const isEnglishChoice = state.qtype === 'ja2en';
    const text = isEnglishChoice ? choice.en : choice.ja;

    // NOTE: .choice-btn is a <div role="button"> rather than a real
    // <button>. When the choice is English we need to nest a speaker
    // <button> inside it, and HTML does not allow a <button> inside
    // another <button> — browsers silently split/auto-close that markup,
    // which breaks click handling. A div + role="button" avoids that
    // while staying keyboard-accessible.
    const btn = document.createElement('div');
    btn.className = 'choice-btn';
    btn.setAttribute('role', 'button');
    btn.tabIndex = 0;
    btn.dataset.choiceId = choice.id;
    btn.innerHTML = `<span class="choice-text">${esc(text)}</span>` +
      (isEnglishChoice ? ttsBtn(choice.en, 'choice-tts') : '');

    const selectThis = (e) => {
      // Don't treat a tap on the speaker icon as an answer selection.
      if (e.target.closest('.tts-btn')) return;
      if (btn.classList.contains('disabled')) return;
      handleAnswer(choice.id === q.id, btn, q);
    };
    btn.onclick = selectThis;
    btn.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectThis(e); }
    };
    grid.appendChild(btn);
  });

  // Animate question card
  const card = $('question-card');
  card.style.opacity = '0';
  card.style.transform = 'translateY(10px)';
  requestAnimationFrame(() => {
    card.style.transition = 'opacity .2s, transform .2s';
    card.style.opacity = '1';
    card.style.transform = 'none';
  });
}

function handleAnswer(correct, btn, q) {
  // Disable all choices
  $('choices-grid').querySelectorAll('.choice-btn').forEach(b => b.classList.add('disabled'));

  if (correct) {
    btn.classList.add('correct');
    state.score++;
    state.answers.push({ id: q.id, correct: true });
    showResultOverlay('✅', 'せいかい！');
  } else {
    btn.classList.add('wrong');
    state.answers.push({ id: q.id, correct: false });
    // Highlight correct answer — matched by choice id (set in renderQuestion),
    // not by text content, since the English choices now contain extra
    // markup (the speaker button) inside them.
    $('choices-grid').querySelectorAll('.choice-btn').forEach(b => {
      if (b.dataset.choiceId === q.id) b.classList.add('correct');
    });
    showResultOverlay('❌', `こたえ：${state.qtype === 'en2ja' ? q.ja : q.en}`);
  }

  setTimeout(() => {
    state.qIndex++;
    renderQuestion();
  }, 1200);
}

function showResultOverlay(icon, msg) {
  $('result-overlay').classList.remove('hidden');
  $('result-icon').textContent = icon;
  $('result-msg').textContent  = msg;
}

// ── Flash cards ────────────────────────────────────────────────────────────
let flashIndex = 0;

function startFlash() {
  const pool = shuffle(state.pool);
  flashIndex = 0;

  $('flash-back').onclick = () => {
    if (confirm('やめますか？')) showScreen('screen-qtype');
  };

  function renderFlash() {
    if (window.NHTTS) NHTTS.stop();
    const w = pool[flashIndex];
    $('flash-emoji').textContent      = w.emoji || '📖';
    $('flash-emoji-back').textContent = w.emoji || '📖';
    $('flash-en').innerHTML           = `${esc(w.en)} ${ttsBtn(w.en, 'flash-tts')}`;
    $('flash-ja').textContent         = w.ja;
    $('flash-en-small').innerHTML     = `${esc(w.en)} ${ttsBtn(w.en, 'flash-tts-small')}`;
    $('flash-fill').style.width       = ((flashIndex + 1) / pool.length * 100) + '%';
    $('flash-progress-text').textContent = `${flashIndex + 1} / ${pool.length}`;
    $('flash-count').textContent      = `${flashIndex + 1}枚`;
    $('flashcard').classList.remove('flipped');
  }

  $('flashcard').onclick = (e) => {
    // Don't flip the card when the tap was on a speaker icon.
    if (e.target.closest('.tts-btn')) return;
    $('flashcard').classList.toggle('flipped');
  };
  $('flash-prev').onclick = () => {
    if (flashIndex > 0) { flashIndex--; renderFlash(); }
  };
  $('flash-next').onclick = () => {
    if (flashIndex < pool.length - 1) { flashIndex++; renderFlash(); }
    else { showResults(); }
  };

  renderFlash();
  showScreen('screen-flash');
}

// ── Results ────────────────────────────────────────────────────────────────
async function showResults() {
  const total   = state.qtype === 'flash' ? state.pool.length : state.questions.length;
  const correct = state.score;
  const pct     = state.qtype === 'flash' ? 100 : Math.round(correct / total * 100);

  $('results-emoji').textContent = pct >= 80 ? '🎉' : pct >= 60 ? '😊' : '💪';
  $('results-score').textContent = state.qtype === 'flash'
    ? `${total}枚 完了！`
    : `${correct} / ${total} 正解 (${pct}%)`;
  $('results-bar').style.width = pct + '%';
  $('results-msg').textContent = pct >= 80 ? 'すばらしい！よくできました！'
    : pct >= 60 ? 'よくがんばりました！'
    : 'もう一度チャレンジしよう！';
  $('sync-status').textContent = '';

  showScreen('screen-results');

  // Sync to Supabase
  if (typeof window.hk !== 'undefined' && state.qtype !== 'flash') {
    const user = await window.hk.getUser();
    if (user) {
      try {
        await window.hk.syncQuizResult({
          level:    state.category || (state.grade ? `g${state.grade}u${state.unit}` : 'all'),
          setId:    state.qtype,
          category: state.mode || 'category',
          correct,
          total,
          app_id:   'newhorizon'
        });
        $('sync-status').textContent = '✓ 成績を保存しました';
      } catch (e) {
        console.warn('[NH] sync failed:', e.message);
      }
    }
  }

  // Save local stats
  saveLocalStats(state.category || state.mode, correct, total);
  updateMenuStats();

  $('results-retry').onclick = () => {
    if (state.qtype === 'flash') startFlash();
    else startQuiz();
  };
  $('results-menu').onclick = () => showScreen('screen-menu');
}

// ── Local stats ────────────────────────────────────────────────────────────
function saveLocalStats(key, correct, total) {
  const stored = JSON.parse(localStorage.getItem('nh-stats') || '{}');
  if (!stored[key]) stored[key] = { correct: 0, total: 0, sessions: 0 };
  stored[key].correct  += correct;
  stored[key].total    += total;
  stored[key].sessions += 1;
  stored.overall = stored.overall || { correct: 0, total: 0, sessions: 0 };
  stored.overall.correct  += correct;
  stored.overall.total    += total;
  stored.overall.sessions += 1;
  localStorage.setItem('nh-stats', JSON.stringify(stored));
}

function updateMenuStats() {
  const stored = JSON.parse(localStorage.getItem('nh-stats') || '{}');
  const ov = stored.overall;
  if (!ov || ov.sessions === 0) { $('menu-stats').style.display = 'none'; return; }
  $('menu-stats').style.display = '';
  const pct = ov.total > 0 ? Math.round(ov.correct / ov.total * 100) : 0;
  $('stats-row').innerHTML = `
    <div class="stat-card"><div class="stat-num">${ov.sessions}</div><div class="stat-lbl">セッション</div></div>
    <div class="stat-card"><div class="stat-num">${ov.total}</div><div class="stat-lbl">回答数</div></div>
    <div class="stat-card"><div class="stat-num">${pct}%</div><div class="stat-lbl">正答率</div></div>`;
}
updateMenuStats();

// ── Romaji practice ────────────────────────────────────────────────────────
// (Kana → romaji practice — not English pronunciation, so no TTS here.)
const ROMAJI_ROWS = ['vowels','K','S','T','N','H','M','Y','R','W','N_','G','Z','D','B','P'];
const ROMAJI_ROW_LABELS = {
  vowels:'あいうえお', K:'かきくけこ', S:'さしすせそ', T:'たちつてと',
  N:'なにぬねの', H:'はひふへほ', M:'まみむめも', Y:'やゆよ',
  R:'らりるれろ', W:'わ', N_:'ん', G:'がぎぐげご', Z:'ざじずぜぞ',
  D:'だでど', B:'ばびぶべぼ', P:'ぱぴぷぺぽ'
};

let romajiPool = [...NH_ROMAJI];
let romajiActiveRows = new Set(ROMAJI_ROWS);
let romajiCorrect = 0, romajiWrong = 0;
let romajiCurrent = null;
let romajiLocked = false;

function startRomaji() {
  buildRowChips();
  romajiCorrect = 0; romajiWrong = 0;
  updateRomajiStats();
  nextRomajiQuestion();
  showScreen('screen-romaji');
}

function buildRowChips() {
  const wrap = $('row-chips');
  wrap.innerHTML = '';
  ROMAJI_ROWS.forEach(row => {
    const chip = document.createElement('button');
    chip.className = 'row-chip' + (romajiActiveRows.has(row) ? ' active' : '');
    chip.textContent = ROMAJI_ROW_LABELS[row];
    chip.onclick = () => {
      if (romajiActiveRows.has(row) && romajiActiveRows.size > 1) {
        romajiActiveRows.delete(row);
        chip.classList.remove('active');
      } else {
        romajiActiveRows.add(row);
        chip.classList.add('active');
      }
      nextRomajiQuestion();
    };
    wrap.appendChild(chip);
  });
}

function nextRomajiQuestion() {
  romajiLocked = false;
  $('romaji-result').classList.add('hidden');

  const pool = NH_ROMAJI.filter(r => romajiActiveRows.has(r.row));
  if (pool.length === 0) return;
  romajiCurrent = pool[Math.floor(Math.random() * pool.length)];
  $('romaji-kana').textContent = romajiCurrent.kana;

  // Choices: 3 wrong from all romaji
  const wrong = sample(NH_ROMAJI.filter(r => r.romaji !== romajiCurrent.romaji), 3);
  const choices = shuffle([romajiCurrent, ...wrong]);

  const grid = $('romaji-choices');
  grid.innerHTML = '';
  choices.forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = c.romaji;
    btn.onclick = () => handleRomajiAnswer(c.romaji === romajiCurrent.romaji, btn);
    grid.appendChild(btn);
  });
}

function handleRomajiAnswer(correct, btn) {
  if (romajiLocked) return;
  romajiLocked = true;
  $('romaji-choices').querySelectorAll('.choice-btn').forEach(b => b.disabled = true);

  if (correct) {
    btn.classList.add('correct');
    romajiCorrect++;
    $('romaji-result-icon').textContent = '✅';
    $('romaji-result-msg').textContent  = 'せいかい！';
  } else {
    btn.classList.add('wrong');
    romajiWrong++;
    $('romaji-result-icon').textContent = '❌';
    $('romaji-result-msg').textContent  = `こたえ：${romajiCurrent.romaji}`;
    $('romaji-choices').querySelectorAll('.choice-btn').forEach(b => {
      if (b.textContent === romajiCurrent.romaji) b.classList.add('correct');
    });
  }

  $('romaji-result').classList.remove('hidden');
  updateRomajiStats();

  setTimeout(() => nextRomajiQuestion(), 1100);
}

function updateRomajiStats() {
  $('romaji-correct').textContent = `✅ ${romajiCorrect}`;
  $('romaji-wrong').textContent   = `❌ ${romajiWrong}`;
}

// ── URL parameter deep-linking ────────────────────────────────────────────
// Supports ?cat=<category_id> e.g. ?cat=sports or ?cat=colors,sports
// Also supports ?grade=5 or ?grade=6 for grade-level practice
(function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const cat    = params.get('cat');
  const grade  = params.get('grade');

  if (cat) {
    // Wait for vocab data to load, then jump straight to qtype screen
    const firstCat = cat.split(',')[0].trim();
    const words = NH_VOCAB.filter(w => w.cat === firstCat);
    if (words.length > 0) {
      const meta = NH_CATEGORIES.find(c => c.id === firstCat);
      const label = meta ? `${meta.emoji} ${meta.ja}` : firstCat;
      state.mode     = 'category';
      state.category = firstCat;
      state.pool     = words;
      showQtypeScreen(label, `${words.length}語`);
      return;
    }
  }

  if (grade) {
    const g = parseInt(grade);
    if (g === 5 || g === 6) {
      state.mode  = g === 5 ? 'grade5' : 'grade6';
      state.grade = g;
      buildUnitScreen(g);
      return;
    }
  }
})();

