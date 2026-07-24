-- Teacher-driven module assignments (user-report #176, spec
-- docs/specs/SPEC_teacher_assignment_workflow.md, Phase 1 MVP).
-- A discrete, teacher-issued task from an already-enabled drill module —
-- mirrors kadaiban_assignments (own id, created_by, multiple-per-class), so
-- "assignment" is separated from class_modules "enablement". Completion is
-- inferred (MVP) from activity_results; no reporting-path change.
--
-- Verified live post-apply by impersonation:
--   teacher    → insert (self-attributed) OK, reads own class's rows
--   student    → reads the class's rows, insert DENIED (RLS)
--   teacher spoofing created_by (≠ auth.uid) → DENIED (self-attribution check)
--   unrelated user → sees 0 rows
-- Grants: anon/authenticated hold CRUD (RLS-filtered) but NOT truncate.
-- Applied 2026-07-24, ledger 20260724024845.
create table if not exists public.module_assignments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id)  on delete cascade,
  module_id    uuid not null references public.modules(id)  on delete cascade,
  created_by   uuid not null references public.profiles(id),
  title        text,
  focus_units  jsonb,          -- which units (null = whole module); same key convention as class_modules.focus_units
  target_items integer,        -- desired question count (null = module default)
  due_date     date,
  instructions text,
  created_at   timestamptz not null default now()
);

-- FK-covering indexes (perf-advisor rule: every FK gets a covering index)
create index if not exists module_assignments_class_id_idx   on public.module_assignments (class_id);
create index if not exists module_assignments_module_id_idx  on public.module_assignments (module_id);
create index if not exists module_assignments_created_by_idx on public.module_assignments (created_by);

alter table public.module_assignments enable row level security;

-- New-table hardening: ALTER DEFAULT PRIVILEGES re-grants TRUNCATE (RLS-bypassing)
-- to anon/authenticated on every freshly created table — revoke it here so we
-- don't repeat the kadaiban miss (20260717041107).
revoke truncate on public.module_assignments from anon, authenticated;

-- READ: a student of the class, or a teacher/staff of it (so the student hub and
-- the gradebook read the same rows). Helpers live in the private schema
-- (20260724011947).
create policy module_assignments_read on public.module_assignments
  for select
  using (
    class_id in (select private.app_user_class_ids())
    or class_id in (select private.app_user_taught_class_ids())
    or class_id in (select c.id from public.classes c
                    where c.school_id in (select private.app_user_staff_school_ids()))
  );

-- WRITE: teacher/staff of the class only. Split by command (not FOR ALL) so this
-- never re-introduces the ALL+SELECT overlap that perf-debt #7's residual is
-- about. INSERT self-attributes (created_by = caller).
create policy module_assignments_insert on public.module_assignments
  for insert
  with check (
    created_by = (select auth.uid())
    and (
      class_id in (select private.app_user_taught_class_ids())
      or class_id in (select c.id from public.classes c
                      where c.school_id in (select private.app_user_staff_school_ids()))
    )
  );

create policy module_assignments_update on public.module_assignments
  for update
  using (
    class_id in (select private.app_user_taught_class_ids())
    or class_id in (select c.id from public.classes c
                    where c.school_id in (select private.app_user_staff_school_ids()))
  )
  with check (
    class_id in (select private.app_user_taught_class_ids())
    or class_id in (select c.id from public.classes c
                    where c.school_id in (select private.app_user_staff_school_ids()))
  );

create policy module_assignments_delete on public.module_assignments
  for delete
  using (
    class_id in (select private.app_user_taught_class_ids())
    or class_id in (select c.id from public.classes c
                    where c.school_id in (select private.app_user_staff_school_ids()))
  );
