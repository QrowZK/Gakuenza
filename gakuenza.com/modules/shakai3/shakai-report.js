// shakai-report.js — backend wiring for the 社会3年 module.
// Mirrors the eiken-report.js contract:
//   session -> userId -> profile
//   modules.key = 'shakai3' -> moduleId
//   enrollments -> classes -> classId / schoolId
// If any resolution fails, logs and silently skips reporting (never errors
// into the学習 flow).
(function () {
  'use strict';

  const MODULE_KEY = 'shakai3';
  let client = null;
  let ctxPromise = null;

  function getClient() {
    if (client) return client;
    try {
      if (window.supabase && window.GAKUENZA_CONFIG &&
          window.GAKUENZA_CONFIG.supabaseUrl && window.GAKUENZA_CONFIG.supabaseAnonKey) {
        client = window.supabase.createClient(
          window.GAKUENZA_CONFIG.supabaseUrl,
          window.GAKUENZA_CONFIG.supabaseAnonKey
        );
      }
    } catch (e) {
      console.log('[Shakai3Report] supabase client unavailable:', e && e.message);
    }
    return client;
  }

  async function resolveContext() {
    const sb = getClient();
    if (!sb) return null;

    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session || !session.user) {
      console.log('[Shakai3Report] no session — skipping reporting.');
      return null;
    }
    const userId = session.user.id;

    const { data: profile } = await sb
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    // module id via key
    const { data: mod } = await sb
      .from('modules').select('id').eq('key', MODULE_KEY).maybeSingle();

    // class / school via enrollment
    let classId = null, schoolId = null;
    const { data: enr } = await sb
      .from('enrollments')
      .select('class_id, classes ( id, school_id )')
      .eq('user_id', userId)
      .limit(1);
    if (enr && enr.length) {
      classId = enr[0].class_id;
      schoolId = enr[0].classes ? enr[0].classes.school_id : null;
    }

    if (!mod || !schoolId) {
      console.log('[Shakai3Report] no module/school context — skipping reporting.');
      return { userId, profile, moduleId: null, classId: null, schoolId: null };
    }
    return { userId, profile, moduleId: mod.id, classId, schoolId };
  }

  function getContext() {
    if (!ctxPromise) ctxPromise = resolveContext().catch((e) => {
      console.log('[Shakai3Report] context resolution failed:', e && e.message);
      return null;
    });
    return ctxPromise;
  }

  async function report(result) {
    try {
      const ctx = await getContext();
      if (!ctx || !ctx.moduleId) return false;
      const sb = getClient();
      if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) {
        console.log('[Shakai3Report] HubCommon.reportActivityWithItems unavailable — skipping.');
        return false;
      }
      // Route through the shared helper so the summary row AND the
      // per-question activity_result_items detail are written in one place
      // (previously this hand-rolled the activity_results insert and never
      // populated activity_result_items — the gradebook's per-question
      // analysis had nothing for this module).
      // Timestamp suffix matches every other module's convention
      // (eiken/nh6/etc. all do `${...}/${Date.now()}`) — without it, every
      // attempt at the same section would report under the same activity_ref,
      // which the gradebook's per-assignment grouping depends on being
      // distinguishable.
      const out = await window.HubCommon.reportActivityWithItems(sb, {
        schoolId: ctx.schoolId,
        classId: ctx.classId,
        moduleId: ctx.moduleId,
        userId: ctx.userId,
        activityRef: `shakai3/${result.sectionId}/${Date.now()}`,
        score: result.score,
        maxScore: result.total,
        payload: {
          section: result.sectionTitle,
          unit: result.unit,
          // Per-question outcomes, needed by the ふくしゅう (review) card to
          // rebuild "questions you got wrong" across page reloads. Without
          // these persisted, the feature only worked within one page load.
          right: result.rightIds || [],
          wrong: result.wrongIds || [],
        },
        items: result.items || [],
      });
      if (!out.ok) {
        console.log('[Shakai3Report] insert failed:', out.error && out.error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.log('[Shakai3Report] report failed:', e && e.message);
      return false;
    }
  }

  // Reads back this student's own prior attempts for this module so the
  // ふくしゅう card can recompute previously-missed questions after a reload.
  // Each row's payload carries { right:[ids], wrong:[ids] } (see report()).
  // Returns [] (never throws) when there's no session/context.
  async function fetchResults() {
    try {
      const ctx = await getContext();
      if (!ctx || !ctx.moduleId) return [];
      const sb = getClient();
      const { data, error } = await sb
        .from('activity_results')
        .select('activity_ref, score, max_score, payload, created_at')
        .eq('user_id', ctx.userId)
        .eq('module_id', ctx.moduleId)
        .order('created_at', { ascending: false });
      if (error) {
        console.log('[Shakai3Report] fetchResults failed:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.log('[Shakai3Report] fetchResults error:', e && e.message);
      return [];
    }
  }

  async function getProfile() {
    const ctx = await getContext();
    return ctx ? ctx.profile : null;
  }

  async function signOut() {
    const sb = getClient();
    if (sb) await sb.auth.signOut();
  }

  window.Shakai3Report = { report, fetchResults, getProfile, signOut, MODULE_KEY };
})();
