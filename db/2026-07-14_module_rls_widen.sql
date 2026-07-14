-- Module workflow rework — Phase 1: RLS widening for class_modules writes.
--
-- NOTE: the repo has no supabase/ tooling, so this file is documentation, not
-- an auto-applied migration. It mirrors the migration
-- `widen_class_modules_write_to_staff_and_taught` already applied to the live
-- project (ref ohnsawydclmsrgphasbn) via the Supabase management API.
--
-- ============================================================================
-- POLICY STATEMENT (current -> target), per REHOMING_AND_BUILD_SPECS.md Spec 5
-- ============================================================================
--
-- Verified live (2026-07-14) BEFORE this change:
--   class_modules  write (cmod_admin_write, FOR ALL): school of class IN
--     app_user_admin_school_ids()  -> platform-admin + school_admin ONLY.
--   school_modules write (smod_admin_write, FOR ALL): school IN
--     app_user_admin_school_ids()  -> platform-admin + school_admin ONLY.
--
-- Confirmed drift: coordinators reach the admin module UI (requireAdminAccess
-- admits 'coordinator') but neither write policy admitted them, and educators
-- were excluded entirely -- a class-assigned teacher could not assign a drill
-- to their own class.
--
-- TARGET (this change):
--   class_modules  write: school of class IN app_user_staff_school_ids()
--     (admin + coordinator, school-wide) OR class_id IN
--     app_user_taught_class_ids() (educators, their own taught classes only).
--   school_modules write: UNCHANGED -- app_user_admin_school_ids() (admin-only).
--     School-level enablement is a licensing act; coordinators cannot enable.
--
-- The enforce_module_enabled trigger (class_modules_guard, BEFORE INSERT/UPDATE)
-- still blocks assigning a module that is not school-enabled -- unchanged.
-- ============================================================================

drop policy if exists cmod_admin_write on public.class_modules;

create policy cmod_write on public.class_modules
  for all
  to public
  using (
    class_id in (
      select classes.id from public.classes
      where classes.school_id in (select public.app_user_staff_school_ids())
    )
    or class_id in (select public.app_user_taught_class_ids())
  )
  with check (
    class_id in (
      select classes.id from public.classes
      where classes.school_id in (select public.app_user_staff_school_ids())
    )
    or class_id in (select public.app_user_taught_class_ids())
  );
