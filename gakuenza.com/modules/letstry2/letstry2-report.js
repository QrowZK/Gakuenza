// letstry2-report.js — the module-contract adapter, same role as
// nh6-report.js / eiken-report.js.
//
// Replaces LetsTry2Utility's own supabase-bridge.js + supabase-client.js
// entirely: those pointed at a different Supabase project
// (rfntsrcguhldybddfgcl.supabase.co) with their own auth/login modal and
// their own result table, bolted onto the DOM from outside. This module
// trusts the SAME Supabase session the hub already established, and
// reports results into the shared activity_results table.
//
// Unlike nh6 (whose app.js calls window.hk.getUser() itself), this app's
// own index.html only ever guards with `typeof window.hk !== "undefined"`
// before calling syncQuizResult() directly (see showReview() in
// index.html) — it never called getUser/signIn/getProfile itself; only
// the now-deleted bridge did. So this shim only needs to define
// syncQuizResult().
(async function () {
  const cfg = window.GAKUENZA_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '../../hub/login.html'; return; }
  const userId = session.user.id;

  // ── Account bubble (name + sign-out) — identical pattern to eiken/nh6 ──
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
    sb.from('modules').select('id').eq('key', 'letstry2').maybeSingle(),
    sb.from('enrollments').select('class_id, classes(school_id)').eq('user_id', userId).eq('role', 'student').limit(1),
  ]);
  const moduleId = moduleRow?.id || null;
  const classId = enrollmentRows?.[0]?.class_id || null;
  const schoolId = enrollmentRows?.[0]?.classes?.school_id || null;

  if (!moduleId || !schoolId) {
    console.warn('[LetsTry2Report] no module/school context for this account — results will not be reported.');
  }

  // The shim itself. index.html's showReview() (see the "Gakuenza sync"
  // block added there) calls exactly this, guarded by
  // `typeof window.hk !== 'undefined'`:
  //   await window.hk.syncQuizResult({ level, setId, category, correct, total, app_id });
  window.hk = {
    async syncQuizResult({ level, setId, category, correct, total, app_id }) {
      if (!moduleId || !schoolId) return; // context didn't resolve; nothing to report
      const ref = `letstry2/${category}/${level}/${Date.now()}`;
      const { error } = await sb.from('activity_results').insert({
        school_id: schoolId,
        class_id: classId,
        module_id: moduleId,
        user_id: userId,
        activity_ref: ref,
        score: correct,
        max_score: total,
        payload: { level, setId, category, app_id },
      });
      if (error) { console.error('[LetsTry2Report] failed to report result:', error); throw error; }
      console.log('[LetsTry2Report] reported', correct, '/', total, 'to activity_results');
    },
  };
})();
