-- Kadaiban (課題板) — digital ink annotation + submission workflow.
-- Phase 1 infrastructure: four tables + table RLS + a submissions guard
-- trigger + the catch-all `kadaiban` reporting-anchor module.
--
-- Design source of truth: docs/planning/KADAIBAN_design.md (architecture
-- confirmed 2026-07-16). This is genuinely new territory — the first Gakuenza
-- feature to use file uploads + persisted freehand drawing. Storage buckets
-- and their storage.objects policies live in the sibling migration
-- 20260717002655_kadaiban_storage.sql (buckets are an infra object, not a
-- public-schema table). The teacher-only RLS below was later widened to
-- teacher-OR-staff-of-school in 20260717011536_kadaiban_staff_access.sql (#70).
--
-- Fully idempotent (create ... if not exists / drop policy if exists +
-- create / create or replace): safe to run twice with no duplicate rows.
-- RLS is also force-enabled here explicitly even though the rls_auto_enable
-- event trigger would catch a fresh CREATE TABLE — convention + defence in
-- depth, and it makes a re-run on an already-existing table a no-op rather
-- than a silent gap.

-- ── tables ──────────────────────────────────────────────────────────────
create table if not exists public.kadaiban_assignments (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes(id),
  created_by uuid not null references public.profiles(id),   -- which teacher assigned it
  title      text not null,
  instructions text,
  due_date   date,
  page_count int  not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.kadaiban_assignment_pages (
  id           uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.kadaiban_assignments(id) on delete cascade,
  page_number  int  not null,
  source_image_path text not null,                 -- kadaiban-sources bucket path
  unique (assignment_id, page_number)
);

create table if not exists public.kadaiban_submissions (
  id           uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.kadaiban_assignments(id),
  student_id   uuid not null references public.profiles(id),
  status       text not null default 'not_started'
    check (status in ('not_started','in_progress','submitted','graded')),
  submitted_at timestamptz,
  score        numeric,
  max_score    numeric,
  graded_by    uuid references public.profiles(id),
  graded_at    timestamptz,
  unique (assignment_id, student_id)
);

create table if not exists public.kadaiban_submission_pages (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.kadaiban_submissions(id) on delete cascade,
  page_number   int  not null,
  canvas_state  jsonb,               -- editable strokes [[{x,y,...}],...] in IMAGE space
  rendered_image_path text,          -- flattened PNG snapshot, kadaiban-submissions bucket
  updated_at    timestamptz not null default now(),
  unique (submission_id, page_number)
);

alter table public.kadaiban_assignments       enable row level security;
alter table public.kadaiban_assignment_pages   enable row level security;
alter table public.kadaiban_submissions        enable row level security;
alter table public.kadaiban_submission_pages   enable row level security;

-- ── table RLS ───────────────────────────────────────────────────────────
-- Modeled on the existing cmod_write / ar_insert self-vs-staff split, using
-- the same SECURITY DEFINER helpers (app_user_taught_class_ids,
-- app_user_class_ids) that the rest of the app's RLS relies on.

-- kadaiban_assignments -----------------------------------------------------
drop policy if exists kadaiban_asg_read  on public.kadaiban_assignments;
create policy kadaiban_asg_read on public.kadaiban_assignments for select using (
  class_id in (select public.app_user_taught_class_ids())
  or class_id in (select public.app_user_class_ids())
);
drop policy if exists kadaiban_asg_write on public.kadaiban_assignments;
create policy kadaiban_asg_write on public.kadaiban_assignments for all using (
  class_id in (select public.app_user_taught_class_ids())
) with check (
  class_id in (select public.app_user_taught_class_ids())
  and created_by = auth.uid()
);

-- kadaiban_assignment_pages (scope inherited from the parent assignment) ----
drop policy if exists kadaiban_asgpage_read  on public.kadaiban_assignment_pages;
create policy kadaiban_asgpage_read on public.kadaiban_assignment_pages for select using (
  assignment_id in (select id from public.kadaiban_assignments)  -- parent RLS filters
);
drop policy if exists kadaiban_asgpage_write on public.kadaiban_assignment_pages;
create policy kadaiban_asgpage_write on public.kadaiban_assignment_pages for all using (
  assignment_id in (select a.id from public.kadaiban_assignments a
                    where a.class_id in (select public.app_user_taught_class_ids()))
) with check (
  assignment_id in (select a.id from public.kadaiban_assignments a
                    where a.class_id in (select public.app_user_taught_class_ids()))
);

-- kadaiban_submissions -----------------------------------------------------
drop policy if exists kadaiban_sub_read on public.kadaiban_submissions;
create policy kadaiban_sub_read on public.kadaiban_submissions for select using (
  student_id = auth.uid()
  or assignment_id in (select a.id from public.kadaiban_assignments a
                       where a.class_id in (select public.app_user_taught_class_ids()))
);
-- student creates/updates their OWN submission (draft + submit). Grade fields
-- are additionally locked down by the guard trigger below (WITH CHECK cannot
-- compare against OLD, so the "student may not set score/graded" rule lives
-- in the trigger, not here).
drop policy if exists kadaiban_sub_student_write on public.kadaiban_submissions;
create policy kadaiban_sub_student_write on public.kadaiban_submissions for all using (
  student_id = auth.uid()
) with check (
  student_id = auth.uid()
  and assignment_id in (select a.id from public.kadaiban_assignments a
                        where a.class_id in (select public.app_user_class_ids()))
);
-- teacher updates grade fields for classes they teach
drop policy if exists kadaiban_sub_teacher_grade on public.kadaiban_submissions;
create policy kadaiban_sub_teacher_grade on public.kadaiban_submissions for update using (
  assignment_id in (select a.id from public.kadaiban_assignments a
                    where a.class_id in (select public.app_user_taught_class_ids()))
) with check (
  assignment_id in (select a.id from public.kadaiban_assignments a
                    where a.class_id in (select public.app_user_taught_class_ids()))
);

-- kadaiban_submission_pages (canvas drafts) --------------------------------
drop policy if exists kadaiban_subpage_student on public.kadaiban_submission_pages;
create policy kadaiban_subpage_student on public.kadaiban_submission_pages for all using (
  submission_id in (select id from public.kadaiban_submissions where student_id = auth.uid())
) with check (
  submission_id in (select id from public.kadaiban_submissions where student_id = auth.uid())
);
drop policy if exists kadaiban_subpage_teacher_read on public.kadaiban_submission_pages;
create policy kadaiban_subpage_teacher_read on public.kadaiban_submission_pages for select using (
  submission_id in (
    select s.id from public.kadaiban_submissions s
    join public.kadaiban_assignments a on a.id = s.assignment_id
    where a.class_id in (select public.app_user_taught_class_ids()))
);

-- ── guard trigger ─────────────────────────────────────────────────────────
-- Mirrors the class_modules_guard pattern. A student's own-row write (allowed
-- by kadaiban_sub_student_write) must NOT be able to flip status to 'graded'
-- or set score/max_score/graded_by/graded_at, and must not alter an existing
-- grade. Only a teacher of the assignment's class (the grade path) may touch
-- those. SECURITY DEFINER so the is-teacher probe sees the assignment row
-- regardless of the caller's RLS; auth.uid() still resolves to the real caller.
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
      and a.class_id in (select public.app_user_taught_class_ids())
  ) into v_is_teacher;

  if not v_is_teacher then
    if new.status = 'graded' then
      raise exception 'kadaiban: only a teacher of the class may set status=graded';
    end if;
    if new.score is not null or new.max_score is not null
       or new.graded_by is not null or new.graded_at is not null then
      raise exception 'kadaiban: only a teacher of the class may set grade fields';
    end if;
    if tg_op = 'UPDATE' and old.status = 'graded' then
      raise exception 'kadaiban: a graded submission cannot be modified by the student';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists kadaiban_submissions_guard on public.kadaiban_submissions;
create trigger kadaiban_submissions_guard
  before insert or update on public.kadaiban_submissions
  for each row execute function public.kadaiban_submissions_guard();

-- A trigger function is invoked by the trigger mechanism, not via role EXECUTE,
-- so revoke the default PUBLIC EXECUTE — it should never be reachable as a REST
-- RPC (clears the anon/authenticated_security_definer_function_executable lint).
revoke all on function public.kadaiban_submissions_guard() from public, anon, authenticated;

-- ── grants (RLS still governs row visibility) ─────────────────────────────
grant select, insert, update, delete, references, trigger on
  public.kadaiban_assignments, public.kadaiban_assignment_pages,
  public.kadaiban_submissions, public.kadaiban_submission_pages
  to authenticated;
grant all on
  public.kadaiban_assignments, public.kadaiban_assignment_pages,
  public.kadaiban_submissions, public.kadaiban_submission_pages
  to service_role;

-- ── catch-all reporting-anchor module ─────────────────────────────────────
-- activity_results.module_id is NOT NULL (FK → modules.id). Kadaiban grades
-- have no real "module", so they anchor to this single catch-all row; the
-- activity_ref (kadaiban/<assignment_id>/<graded_ts>) distinguishes them.
-- is_active=false so it never renders as a launchable tile in the hub grid —
-- it is a reporting anchor, not an app. No launch_url (nothing to launch).
-- subject 'misc' satisfies modules_subject_check. Idempotent.
insert into public.modules (key, name, name_en, subject, is_active)
values ('kadaiban', '課題板', 'Kadaiban', 'misc', false)
on conflict (key) do update set
  name      = excluded.name,
  name_en   = excluded.name_en,
  subject   = excluded.subject,
  is_active = excluded.is_active;
