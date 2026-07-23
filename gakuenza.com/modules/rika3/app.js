// 理科3年 module — app logic.
// Screens: menu (two strand families) -> lesson (optional) -> drill
// (choice + order questions) -> review (+ best-effort gradebook report).
(function () {
  'use strict';

  const { STRANDS } = window.RIKA3_DATA;
  const GEN = window.RIKA3_GEN;
  const QUESTIONS_PER_DRILL = 10;

  // Unit-scoped pacing (class_modules.focus_units): null = show all normally;
  // a Set = foreground these keys. Loaded async on boot (fails soft to null).
  let focusUnits = null;

  // Flat unit lookup by key, and a stable id for every AUTHORED question
  // (`${unitKey}-${index}`). Generated questions get their id at drill time.
  const UNIT_BY_KEY = {};
  STRANDS.forEach((strand) => strand.units.forEach((u) => {
    u.strandId = strand.id;
    UNIT_BY_KEY[u.key] = u;
    u.questions.forEach((q, i) => { q.id = u.key + '-' + i; q._src = 'authored'; });
  }));

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  function show(screenId) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
    $(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- state ----------
  const state = {
    unit: null,          // current unit object
    lessons: [],
    lessonIdx: 0,
    questions: [],       // the drill's question instances
    qIdx: 0,
    results: [],         // { q, user, correct }
    answered: false,
    orderPicked: [],
    orderShuffled: [],
    completed: {},       // unitKey -> 'score/total' (this page load)
  };

  // ---------- menu ----------
  function renderMenu() {
    const root = $('strandList');
    root.innerHTML = '';
    STRANDS.forEach((strand) => {
      const block = document.createElement('div');
      block.className = 'strand-block';

      const head = document.createElement('div');
      head.className = 'strand-head';
      head.innerHTML =
        '<div class="strand-title"><span class="strand-badge">' + esc(strand.id) +
        '</span>' + esc(strand.title) + '</div>' +
        '<div class="strand-desc">' + esc(strand.desc) + '</div>';
      block.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'unit-grid';
      strand.units.forEach((u) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'unit-card';
        card.setAttribute('data-unit', u.key);
        const isFocus = !!(focusUnits && focusUnits.has(u.key));
        if (isFocus) card.classList.add('unit-card--focus');
        const done = state.completed[u.key];
        const count = u.questions.length + (u.gen ? '＋' : '');
        card.innerHTML =
          '<div class="uc-head"><span class="uc-num">' + esc(u.num) + '</span>' +
          '<span class="uc-title">' + esc(u.title) + '</span>' +
          (isFocus ? '<span class="uc-focus-badge">★ 今週</span>' : '') + '</div>' +
          '<div class="uc-meta">' + esc(u.month) + '　・　問題 ' + count + '問' +
          (done ? '　・　✔ ' + esc(done) : '') + '</div>';
        card.addEventListener('click', () => startUnit(u));
        grid.appendChild(card);
      });
      block.appendChild(grid);
      root.appendChild(block);
    });
    show('screen-menu');
  }

  // ---------- unit entry ----------
  function buildQuestions(u) {
    const authored = u.questions.slice();
    let generated = [];
    if (u.gen && GEN) {
      // fill up toward the target with generated instances, but never crowd
      // out the authored set entirely — cap generated at half the target.
      const room = Math.max(0, QUESTIONS_PER_DRILL - authored.length);
      const genCount = Math.min(room, Math.ceil(QUESTIONS_PER_DRILL / 2));
      generated = GEN.generateFor(u.gen, genCount).map((q, i) => {
        q.id = u.key + '-gen-' + q.tid + '-' + i;
        q._src = 'generated';
        return q;
      });
    }
    const pool = shuffle(authored.concat(generated));
    return pool.slice(0, Math.min(QUESTIONS_PER_DRILL, pool.length));
  }

  function startUnit(u) {
    state.unit = u;
    state.lessons = u.lessons || [];
    state.lessonIdx = 0;
    if (state.lessons.length) {
      renderLesson();
      show('screen-lesson');
    } else {
      startDrill();
    }
  }

  // ---------- lessons ----------
  function renderLesson() {
    const u = state.unit;
    const lesson = state.lessons[state.lessonIdx];
    $('lessonSectionTitle').textContent = u.num + '　' + u.title;
    let html = '<h2>' + esc(lesson.title) + '</h2>' +
      '<p class="body">' + esc(lesson.body) + '</p>';
    if (lesson.point) html += '<div class="point">' + esc(lesson.point) + '</div>';
    $('lessonCard').innerHTML = html;

    $('lessonDots').innerHTML = state.lessons
      .map((_, d) => '<span class="dot' + (d === state.lessonIdx ? ' on' : '') + '"></span>')
      .join('');
    $('lessonPrev').disabled = state.lessonIdx === 0;
    $('lessonNext').textContent =
      state.lessonIdx === state.lessons.length - 1 ? '問題へ →' : 'つぎ →';
  }

  $('lessonPrev').addEventListener('click', () => {
    if (state.lessonIdx > 0) { state.lessonIdx--; renderLesson(); }
  });
  $('lessonNext').addEventListener('click', () => {
    if (state.lessonIdx < state.lessons.length - 1) {
      state.lessonIdx++;
      renderLesson();
    } else {
      startDrill();
    }
  });
  $('lessonSkip').addEventListener('click', startDrill);

  // ---------- drill ----------
  function startDrill() {
    state.questions = buildQuestions(state.unit);
    state.qIdx = 0;
    state.results = [];
    renderQuestion();
    show('screen-drill');
  }

  function renderOrderChips() {
    const pool = $('orderPool');
    const picked = $('orderPicked');
    pool.innerHTML = '';
    picked.innerHTML = state.orderPicked.length
      ? ''
      : '<span class="order-hint">下のカードを、じゅんばんにタップしてね</span>';

    state.orderPicked.forEach((item, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'order-chip picked';
      chip.textContent = (i + 1) + '. ' + item;
      chip.addEventListener('click', () => {
        if (state.answered) return;
        state.orderPicked.splice(i, 1);
        renderOrderChips();
        syncCheckEnabled();
      });
      picked.appendChild(chip);
    });

    state.orderShuffled.forEach((item) => {
      if (state.orderPicked.includes(item)) return;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'order-chip';
      chip.textContent = item;
      chip.addEventListener('click', () => {
        if (state.answered) return;
        state.orderPicked.push(item);
        renderOrderChips();
        syncCheckEnabled();
      });
      pool.appendChild(chip);
    });
  }

  function syncCheckEnabled() {
    const q = state.questions[state.qIdx];
    if (q.type === 'order') {
      $('checkBtn').disabled = state.orderPicked.length !== q.items.length;
    }
  }

  function renderQuestion() {
    const q = state.questions[state.qIdx];
    state.answered = false;

    $('drillTitle').textContent = state.unit.num + '. ' + state.unit.title;
    $('drillCounter').textContent =
      '第' + (state.qIdx + 1) + '問 / ' + state.questions.length + '問';
    $('drillFill').style.width =
      Math.round((state.qIdx / state.questions.length) * 100) + '%';

    const cat = $('qCat');
    if (q.cat) { cat.textContent = q.cat; cat.hidden = false; }
    else { cat.hidden = true; cat.textContent = ''; }

    $('qText').textContent = q.q;

    const isOrder = q.type === 'order';
    const choiceArea = $('choiceArea');
    const orderArea = $('orderArea');
    choiceArea.hidden = isOrder;
    orderArea.hidden = !isOrder;

    if (isOrder) {
      state.orderPicked = [];
      // shuffle until not already in the correct order (avoid a trivial round)
      do { state.orderShuffled = shuffle(q.items); }
      while (q.items.length > 1 && state.orderShuffled.join('|') === q.items.join('|'));
      renderOrderChips();
      $('checkBtn').hidden = false;
      $('checkBtn').disabled = true;
    } else {
      choiceArea.innerHTML = '';
      shuffle(q.options).forEach((opt) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice-btn';
        b.textContent = opt;
        b.addEventListener('click', () => { if (!state.answered) gradeChoice(opt); });
        choiceArea.appendChild(b);
      });
      $('checkBtn').hidden = true;
    }

    const fb = $('feedback');
    fb.className = 'feedback';
    $('fbVerdict').textContent = '';
    $('fbBody').innerHTML = '';
    $('nextBtn').hidden = true;
  }

  function gradeChoice(selected) {
    const q = state.questions[state.qIdx];
    const ok = selected === q.answer;
    document.querySelectorAll('#choiceArea .choice-btn').forEach((b) => {
      b.disabled = true;
      if (b.textContent === q.answer) b.classList.add('is-correct');
      else if (b.textContent === selected && !ok) b.classList.add('is-wrong');
    });
    finishQuestion(ok, selected, q.answer);
  }

  function gradeOrder() {
    const q = state.questions[state.qIdx];
    if (state.orderPicked.length !== q.items.length) return;
    const ok = state.orderPicked.every((item, i) => item === q.items[i]);
    document.querySelectorAll('#orderPicked .order-chip').forEach((c) =>
      c.classList.add(ok ? 'correct' : 'wrong'));
    $('checkBtn').hidden = true;
    finishQuestion(ok, state.orderPicked.join(' → '), q.items.join(' → '));
  }

  function finishQuestion(ok, userAnswer, correctAnswer) {
    const q = state.questions[state.qIdx];
    state.answered = true;
    state.results.push({ q, user: userAnswer, correct: ok, correctAnswer });

    const fb = $('feedback');
    fb.className = 'feedback show ' + (ok ? 'ok' : 'ng');
    $('fbVerdict').textContent = ok ? '○ せいかい！' : '× ざんねん…';
    $('fbBody').innerHTML =
      (ok ? '' : '<div class="the-answer">答え：' + esc(correctAnswer) + '</div>') +
      (q.exp ? '<div>' + esc(q.exp) + '</div>' : '');

    const nextBtn = $('nextBtn');
    nextBtn.textContent =
      state.qIdx === state.questions.length - 1 ? 'けっかを見る →' : 'つぎの問題 →';
    nextBtn.hidden = false;
    nextBtn.focus();
  }

  function next() {
    if (state.qIdx < state.questions.length - 1) {
      state.qIdx++;
      renderQuestion();
    } else {
      finishDrill();
    }
  }

  $('checkBtn').addEventListener('click', () => { if (!state.answered) gradeOrder(); });
  $('nextBtn').addEventListener('click', next);
  $('quitBtn').addEventListener('click', renderMenu);

  // ---------- review + report ----------
  function finishDrill() {
    const u = state.unit;
    const total = state.results.length;
    const score = state.results.filter((r) => r.correct).length;

    $('reviewTitle').textContent = u.num + '. ' + u.title + '　けっか';
    $('reviewScore').textContent = score + ' / ' + total;
    $('reviewMsg').textContent =
      score === total ? 'ぜんもんせいかい！すばらしい！' :
      score >= Math.ceil(total * 0.7) ? 'よくできました！まちがえた問題をたしかめよう。' :
      'まちがえた問題をたしかめて、もういちどチャレンジしよう。';

    $('reviewList').innerHTML = state.results.map((r, i) => {
      const cls = r.correct ? 'ok' : 'ng';
      const mark = r.correct ? '○' : '×';
      return '<div class="review-item ' + cls + '">' +
        '<div class="ri-head"><span class="ri-mark">' + mark + '</span>' +
        '<span class="ri-q">' + (i + 1) + '. ' + esc(r.q.q) + '</span></div>' +
        (r.correct ? '' :
          '<div class="ri-detail">あなたの答え：' + esc(r.user || '（無回答）') +
          '　／　答え：<strong>' + esc(r.correctAnswer) + '</strong></div>') +
        (r.q.exp ? '<div class="ri-exp">' + esc(r.q.exp) + '</div>' : '') +
        '</div>';
    }).join('');

    state.completed[u.key] = score + '/' + total;
    show('screen-review');

    // best-effort gradebook report (per-item detail included so the
    // gradebook's per-question analysis works). Never blocks the flow.
    if (window.Rika3Report) {
      window.Rika3Report.report({
        unitKey: u.key,
        unitTitle: u.num + '. ' + u.title,
        strand: u.strandId,
        score,
        total,
        items: state.results.map((r, i) => ({
          itemRef: u.key + '/' + (r.q.id || ('q' + i)),
          category: r.q.cat || null,
          prompt: r.q.q,
          correct: r.correct,
          selectedAnswer: r.user,
          correctAnswer: r.correctAnswer,
        })),
      });
    }
  }

  $('retryBtn').addEventListener('click', () => {
    // fresh instances (generated questions re-roll) for the same unit
    startDrill();
  });
  $('backToMenuBtn').addEventListener('click', renderMenu);

  // ---------- account bubble ----------
  async function initAccount() {
    if (!window.Rika3Report) return;
    try {
      const profile = await window.Rika3Report.getProfile();
      if (!profile) return;
      const name = profile.display_name || profile.full_name || '';
      if (!name) return;
      $('bubbleName').textContent = name;
      $('bubbleAvatar').textContent = name.slice(0, 1);
      const bubble = $('accountBubble');
      bubble.hidden = false;
      $('bubbleBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        bubble.classList.toggle('open');
      });
      document.addEventListener('click', () => bubble.classList.remove('open'));
      $('signoutBtn').addEventListener('click', async () => {
        await window.Rika3Report.signOut();
        window.location.href = '../../hub/login.html';
      });
    } catch (e) {
      console.log('[Rika3] account bubble skipped:', e && e.message);
    }
  }

  // expose internals for tests
  window.__rika3Test = { state, UNIT_BY_KEY, buildQuestions, shuffle };

  // ---------- boot ----------
  renderMenu();
  initAccount();

  // Load this class's focus units, then re-render to foreground them. Async and
  // non-blocking: the menu is already usable with all units; if the fetch fails
  // or returns null, nothing changes (no regression). Mirrors sansu3.
  if (window.Rika3Report && window.Rika3Report.getFocusUnits) {
    window.Rika3Report.getFocusUnits().then(function (keys) {
      if (keys && keys.length) { focusUnits = new Set(keys); renderMenu(); }
    });
  }
})();
