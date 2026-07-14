// hub-common.js — shared across every hub/*.html page (index, modules,
// settings, ...). Extracted once we had three pages needing the same
// sidebar + profile fetch + formatting logic, rather than duplicating it.
window.HubCommon = (function () {
  const SUBJECT_LABEL_JA = { english: '英語', math: '算数', japanese: '国語', science: '理科', social: '社会', sougou: '総合', misc: 'その他' };
  const SUBJECT_LABEL_EN = { english: 'English', math: 'Math', japanese: 'Japanese', science: 'Science', social: 'Social Studies', sougou: 'Integrated Studies', misc: 'Other' };
  // Canonical display order — used anywhere subjects are grouped (the
  // module list page, the assign-module picker) so categories appear in
  // a consistent, predictable order rather than whatever order modules
  // happened to be fetched in.
  const SUBJECT_ORDER = ['english', 'math', 'japanese', 'science', 'social', 'sougou', 'misc'];
  // Escapes text for safe interpolation into innerHTML. Every value that
  // originated in the database — student-typed answers, prompts, category
  // labels, display names, module names — MUST pass through this before
  // being placed in an HTML string, or a student can store markup/script
  // that executes in a teacher's or admin's session (stored XSS).
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  const subjectVar = (s) => `var(--subject-${s || 'misc'}, var(--border))`;
  const subjectLabel = (s) => `${SUBJECT_LABEL_JA[s] || s} · ${SUBJECT_LABEL_EN[s] || s}`;
  // Sorts the keys of a {subject: [...]} grouping object into
  // SUBJECT_ORDER, with any unrecognized subject value pushed to the end
  // rather than dropped — a module with a typo'd/legacy subject should
  // still be visible somewhere, just not silently lost.
  function sortedSubjectKeys(bySubject) {
    const known = SUBJECT_ORDER.filter(s => bySubject[s]);
    const unknown = Object.keys(bySubject).filter(s => !SUBJECT_ORDER.includes(s));
    return [...known, ...unknown];
  }
  const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

  function givenName(name) {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  }
  function formatGreetingDate(d) {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_JA[d.getDay()]})`;
  }
  function formatDueDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return `期限: ${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAY_JA[d.getDay()]})`;
  }
  function relativeTime(iso) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffH = diffMs / 3600000;
    if (diffH < 1) return 'たった今アクセス';
    if (diffH < 24) return `${Math.floor(diffH)}時間前にアクセス`;
    const diffD = Math.floor(diffH / 24);
    return diffD === 1 ? '昨日アクセス' : `${diffD}日前にアクセス`;
  }
  function progressBar(pct) {
    if (pct === null || pct === undefined) return '';
    return `<div class="progress-track"><div class="progress-fill" style="width:${pct}%;"></div></div>`;
  }

  // Every page calls this first. Redirects to login if there's no session;
  // otherwise returns it so the page can read session.user.id.
  async function requireSession(sb) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return null; }
    return session;
  }

  // Fetches profile + class once, renders the sidebar into #sidebar-mount,
  // highlights the active nav item, and wires the logout button. Returns
  // the fetched profile/className in case the calling page also needs them
  // (e.g. the greeting on index.html).
  async function renderSidebar(sb, userId, activeKey) {
    const mount = document.getElementById('sidebar-mount');
    if (!mount) return {};

    const { data: profile, error: profileErr } = await sb
      .from('profiles').select('display_name, student_number, is_platform_admin').eq('id', userId).maybeSingle();
    const { data: enrollmentRows } = await sb
      .from('enrollments').select('class_id, classes(name)').eq('user_id', userId).eq('role', 'student');
    const className = enrollmentRows?.[0]?.classes?.name || '';
    const given = givenName(profile?.display_name || '');
    const initial = given.charAt(0) || '?';

    // An admin is still a regular hub user first — this just adds a way
    // in to the admin console from their normal dashboard, since there's
    // no other entry point to it yet. Checked here (not assumed) so a
    // non-admin never sees a dead-end link.
    //
    // FIXED 2026-07-09: this only ever checked role='school_admin' — a
    // coordinator (added weeks ago) or educator (added alongside the
    // gradebook) had no entry point into anything admin-tier at all,
    // even though both roles were fully built out elsewhere. A
    // coordinator got stuck exactly where a plain student would.
    const { data: adminRow } = await sb
      .from('school_members').select('school_id, role').eq('user_id', userId)
      .in('role', ['school_admin', 'coordinator', 'educator']).limit(1).maybeSingle();
    const isFullAdminUser = !!(profile?.is_platform_admin || (adminRow && adminRow.role !== 'educator'));
    const isEducator = adminRow?.role === 'educator';

    const navItems = [
      { key: 'home', href: 'index.html', label: 'ホーム' },
      { key: 'modules', href: 'modules.html', label: 'モジュール一覧' },
      // Three distinct destinations for the same nav slot, added
      // 2026-07-09 for the last of them (a plain student — this was the
      // permanently-disabled stub until now):
      //   - educator: their own scoped teacher view (class-detail.html's
      //     own admin guard would otherwise block them, so 管理画面
      //     below isn't an option for this tier).
      //   - admin-tier (school_admin/coordinator/platform admin): no
      //     link needed here — 管理画面 below already gets them into
      //     the admin console, which has its own 成績 in its own nav.
      //   - anyone else (no school_members row at all — a plain
      //     student): their own personal grades, scoped to just their
      //     own activity_results (already RLS-permitted, always was —
      //     this is a UI-only addition, no schema/RLS change needed).
      isEducator
        ? { key: 'grades', href: 'admin/gradebook.html', label: '成績' }
        : isFullAdminUser
        ? { key: 'grades', label: '成績', disabled: true }
        : { key: 'grades', href: 'grades.html', label: '成績' },
      { key: 'settings', href: 'settings.html', label: '設定' },
    ];
    // No specific class in mind here — admin/class-detail.html handles a
    // missing class_id by showing its own school/year/gumi picker, so
    // this link doesn't need to (and shouldn't try to) guess a class.
    // school_admin/coordinator/platform admin all land here; educator
    // gets the direct gradebook link above instead, not this one.
    if (isFullAdminUser) navItems.push({ key: 'admin', href: 'admin/class-detail.html', label: '管理画面' });

    mount.innerHTML = `
      <a class="gz-home" href="index.html" title="ホームへ">
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
      <div class="profile-block">
        <div class="avatar" id="avatar">${profileErr ? '?' : initial}</div>
        <div class="profile-name" id="profile-name">${profileErr ? '読み込めませんでした' : (profile ? profile.display_name + 'さん' : '未登録')}</div>
        <div class="profile-class" id="profile-class">${className}</div>
      </div>
      <nav class="nav">
        ${navItems.map(n => n.disabled
          ? `<div class="nav-item" title="近日公開">${n.label}</div>`
          : `<a class="nav-item${n.key === activeKey ? ' active' : ''}" href="${n.href}">${n.label}</a>`
        ).join('')}
      </nav>
      <button class="hub-btn btn-ghost" id="logout-btn" type="button">ログアウト</button>
    `;

    document.getElementById('logout-btn').addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = 'login.html';
    });

    return { profile, className, given };
  }

  // Reports one activity attempt AND (optionally) its per-item detail, in
  // that order — the summary row first, then items keyed off its real id.
  // This is the ONE place every module's report shim should call for
  // this, rather than each one hand-rolling the two-step insert.
  // Items are best-effort: if the item insert fails, the summary score
  // has already been saved and the student's flow is never blocked on
  // it — a logged console error, not a thrown exception.
  //
  // items (optional) is an array of:
  //   { itemRef, category, prompt, correct, selectedAnswer, correctAnswer }
  // selectedAnswer/correctAnswer are always TEXT — the actual option text
  // or typed answer, not an index — so this one shape works for both
  // fixed multiple-choice modules and free-text ones (shakai3) without
  // any per-module-type branching here or in anything that reads it back.
  // Every module's report shim builds activity_ref as
  // `<module>/<part>/<part>/<timestamp>` (confirmed against eiken, nh6,
  // and shakai3's report shims directly, not assumed) — stripping the
  // trailing timestamp segment gives a stable key identifying "the same
  // recurring assignment" across however many times a student retried
  // it, without needing per-module-specific parsing here.
  //
  // Shared here (moved from admin/gradebook.html, 2026-07-09) because
  // hub/grades.html needs the exact same grouping logic for a student's
  // own view — one source of truth, not two copies that could drift.
  function assignmentKeyFromRef(activityRef) {
    const parts = String(activityRef).split('/');
    const last = parts[parts.length - 1];
    if (parts.length > 1 && /^\d+$/.test(last)) return parts.slice(0, -1).join('/');
    return activityRef;
  }

  // Best-effort human-readable label from whatever shape this module's
  // payload happens to use — falls back to the raw assignment key
  // (still meaningful, just less pretty) for any module whose payload
  // doesn't match one of the known shapes.
  function assignmentLabel(key, samplePayload) {
    const p = samplePayload || {};
    if (p.level && p.set) return `Lv.${p.level} Set${p.set}`;
    if (p.section) return p.section;
    if (p.unit) return `Unit ${p.unit}`;
    return key;
  }

  async function reportActivityWithItems(sb, { schoolId, classId, moduleId, userId, activityRef, score, maxScore, payload, items }) {
    const { data: resultRow, error: resultErr } = await sb
      .from('activity_results')
      .insert({
        school_id: schoolId, class_id: classId, module_id: moduleId, user_id: userId,
        activity_ref: activityRef, score, max_score: maxScore, payload: payload || {},
      })
      .select('id')
      .single();

    if (resultErr || !resultRow) {
      return { ok: false, error: resultErr };
    }

    if (items && items.length) {
      const rows = items.map(it => ({
        activity_result_id: resultRow.id,
        item_ref: it.itemRef,
        category: it.category ?? null,
        prompt: it.prompt ?? null,
        correct: it.correct,
        selected_answer: it.selectedAnswer ?? null,
        correct_answer: it.correctAnswer ?? null,
      }));
      const { error: itemsErr } = await sb.from('activity_result_items').insert(rows);
      if (itemsErr) {
        console.error('[HubCommon.reportActivityWithItems] item detail failed to save (summary score was still saved):', itemsErr);
      }
    }

    return { ok: true, id: resultRow.id };
  }

  return {
    escapeHtml,
    subjectVar, subjectLabel, sortedSubjectKeys, givenName, formatGreetingDate, formatDueDate,
    relativeTime, progressBar, requireSession, renderSidebar, reportActivityWithItems,
    assignmentKeyFromRef, assignmentLabel,
  };
})();