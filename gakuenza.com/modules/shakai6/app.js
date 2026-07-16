// 社会6年 module — app logic.
// Adapted from the 社会4年 engine. Key difference: focus_units is matched at
// the SECTION level, not the unit level. History (unit 2) is one big unit of
// 12 chronological sections, and the spec calls for sub-unit-level focus keys
// (u2a_jomon_kofun .. u2l_postwar_japan) so a teacher can assign a single
// period. So every section carries its own `key`; units 1 and 3 give all
// their sections the same unit-level key (u1_politics / u3_japan_and_the_
// world). A unit is foregrounded when any of its sections is assigned, and
// within a foregrounded unit the non-assigned sections stay visible but
// dimmed — never hard-hidden. Fails soft to "all units" on null/empty/no-match.
//
// Reporting sends per-question `items` so activity_result_items gets populated
// (via HubCommon.reportActivityWithItems in the report shim).
(function () {
  'use strict';

  const { UNITS, FIGURES } = window.SHAKAI6_DATA;

  // Stable question IDs for ふくしゅう history (activity_results.payload).
  // `${sectionId}-${index}` — append new questions at the END of a section
  // so existing student history stays valid.
  const QUESTION_INDEX = {};
  UNITS.forEach((u) => u.sections.forEach((s) => s.questions.forEach((q, i) => {
    q.id = s.id + '-' + i;
    QUESTION_INDEX[q.id] = q;
  })));

  // ---------- answer normalization ----------
  function normalize(s) {
    if (!s) return '';
    let t = String(s).normalize('NFKC').trim();
    t = t.replace(/[\s　]+/g, '');
    t = t.replace(/[。、．，.,!！?？]+$/g, '');
    t = t.replace(/[ァ-ヶ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60)
    );
    return t.toLowerCase();
  }

  function isCorrect(userInput, accepted) {
    const u = normalize(userInput);
    if (!u) return false;
    return accepted.some((a) => normalize(a) === u);
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
    unit: null,          // unit object or null (matome/fukushu use pseudo units)
    section: null,       // section-like { id, title, lessons, questions, activityKey, unitNum }
    lessonIdx: 0,
    qIdx: 0,
    results: [],         // { q, user, correct }
    answered: false,
    orderPicked: [],     // for order questions: array of item strings in picked order
    orderShuffled: [],
    completed: {},       // sectionId -> score string (per page load)
    sessionOutcomes: [], // { id, correct } this page load (newest last)
    backendRows: null,   // cached activity_results rows (newest first) or null
    focusUnits: null,    // array of section keys (class_modules.focus_units) or null
  };

  // ---------- dom helpers ----------
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

  // ---------- ふくしゅう set computation ----------
  // Latest outcome per question id wins. Session outcomes are newer than
  // backend rows; backend rows arrive newest-first.
  function computeWrongIds() {
    const latest = {};
    for (let i = state.sessionOutcomes.length - 1; i >= 0; i--) {
      const o = state.sessionOutcomes[i];
      if (!(o.id in latest)) latest[o.id] = o.correct;
    }
    if (state.backendRows) {
      for (const row of state.backendRows) {
        const d = row && row.payload;
        if (!d) continue;
        (d.wrong || []).forEach((id) => { if (!(id in latest)) latest[id] = false; });
        (d.right || []).forEach((id) => { if (!(id in latest)) latest[id] = true; });
      }
    }
    return Object.keys(latest).filter((id) => latest[id] === false && QUESTION_INDEX[id]);
  }

  async function refreshFukushuCard() {
    const card = $('fukushuCard');
    if (!card) return;
    const meta = card.querySelector('.sec-meta');
    if (state.backendRows === null && window.Shakai6Report) {
      meta.textContent = '読み込み中…';
      try {
        state.backendRows = await window.Shakai6Report.fetchResults();
      } catch (e) {
        state.backendRows = [];
      }
      if (state.backendRows === null || state.backendRows === undefined) state.backendRows = [];
    }
    const wrong = computeWrongIds();
    if (wrong.length) {
      meta.textContent = 'まちがえた問題 ' + wrong.length + '問';
      card.disabled = false;
    } else {
      meta.textContent = 'まちがえた問題はありません';
      card.disabled = true;
    }
  }

  // ---------- focus_units ordering (section-level) ----------
  // Foreground units that contain at least one assigned section; within them,
  // dim (but never hide) the non-assigned sections. Units with no assigned
  // section drop below a divider, whole-block dimmed. Fail soft to "all units,
  // normal order" when focus_units is null, empty, malformed, or matches
  // nothing (so a stale/typo'd key never hides the whole module).
  function partitionUnits() {
    const f = state.focusUnits;
    if (!Array.isArray(f) || !f.length) {
      return { focus: UNITS, rest: [], set: null, scoped: false };
    }
    const set = new Set(f);
    const focus = UNITS.filter((u) => u.sections.some((s) => set.has(s.key)));
    const rest = UNITS.filter((u) => !u.sections.some((s) => set.has(s.key)));
    if (!focus.length) return { focus: UNITS, rest: [], set: null, scoped: false };
    return { focus, rest, set, scoped: true };
  }

  // unitDimmed: whole block is a "other unit" (below the divider).
  // focusSet: when scoped, the set of assigned section keys — sections not in
  // it render dimmed inside a foregrounded unit.
  function unitBlock(unit, unitDimmed, focusSet) {
    const block = document.createElement('div');
    block.className = 'unit-block ' + unit.color + (unitDimmed ? ' dimmed' : '');
    const head = document.createElement('div');
    head.className = 'unit-head';
    head.innerHTML =
      '<span class="unit-badge">' + esc(unit.num) + '</span>' +
      '<span class="unit-title">' + esc(unit.title) +
      (unit.sub ? '<span class="unit-sub">' + esc(unit.sub) + '</span>' : '') +
      '</span>';
    const matomeBtn = document.createElement('button');
    matomeBtn.type = 'button';
    matomeBtn.className = 'matome-btn';
    matomeBtn.textContent = 'まとめテスト';
    matomeBtn.setAttribute('data-matome', unit.id);
    matomeBtn.addEventListener('click', () => startMatome(unit));
    head.appendChild(matomeBtn);
    block.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'section-grid';
    unit.sections.forEach((sec) => {
      const card = document.createElement('button');
      card.type = 'button';
      const dimSec = !unitDimmed && focusSet && !focusSet.has(sec.key);
      card.className = 'section-card' + (dimSec ? ' dimmed' : '');
      card.setAttribute('data-section', sec.id);
      const done = state.completed[sec.id];
      card.innerHTML =
        '<div class="sec-title">' + esc(sec.title) + '</div>' +
        '<div class="sec-meta">レッスン ' + sec.lessons.length +
        '　・　問題 ' + sec.questions.length + '問</div>' +
        (done ? '<div class="sec-done">✔ ' + esc(done) + '</div>' : '');
      card.addEventListener('click', () => startSection(unit, sec));
      grid.appendChild(card);
    });
    block.appendChild(grid);
    return block;
  }

  // ---------- menu ----------
  function renderMenu() {
    const root = $('unitList');
    root.innerHTML = '';

    // ふくしゅう card
    const fk = document.createElement('button');
    fk.type = 'button';
    fk.id = 'fukushuCard';
    fk.className = 'section-card fukushu-card';
    fk.disabled = true;
    fk.innerHTML =
      '<div class="sec-title">ふくしゅう</div>' +
      '<div class="sec-meta">読み込み中…</div>';
    fk.addEventListener('click', startFukushu);
    root.appendChild(fk);

    const { focus, rest, set, scoped } = partitionUnits();

    const note = $('focusNote');
    if (scoped) {
      note.innerHTML =
        '<div class="focus-note">先生が <b>今学しゅうする単元</b> をえらんでいます。' +
        'まずは上の単元にチャレンジしよう。ほかの単元も下から学べます。</div>';
    } else {
      note.innerHTML = '';
    }

    focus.forEach((unit) => root.appendChild(unitBlock(unit, false, set)));

    if (rest.length) {
      const div = document.createElement('div');
      div.className = 'units-divider';
      div.textContent = 'ほかの単元';
      root.appendChild(div);
      rest.forEach((unit) => root.appendChild(unitBlock(unit, true, null)));
    }

    show('screen-menu');
    refreshFukushuCard();
  }

  // ---------- section / matome / fukushu entry points ----------
  function startSection(unit, sec) {
    state.unit = unit;
    state.section = {
      id: sec.id, title: sec.title,
      lessons: sec.lessons, questions: sec.questions,
      activityKey: sec.id, unitNum: unit.num,
    };
    state.lessonIdx = 0;
    if (!sec.lessons.length) { startDrill(); return; }
    renderLesson();
    show('screen-lesson');
  }

  function startMatome(unit) {
    const pool = [];
    unit.sections.forEach((s) => pool.push(...s.questions));
    const questions = shuffle(pool).slice(0, Math.min(12, pool.length));
    state.unit = unit;
    state.section = {
      id: unit.id + '-matome',
      title: unit.title + '　まとめテスト',
      lessons: [], questions,
      activityKey: unit.id + '-matome', unitNum: unit.num,
    };
    startDrill();
  }

  function startFukushu() {
    const ids = shuffle(computeWrongIds()).slice(0, 15);
    if (!ids.length) return;
    state.unit = null;
    state.section = {
      id: 'fukushu', title: 'ふくしゅう',
      lessons: [], questions: ids.map((id) => QUESTION_INDEX[id]),
      activityKey: 'fukushu', unitNum: 0,
    };
    startDrill();
  }

  // ---------- lessons ----------
  function figureBox(figKey) {
    return '<div class="fig">' + (FIGURES[figKey] || '') + '</div>';
  }

  function renderLesson() {
    const sec = state.section;
    const i = state.lessonIdx;
    const lesson = sec.lessons[i];
    $('lessonSectionTitle').textContent =
      (state.unit ? state.unit.num + '　' + state.unit.title + '　—　' : '') + sec.title;

    let html = '<h2>' + esc(lesson.title) + '</h2>' +
      '<p class="body">' + lesson.body + '</p>';
    if (lesson.point) html += '<div class="point">' + lesson.point + '</div>';
    if (lesson.care) html += '<div class="care">' + lesson.care + '</div>';
    if (lesson.fig) html += figureBox(lesson.fig);
    $('lessonCard').innerHTML = html;

    $('lessonDots').innerHTML = sec.lessons
      .map((_, d) => '<span class="dot' + (d === i ? ' on' : '') + '"></span>')
      .join('');
    $('lessonPrev').disabled = i === 0;
    $('lessonNext').textContent = i === sec.lessons.length - 1 ? '問題へ →' : 'つぎ →';
  }

  $('lessonPrev').addEventListener('click', () => {
    if (state.lessonIdx > 0) { state.lessonIdx--; renderLesson(); }
  });
  $('lessonNext').addEventListener('click', () => {
    if (state.lessonIdx < state.section.lessons.length - 1) {
      state.lessonIdx++;
      renderLesson();
    } else {
      startDrill();
    }
  });
  $('lessonSkip').addEventListener('click', startDrill);

  // ---------- drill ----------
  function startDrill() {
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
      });
      pool.appendChild(chip);
    });
  }

  function renderQuestion() {
    const sec = state.section;
    const q = sec.questions[state.qIdx];
    state.answered = false;

    $('drillTitle').textContent = sec.title;
    $('drillCounter').textContent =
      '第' + (state.qIdx + 1) + '問 / ' + sec.questions.length + '問';
    $('drillFill').style.width =
      Math.round((state.qIdx / sec.questions.length) * 100) + '%';

    // figure
    const figBox = $('qFig');
    if (q.fig) {
      figBox.innerHTML = FIGURES[q.fig] || '';
      figBox.hidden = false;
    } else {
      figBox.hidden = true;
      figBox.innerHTML = '';
    }

    $('qText').textContent = q.q;

    // typed vs order UI
    const isOrder = q.type === 'order';
    $('answerRow').hidden = isOrder;
    $('orderArea').hidden = !isOrder;
    if (isOrder) {
      state.orderPicked = [];
      do { state.orderShuffled = shuffle(q.items); }
      while (state.orderShuffled.join('|') === q.items.join('|'));
      renderOrderChips();
    } else {
      const input = $('answerInput');
      input.value = '';
      input.className = 'answer-input';
      input.disabled = false;
      input.focus();
    }

    // hint
    const hintBtn = $('hintBtn');
    hintBtn.hidden = !q.hint;
    $('hintText').hidden = true;
    $('hintText').textContent = q.hint ? 'ヒント：' + q.hint : '';

    const fb = $('feedback');
    fb.className = 'feedback';
    $('checkBtn').hidden = false;
    $('nextBtn').hidden = true;
  }

  function check() {
    if (state.answered) return;
    const sec = state.section;
    const q = sec.questions[state.qIdx];
    let ok, userAnswer;

    if (q.type === 'order') {
      if (state.orderPicked.length !== q.items.length) return; // not done picking
      ok = state.orderPicked.every((item, i) => item === q.items[i]);
      userAnswer = state.orderPicked.join(' → ');
      document.querySelectorAll('#orderPicked .order-chip').forEach((c) =>
        c.classList.add(ok ? 'correct' : 'wrong'));
    } else {
      const input = $('answerInput');
      userAnswer = input.value;
      if (!normalize(userAnswer)) { input.focus(); return; }
      ok = isCorrect(userAnswer, q.a);
      input.disabled = true;
      input.classList.add(ok ? 'correct' : 'wrong');
    }

    state.answered = true;
    state.results.push({ q, user: userAnswer, correct: ok });
    state.sessionOutcomes.push({ id: q.id, correct: ok });

    const fb = $('feedback');
    fb.className = 'feedback show ' + (ok ? 'ok' : 'ng');
    $('fbVerdict').textContent = ok ? '○ せいかい！' : '× ざんねん…';
    const answerText = q.type === 'order' ? q.items.join(' → ') : q.a[0];
    $('fbBody').innerHTML =
      '<div class="the-answer">答え：' + esc(answerText) + '</div>' +
      (q.exp ? '<div>' + esc(q.exp) + '</div>' : '');

    $('checkBtn').hidden = true;
    const nextBtn = $('nextBtn');
    nextBtn.textContent =
      state.qIdx === sec.questions.length - 1 ? 'けっかを見る →' : 'つぎの問題 →';
    nextBtn.hidden = false;
    nextBtn.focus();
  }

  function next() {
    if (state.qIdx < state.section.questions.length - 1) {
      state.qIdx++;
      renderQuestion();
    } else {
      finishDrill();
    }
  }

  $('checkBtn').addEventListener('click', check);
  $('nextBtn').addEventListener('click', next);
  $('hintBtn').addEventListener('click', () => { $('hintText').hidden = false; });
  $('answerInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // during IME composition, Enter confirms the conversion — don't submit
      if (e.isComposing || e.keyCode === 229) return;
      // preventDefault: check() focuses the next-button, and without this the
      // same keystroke's activation would fire on it and skip the feedback
      e.preventDefault();
      if (!state.answered) check(); else next();
    }
  });
  $('quitBtn').addEventListener('click', () => renderMenu());

  // ---------- review ----------
  function answerTextFor(q) {
    return q.type === 'order' ? q.items.join(' → ') : q.a[0];
  }

  function finishDrill() {
    const sec = state.section;
    const total = sec.questions.length;
    const score = state.results.filter((r) => r.correct).length;

    $('reviewTitle').textContent = sec.title + '　けっか';
    $('reviewScore').textContent = score + ' / ' + total;
    $('reviewMsg').textContent =
      score === total ? 'ぜんもんせいかい！すばらしい！' :
      score >= Math.ceil(total * 0.7) ? 'よくできました！' :
      'まちがえた問題をたしかめて、もういちどチャレンジしよう。';

    $('reviewList').innerHTML = state.results.map((r) => {
      const cls = r.correct ? 'ok' : 'ng';
      const mark = r.correct ? '○' : '×';
      const answerText = answerTextFor(r.q);
      return '<div class="review-item ' + cls + '">' +
        '<span class="mark">' + mark + '</span>' + esc(r.q.q) +
        '<div class="ri-user">あなたの答え：' + esc(r.user) +
        (r.correct ? '' : '　／　答え：' + esc(answerText)) + '</div>' +
        '</div>';
    }).join('');

    state.completed[sec.id] = score + '/' + total + ' せいかい';
    show('screen-review');

    // report to hub backend (silently skips if context missing). Build the
    // per-question item detail so activity_result_items gets populated.
    if (window.Shakai6Report) {
      const items = state.results.map((r) => ({
        itemRef: r.q.id,
        category: sec.title,
        prompt: r.q.q,
        correct: r.correct,
        selectedAnswer: r.user,
        correctAnswer: answerTextFor(r.q),
      }));
      window.Shakai6Report.report({
        sectionId: sec.activityKey,
        sectionTitle: sec.title,
        unit: sec.unitNum,
        score,
        total,
        rightIds: state.results.filter((r) => r.correct).map((r) => r.q.id),
        wrongIds: state.results.filter((r) => !r.correct).map((r) => r.q.id),
        items,
      });
    }
  }

  $('retryBtn').addEventListener('click', () => startDrill());
  $('backToMenuBtn').addEventListener('click', () => renderMenu());

  // ---------- account bubble ----------
  async function initAccountBubble() {
    try {
      if (!window.Shakai6Report) return;
      const profile = await window.Shakai6Report.getProfile();
      if (!profile) return;
      const name =
        (window.HubCommon && window.HubCommon.givenName && window.HubCommon.givenName(profile.display_name)) ||
        profile.display_name || profile.full_name || '';
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
        await window.Shakai6Report.signOut();
        location.href = '../../hub/login.html';
      });
    } catch (e) {
      console.log('[Shakai6] account bubble skipped:', e && e.message);
    }
  }

  // Load focus_units, then re-render the menu so assigned units foreground.
  async function initFocusUnits() {
    try {
      if (!window.Shakai6Report || !window.Shakai6Report.getFocusUnits) return;
      const fu = await window.Shakai6Report.getFocusUnits();
      if (Array.isArray(fu) && fu.length) {
        state.focusUnits = fu;
        // only re-render if still on the menu (don't yank a student out of a drill)
        if ($('screen-menu').classList.contains('active')) renderMenu();
      }
    } catch (e) {
      console.log('[Shakai6] focus_units skipped:', e && e.message);
    }
  }

  // expose internals for tests
  window.__shakai6Test = { normalize, isCorrect, computeWrongIds, partitionUnits, QUESTION_INDEX, state, UNITS };

  // ---------- boot ----------
  renderMenu();
  initAccountBubble();
  initFocusUnits();
})();
