-- Fix: platform_admin / school_admin / coordinator cannot post a Kadaiban
-- assignment for a class they administer but do not personally teach.
--
-- Kadaiban's table + storage RLS (20260717000000_kadaiban.sql,
-- 20260717000100_kadaiban_storage.sql) was described as "modeled on the
-- existing cmod_write / ar_insert self-vs-staff split" but only implemented
-- the self (teacher) half via app_user_taught_class_ids() — the staff branch
-- (class's school in app_user_staff_school_ids(), the same helper cmod_write,
-- ar_read, observation_records_rw and gradebook_snapshots_read already use)
-- was never added. The gradebook UI (Gradebook.loadClasses,
-- gradebook-common.js) deliberately gives non-educator tiers whole-school
-- class visibility, so an admin reaches Kadaiban's create form for a class
-- they don't teach, and the insert is rejected by RLS (issue #70).
--
-- Scope: only the policies on the assignment-creation path
-- (kadaiban_asg_write -> kadaiban-sources storage upload ->
-- kadaiban_asgpage_write), plus kadaiban_asg_read so the admin can see the
-- assignment list for a class they administer. Grading
-- (kadaiban_sub_teacher_grade, the kadaiban_submissions_guard trigger,
-- submission storage policies) is a separate, unreported action and is left
-- untouched here.
--
-- Idempotent: drop-policy-if-exists then create, matching the source
-- migrations' convention.

-- kadaiban_assignments -------------------------------------------------------
drop policy if exists kadaiban_asg_read on public.kadaiban_assignments;
create policy kadaiban_asg_read on public.kadaiban_assignments for select using (
  class_id in (select public.app_user_taught_class_ids())
  or class_id in (select public.app_user_class_ids())
  or class_id in (select c.id from public.classes c
                  where c.school_id in (select public.app_user_staff_school_ids()))
);

drop policy if exists kadaiban_asg_write on public.kadaiban_assignments;
create policy kadaiban_asg_write on public.kadaiban_assignments for all using (
  class_id in (select public.app_user_taught_class_ids())
  or class_id in (select c.id from public.classes c
                  where c.school_id in (select public.app_user_staff_school_ids()))
) with check (
  (class_id in (select public.app_user_taught_class_ids())
   or class_id in (select c.id from public.classes c
                   where c.school_id in (select public.app_user_staff_school_ids())))
  and created_by = auth.uid()
);

-- kadaiban_assignment_pages (scope inherited from the parent assignment) ----
drop policy if exists kadaiban_asgpage_write on public.kadaiban_assignment_pages;
create policy kadaiban_asgpage_write on public.kadaiban_assignment_pages for all using (
  assignment_id in (select a.id from public.kadaiban_assignments a
                    where a.class_id in (select public.app_user_taught_class_ids())
                       or a.class_id in (select c.id from public.classes c
                                         where c.school_id in (select public.app_user_staff_school_ids())))
) with check (
  assignment_id in (select a.id from public.kadaiban_assignments a
                    where a.class_id in (select public.app_user_taught_class_ids())
                       or a.class_id in (select c.id from public.classes c
                                         where c.school_id in (select public.app_user_staff_school_ids())))
);

-- storage.objects: kadaiban-sources write (page-1 scan upload in submitCreate) --
drop policy if exists kadaiban_src_write on storage.objects;
create policy kadaiban_src_write on storage.objects for all to authenticated using (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id::text = split_part(name,'/',1)
                and (a.class_id in (select public.app_user_taught_class_ids())
                     or a.class_id in (select c.id from public.classes c
                                       where c.school_id in (select public.app_user_staff_school_ids()))))
) with check (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id::text = split_part(name,'/',1)
                and (a.class_id in (select public.app_user_taught_class_ids())
                     or a.class_id in (select c.id from public.classes c
                                       where c.school_id in (select public.app_user_staff_school_ids()))))
);
