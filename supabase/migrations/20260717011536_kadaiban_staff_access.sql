-- Fix #70: widen Kadaiban RLS from teacher-only to teacher-OR-staff-of-school,
-- matching cmod_write / ar_read / observation_records_rw. The shipped Kadaiban
-- migrations (20260717002543_kadaiban.sql, 20260717002655_kadaiban_storage.sql)
-- were described as "modeled on the cmod_write / ar_insert self-vs-staff split"
-- but only implemented the self (teacher) half via app_user_taught_class_ids();
-- the staff branch was dropped. So platform_admin / school_admin / coordinator
-- — who get whole-school class access in the gradebook UI (Gradebook.loadClasses)
-- — reached Kadaiban's create form but were rejected by RLS on the insert
-- (issue #70: "RLS security error ... could not send it in").
--
-- app_user_staff_school_ids() returns ALL schools for a platform_admin and the
-- admin/coordinator's schools otherwise; educators keep exactly their taught
-- classes via app_user_taught_class_ids(). So "taught OR staff-of-school" is the
-- same self-vs-staff shape cmod_write uses, restoring access on EVERY Kadaiban
-- path (create, page upload, grade, and the staff read paths), not just the one
-- create policy the reporter happened to hit.
--
-- Applied to prod via MCP apply_migration (ledger 20260717011536) and verified:
-- a platform_admin with 0 taught classes can now insert a kadaiban_assignments
-- row under RLS (checked in a rolled-back transaction on a real class).
--
-- Idempotent: drop-policy-if-exists + create; create-or-replace on the guard fn.

-- ── kadaiban_assignments ──────────────────────────────────────────────────
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

-- ── kadaiban_assignment_pages ─────────────────────────────────────────────
-- (read inherits parent RLS via `assignment_id in (select id from
-- kadaiban_assignments)` — widening kadaiban_asg_read above covers it.)
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

-- ── kadaiban_submissions ──────────────────────────────────────────────────
drop policy if exists kadaiban_sub_read on public.kadaiban_submissions;
create policy kadaiban_sub_read on public.kadaiban_submissions for select using (
  student_id = auth.uid()
  or assignment_id in (select a.id from public.kadaiban_assignments a
    where a.class_id in (select public.app_user_taught_class_ids())
       or a.class_id in (select c.id from public.classes c
                         where c.school_id in (select public.app_user_staff_school_ids())))
);

drop policy if exists kadaiban_sub_teacher_grade on public.kadaiban_submissions;
create policy kadaiban_sub_teacher_grade on public.kadaiban_submissions for update using (
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

-- ── kadaiban_submission_pages ─────────────────────────────────────────────
drop policy if exists kadaiban_subpage_teacher_read on public.kadaiban_submission_pages;
create policy kadaiban_subpage_teacher_read on public.kadaiban_submission_pages for select using (
  submission_id in (
    select s.id from public.kadaiban_submissions s
    join public.kadaiban_assignments a on a.id = s.assignment_id
    where a.class_id in (select public.app_user_taught_class_ids())
       or a.class_id in (select c.id from public.classes c
                         where c.school_id in (select public.app_user_staff_school_ids())))
);

-- ── guard trigger: widen v_is_teacher to teacher-OR-staff ──────────────────
-- Otherwise an admin's grade UPDATE would still throw here even after the
-- policies above are widened (the reason the partial autofix left grading broken).
create or replace function public.kadaiban_submissions_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_is_teacher boolean;
begin
  select exists (
    select 1 from public.kadaiban_assignments a
    where a.id = new.assignment_id
      and (a.class_id in (select public.app_user_taught_class_ids())
           or a.class_id in (select c.id from public.classes c
                             where c.school_id in (select public.app_user_staff_school_ids())))
  ) into v_is_teacher;

  if not v_is_teacher then
    if new.status = 'graded' then
      raise exception 'kadaiban: only a teacher/staff of the class may set status=graded';
    end if;
    if new.score is not null or new.max_score is not null
       or new.graded_by is not null or new.graded_at is not null then
      raise exception 'kadaiban: only a teacher/staff of the class may set grade fields';
    end if;
    if tg_op = 'UPDATE' and old.status = 'graded' then
      raise exception 'kadaiban: a graded submission cannot be modified by the student';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.kadaiban_submissions_guard() from public, anon, authenticated;

-- ── storage.objects ───────────────────────────────────────────────────────
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

drop policy if exists kadaiban_src_read on storage.objects;
create policy kadaiban_src_read on storage.objects for select to authenticated using (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id::text = split_part(name,'/',1)
                and (a.class_id in (select public.app_user_taught_class_ids())
                     or a.class_id in (select public.app_user_class_ids())
                     or a.class_id in (select c.id from public.classes c
                                       where c.school_id in (select public.app_user_staff_school_ids()))))
);

drop policy if exists kadaiban_subm_read on storage.objects;
create policy kadaiban_subm_read on storage.objects for select to authenticated using (
  bucket_id = 'kadaiban-submissions'
  and (split_part(name,'/',2) = auth.uid()::text
       or exists (select 1 from public.kadaiban_assignments a
                  where a.id::text = split_part(name,'/',1)
                    and (a.class_id in (select public.app_user_taught_class_ids())
                         or a.class_id in (select c.id from public.classes c
                                           where c.school_id in (select public.app_user_staff_school_ids())))))
);
