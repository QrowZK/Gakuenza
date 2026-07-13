// sansu-report.js — backend wiring for the 算数3年 module.
// Same context-resolution contract as the other modules
// (session -> profile -> module by key -> class/school via enrollment),
// but the actual write goes through H.reportActivityWithItems so the
// summary row + per-item detail insert lives in exactly one shared place
// (hub-common.js), per the established convention.
// If any resolution step fails, reporting silently skips — a practice
// attempt must never error out of the child's flow.
(function () {
  'use strict';

  const MODULE_KEY = 'sansu3';
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
      console.log('[Sansu3Report] supabase client unavailable:', e && e.message);
    }
    return client;
  }

  async function resolveContext() {
    const sb = getClient();
    if (!sb) return null;

    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session || !session.user) {
      console.log('[Sansu3Report] no session — skipping reporting.');
      return null;
    }
    const userId = session.user.id;

    const { data: profile } = await sb
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    const { data: mod } = await sb
      .from('modules').select('id').eq('key', MODULE_KEY).maybeSingle();

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
      console.log('[Sansu3Report] no module/school context — skipping reporting.');
      return { userId, profile, moduleId: null, classId: null, schoolId: null };
    }
    return { userId, profile, moduleId: mod.id, classId, schoolId };
  }

  function getContext() {
    if (!ctxPromise) ctxPromise = resolveContext().catch(function (e) {
      console.log('[Sansu3Report] context resolution failed:', e && e.message);
      return null;
    });
    return ctxPromise;
  }

  // result: { sectionId, sectionTitle, unit, score, total, items }
  // items: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
  async function report(result) {
    try {
      const ctx = await getContext();
      if (!ctx || !ctx.moduleId) return false;
      const sb = getClient();
      if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) {
        console.log('[Sansu3Report] HubCommon.reportActivityWithItems unavailable — skipping.');
        return false;
      }
      // Timestamp suffix per project convention: the gradebook derives
      // its per-assignment key by stripping the trailing timestamp from
      // activity_ref, so 'sansu3/<sectionId>/<ts>' groups attempts of
      // the same section into one gradebook column.
      const out = await window.HubCommon.reportActivityWithItems(sb, {
        schoolId: ctx.schoolId,
        classId: ctx.classId,
        moduleId: ctx.moduleId,
        userId: ctx.userId,
        activityRef: MODULE_KEY + '/' + result.sectionId + '/' + Date.now(),
        score: result.score,
        maxScore: result.total,
        payload: { section: result.sectionTitle, unit: result.unit },
        items: result.items || [],
      });
      if (!out.ok) {
        console.log('[Sansu3Report] insert failed:', out.error && out.error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.log('[Sansu3Report] report failed:', e && e.message);
      return false;
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

  window.Sansu3Report = { report, getProfile, signOut, MODULE_KEY };
})();
