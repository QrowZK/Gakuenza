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
      const payload = {
        user_id: ctx.userId,
        module_id: ctx.moduleId,
        class_id: ctx.classId,
        school_id: ctx.schoolId,
        // activity_ref (not activity_key — that column doesn't exist) and
        // payload (not detail — same issue) — both fixed 2026-07-09.
        // Timestamp suffix added to match every other module's
        // convention (eiken/nh6/etc. all do `${...}/${Date.now()}`) —
        // without it, every attempt at the same section would try to
        // report under the exact same activity_ref, which the gradebook's
        // per-assignment grouping now depends on being distinguishable.
        activity_ref: `shakai3/${result.sectionId}/${Date.now()}`,
        score: result.score,
        max_score: result.total,
        payload: {
          section: result.sectionTitle,
          unit: result.unit,
        },
      };
      const { error } = await sb.from('activity_results').insert(payload);
      if (error) {
        console.log('[Shakai3Report] insert failed:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.log('[Shakai3Report] report failed:', e && e.message);
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

  window.Shakai3Report = { report, getProfile, signOut, MODULE_KEY };
})();
