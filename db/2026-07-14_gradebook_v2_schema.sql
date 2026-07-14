-- Gradebook v2 schema — three new tables backing hub/gradebook/
-- (project ref: ohnsawydclmsrgphasbn). Applied to the live database on
-- 2026-07-14 via the Supabase migration
-- `gradebook_observation_snapshots_corrections`. This file is the
-- version-controlled record; the repo has no supabase/ tooling, so it is
-- documentation, not an auto-applied migration.
--
--   observation_records  — teacher observations (unit-mode + free-notes)
--   gradebook_snapshots  — weekly cron-generated rollups (trend line source)
--   grade_corrections    — audited history of score corrections
--
-- RLS boundary reused from the existing gradebook: platform admin (all
-- schools), school_admin/coordinator (their school, via app_has_role), and
-- educator (only classes they teach, via app_user_taught_class_ids()). This is
-- exactly results_admin_write's authorization boundary — the same people who
-- can already correct a score are the ones who can observe/snapshot/log-why.

-- ─────────────────────────────────────────────────────────────────────────
-- observation_records
-- school_id added (not in the v2 spec's column list) so the school-role RLS
-- check matches activity_results' app_has_role(school_id, ...) pattern rather
-- than re-deriving the school through app_class_school on every row.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.observation_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id),
  class_id    uuid NOT NULL REFERENCES public.classes(id),
  student_id  uuid NOT NULL REFERENCES public.profiles(id),
  teacher_id  uuid NOT NULL REFERENCES public.profiles(id),
  subject     text,
  module_id   uuid REFERENCES public.modules(id),   -- set for unit-mode, null for free-notes
  category    text NOT NULL,                          -- e.g. 授業態度, or the unit label when module_id set
  rating      text CHECK (rating IN ('A','B','C')),   -- nullable
  note        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX observation_records_class_student_idx ON public.observation_records (class_id, student_id);
CREATE INDEX observation_records_module_idx ON public.observation_records (module_id);
CREATE INDEX observation_records_created_idx ON public.observation_records (created_at DESC);

ALTER TABLE public.observation_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY observation_records_rw ON public.observation_records
  FOR ALL
  USING (
    app_is_platform_admin()
    OR app_has_role(school_id, ARRAY['school_admin'::text, 'coordinator'::text])
    OR class_id IN (SELECT app_user_taught_class_ids())
  )
  WITH CHECK (
    app_is_platform_admin()
    OR app_has_role(school_id, ARRAY['school_admin'::text, 'coordinator'::text])
    OR class_id IN (SELECT app_user_taught_class_ids())
  );

CREATE OR REPLACE FUNCTION public.observation_records_touch()
  RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER observation_records_touch_updated
  BEFORE UPDATE ON public.observation_records
  FOR EACH ROW EXECUTE FUNCTION public.observation_records_touch();

-- ─────────────────────────────────────────────────────────────────────────
-- gradebook_snapshots
-- Written by a weekly Supabase Cron job (service_role, bypasses RLS). Clients
-- only ever read, so there is deliberately no client write policy.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.gradebook_snapshots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id),
  class_id    uuid NOT NULL REFERENCES public.classes(id),
  student_id  uuid NOT NULL REFERENCES public.profiles(id),
  week_of     date NOT NULL,
  subject     text,
  category    text,
  rollup      jsonb NOT NULL DEFAULT '{}'::jsonb,
  pinned_note text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX gradebook_snapshots_student_week_idx ON public.gradebook_snapshots (student_id, week_of);
CREATE INDEX gradebook_snapshots_class_week_idx ON public.gradebook_snapshots (class_id, week_of);

ALTER TABLE public.gradebook_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY gradebook_snapshots_read ON public.gradebook_snapshots
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR app_has_role(school_id, ARRAY['school_admin'::text, 'coordinator'::text])
    OR class_id IN (SELECT app_user_taught_class_ids())
  );

-- ─────────────────────────────────────────────────────────────────────────
-- grade_corrections
-- Append-only audit trail. Access derives from the corrected activity_result's
-- own school/class, matching results_admin_write. No UPDATE/DELETE policy: an
-- audit row is never edited or removed (a later correction is a new row).
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE public.grade_corrections (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_result_id uuid NOT NULL REFERENCES public.activity_results(id) ON DELETE CASCADE,
  corrected_by       uuid NOT NULL REFERENCES public.profiles(id),
  previous_score     numeric,
  new_score          numeric,
  reason             text NOT NULL DEFAULT '',
  corrected_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grade_corrections_result_idx ON public.grade_corrections (activity_result_id, corrected_at DESC);

ALTER TABLE public.grade_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY grade_corrections_read ON public.grade_corrections
  FOR SELECT
  USING (
    app_is_platform_admin()
    OR app_has_role(
         (SELECT ar.school_id FROM activity_results ar WHERE ar.id = activity_result_id),
         ARRAY['school_admin'::text, 'coordinator'::text])
    OR (SELECT ar.class_id FROM activity_results ar WHERE ar.id = activity_result_id)
         IN (SELECT app_user_taught_class_ids())
  );

CREATE POLICY grade_corrections_insert ON public.grade_corrections
  FOR INSERT
  WITH CHECK (
    corrected_by = auth.uid()
    AND (
      app_is_platform_admin()
      OR app_has_role(
           (SELECT ar.school_id FROM activity_results ar WHERE ar.id = activity_result_id),
           ARRAY['school_admin'::text, 'coordinator'::text])
      OR (SELECT ar.class_id FROM activity_results ar WHERE ar.id = activity_result_id)
           IN (SELECT app_user_taught_class_ids())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Follow-up (NOT done here — dashboard / product decisions):
--   * gradebook_snapshots is populated by a weekly Supabase Cron job that
--     rolls up activity_results per (class, student, week). Create it in the
--     Dashboard (Database > Cron) running as service_role. Its health is only
--     surfaced as the sidebar "最終実行" line for now (spec open item #3).
--   * Tightening activity_results/_items READ RLS to match the educator's
--     taught-class scope (currently school-wide) remains the separately
--     tracked follow-up noted in admin-common.js requireGradebookAccess().
-- ─────────────────────────────────────────────────────────────────────────
