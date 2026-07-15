// rika3-report.js — backend wiring for the 理科3年 module.
// Same context-resolution contract as the other modules
// (session -> profile -> module by key -> class/school via ENROLLMENT, NOT
// profiles.home_school_id — kokugo3 caught that mid-build), and the actual
// write goes through HubCommon.reportActivityWithItems so the summary row +
// per-item detail insert lives in exactly one shared place. We deliberately
// do NOT hand-roll the activity_results/activity_result_items insert — that
// is precisely where shakai3 (and 3 others) shipped a real bug.
// If any resolution step fails, reporting silently skips — a practice
// attempt must never error out of the child's flow.
(function () {
  'use strict';

  const MODULE_KEY = 'rika3';
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
      console.log('[Rika3Report] supabase client unavailable:', e && e.message);
    }
    return client;
  }

  async function resolveContext() {
    const sb = getClient();
    if (!sb) return null;

    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session || !session.user) {
      console.log('[Rika3Report] no session — skipping reporting.');
      return null;
    }
    const userId = session.user.id;

    const { data: profile } = await sb
      .from('profiles').select('*').eq('id', userId).maybeSingle();

    const { data: mod } = await sb
      .from('modules').select('id').eq('key', MODULE_KEY).maybeSingle();

    // class / school via enrollment -> classes.school_id (the established
    // pattern; NOT profiles.home_school_id).
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
      console.log('[Rika3Report] no module/school context — skipping reporting.');
      return { userId, profile, moduleId: null, classId: null, schoolId: null };
    }
    return { userId, profile, moduleId: mod.id, classId, schoolId };
  }

  function getContext() {
    if (!ctxPromise) ctxPromise = resolveContext().catch(function (e) {
      console.log('[Rika3Report] context resolution failed:', e && e.message);
      return null;
    });
    return ctxPromise;
  }

  // result: { unitKey, unitTitle, strand, score, total, items }
  // items: [{ itemRef, category, prompt, correct, selectedAnswer, correctAnswer }]
  async function report(result) {
    try {
      const ctx = await getContext();
      if (!ctx || !ctx.moduleId) return false;
      const sb = getClient();
      if (!window.HubCommon || !window.HubCommon.reportActivityWithItems) {
        console.log('[Rika3Report] HubCommon.reportActivityWithItems unavailable — skipping.');
        return false;
      }
      // Timestamp suffix per project convention: the gradebook derives its
      // per-assignment key by stripping the trailing timestamp from
      // activity_ref, so 'rika3/<unitKey>/<ts>' groups every attempt of the
      // same unit into one gradebook column.
      const out = await window.HubCommon.reportActivityWithItems(sb, {
        schoolId: ctx.schoolId,
        classId: ctx.classId,
        moduleId: ctx.moduleId,
        userId: ctx.userId,
        activityRef: MODULE_KEY + '/' + result.unitKey + '/' + Date.now(),
        score: result.score,
        maxScore: result.total,
        payload: { unit: result.unitTitle, unitKey: result.unitKey, strand: result.strand },
        items: result.items || [],
      });
      if (!out.ok) {
        console.log('[Rika3Report] insert failed:', out.error && out.error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.log('[Rika3Report] report failed:', e && e.message);
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

  window.Rika3Report = { report, getProfile, signOut, MODULE_KEY };
})();
