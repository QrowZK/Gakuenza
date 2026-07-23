-- Performance advisor: auth RLS initialization plan.
--
-- 13 RLS policies called auth.uid() bare in their USING / WITH CHECK
-- expression. Postgres re-evaluates a bare volatile-looking call per row; the
-- documented Supabase fix is to wrap it as (select auth.uid()) so the planner
-- hoists it to a one-time InitPlan. auth.uid() is STABLE and returns the same
-- value for the whole statement, so this is strictly a planner hint — row
-- visibility is byte-for-byte identical before and after.
--
-- Done with ALTER POLICY (atomic; the policy is never absent mid-statement)
-- rather than DROP+CREATE. Only the flagged bare auth.uid() calls are wrapped;
-- every other sub-expression (including the already-(select ...)-wrapped
-- app_user_*() helper calls) is reproduced verbatim. app_has_role()/
-- app_is_platform_admin()/app_class_school() are left as-is: they are public
-- (not auth.*) functions, some take per-row column args and cannot be hoisted,
-- and the advisor does not flag them.

-- activity_result_items --------------------------------------------------------
alter policy result_items_insert_own on public.activity_result_items
  with check (activity_result_id in ( select activity_results.id
     from activity_results
    where (activity_results.user_id = (select auth.uid()))));

alter policy result_items_read on public.activity_result_items
  using (activity_result_id in ( select ar.id
     from activity_results ar
    where ((ar.user_id = (select auth.uid())) or (ar.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)) or (ar.class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids)))));

-- activity_results -------------------------------------------------------------
alter policy ar_insert on public.activity_results
  with check (app_has_role(school_id, array['educator'::text, 'school_admin'::text]) or ((user_id = (select auth.uid())) and (class_id in ( select app_user_class_ids() as app_user_class_ids)) and (school_id = app_class_school(class_id)) and ((score is null) or (score >= (0)::numeric)) and ((score is null) or (max_score is null) or (score <= max_score))));

alter policy ar_read on public.activity_results
  using ((user_id = (select auth.uid())) or (school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids)));

-- class_teachers ---------------------------------------------------------------
alter policy class_teachers_read on public.class_teachers
  using ((user_id = (select auth.uid())) or (class_id in ( select classes.id
     from classes
    where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))));

-- enrollments ------------------------------------------------------------------
alter policy enroll_read on public.enrollments
  using ((user_id = (select auth.uid())) or (class_id in ( select classes.id
     from classes
    where (classes.school_id in ( select app_user_school_ids() as app_user_school_ids)))));

-- grade_corrections ------------------------------------------------------------
alter policy grade_corrections_insert on public.grade_corrections
  with check ((corrected_by = (select auth.uid())) and (app_is_platform_admin() or app_has_role(( select ar.school_id
     from activity_results ar
    where (ar.id = grade_corrections.activity_result_id)), array['school_admin'::text, 'coordinator'::text]) or (( select ar.class_id
     from activity_results ar
    where (ar.id = grade_corrections.activity_result_id)) in ( select app_user_taught_class_ids() as app_user_taught_class_ids))));

-- kadaiban_assignments ---------------------------------------------------------
alter policy kadaiban_asg_write on public.kadaiban_assignments
  using ((class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids)) or (class_id in ( select c.id
     from classes c
    where (c.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))))
  with check (((class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids)) or (class_id in ( select c.id
     from classes c
    where (c.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids))))) and (created_by = (select auth.uid())));

-- kadaiban_submission_pages ----------------------------------------------------
alter policy kadaiban_subpage_student on public.kadaiban_submission_pages
  using (submission_id in ( select kadaiban_submissions.id
     from kadaiban_submissions
    where (kadaiban_submissions.student_id = (select auth.uid()))))
  with check (submission_id in ( select kadaiban_submissions.id
     from kadaiban_submissions
    where (kadaiban_submissions.student_id = (select auth.uid()))));

-- kadaiban_submissions ---------------------------------------------------------
alter policy kadaiban_sub_student_write on public.kadaiban_submissions
  using (student_id = (select auth.uid()))
  with check ((student_id = (select auth.uid())) and (assignment_id in ( select a.id
     from kadaiban_assignments a
    where (a.class_id in ( select app_user_class_ids() as app_user_class_ids)))));

alter policy kadaiban_sub_read on public.kadaiban_submissions
  using ((student_id = (select auth.uid())) or (assignment_id in ( select a.id
     from kadaiban_assignments a
    where ((a.class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids)) or (a.class_id in ( select c.id
             from classes c
            where (c.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids))))))));

-- profiles ---------------------------------------------------------------------
alter policy profiles_read on public.profiles
  using ((id = (select auth.uid())) or (home_school_id in ( select app_user_school_ids() as app_user_school_ids)));

alter policy profiles_read_admin on public.profiles
  using ((id = (select auth.uid())) or (id in ( select school_members.user_id
     from school_members
    where (school_members.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))) or (id in ( select e.user_id
     from (enrollments e
       join classes c on ((c.id = e.class_id)))
    where (c.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))));
