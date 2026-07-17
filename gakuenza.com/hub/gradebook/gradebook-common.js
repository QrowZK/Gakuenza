// gradebook-common.js — shared across every hub/gradebook/*.html page.
// Reuses the existing hub/admin plumbing rather than reinventing it:
//   HubCommon  (escapeHtml, requireSession, givenName)  — hub-common.js
//   AdminCommon (requireGradebookAccess, getAccessibleSchools) — admin-common.js
// Only the sidebar chrome + class context + a few gradebook-specific
// formatting helpers live here. The CSS, by contrast, is fully self-contained
// (gradebook.css) per the design handoff — this is the "dedicated tool"
// surface, not the student hub shell.
window.Gradebook = (function () {
  const H = window.HubCommon;
  const AC = window.AdminCommon;
  const esc = H.escapeHtml;

  const CLASS_KEY = 'gb_class_id';

  const SUBJECTS = [
    { key: 'math', label: '算数' },
    { key: 'japanese', label: '国語' },
    { key: 'english', label: '英語' },
    { key: 'science', label: '理科' },
    { key: 'social', label: '社会' },
    { key: 'sougou', label: '総合' },
  ];
  const SUBJECT_LABEL = Object.fromEntries(SUBJECTS.map(s => [s.key, s.label]));

  // ── access ───────────────────────────────────────────────────────────
  // One call every page makes first. Confirms a session, then the gradebook
  // access tier (reusing requireGradebookAccess verbatim — platform admin /
  // school_admin / coordinator / educator, renders its own denial on fail).
  //
  // Session check is done here rather than via HubCommon.requireSession
  // because that helper redirects to a bare 'login.html' — correct for the
  // hub/ pages it was written for, but these pages sit one level deeper in
  // hub/gradebook/, so the login page is at '../login.html'.
  async function requireContext(sb) {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { window.location.href = '../login.html'; return null; }
    const userId = session.user.id;
    const ctx = await AC.requireGradebookAccess(sb, userId);
    if (!ctx) return null;
    const { data: profile } = await sb
      .from('profiles').select('display_name').eq('id', userId).maybeSingle();
    return { userId, ctx, profile };
  }

  // ── accessible classes ───────────────────────────────────────────────
  // educator → only classes they teach (class_teachers, via ctx.taughtClassIds).
  // every other tier → every class in the school(s) they administer. This is
  // the same scope split the old admin/gradebook grid used.
  async function loadClasses(sb, ctx) {
    if (ctx.tier === 'educator') {
      const ids = ctx.taughtClassIds || [];
      if (!ids.length) return [];
      const { data } = await sb
        .from('classes').select('id, name, school_id, year, gumi')
        .in('id', ids).order('year').order('gumi');
      const rows = data || [];
      // Resolve school names for the taught classes (usually one school, but an
      // educator can teach across schools) so the class chip can group by school.
      const schoolIds = [...new Set(rows.map(c => c.school_id))];
      let nameById = {};
      if (schoolIds.length) {
        const { data: sch } = await sb.from('schools').select('id, name').in('id', schoolIds);
        (sch || []).forEach(s => { nameById[s.id] = s.name; });
      }
      return rows.map(c => ({ ...c, school_name: nameById[c.school_id] || '' }));
    }
    const schools = await AC.getAccessibleSchools(sb, ctx);
    const schoolIds = schools.map(s => s.id);
    if (!schoolIds.length) return [];
    const nameById = Object.fromEntries(schools.map(s => [s.id, s.name]));
    const { data } = await sb
      .from('classes').select('id, name, school_id, year, gumi')
      .in('school_id', schoolIds).order('year').order('gumi');
    // Attach school_name so the class chip can group multi-school lists (a
    // platform admin sees every school's classes, and "3年1組" repeats per
    // school — grouping is what makes them findable).
    return (data || []).map(c => ({ ...c, school_name: nameById[c.school_id] || '' }));
  }

  function getCurrentClassId(classes) {
    const stored = localStorage.getItem(CLASS_KEY);
    if (stored && classes.some(c => c.id === stored)) return stored;
    return classes[0]?.id || null;
  }
  function setCurrentClassId(id) { localStorage.setItem(CLASS_KEY, id); }

  // Class filter chip — a styled <select id="gb-class-chip">. Pages read its
  // value and persist via setCurrentClassId on change.
  //
  // When the accessible classes span more than one school (platform admin, or
  // an educator teaching across schools), the options are grouped under
  // <optgroup> headers labelled by school — otherwise every school's "3年1組"
  // renders as an indistinguishable flat list. Single-school users keep the
  // flat list unchanged.
  function classChipHtml(classes, currentId) {
    if (!classes.length) return '';
    const opt = c => `<option value="${c.id}"${c.id === currentId ? ' selected' : ''}>${esc(c.name)}</option>`;
    const schoolNames = [...new Set(classes.map(c => c.school_name || ''))];
    let inner;
    if (schoolNames.length > 1) {
      const bySchool = new Map();
      classes.forEach(c => {
        const k = c.school_name || 'その他';
        if (!bySchool.has(k)) bySchool.set(k, []);
        bySchool.get(k).push(c);
      });
      inner = [...bySchool.keys()].sort().map(sn =>
        `<optgroup label="${esc(sn)}">${bySchool.get(sn).map(opt).join('')}</optgroup>`
      ).join('');
    } else {
      inner = classes.map(opt).join('');
    }
    return `<span class="gb-chip"><select id="gb-class-chip" aria-label="クラス">${inner}</select></span>`;
  }

  function subjectChipHtml(currentKey, opts) {
    const withAll = opts && opts.withAll;
    const items = (withAll ? [{ key: '', label: 'すべて' }] : []).concat(SUBJECTS);
    return `<span class="gb-chip"><span class="gb-chip-label">教科</span><select id="gb-subject-chip" aria-label="教科">${
      items.map(s => `<option value="${esc(s.key)}"${s.key === (currentKey || '') ? ' selected' : ''}>${esc(s.label)}</option>`).join('')
    }</select></span>`;
  }

  // ── sidebar ──────────────────────────────────────────────────────────
  const NAV = [
    { key: 'dashboard',    label: 'ダッシュボード', href: 'index.html' },
    { key: 'assign',       label: '課題',           href: 'assign.html' },
    { key: 'roster',       label: '名簿',           href: 'roster.html' },
    { key: 'observations', label: '観察記録',       href: 'observations.html' },
    { key: 'analysis',     label: '成績分析',       href: 'analysis.html' },
    { key: 'kadaiban',     label: '課題板',         href: 'kadaiban.html' },
    { key: 'karte',        label: '個人カルテ',     href: 'karte.html' },
    { key: 'print',        label: 'プリント作成',   href: 'print.html' },
  ];

  function renderSidebar(sb, profile, activeKey, ctx, snapshot) {
    const mount = document.getElementById('gb-sidebar');
    if (!mount) return;
    const name = profile?.display_name || '先生';
    const initial = (H.givenName(name).charAt(0)) || '先';
    const roleLabel = ctx.tier === 'educator' ? '担任'
      : ctx.tier === 'coordinator' ? 'コーディネーター'
      : ctx.isPlatformAdmin ? '全校管理者' : '管理者';
    const snapLine = snapshot && snapshot.lastRun
      ? `<b>週次スナップショット</b>最終実行: ${snapshot.lastRun} <span class="gb-snap-ok">✓</span>`
      : `<b>週次スナップショット</b><span class="gb-muted">未実行</span>`;

    mount.innerHTML = `
      <a class="gb-brand" href="index.html">
        <div class="gb-brand-mark">がくえん座</div>
        <div class="gb-brand-sub">Gradebook · 成績簿</div>
      </a>
      <nav class="gb-nav">
        ${NAV.map(n => `<a class="gb-nav-item${n.key === activeKey ? ' active' : ''}" href="${n.href}">${n.label}</a>`).join('')}
      </nav>
      <div class="gb-side-spacer"></div>
      <div class="gb-snapshot">${snapLine}</div>
      <div class="gb-profile">
        <div class="gb-avatar">${esc(initial)}</div>
        <div>
          <div class="gb-profile-name">${esc(name)}</div>
          <div class="gb-profile-role">${esc(ctx.schoolName || '')} · ${roleLabel}</div>
        </div>
      </div>
      <button class="gb-logout" id="gb-logout" type="button">ログアウト</button>
      ${AC.bugReport ? AC.bugReport.buttonHtml() : ''}`;

    document.getElementById('gb-logout').addEventListener('click', async () => {
      await sb.auth.signOut();
      window.location.href = '../login.html';
    });
    if (AC.bugReport) AC.bugReport.wire(sb);
  }

  // Most-recent snapshot timestamp for the sidebar "最終実行" line — the only
  // place the cron job's health is surfaced for now (spec open item #3).
  async function loadSnapshotStatus(sb, classId) {
    if (!classId) return { lastRun: null };
    const { data } = await sb
      .from('gradebook_snapshots').select('created_at')
      .eq('class_id', classId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return { lastRun: data ? mdDate(data.created_at) : null };
  }

  // ── formatting / small helpers ─────────────────────────────────────────
  function pct(correct, total) { return total > 0 ? Math.round((correct / total) * 100) : 0; }
  // 4-step heatmap tint bucket. 85%+ / 70–84% / 55–69% / <55%.
  function heatClass(p) {
    if (p >= 85) return 'gb-heat-1';
    if (p >= 70) return 'gb-heat-2';
    if (p >= 55) return 'gb-heat-3';
    return 'gb-heat-4';
  }
  function initial(name) { return (H.givenName(name || '').charAt(0)) || '?'; }
  const WK = ['日','月','火','水','木','金','土'];
  function mdDate(iso) { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()}`; }
  function fullDate(iso) { const d = new Date(iso); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WK[d.getDay()]})`; }
  function relTime(iso) {
    const diffH = (Date.now() - new Date(iso).getTime()) / 3600000;
    if (diffH < 1) return 'たった今';
    if (diffH < 24) return `${Math.floor(diffH)}時間前`;
    const d = Math.floor(diffH / 24);
    if (d === 1) return '昨日';
    if (d < 7) return `${d}日前`;
    return mdDate(iso);
  }
  // Reuse the shared assignment grouping so a recurring activity keys the same
  // way it does in hub-common.js / the old grid.
  const assignmentKeyFromRef = H.assignmentKeyFromRef;
  const assignmentLabel = H.assignmentLabel;

  return {
    esc, SUBJECTS, SUBJECT_LABEL,
    requireContext, loadClasses, getCurrentClassId, setCurrentClassId,
    classChipHtml, subjectChipHtml, renderSidebar, loadSnapshotStatus,
    pct, heatClass, initial, mdDate, fullDate, relTime,
    assignmentKeyFromRef, assignmentLabel,
  };
})();
