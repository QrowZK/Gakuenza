// eiken-report.js — the module-contract adapter. Replaces the old app's own
// login modal + custom sync layer entirely: this module trusts the SAME
// Supabase session the hub already established (same project, same auth),
// and reports results into the shared activity_results table instead of a
// bespoke quiz_results table.
(async function () {
  const cfg = window.GAKUENZA_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '../../hub/login.html'; return; }
  const userId = session.user.id;

  // ── Account bubble (name + sign-out) — an account-level feature, so it
  // renders regardless of whether module/school context resolves below. ──
  (async function renderAccountBubble() {
    const mount = document.getElementById('module-account-mount');
    if (!mount) return;
    const { data: profile } = await sb.from('profiles').select('display_name').eq('id', userId).maybeSingle();
    const given = window.HubCommon ? window.HubCommon.givenName(profile?.display_name || '') : (profile?.display_name || '');
    const initial = given.charAt(0) || '?';

    mount.innerHTML = `
      <div class="module-account" id="module-account">
        <button class="module-account-btn" id="module-account-btn" type="button">
          <span class="module-account-avatar">${initial}</span>
          <span class="module-account-name">${profile?.display_name || '未登録'}さん</span>
        </button>
        <div class="module-account-menu hidden" id="module-account-menu">
          <button class="module-account-signout" id="module-account-signout" type="button">サインアウト</button>
        </div>
      </div>`;

    const btn = document.getElementById('module-account-btn');
    const menu = document.getElementById('module-account-menu');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => menu.classList.add('hidden'));
    menu.addEventListener('click', (e) => e.stopPropagation());

    document.getElementById('module-account-signout').addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = '../../hub/login.html';
    });
  })();

  // Resolve this module's id, and this student's class/school — needed to
  // satisfy activity_results' NOT NULL columns and RLS scoping.
  const [{ data: moduleRow }, { data: enrollmentRows }] = await Promise.all([
    sb.from('modules').select('id').eq('key', 'eiken').maybeSingle(),
    sb.from('enrollments').select('class_id, classes(school_id)').eq('user_id', userId).eq('role', 'student').limit(1),
  ]);
  const moduleId = moduleRow?.id || null;
  const classId = enrollmentRows?.[0]?.class_id || null;
  const schoolId = enrollmentRows?.[0]?.classes?.school_id || null;

  if (!moduleId || !schoolId) {
    console.warn('[EikenReport] no module/school context for this account — results will not be reported.');
    return;
  }

  // recordSession is a plain top-level function declared in app.js; wrapping
  // it here (rather than editing app.js) keeps the ported quiz logic
  // completely untouched.
  const _origRecordSession = window.recordSession;
  window.recordSession = function (res) {
    _origRecordSession(res);

    const correct = res.filter(r => r.chosen === r.correct).length;
    const total = res.length;
    // currentLevel/currentSet/questions are top-level `let` bindings from
    // app.js — classic (non-module) scripts on the same page share that
    // scope, so they're reachable here as bare identifiers, just not via
    // `window.`. `questions.find(x=>x.id===r.qId)` is the exact same
    // lookup app.js's own results/stats screens already do — reusing it
    // here, not inventing a new one.
    const ref = `eiken/${currentLevel}/${currentSet}/${Date.now()}`;

    // Per-item detail (added for the gradebook retrofit, 2026-07-09) —
    // eiken already computed everything needed for its own on-screen
    // results/category-stats screens; this just reports the same data
    // instead of discarding it after rendering. opts[origChosen/origCorrect]
    // gives the actual answer TEXT, not just an option index, so a
    // teacher reading this later sees "chose 'garden' instead of
    // 'garage'" — not "chose option 1".
    const items = res.map(r => {
      const q = questions.find(x => x.id === r.qId);
      if (!q) return null;
      return {
        itemRef: `${q.cat}:${q.id}`,
        category: q.cat,
        prompt: q.q,
        correct: r.chosen === r.correct,
        selectedAnswer: q.opts[r.origChosen],
        correctAnswer: q.opts[r.origCorrect],
      };
    }).filter(Boolean);

    window.HubCommon.reportActivityWithItems(sb, {
      schoolId, classId, moduleId, userId,
      activityRef: ref, score: correct, maxScore: total,
      payload: { level: currentLevel, set: currentSet },
      items,
    }).then(({ ok, error }) => {
      if (!ok) console.error('[EikenReport] failed to report result:', error);
      else console.log('[EikenReport] reported', correct, '/', total, 'to activity_results (with', items.length, 'item(s))');
    });
  };
})();
