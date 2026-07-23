// nh6-report.js — the module-contract adapter, same role as eiken-report.js.
// Replaces NH6's own login modal + independent Supabase backend (a
// different project, its own quiz_results table) entirely: this module
// trusts the SAME Supabase session the hub already established, and
// reports results into the shared activity_results table.
//
// Unlike eiken (which wraps an existing window.recordSession function),
// app.js here calls window.hk.getUser() / window.hk.syncQuizResult()
// directly — so instead of wrapping something that already exists, this
// DEFINES window.hk fresh, implementing only the two methods app.js still
// calls now that its login-modal code (the only caller of every other
// window.hk method) has been removed.
(async function () {
  const cfg = window.GAKUENZA_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = '../../hub/login.html'; return; }
  const userId = session.user.id;

  // ── Account bubble (name + sign-out) — identical pattern to eiken-report.js ──
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
    sb.from('modules').select('id').eq('key', 'nh6').maybeSingle(),
    sb.from('enrollments').select('class_id, classes(school_id)').eq('user_id', userId).eq('role', 'student').limit(1),
  ]);
  const moduleId = moduleRow?.id || null;
  const classId = enrollmentRows?.[0]?.class_id || null;
  const schoolId = enrollmentRows?.[0]?.classes?.school_id || null;

  if (!moduleId || !schoolId) {
    console.warn('[NH6Report] no module/school context for this account — results will not be reported.');
  }

  // The shim itself. app.js's showResults() (unchanged from the original
  // app) calls exactly these two methods, guarded by
  // `typeof window.hk !== 'undefined'`:
  //   const user = await window.hk.getUser();
  //   if (user) await window.hk.syncQuizResult({ level, setId, category, correct, total, app_id });
  window.hk = {
    async getUser() {
      return { id: userId, email: session.user.email };
    },
    async syncQuizResult({ level, setId, category, correct, total, app_id, items }) {
      if (!moduleId || !schoolId) return; // context didn't resolve; nothing to report
      if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) {
        console.warn('[NH6Report] HubCommon.reportActivityWithItems unavailable — skipping.');
        return;
      }
      // Route through the shared helper so the summary row AND per-question
      // activity_result_items detail are written together (this shim used to
      // hand-roll the activity_results insert and never wrote the item detail,
      // so the gradebook's per-question analysis had nothing for nh6).
      const out = await window.HubCommon.reportActivityWithItems(sb, {
        schoolId, classId, moduleId, userId,
        activityRef: `nh6/${level}/${setId}/${Date.now()}`,
        score: correct,
        maxScore: total,
        payload: { level, setId, category, app_id },
        items: items || [],
      });
      if (!out.ok) console.error('[NH6Report] failed to report result:', out.error);
      else console.log('[NH6Report] reported', correct, '/', total, 'to activity_results');
    },
  };
})();
