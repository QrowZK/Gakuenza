// shakai6-report.js — backend wiring for the 社会6年 module.
// Contract mirrors shakai4-report.js (社会4年):
//   session -> userId -> profile
//   modules.key = 'shakai6' -> moduleId
//   enrollments -> classes -> classId / schoolId   (NEVER profiles.home_school_id)
// If any resolution fails, logs and silently skips reporting (never errors
// into the 学習 flow).
//
// As in shakai4:
//   1. Reporting goes through HubCommon.reportActivityWithItems so that
//      activity_result_items ALSO gets per-question detail. We still persist
//      { right, wrong } in payload so the ふくしゅう card can rebuild
//      "questions you missed" across reloads.
//   2. getFocusUnits() reads class_modules.focus_units for this student's
//      class+module so the menu can foreground the assigned units. shakai6
//      uses sub-unit-level keys for history (u2a_jomon_kofun .. u2l_postwar_
//      japan) alongside u1_politics and u3_japan_and_the_world, so focus is
//      matched at the section level (see app.js partitionUnits).
(function () {
  'use strict';

  const MODULE_KEY = 'shakai6';
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
      console.log('[Shakai6Report] supabase client unavailable:', e && e.message);
    }
    return client;
  }

  async function resolveContext() {
    const sb = getClient();
    if (!sb) return null;

    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session || !session.user) {
      console.log('[Shakai6Report] no session — skipping reporting.');
      return null;
    }
    const userId = session.user.id;

    const { data: profile } = await sb
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    // module id via key
    const { data: mod } = await sb
      .from('modules').select('id').eq('key', MODULE_KEY).maybeSingle();

    // class / school via enrollment (the established, correct pattern —
    // NOT profiles.home_school_id).
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
      console.log('[Shakai6Report] no module/school context — skipping reporting.');
      return { userId, profile, moduleId: mod ? mod.id : null, classId, schoolId: null };
    }
    return { userId, profile, moduleId: mod.id, classId, schoolId };
  }

  function getContext() {
    if (!ctxPromise) ctxPromise = resolveContext().catch((e) => {
      console.log('[Shakai6Report] context resolution failed:', e && e.message);
      return null;
    });
    return ctxPromise;
  }

  async function report(result) {
    try {
      const ctx = await getContext();
      if (!ctx || !ctx.moduleId || !ctx.schoolId) return false;
      const sb = getClient();

      // Timestamp suffix matches every other module's activity_ref
      // convention (<module>/<part>/<timestamp>); the gradebook strips the
      // trailing timestamp to group retries into one assignment column.
      const activityRef = `shakai6/${result.sectionId}/${Date.now()}`;

      // Per-question outcome ids stay in payload so the ふくしゅう card can
      // recompute previously-missed questions after a reload.
      const payload = {
        section: result.sectionTitle,
        unit: result.unit,
        right: result.rightIds || [],
        wrong: result.wrongIds || [],
      };

      const res = await window.HubCommon.reportActivityWithItems(sb, {
        schoolId: ctx.schoolId,
        classId: ctx.classId,
        moduleId: ctx.moduleId,
        userId: ctx.userId,
        activityRef,
        score: result.score,
        maxScore: result.total,
        payload,
        items: result.items || [],
      });
      if (!res || !res.ok) {
        console.log('[Shakai6Report] report failed:', res && res.error && res.error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.log('[Shakai6Report] report failed:', e && e.message);
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
        console.log('[Shakai6Report] fetchResults failed:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.log('[Shakai6Report] fetchResults error:', e && e.message);
      return [];
    }
  }

  // Returns the assigned focus-unit keys for this student's class+module as
  // an array (e.g. ['u1_politics','u2d_kamakura']), or null when none is set
  // / anything is missing or malformed — the app treats null as "all units",
  // never hard-hiding the rest.
  async function getFocusUnits() {
    try {
      const ctx = await getContext();
      if (!ctx || !ctx.moduleId || !ctx.classId) return null;
      const sb = getClient();
      const { data, error } = await sb
        .from('class_modules')
        .select('focus_units')
        .eq('class_id', ctx.classId)
        .eq('module_id', ctx.moduleId)
        .maybeSingle();
      if (error) {
        console.log('[Shakai6Report] getFocusUnits failed:', error.message);
        return null;
      }
      const fu = data && data.focus_units;
      if (Array.isArray(fu)) return fu.filter((x) => typeof x === 'string');
      return null;
    } catch (e) {
      console.log('[Shakai6Report] getFocusUnits error:', e && e.message);
      return null;
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

  window.Shakai6Report = { report, fetchResults, getFocusUnits, getProfile, signOut, MODULE_KEY };
})();
