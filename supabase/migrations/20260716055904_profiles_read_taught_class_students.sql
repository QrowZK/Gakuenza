-- Educators can read the profiles of students in the classes they teach.
--
-- Gap found 2026-07-16: profiles SELECT was only reachable via
-- profiles_read (home_school_id IN app_user_school_ids()) or
-- profiles_read_admin (staff/admin scope). Real schools intentionally leave
-- profiles.home_school_id NULL (per-class 出席番号 numbering — see the
-- profiles_student_no_per_school note), and a pure educator is not staff — so
-- a class teacher could not read their own students' profiles at all, and
-- every student rendered as 未設定 in the gradebook.
--
-- This adds the missing taught-class path, mirroring how activity_results
-- (ar_read), observation_records, and grade_corrections already scope
-- educator access via app_user_taught_class_ids(). Read-only, additive, and
-- tightly scoped to students enrolled in the caller's taught classes.

create policy profiles_read_taught on public.profiles
  for select
  to public
  using (
    id in (
      select e.user_id
      from public.enrollments e
      where e.class_id in (select public.app_user_taught_class_ids())
    )
  );
