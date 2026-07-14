// 算数3年 module — app logic
(function () {
  'use strict';

  const UNITS = window.SANSU3_DATA.UNITS;

  // ---------- unit-scoped pacing (focus_units) ----------
  // Canonical unit key = 'u' + zero-padded unit number (u01..u17). These are
  // the keys stored in class_modules.focus_units and offered by the
  // assignment UI (see hub/module-units.js). null focus = all units (today's
  // behavior); a populated set foregrounds those units without hiding others.
  function unitKey(u) { return 'u' + String(u.num).padStart(2, '0'); }
  let focusUnits = null; // null = show all normally; Set = foreground these

  // ---------- answer normalization ----------
  // Handles: full-width digits/letters (NFKC), whitespace, trailing
  // punctuation, unit words the question already shows, katakana→hiragana.
  function normalize(s) {
    if (s == null) return '';
    let t = String(s).normalize('NFKC').trim();
    t = t.replace(/[\s\u3000]+/g, '');
    t = t.replace(/[。、．，.,!！?？]+$/g, '');
    t = t.replace(/,/g, ''); // 12,000 -> 12000
    t = t.replace(/[\u30a1-\u30f6]/g, function (ch) {
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
      // allow the student to type the unit the box already shows: "24cm"
      if (unitSuffix && normalize(String(accepted[i]) + unitSuffix) === u) return true;
    }
    return false;
  }

  // Exposed so tests can assert every generated problem's canonical
  // answer passes its own checker (test-the-actual-thing convention).
  window.SANSU3_CHECK = { normalize: normalize, isCorrect: isCorrect };

  // ---------- state ----------
  const state = {
    section: null,     // { id, title, gen, n, unitTitle }
    problems: [],      // generated for this attempt
    qIdx: 0,
    results: [],       // { p, user, correct }
    answered: false,
    completed: {},     // sectionId -> 'score/total' (this page load)
  };

  // ---------- dom helpers ----------
  const $ = function (id) { return document.getElementById(id); };
  function show(screenId) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
    $(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ---------- menu ----------
  function unitCard(u) {
    const card = document.createElement('div');
    card.className = 'unit-card';
    if (focusUnits && focusUnits.has(unitKey(u))) card.classList.add('unit-card--focus');
    const head = document.createElement('div');
    head.className = 'unit-head';
    const badge = (focusUnits && focusUnits.has(unitKey(u)))
      ? '<span class="unit-focus-badge">今週</span>' : '';
    head.innerHTML = '<span class="unit-num">' + u.num + '</span><span class="unit-title">' + esc(u.title) + '</span>' + badge;
    card.appendChild(head);
    u.sections.forEach(function (s) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sec-btn';
      const done = state.completed[s.id];
      btn.innerHTML = '<span class="sec-title">' + esc(s.title) + '</span>' +
        '<span class="sec-meta">' + (done ? 'さいごの結果 ' + esc(done) : '全' + s.n + '問') + '</span>';
      btn.addEventListener('click', function () { startSection(u, s); });
      card.appendChild(btn);
    });
    return card;
  }

  function renderMenu() {
    const root = $('unitList');
    root.innerHTML = '';

    // Foreground pass: when the class is focused on specific units, relocate
    // those to the top under "今週の単元"; the rest stay fully reachable below
    // under "ほかの単元" (foreground, don't hide — a curious child can still
    // explore ahead; nothing is removed, just reordered).
    const foregrounding = !!(focusUnits && focusUnits.size &&
      UNITS.some(function (u) { return focusUnits.has(unitKey(u)); }));
    if (foregrounding) {
      const fh = document.createElement('h2');
      fh.className = 'vol-head vol-head--focus';
      fh.textContent = '今週の単元';
      root.appendChild(fh);
      UNITS.filter(function (u) { return focusUnits.has(unitKey(u)); })
        .forEach(function (u) { root.appendChild(unitCard(u)); });
      const rh = document.createElement('h2');
      rh.className = 'vol-head';
      rh.textContent = 'ほかの単元';
      root.appendChild(rh);
    }

    // Main list. When foregrounding, the focused units are already shown above,
    // so skip them here (relocated, not duplicated).
    let currentVol = null;
    UNITS.forEach(function (u) {
      if (foregrounding && focusUnits.has(unitKey(u))) return;
      if (u.vol !== currentVol) {
        currentVol = u.vol;
        const h = document.createElement('h2');
        h.className = 'vol-head';
        h.textContent = currentVol === '上' ? '3年 上' : '3年 下';
        root.appendChild(h);
      }
      root.appendChild(unitCard(u));
    });
  }

  // ---------- drill ----------
  function startSection(unit, s) {
    const problems = [];
    const seen = new Set();
    let guard = 0;
    while (problems.length < s.n && guard++ < s.n * 30) {
      const p = s.gen();
      // avoid exact-duplicate problems within one attempt — keyed on
      // prompt AND answer (clock problems share one prompt text but
      // differ in figure/answer)
      const sig = p.q + '\u0000' + (p.kind === 'typed' ? p.answer : p.correctChoice);
      if (seen.has(sig)) continue;
      seen.add(sig);
      problems.push(p);
    }
    state.section = { id: s.id, title: s.title, n: s.n, unitTitle: unit.title, unitNum: unit.num };
    state.problems = problems;
    state.qIdx = 0;
    state.results = [];
    state.answered = false;
    $('drillTitle').textContent = unit.num + '. ' + s.title;
    show('screen-drill');
    renderQuestion();
  }

  function renderQuestion() {
    const p = state.problems[state.qIdx];
    state.answered = false;

    $('drillCounter').textContent = (state.qIdx + 1) + ' / ' + state.problems.length;
    $('drillFill').style.width = (100 * state.qIdx / state.problems.length) + '%';

    const fig = $('qFig');
    if (p.fig) { fig.innerHTML = p.fig; fig.hidden = false; }
    else { fig.innerHTML = ''; fig.hidden = true; }

    $('qText').textContent = p.q;

    const answerRow = $('answerRow');
    const choiceArea = $('choiceArea');
    const input = $('answerInput');
    $('unitSuffix').textContent = p.unitSuffix || '';

    if (p.kind === 'typed') {
      answerRow.hidden = false;
      choiceArea.hidden = true;
      choiceArea.innerHTML = '';
      input.value = '';
      input.disabled = false;
      input.setAttribute('inputmode', p.inputMode === 'numeric' ? 'numeric' : 'text');
      $('checkBtn').hidden = false;
      $('checkBtn').disabled = false;
      setTimeout(function () { input.focus(); }, 50);
    } else {
      answerRow.hidden = true;
      choiceArea.hidden = false;
      choiceArea.innerHTML = '';
      p.choices.forEach(function (c) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice-btn';
        b.textContent = c;
        b.addEventListener('click', function () { if (!state.answered) grade(c); });
        choiceArea.appendChild(b);
      });
      $('checkBtn').hidden = true;
    }

    const fb = $('feedback');
    fb.className = 'feedback';
    fb.hidden = true;
    $('nextBtn').hidden = true;
  }

  function grade(userAnswer) {
    const p = state.problems[state.qIdx];
    let ok;
    if (p.kind === 'typed') {
      ok = isCorrect(userAnswer, p.accepted, p.unitSuffix);
    } else {
      ok = userAnswer === p.correctChoice;
    }
    state.answered = true;
    state.results.push({ p: p, user: String(userAnswer), correct: ok });

    if (p.kind === 'typed') {
      $('answerInput').disabled = true;
      $('checkBtn').disabled = true;
    } else {
      document.querySelectorAll('.choice-btn').forEach(function (b) {
        b.disabled = true;
        if (b.textContent === p.correctChoice) b.classList.add('is-correct');
        else if (b.textContent === String(userAnswer) && !ok) b.classList.add('is-wrong');
      });
    }

    const fb = $('feedback');
    fb.hidden = false;
    fb.className = 'feedback ' + (ok ? 'ok' : 'ng');
    $('fbVerdict').textContent = ok ? '○ せいかい！' : '× ざんねん…';
    const correctTxt = p.kind === 'typed' ? p.answer + (p.unitSuffix || '') : p.correctChoice;
    $('fbBody').innerHTML = (ok ? '' : '<p class="fb-answer">正しい答え：<strong>' + esc(correctTxt) + '</strong></p>') +
      '<p class="fb-exp">' + esc(p.exp || '') + '</p>';
    $('nextBtn').hidden = false;
    $('nextBtn').textContent = state.qIdx + 1 >= state.problems.length ? '結果を見る →' : 'つぎの問題 →';
    $('nextBtn').focus();
  }

  function next() {
    if (state.qIdx + 1 >= state.problems.length) return finish();
    state.qIdx += 1;
    renderQuestion();
  }

  // ---------- finish / report / review ----------
  function finish() {
    const score = state.results.filter(function (r) { return r.correct; }).length;
    const total = state.results.length;
    state.completed[state.section.id] = score + '/' + total;

    // gradebook reporting — best-effort, never blocks the child’s flow
    if (window.Sansu3Report) {
      window.Sansu3Report.report({
        sectionId: state.section.id,
        sectionTitle: state.section.title,
        unit: state.section.unitNum + '. ' + state.section.unitTitle,
        score: score,
        total: total,
        items: state.results.map(function (r, i) {
          return {
            itemRef: state.section.id + '/' + r.p.tid + '/' + i,
            category: r.p.category,
            prompt: r.p.q,
            correct: r.correct,
            selectedAnswer: r.user,
            correctAnswer: r.p.kind === 'typed' ? r.p.answer : r.p.correctChoice,
          };
        }),
      });
    }

    $('reviewTitle').textContent = state.section.unitNum + '. ' + state.section.title + '　結果';
    $('reviewScore').textContent = score + ' / ' + total;
    $('reviewMsg').textContent =
      score === total ? 'パーフェクト！すばらしい！' :
      score >= total * 0.7 ? 'よくできました！まちがえた問題をたしかめよう。' :
      'もういちどチャレンジしてみよう。せつめいを読むとヒントになるよ。';

    const list = $('reviewList');
    list.innerHTML = '';
    state.results.forEach(function (r, i) {
      const row = document.createElement('div');
      row.className = 'review-item ' + (r.correct ? 'ok' : 'ng');
      const correctTxt = r.p.kind === 'typed' ? r.p.answer + (r.p.unitSuffix || '') : r.p.correctChoice;
      row.innerHTML =
        '<div class="ri-head"><span class="ri-mark">' + (r.correct ? '○' : '×') + '</span>' +
        '<span class="ri-q">' + (i + 1) + '. ' + esc(r.p.q) + '</span></div>' +
        (r.correct ? '' :
          '<div class="ri-detail">あなたの答え：' + esc(r.user || '（無回答）') +
          '　／　正しい答え：<strong>' + esc(correctTxt) + '</strong></div>') +
        '<div class="ri-exp">' + esc(r.p.exp || '') + '</div>';
      list.appendChild(row);
    });
    show('screen-review');
  }

  // ---------- account bubble ----------
  async function initAccount() {
    if (!window.Sansu3Report) return;
    try {
      const profile = await window.Sansu3Report.getProfile();
      if (!profile) return;
      const bubble = $('accountBubble');
      const name = profile.display_name || profile.full_name || '';
      if (!name) return;
      $('bubbleName').textContent = name;
      $('bubbleAvatar').textContent = name.charAt(0);
      bubble.hidden = false;
      $('bubbleBtn').addEventListener('click', function () {
        bubble.classList.toggle('open');
      });
      $('signoutBtn').addEventListener('click', async function () {
        await window.Sansu3Report.signOut();
        window.location.href = '/hub/login.html';
      });
    } catch (e) { /* anonymous preview is fine */ }
  }

  // ---------- wire up ----------
  document.addEventListener('DOMContentLoaded', function () {
    renderMenu();
    initAccount();

    // Load this class's focus units, then re-render to foreground them. Async
    // and non-blocking: the menu is already usable with all units; if the
    // fetch fails or returns null, nothing changes (no regression).
    if (window.Sansu3Report && window.Sansu3Report.getFocusUnits) {
      window.Sansu3Report.getFocusUnits().then(function (keys) {
        if (keys && keys.length) { focusUnits = new Set(keys); renderMenu(); }
      });
    }

    $('checkBtn').addEventListener('click', function () {
      if (!state.answered) grade($('answerInput').value);
    });
    $('answerInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        // Without preventDefault, grading moves focus to #nextBtn and the
        // same physical Enter press then delivers its default button
        // activation there — instantly skipping past the feedback the
        // child was supposed to read. Caught by the trusted-key E2E test
        // (synthetic events have no default action and hid this).
        e.preventDefault();
        if (!state.answered) grade($('answerInput').value);
        else next();
      }
    });
    $('nextBtn').addEventListener('click', next);
    $('quitBtn').addEventListener('click', function () {
      renderMenu();
      show('screen-menu');
    });
    $('retryBtn').addEventListener('click', function () {
      const u = UNITS.find(function (x) { return x.num === state.section.unitNum; });
      const s = u.sections.find(function (x) { return x.id === state.section.id; });
      startSection(u, s);
    });
    $('backToMenuBtn').addEventListener('click', function () {
      renderMenu();
      show('screen-menu');
    });
  });
})();
