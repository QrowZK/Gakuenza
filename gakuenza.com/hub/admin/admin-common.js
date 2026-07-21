// hub/admin/admin-common.js — shared across every hub/admin/*.html page.
// Mirrors hub-common.js's pattern (one shared module once >1 page needs
// the same guard/sidebar logic) but kept separate rather than merged into
// hub-common.js: the admin sidebar has a different nav set and a
// school_admin-only guard that student-facing pages must never run.
window.AdminCommon = (function () {

  // Shared lookup — resolves the caller's admin-tier membership WITHOUT
  // rendering any UI on failure (just returns null). Both
  // requireAdminAccess (renders a denial on failure) and
  // requireGradebookAccess (falls through to checking 'educator' on
  // failure, so it can't render a denial yet either) delegate to this,
  // rather than each keeping their own copy of the same three queries.
  //
  // Multi-school fix (#114): a coordinator (or, in principle, a school_admin)
  // can hold more than one school_members row — one per school they're
  // scoped to. This used to fetch only ONE row (.limit(1).maybeSingle()),
  // so a coordinator over N>1 schools only ever saw the first. Now fetches
  // ALL of the caller's school_admin/coordinator rows and returns the UNION
  // of their schools via admin.schools (and the derived admin.schoolIds).
  // Product decision: one tier per person — nobody is school_admin at one
  // school and coordinator at another — so tier is derived from the rows'
  // shared role. If rows are somehow mixed (shouldn't happen, not enforced
  // by a DB constraint), prefer the higher-privilege 'school_admin' tier
  // rather than erroring, and still expose every row's school in
  // admin.schools/schoolIds — RLS remains the real boundary on any write,
  // this is only ever the UI's read of "what should I show".
  async function lookupAdminTier(sb, userId) {
    const { data: profileRow } = await sb
      .from('profiles').select('is_platform_admin').eq('id', userId).maybeSingle();

    if (profileRow?.is_platform_admin) {
      return {
        tier: 'platform_admin', isPlatformAdmin: true, isCoordinator: false, canManageStaff: true,
        schoolId: null, schoolName: null, schoolIds: null, schools: null, userId,
      };
    }

    const { data } = await sb
      .from('school_members')
      .select('school_id, role, schools(name)')
      .eq('user_id', userId)
      .in('role', ['school_admin', 'coordinator']);

    if (!data || data.length === 0) return null;

    const hasSchoolAdmin = data.some(r => r.role === 'school_admin');
    const isCoordinator = !hasSchoolAdmin;
    const schools = data.map(r => ({ id: r.school_id, name: r.schools?.name || '' }));
    const first = data[0];
    return {
      tier: isCoordinator ? 'coordinator' : 'school_admin',
      isPlatformAdmin: false,
      isCoordinator,
      canManageStaff: !isCoordinator, // create teachers/admins, reset passwords
      // Single-school fields kept for existing consumers that only ever
      // needed "the" school (e.g. sidebar badge text) — the FIRST of the
      // caller's schools, not necessarily the only one. Any consumer that
      // needs to know every school this admin can act on must use
      // schoolIds/schools (or call getAccessibleSchools), not schoolId.
      schoolId: first.school_id,
      schoolName: first.schools?.name || '',
      schoolIds: data.map(r => r.school_id),
      schools,
      userId,
    };
  }

  // Every admin page calls this first, right after H.requireSession().
  // Confirms the signed-in user is one of three tiers:
  //   (a) platform admin (profiles.is_platform_admin) — every school,
  //       present and future, no school_members row required.
  //   (b) school_admin of a specific school — full admin of that school.
  //   (c) coordinator (added 2026-07-09) — can manage classes and
  //       enrollments and see everyone in their school, but cannot
  //       create teachers/admins, cannot create schools, cannot reset
  //       anyone's password. Pages/actions that are school_admin-only
  //       must check `admin.tier !== 'coordinator'` (or the
  //       `admin.canManageStaff` convenience flag below) themselves —
  //       this function only establishes identity/tier, not per-action
  //       authorization, same as before.
  //
  // Returns the membership info, or renders an access-denied state into
  // #app-root and returns null so the caller can stop.
  //
  // NOTE: this is a UX nicety, not the security boundary — RLS is what
  // actually prevents a non-admin (or a coordinator doing something
  // school_admin-only) from reading/writing admin-only data. A user who
  // bypasses this check client-side still hits RLS denials on every real
  // query. This just avoids showing a confusing page to someone whose
  // tier doesn't match what a page expects.
  async function requireAdminAccess(sb, userId) {
    const result = await lookupAdminTier(sb, userId);
    if (result) return result;

    const root = document.getElementById('app-root') || document.body;
    root.innerHTML = `
      <div class="ac-empty" style="max-width:440px;margin:80px auto;">
        <p>この画面を利用する権限がありません。</p>
        <a class="ac-btn ac-btn-ghost-light ac-btn-md ac-empty-cta" href="../index.html">ホームに戻る</a>
      </div>`;
    return null;
  }

  // Returns the schools this admin can act on: every school for a
  // platform admin, or the UNION of every school_admin/coordinator
  // school_members row's school for a scoped admin (#114 — a coordinator
  // can be scoped to more than one school; used to return only
  // admin.schoolId, i.e. just one). Shared by any admin page that needs a
  // school picker (class-detail.html's school/year/gumi picker, the
  // teachers list, students list, modules matrix, gradebook) so there's
  // exactly one copy of this logic, not one per page quietly drifting
  // apart.
  //
  // For non-platform-admins this reads admin.schools, already fetched by
  // lookupAdminTier — no extra round trip needed. De-duplicated and
  // sorted by name for a stable picker order (school_members rows arrive
  // in whatever order Postgres returns them).
  async function getAccessibleSchools(sb, admin) {
    if (admin.isPlatformAdmin) {
      const { data } = await sb.from('schools').select('id, name').order('name');
      return data || [];
    }
    const seen = new Map();
    (admin.schools || []).forEach(s => { if (!seen.has(s.id)) seen.set(s.id, s); });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }

  // Renders the admin sidebar into #sidebar-mount. Reuses the shared shell
  // classes from hub-shell.css (.sidebar/.nav/.nav-item/.profile-block/
  // .avatar/.brand-mark/.brand-sub) unchanged, per the design handoff —
  // only the nav items and badge differ from the student hub's sidebar.
  function renderAdminSidebar(sb, profile, activeKey, admin) {
    const mount = document.getElementById('sidebar-mount');
    if (!mount) return;
    const given = window.HubCommon.givenName(profile?.display_name || '');
    const initial = given.charAt(0) || '管';
    // Platform admins get a visibly different badge — one account with
    // access to every school's (minors') data is worth a constant visual
    // reminder, not just an internal flag nobody sees. Coordinators and
    // educators (added 2026-07-09) get their own badges too, distinct
    // from 管理者, since their actual permissions are meaningfully
    // narrower in each case.
    const badgeLabel = admin?.isPlatformAdmin ? '全校管理者'
      : admin?.isCoordinator ? 'コーディネーター'
      : admin?.tier === 'educator' ? '教員'
      : '管理者';

    // ホーム/設定 reuse pages that already exist on the student side (an
    // admin is still a person with their own dashboard/settings) —
    // クラス resets to the class picker, 教員/モジュール/生徒 are real
    // pages. 生徒 (added 2026-07-09) is the school-wide student list +
    // CSV import — available to every admin tier, same as クラス.
    //
    // A plain educator (added 2026-07-09, via requireGradebookAccess —
    // never reaches this page via requireAdminAccess at all) gets a
    // deliberately minimal nav: only 成績 is actually meant for them.
    // The rest of the admin console stays admin-tier only — this isn't
    // a general "teacher login" yet, just gradebook access.
    const navItems = admin?.tier === 'educator'
      ? [
          { key: 'home', label: 'ホーム', href: '../index.html' },
          { key: 'gradebook', label: '成績', href: '../gradebook/index.html' },
          { key: 'settings', label: '設定', href: '../settings.html' },
        ]
      : [
          { key: 'home', label: 'ホーム', href: '../index.html' },
          { key: 'teachers', label: '教員', href: 'teachers.html' },
          { key: 'students', label: '生徒', href: 'students.html' },
          { key: 'classes', label: 'クラス', href: 'class-detail.html' },
          { key: 'modules', label: 'モジュール', href: 'modules.html' },
          { key: 'gradebook', label: '成績', href: '../gradebook/index.html' },
          { key: 'settings', label: '設定', href: '../settings.html' },
        ];

    // Platform admins (全校管理者) get a cross-school 学校 tab for creating
    // and reviewing schools — a sysadmin-global surface, so it's only added
    // for that tier (RLS also gates the actual create to platform admins).
    if (admin?.isPlatformAdmin) {
      navItems.splice(1, 0, { key: 'schools', label: '学校', href: 'schools.html' });
    }

    mount.innerHTML = `
      <a class="gz-home" href="../index.html" title="ホームへ">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle class="gz-seat" style="--fx:0px;--fy:-48px"      cx="50" cy="20" r="6" fill="#F7F3EA"/>
          <circle class="gz-seat" style="--fx:41.6px;--fy:-24px"   cx="76" cy="35" r="6" fill="#F7F3EA"/>
          <circle class="gz-seat" style="--fx:41.6px;--fy:24px"    cx="76" cy="65" r="6" fill="#F7F3EA"/>
          <circle class="gz-seat" style="--fx:0px;--fy:48px"       cx="50" cy="80" r="6" fill="#F7F3EA"/>
          <circle class="gz-seat" style="--fx:-41.6px;--fy:24px"   cx="24" cy="65" r="6" fill="#F7F3EA"/>
          <circle class="gz-seat" style="--fx:-41.6px;--fy:-24px"  cx="24" cy="35" r="6" fill="#F7F3EA"/>
          <circle class="gz-ring" cx="50" cy="50" r="30" fill="none" stroke="#C9A24B" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="0.1 9"/>
          <path class="gz-star" d="M50 40.2 Q51.7 48.3 59.8 50 Q51.7 51.7 50 59.8 Q48.3 51.7 40.2 50 Q48.3 48.3 50 40.2 Z" fill="#C9A24B"/>
        </svg>
        <div class="gz-brandtext">
          <div class="brand-mark">がくえん座</div>
          <div class="brand-sub">Gakuenza</div>
        </div>
      </a>
      <div class="profile-block" style="margin-top:36px;">
        <div class="avatar">${initial}</div>
        <div class="profile-name">${profile?.display_name || '管理者'}</div>
        <div style="margin-top:6px;"><span class="ac-badge ac-badge-gold">${badgeLabel}</span></div>
      </div>
      <nav class="nav">
        ${navItems.map(n => n.href
          ? `<a class="nav-item${n.key === activeKey ? ' active' : ''}" href="${n.href}">${n.label}</a>`
          : `<div class="nav-item" title="準備中" style="display:flex;justify-content:space-between;opacity:0.55;">${n.label}<span style="font-size:0.65rem;">準備中</span></div>`
        ).join('')}
      </nav>
      <button class="ac-btn ac-btn-ghost-light ac-btn-block ac-btn-md" id="logout-btn" type="button" style="margin-top:12px;">ログアウト</button>
      ${bugReport.buttonHtml()}
    `;
    document.getElementById('logout-btn').addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = '../login.html';
    });
    bugReport.wire(sb);
  }

  // Gradebook-specific access check (added 2026-07-09) — deliberately
  // SEPARATE from requireAdminAccess rather than folded into it. This
  // recognizes a fourth tier, 'educator' (a plain classroom teacher),
  // which requireAdminAccess intentionally still excludes — this does
  // NOT open the rest of the admin console (teachers/students/classes/
  // modules pages) to educators, only the gradebook.
  //
  // An educator's access is scoped to taughtClassIds (from the new
  // class_teachers table) — the gradebook UI must filter its own
  // queries to those class ids for this tier. Every other tier keeps
  // requireAdminAccess's existing whole-school (or whole-platform)
  // scope; taughtClassIds is null for those, meaning "not restricted
  // this way" — check tier, not just presence of the field.
  //
  // Note: this does NOT narrow what activity_results/activity_result_items
  // RLS already technically permits an educator to read (that's still
  // school-wide, a pre-existing policy, not changed here) — this only
  // controls what the gradebook UI itself queries for and displays.
  // Tightening the underlying read RLS to match is flagged as a
  // separate, real follow-up, not silently assumed to already be done.
  async function requireGradebookAccess(sb, userId) {
    const adminResult = await lookupAdminTier(sb, userId);
    if (adminResult) return adminResult;

    const { data, error } = await sb
      .from('school_members')
      .select('school_id, schools(name)')
      .eq('user_id', userId)
      .eq('role', 'educator')
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      const root = document.getElementById('app-root') || document.body;
      root.innerHTML = `
        <div class="ac-empty" style="max-width:440px;margin:80px auto;">
          <p>この画面を利用する権限がありません。</p>
          <a class="ac-btn ac-btn-ghost-light ac-btn-md ac-empty-cta" href="../index.html">ホームに戻る</a>
        </div>`;
      return null;
    }

    const { data: taughtRows } = await sb
      .from('class_teachers').select('class_id').eq('user_id', userId);

    return {
      tier: 'educator',
      isPlatformAdmin: false,
      isCoordinator: false,
      canManageStaff: false,
      schoolId: data.school_id,
      schoolName: data.schools?.name || '',
      schoolIds: [data.school_id],
      schools: [{ id: data.school_id, name: data.schools?.name || '' }],
      taughtClassIds: (taughtRows || []).map(r => r.class_id),
      userId,
    };
  }

  // ── in-app bug reporter (staff surfaces only) ──────────────────────────
  // Lives here because admin-common.js is loaded by exactly the staff pages
  // (admin console + gradebook), never the student hub, so the button code
  // never even ships to students. buttonHtml() returns a ghost button sized
  // for the dark sidebar; wire(sb) injects the modal once and handles submit
  // to the report-bug Edge Function (which re-verifies staff + rate-limits;
  // the button placement is UX, RLS/the function is the real boundary).
  const bugReport = {
    buttonHtml() {
      return '<button id="bugrpt-open" type="button" title="不具合を報告"' +
        ' style="margin-top:8px;width:100%;padding:8px 12px;border:1px solid rgba(247,243,234,0.22);' +
        'border-radius:6px;background:transparent;color:rgba(247,243,234,0.82);font-size:0.78rem;' +
        'font-weight:600;cursor:pointer;font-family:inherit;">🐛 不具合を報告</button>';
    },
    wire(sb) {
      const openBtn = document.getElementById('bugrpt-open');
      if (!openBtn) return;
      const esc = window.HubCommon.escapeHtml;
      if (!document.getElementById('bugrpt-backdrop')) {
        const el = document.createElement('div');
        el.id = 'bugrpt-backdrop';
        el.style.cssText = 'position:fixed;inset:0;background:rgba(28,37,48,0.55);display:none;' +
          'align-items:center;justify-content:center;z-index:1000;';
        el.innerHTML =
          '<div style="background:#fff;border-radius:14px;padding:24px;width:min(520px,calc(100vw - 32px));' +
          'box-shadow:0 8px 30px rgba(0,0,0,0.25);font-family:inherit;">' +
            '<h2 style="margin:0 0 4px;font-size:1.05rem;color:#1c2530;font-weight:700;">不具合を報告</h2>' +
            '<p style="margin:0 0 14px;font-size:0.78rem;color:#5a6472;">気づいた不具合や不便な点をお知らせください。' +
            '開いているページ・権限・日時は自動で記録されます。</p>' +
            '<textarea id="bugrpt-desc" rows="5" placeholder="何が起きましたか？できるだけ具体的にご記入ください。" ' +
            'style="width:100%;box-sizing:border-box;border:1.5px solid #d8d2c2;border-radius:8px;padding:10px 12px;' +
            'font-size:14px;font-family:inherit;resize:vertical;"></textarea>' +
            '<div id="bugrpt-page" style="font-size:0.72rem;color:#8a8570;margin:8px 0 0;word-break:break-all;"></div>' +
            '<div id="bugrpt-msg" style="font-size:0.8rem;margin:10px 0 0;display:none;border-radius:8px;padding:8px 10px;"></div>' +
            '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">' +
              '<button id="bugrpt-cancel" type="button" style="padding:9px 16px;border:1.5px solid #d8d2c2;' +
              'border-radius:8px;background:#fff;color:#1c2530;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;">キャンセル</button>' +
              '<button id="bugrpt-submit" type="button" style="padding:9px 16px;border:none;border-radius:8px;' +
              'background:#4a6b4f;color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;">送信</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(el);
      }
      const backdrop = document.getElementById('bugrpt-backdrop');
      const descEl = document.getElementById('bugrpt-desc');
      const pageEl = document.getElementById('bugrpt-page');
      const msgEl = document.getElementById('bugrpt-msg');
      const submitBtn = document.getElementById('bugrpt-submit');
      const cancelBtn = document.getElementById('bugrpt-cancel');

      function showMsg(text, kind) {
        msgEl.textContent = text;
        msgEl.style.display = 'block';
        msgEl.style.background = kind === 'ok' ? '#e8ede6' : '#fdecea';
        msgEl.style.color = kind === 'ok' ? '#34503a' : '#a23b2e';
      }
      function open() {
        msgEl.style.display = 'none';
        submitBtn.disabled = false; submitBtn.textContent = '送信';
        pageEl.textContent = '報告元: ' + location.href;
        backdrop.style.display = 'flex';
        descEl.focus();
      }
      function close() { backdrop.style.display = 'none'; }

      async function submit() {
        const description = descEl.value.trim();
        if (!description) { showMsg('不具合の内容を入力してください。', 'err'); return; }
        submitBtn.disabled = true; submitBtn.textContent = '送信中…';
        try {
          const { data: { session } } = await sb.auth.getSession();
          if (!session) { showMsg('セッションが切れています。再度ログインしてください。', 'err'); submitBtn.disabled = false; submitBtn.textContent = '送信'; return; }
          const cfg = window.GAKUENZA_CONFIG;
          const res = await fetch(cfg.supabaseUrl + '/functions/v1/report-bug', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
            body: JSON.stringify({ description, pageUrl: location.href }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok || !body.ok) {
            showMsg(body.error || '送信できませんでした。時間をおいて再度お試しください。', 'err');
            submitBtn.disabled = false; submitBtn.textContent = '送信';
            return;
          }
          showMsg('報告を送信しました。ありがとうございます！', 'ok');
          descEl.value = '';
          setTimeout(close, 1600);
        } catch (e) {
          showMsg('送信できませんでした。時間をおいて再度お試しください。', 'err');
          submitBtn.disabled = false; submitBtn.textContent = '送信';
        }
      }

      openBtn.addEventListener('click', open);
      cancelBtn.addEventListener('click', close);
      submitBtn.addEventListener('click', submit);
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
    },
  };

  return { requireAdminAccess, requireGradebookAccess, renderAdminSidebar, getAccessibleSchools, bugReport };
})();
