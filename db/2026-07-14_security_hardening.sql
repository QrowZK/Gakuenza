-- Security hardening applied to the Gakuenza Supabase project
-- (project ref: ohnsawydclmsrgphasbn) on 2026-07-14, from the codebase review.
--
-- These statements were applied to the live database via Supabase migrations
-- of the same names. This file is the version-controlled record; the repo has
-- no supabase/ tooling, so it is documentation, not an auto-applied migration.

-- ─────────────────────────────────────────────────────────────────────────
-- 1) lock_down_modules_table
-- The modules catalog had RLS disabled and anon/authenticated held full
-- write + TRUNCATE grants, so anyone with the public anon key could rewrite
-- or TRUNCATE it for every school. All client code only SELECTs from modules.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS modules_read ON public.modules;
CREATE POLICY modules_read ON public.modules
  FOR SELECT USING (true);

-- No write policy => RLS denies INSERT/UPDATE/DELETE. TRUNCATE ignores RLS,
-- so its grant must be revoked explicitly. service_role retains full access.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.modules FROM anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2) harden_activity_results_insert
-- The ar_insert policy only checked user_id = auth.uid(), leaving school_id,
-- class_id and score client-controlled — a student could forge results into
-- any school/class's gradebook (cross-tenant pollution + the delivery vector
-- for stored XSS in the teacher gradebook) and set score > max_score.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.app_class_school(p_class uuid)
  RETURNS uuid
  LANGUAGE sql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
AS $$
  SELECT school_id FROM classes WHERE id = p_class
$$;

DROP POLICY IF EXISTS ar_insert ON public.activity_results;
CREATE POLICY ar_insert ON public.activity_results
  FOR INSERT
  WITH CHECK (
    app_has_role(school_id, ARRAY['educator'::text, 'school_admin'::text])
    OR (
      user_id = auth.uid()
      AND class_id IN (SELECT app_user_class_ids())
      AND school_id = app_class_school(class_id)
      AND (score IS NULL OR score >= 0)
      AND (score IS NULL OR max_score IS NULL OR score <= max_score)
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3) restrict_maintenance_functions (+ _from_public follow-up)
-- purge_* and rls_auto_enable are cron/dashboard-only maintenance functions
-- but were EXECUTE-able by anon/authenticated via the default GRANT TO PUBLIC
-- (e.g. purge_old_audit_log(0) would erase the whole security audit trail).
-- Revoking from anon/authenticated alone is a no-op — must revoke from PUBLIC.
-- The owner (postgres), under which pg_cron runs, can always execute.
-- ─────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.purge_expired_sessions(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_old_audit_log(integer)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()               FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.purge_expired_sessions(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_old_audit_log(integer)    TO service_role;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable()               TO service_role;
