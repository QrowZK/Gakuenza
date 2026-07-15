-- Fix: platform admins could not create schools through the admin UI.
-- Applied to the live project (ref ohnsawydclmsrgphasbn) on 2026-07-15 via the
-- Supabase migration fix_schools_insert_returning_for_platform_admin.
-- Documentation mirror; the repo has no supabase/ CLI tooling.
--
-- SYMPTOM: teachers.html "学校を追加" runs
--   sb.from('schools').insert({ name }).select('id').single()
-- i.e. INSERT ... RETURNING. It failed with
--   "new row violates row-level security policy for table schools".
--
-- CAUSE: the INSERT WITH CHECK (schools_platform_admin_insert =
-- app_is_platform_admin()) passes fine, but RETURNING also enforces the
-- SELECT policy on the new row. Both schools SELECT policies decided
-- visibility with `id IN (select app_user_staff_school_ids())` /
-- app_user_school_ids(), and those helpers compute the allowed set by
-- SELECTing from the schools table itself — under the INSERT's snapshot the
-- just-inserted row isn't in that set, so the row fails its own RETURNING.
-- (INSERT without RETURNING succeeded, confirming the diagnosis.)
--
-- FIX: give platform admins a direct, non-circular SELECT branch via
-- app_is_platform_admin() (which reads profiles, not schools), so a brand-new
-- school is visible to its inserter immediately. Otherwise unchanged: a
-- platform admin already saw every school via app_user_staff_school_ids();
-- non-platform staff keep their exact prior scope.

drop policy if exists schools_read_admin on public.schools;
create policy schools_read_admin on public.schools
  for select
  to public
  using (
    app_is_platform_admin()
    or id in (select public.app_user_staff_school_ids())
  );
