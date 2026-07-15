-- Tighten result READ RLS to taught classes for educators; fold coordinators
-- into the school-wide staff read (project ref ohnsawydclmsrgphasbn). Applied
-- to the live project 2026-07-15 via the Supabase migration
-- scope_results_read_to_taught_classes. Documentation mirror.
--
-- WHY (two things in one pass):
--  1. Educators previously had SCHOOL-WIDE read on activity_results /
--     activity_result_items via app_has_role(..., 'educator'), broader than
--     what the gradebook UI scopes to (their taught classes). This aligns
--     RLS with the UI — the follow-up flagged in admin-common.js.
--  2. Coordinators reach the gradebook UI (requireGradebookAccess) but were
--     ABSENT from ar_read entirely, so they saw no results in analysis/karte.
--     app_user_staff_school_ids() covers admin + coordinator (+ platform),
--     so switching to it fixes coordinators as a side effect.
--
-- New unified scope for both tables:
--   own rows (student)                            user_id = auth.uid()
--   platform admin + school_admin + coordinator   school_id IN app_user_staff_school_ids()
--   educator                                      class_id  IN app_user_taught_class_ids()

drop policy if exists ar_read on public.activity_results;
create policy ar_read on public.activity_results
  for select
  using (
    user_id = auth.uid()
    or school_id in (select public.app_user_staff_school_ids())
    or class_id  in (select public.app_user_taught_class_ids())
  );

drop policy if exists result_items_read on public.activity_result_items;
create policy result_items_read on public.activity_result_items
  for select
  using (
    activity_result_id in (
      select ar.id from public.activity_results ar
      where ar.user_id = auth.uid()
         or ar.school_id in (select public.app_user_staff_school_ids())
         or ar.class_id  in (select public.app_user_taught_class_ids())
    )
  );
