-- =====================================================================
-- Gakuenza — baseline schema (squashed snapshot of production)
-- Project ref: ohnsawydclmsrgphasbn (Gakuenza.com, ap-northeast-1, PG17)
-- =====================================================================
--
-- HOW THIS WAS MADE: assembled 2026-07-15 by introspecting the LIVE
-- database through the Supabase MCP (pg_catalog / pg_get_*def), NOT via
-- `supabase db pull` (no CLI/DB-credentials were available in the agent
-- sandbox). It captures the FULL current public schema as a single floor,
-- so it is dated at the migration-tracking floor (2026-07-06, project
-- creation) even though it already includes every change through
-- 2026-07-15 — that is what a squashed baseline is.
--
-- >>> VERIFY BEFORE RELYING ON `db reset` FROM ZERO <<<
-- This is a hand-assembled snapshot, not pg_dump output. When you next have
-- DB credentials, run `supabase db pull` on a throwaway/preview branch and
-- diff it against this file to confirm nothing was missed (grants, defaults,
-- policy expressions, extension placement). Treat any diff as authoritative.
--
-- NOT included (intentionally, matches supabase/README.md):
--   * The `auth`/`storage`/`vault` schemas and Supabase-managed system
--     event triggers (pgrst_*, issue_*) — provided by the platform.
--   * The pg_cron weekly-snapshot SCHEDULE (lives in the `cron` schema,
--     not `public`). Re-create it from
--     db/2026-07-15_cron_gradebook_snapshots.sql — see the note at the end.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ---------------------------------------------------------------------
-- 2. Tables (columns only; constraints added in §3)
-- ---------------------------------------------------------------------
create table public.schools (
    id uuid not null default gen_random_uuid(),
    name text not null,
    name_kana text,
    code text,
    status text not null default 'active'::text,
    created_at timestamp with time zone not null default now()
);

create table public.profiles (
    id uuid not null,
    home_school_id uuid,
    display_name text not null,
    student_number text,
    created_at timestamp with time zone not null default now(),
    must_change_password boolean not null default false,
    is_platform_admin boolean not null default false
);

create table public.classes (
    id uuid not null default gen_random_uuid(),
    school_id uuid not null,
    name text not null,
    grade_level integer,
    subject text,
    academic_year integer,
    created_at timestamp with time zone not null default now(),
    year smallint,
    gumi smallint
);

create table public.school_members (
    school_id uuid not null,
    user_id uuid not null,
    role text not null,
    created_at timestamp with time zone not null default now()
);

create table public.enrollments (
    class_id uuid not null,
    user_id uuid not null,
    role text not null,
    created_at timestamp with time zone not null default now()
);

create table public.class_teachers (
    class_id uuid not null,
    user_id uuid not null,
    created_at timestamp with time zone not null default now()
);

create table public.modules (
    id uuid not null default gen_random_uuid(),
    key text not null,
    name text not null,
    subject text not null default 'english'::text,
    curriculum text[] not null default '{}'::text[],
    description text,
    is_active boolean not null default true,
    created_at timestamp with time zone not null default now(),
    name_en text,
    launch_url text,
    recommended_grades integer[]
);

create table public.school_modules (
    school_id uuid not null,
    module_id uuid not null,
    enabled boolean not null default true,
    config jsonb not null default '{}'::jsonb,
    enabled_at timestamp with time zone not null default now()
);

create table public.class_modules (
    class_id uuid not null,
    module_id uuid not null,
    created_at timestamp with time zone not null default now(),
    total_items integer,
    due_date date,
    focus_units jsonb
);

create table public.activity_results (
    id uuid not null default gen_random_uuid(),
    school_id uuid not null,
    class_id uuid,
    module_id uuid not null,
    user_id uuid not null,
    activity_ref text not null,
    score numeric,
    max_score numeric,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamp with time zone not null default now()
);

create table public.activity_result_items (
    id uuid not null default gen_random_uuid(),
    activity_result_id uuid not null,
    item_ref text not null,
    category text,
    prompt text,
    correct boolean not null,
    selected_answer text,
    correct_answer text,
    created_at timestamp with time zone not null default now()
);

create table public.observation_records (
    id uuid not null default gen_random_uuid(),
    school_id uuid not null,
    class_id uuid not null,
    student_id uuid not null,
    teacher_id uuid not null,
    subject text,
    module_id uuid,
    category text not null,
    rating text,
    note text not null default ''::text,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

create table public.grade_corrections (
    id uuid not null default gen_random_uuid(),
    activity_result_id uuid not null,
    corrected_by uuid not null,
    previous_score numeric,
    new_score numeric,
    reason text not null default ''::text,
    corrected_at timestamp with time zone not null default now()
);

create table public.gradebook_snapshots (
    id uuid not null default gen_random_uuid(),
    school_id uuid not null,
    class_id uuid not null,
    student_id uuid not null,
    week_of date not null,
    subject text,
    category text,
    rollup jsonb not null default '{}'::jsonb,
    pinned_note text,
    created_at timestamp with time zone not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Constraints
-- ---------------------------------------------------------------------
-- 3a. Primary keys
alter table only public.schools add constraint schools_pkey primary key (id);
alter table only public.profiles add constraint profiles_pkey primary key (id);
alter table only public.classes add constraint classes_pkey primary key (id);
alter table only public.school_members add constraint school_members_pkey primary key (school_id, user_id);
alter table only public.enrollments add constraint enrollments_pkey primary key (class_id, user_id);
alter table only public.class_teachers add constraint class_teachers_pkey primary key (class_id, user_id);
alter table only public.modules add constraint modules_pkey primary key (id);
alter table only public.school_modules add constraint school_modules_pkey primary key (school_id, module_id);
alter table only public.class_modules add constraint class_modules_pkey primary key (class_id, module_id);
alter table only public.activity_results add constraint activity_results_pkey primary key (id);
alter table only public.activity_result_items add constraint activity_result_items_pkey primary key (id);
alter table only public.observation_records add constraint observation_records_pkey primary key (id);
alter table only public.grade_corrections add constraint grade_corrections_pkey primary key (id);
alter table only public.gradebook_snapshots add constraint gradebook_snapshots_pkey primary key (id);

-- 3b. Unique constraints
alter table only public.modules add constraint modules_key_key unique (key);
alter table only public.schools add constraint schools_code_key unique (code);

-- 3c. Check constraints
alter table only public.classes add constraint classes_gumi_range_check check (((gumi is null) or ((gumi >= 1) and (gumi <= 99))));
alter table only public.classes add constraint classes_year_gumi_pair_check check (((year is null) = (gumi is null)));
alter table only public.classes add constraint classes_year_range_check check (((year is null) or ((year >= 1) and (year <= 6))));
alter table only public.enrollments add constraint enrollments_role_check check ((role = any (array['teacher'::text, 'student'::text])));
alter table only public.modules add constraint modules_subject_check check ((subject = any (array['english'::text, 'math'::text, 'japanese'::text, 'science'::text, 'social'::text, 'sougou'::text, 'misc'::text])));
alter table only public.observation_records add constraint observation_records_rating_check check ((rating = any (array['A'::text, 'B'::text, 'C'::text])));
alter table only public.school_members add constraint school_members_role_check check ((role = any (array['school_admin'::text, 'coordinator'::text, 'educator'::text, 'student'::text])));
alter table only public.schools add constraint schools_status_check check ((status = any (array['active'::text, 'suspended'::text, 'pending'::text])));

-- 3d. Foreign keys
alter table only public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
alter table only public.profiles add constraint profiles_home_school_id_fkey foreign key (home_school_id) references public.schools(id) on delete set null;
alter table only public.classes add constraint classes_school_id_fkey foreign key (school_id) references public.schools(id) on delete cascade;
alter table only public.school_members add constraint school_members_school_id_fkey foreign key (school_id) references public.schools(id) on delete cascade;
alter table only public.school_members add constraint school_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table only public.enrollments add constraint enrollments_class_id_fkey foreign key (class_id) references public.classes(id) on delete cascade;
alter table only public.enrollments add constraint enrollments_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table only public.class_teachers add constraint class_teachers_class_id_fkey foreign key (class_id) references public.classes(id) on delete cascade;
alter table only public.class_teachers add constraint class_teachers_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
alter table only public.class_teachers add constraint class_teachers_user_id_profiles_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table only public.school_modules add constraint school_modules_school_id_fkey foreign key (school_id) references public.schools(id) on delete cascade;
alter table only public.school_modules add constraint school_modules_module_id_fkey foreign key (module_id) references public.modules(id) on delete cascade;
alter table only public.class_modules add constraint class_modules_class_id_fkey foreign key (class_id) references public.classes(id) on delete cascade;
alter table only public.class_modules add constraint class_modules_module_id_fkey foreign key (module_id) references public.modules(id) on delete cascade;
alter table only public.activity_results add constraint activity_results_school_id_fkey foreign key (school_id) references public.schools(id) on delete cascade;
alter table only public.activity_results add constraint activity_results_class_id_fkey foreign key (class_id) references public.classes(id) on delete set null;
alter table only public.activity_results add constraint activity_results_module_id_fkey foreign key (module_id) references public.modules(id) on delete cascade;
alter table only public.activity_results add constraint activity_results_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;
alter table only public.activity_result_items add constraint activity_result_items_activity_result_id_fkey foreign key (activity_result_id) references public.activity_results(id) on delete cascade;
alter table only public.observation_records add constraint observation_records_school_id_fkey foreign key (school_id) references public.schools(id);
alter table only public.observation_records add constraint observation_records_class_id_fkey foreign key (class_id) references public.classes(id);
alter table only public.observation_records add constraint observation_records_student_id_fkey foreign key (student_id) references public.profiles(id);
alter table only public.observation_records add constraint observation_records_teacher_id_fkey foreign key (teacher_id) references public.profiles(id);
alter table only public.observation_records add constraint observation_records_module_id_fkey foreign key (module_id) references public.modules(id);
alter table only public.grade_corrections add constraint grade_corrections_activity_result_id_fkey foreign key (activity_result_id) references public.activity_results(id) on delete cascade;
alter table only public.grade_corrections add constraint grade_corrections_corrected_by_fkey foreign key (corrected_by) references public.profiles(id);
alter table only public.gradebook_snapshots add constraint gradebook_snapshots_school_id_fkey foreign key (school_id) references public.schools(id);
alter table only public.gradebook_snapshots add constraint gradebook_snapshots_class_id_fkey foreign key (class_id) references public.classes(id);
alter table only public.gradebook_snapshots add constraint gradebook_snapshots_student_id_fkey foreign key (student_id) references public.profiles(id);

-- ---------------------------------------------------------------------
-- 4. Indexes (non-constraint)
-- ---------------------------------------------------------------------
create index activity_result_items_category_idx on public.activity_result_items using btree (category);
create index activity_result_items_result_id_idx on public.activity_result_items using btree (activity_result_id);
create index ar_class on public.activity_results using btree (class_id);
create index ar_school on public.activity_results using btree (school_id);
create index ar_user on public.activity_results using btree (user_id);
create index classes_school on public.classes using btree (school_id);
create index enrollments_user on public.enrollments using btree (user_id);
create index grade_corrections_result_idx on public.grade_corrections using btree (activity_result_id, corrected_at desc);
create index gradebook_snapshots_class_week_idx on public.gradebook_snapshots using btree (class_id, week_of);
create index gradebook_snapshots_student_week_idx on public.gradebook_snapshots using btree (student_id, week_of);
create index idx_classes_school_year_gumi on public.classes using btree (school_id, year, gumi);
create index observation_records_class_student_idx on public.observation_records using btree (class_id, student_id);
create index observation_records_created_idx on public.observation_records using btree (created_at desc);
create index observation_records_module_idx on public.observation_records using btree (module_id);
create unique index profiles_student_no_per_school on public.profiles using btree (home_school_id, student_number) where (student_number is not null);
create index school_members_user on public.school_members using btree (user_id);

-- ---------------------------------------------------------------------
-- 5. Functions (SECURITY DEFINER helpers, RPCs, trigger + event-trigger fns)
-- ---------------------------------------------------------------------
create or replace function public.app_is_platform_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false)
$function$;

create or replace function public.app_has_role(p_school uuid, roles text[])
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from school_members
    where user_id = auth.uid() and school_id = p_school and role = any(roles)
  )
$function$;

create or replace function public.app_class_school(p_class uuid)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select school_id from classes where id = p_class
$function$;

create or replace function public.app_user_school_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select school_id from school_members where user_id = auth.uid()
$function$;

create or replace function public.app_user_admin_school_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select id from schools
  where exists (select 1 from profiles where id = auth.uid() and is_platform_admin = true)
  union
  select school_id from school_members
  where user_id = auth.uid() and role = 'school_admin'
$function$;

create or replace function public.app_user_staff_school_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select id from schools
  where exists (select 1 from profiles where id = auth.uid() and is_platform_admin = true)
  union
  select school_id from school_members
  where user_id = auth.uid() and role in ('school_admin', 'coordinator')
$function$;

create or replace function public.app_user_class_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select class_id from enrollments where user_id = auth.uid()
$function$;

create or replace function public.app_user_taught_class_ids()
 returns setof uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select class_id from class_teachers where user_id = auth.uid()
$function$;

create or replace function public.app_set_module_active(p_module uuid, p_active boolean)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.modules
  set is_active = p_active
  where id = p_module and public.app_is_platform_admin();
$function$;

create or replace function public.classes_sync_name()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if new.year is not null and new.gumi is not null then
    new.name := new.year::text || '年' || new.gumi::text || '組';
  end if;
  -- special-ed classes (year/gumi null): name is left exactly as the
  -- admin entered it, untouched.
  return new;
end $function$;

create or replace function public.enforce_module_enabled()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_school uuid;
begin
  select school_id into v_school from classes where id = new.class_id;
  if not exists (
    select 1 from school_modules
    where school_id = v_school and module_id = new.module_id and enabled
  ) then
    raise exception 'module % is not enabled for the school owning class %',
      new.module_id, new.class_id;
  end if;
  return new;
end;
$function$;

create or replace function public.observation_records_touch()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end $function$;

create or replace function public.hook_restrict_google_signups(event jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public'
as $function$
declare
  v_provider text;
begin
  v_provider := event -> 'user' -> 'app_metadata' ->> 'provider';

  -- Not a Google sign-up (e.g. 'email' from provision-account, or anything
  -- else): allow. Returning an empty object means "proceed as usual".
  if v_provider is distinct from 'google' then
    return '{}'::jsonb;
  end if;

  -- A Google new-user creation reaching this point means the email matched
  -- no provisioned account (a match would auto-link instead). Reject it with
  -- a calm, non-enumerating message.
  return jsonb_build_object(
    'error', jsonb_build_object(
      'message',
        'このGoogleアカウントはがくえん座に登録されていません。学校の管理者にお問い合わせください。',
      'http_code', 403
    )
  );
end;
$function$;

create or replace function public.build_gradebook_snapshot(p_week date)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_count int;
begin
  -- Idempotent: clear the overall rows for this week before recomputing,
  -- so re-runs (weekly job overlap, manual re-runs) converge, not duplicate.
  delete from gradebook_snapshots
  where week_of = p_week and subject is null and category is null;

  insert into gradebook_snapshots
    (school_id, class_id, student_id, week_of, subject, category, rollup)
  select ar.school_id, ar.class_id, ar.user_id, p_week, null, null,
         jsonb_build_object(
           'avg', round(avg(ar.score / ar.max_score * 100)),
           'n',   count(*)
         )
  from activity_results ar
  where ar.created_at >= p_week
    and ar.created_at <  p_week + 7
    and ar.class_id is not null
    and ar.score is not null
    and ar.max_score is not null
    and ar.max_score > 0
  group by ar.school_id, ar.class_id, ar.user_id;

  get diagnostics v_count = row_count;
  return v_count;
end $function$;

create or replace function public.backfill_gradebook_snapshots()
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_total int := 0; w date;
begin
  for w in
    select distinct (date_trunc('week', created_at))::date
    from activity_results
    where class_id is not null and score is not null
      and max_score is not null and max_score > 0
    order by 1
  loop
    v_total := v_total + public.build_gradebook_snapshot(w);
  end loop;
  return v_total;
end $function$;

create or replace function public.run_weekly_gradebook_snapshot()
 returns integer
 language sql
 security definer
 set search_path to 'public'
as $function$
  select public.build_gradebook_snapshot(
    (date_trunc('week', now()) - interval '7 days')::date
  );
$function$;

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------
-- 6. Triggers
-- ---------------------------------------------------------------------
create trigger classes_sync_name_trigger before insert or update of year, gumi on public.classes for each row execute function classes_sync_name();
create trigger class_modules_guard before insert or update on public.class_modules for each row execute function enforce_module_enabled();
create trigger observation_records_touch_updated before update on public.observation_records for each row execute function observation_records_touch();

-- Event trigger: auto-enable RLS on any new public table (defense in depth).
create event trigger ensure_rls on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  execute function public.rls_auto_enable();

-- ---------------------------------------------------------------------
-- 7. Views (SECURITY DEFINER — deliberate; expose a safe subset to anon
--    on the pre-login picker; see docs/codebase-and-db-structure.md §3.7)
-- ---------------------------------------------------------------------
create view public.public_schools with (security_invoker = false) as
  select id, name from public.schools;

create view public.public_classes with (security_invoker = false) as
  select id, school_id, year, gumi, name from public.classes;

-- ---------------------------------------------------------------------
-- 8. Row-Level Security
-- ---------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.school_members enable row level security;
alter table public.enrollments enable row level security;
alter table public.class_teachers enable row level security;
alter table public.modules enable row level security;
alter table public.school_modules enable row level security;
alter table public.class_modules enable row level security;
alter table public.activity_results enable row level security;
alter table public.activity_result_items enable row level security;
alter table public.observation_records enable row level security;
alter table public.grade_corrections enable row level security;
alter table public.gradebook_snapshots enable row level security;

-- schools
create policy schools_read on public.schools for select to public
  using ((id in ( select app_user_school_ids() as app_user_school_ids)));
create policy schools_read_admin on public.schools for select to public
  using ((app_is_platform_admin() or (id in ( select app_user_staff_school_ids() as app_user_staff_school_ids))));
create policy schools_platform_admin_insert on public.schools for insert to public
  with check (app_is_platform_admin());

-- profiles
create policy profiles_read on public.profiles for select to public
  using (((id = auth.uid()) or (home_school_id in ( select app_user_school_ids() as app_user_school_ids))));
create policy profiles_read_admin on public.profiles for select to public
  using (((id = auth.uid()) or (id in ( select school_members.user_id
   from school_members
  where (school_members.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))) or (id in ( select e.user_id
   from (enrollments e
     join classes c on ((c.id = e.class_id)))
  where (c.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids))))));
create policy profiles_update_admin on public.profiles for update to public
  using (((id in ( select e.user_id
   from (enrollments e
     join classes c on ((c.id = e.class_id)))
  where (c.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))) or (id in ( select school_members.user_id
   from school_members
  where (school_members.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids))))));

-- classes
create policy classes_read on public.classes for select to public
  using (((school_id in ( select app_user_school_ids() as app_user_school_ids)) or (id in ( select app_user_class_ids() as app_user_class_ids))));
create policy classes_admin_write on public.classes for all to public
  using ((school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))
  with check ((school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)));

-- school_members
create policy members_read on public.school_members for select to public
  using ((school_id in ( select app_user_school_ids() as app_user_school_ids)));
create policy members_admin_write on public.school_members for all to public
  using ((school_id in ( select app_user_admin_school_ids() as app_user_admin_school_ids)))
  with check ((school_id in ( select app_user_admin_school_ids() as app_user_admin_school_ids)));

-- enrollments
create policy enroll_read on public.enrollments for select to public
  using (((user_id = auth.uid()) or (class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_school_ids() as app_user_school_ids))))));
create policy enroll_admin_write on public.enrollments for all to public
  using ((class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))))
  with check ((class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))));

-- class_teachers
create policy class_teachers_read on public.class_teachers for select to public
  using (((user_id = auth.uid()) or (class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids))))));
create policy class_teachers_admin_write on public.class_teachers for all to public
  using ((class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))))
  with check ((class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))));

-- modules (read-only to everyone; writes go through app_set_module_active RPC)
create policy modules_read on public.modules for select to public using (true);

-- school_modules
create policy smod_read on public.school_modules for select to public
  using ((school_id in ( select app_user_school_ids() as app_user_school_ids)));
create policy smod_admin_write on public.school_modules for all to public
  using ((school_id in ( select app_user_admin_school_ids() as app_user_admin_school_ids)))
  with check ((school_id in ( select app_user_admin_school_ids() as app_user_admin_school_ids)));

-- class_modules
create policy cmod_read on public.class_modules for select to public
  using (((class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_school_ids() as app_user_school_ids)))) or (class_id in ( select app_user_class_ids() as app_user_class_ids))));
create policy cmod_write on public.class_modules for all to public
  using (((class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))))
  with check (((class_id in ( select classes.id
   from classes
  where (classes.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)))) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))));

-- activity_results
create policy ar_read on public.activity_results for select to public
  using (((user_id = auth.uid()) or (school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))));
create policy ar_insert on public.activity_results for insert to public
  with check ((app_has_role(school_id, array['educator'::text, 'school_admin'::text]) or ((user_id = auth.uid()) and (class_id in ( select app_user_class_ids() as app_user_class_ids)) and (school_id = app_class_school(class_id)) and ((score is null) or (score >= (0)::numeric)) and ((score is null) or (max_score is null) or (score <= max_score)))));
create policy results_admin_write on public.activity_results for update to public
  using (((school_id in ( select app_user_admin_school_ids() as app_user_admin_school_ids)) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))))
  with check (((school_id in ( select app_user_admin_school_ids() as app_user_admin_school_ids)) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))));

-- activity_result_items
create policy result_items_read on public.activity_result_items for select to public
  using ((activity_result_id in ( select ar.id
   from activity_results ar
  where ((ar.user_id = auth.uid()) or (ar.school_id in ( select app_user_staff_school_ids() as app_user_staff_school_ids)) or (ar.class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))))));
create policy result_items_insert_own on public.activity_result_items for insert to public
  with check ((activity_result_id in ( select activity_results.id
   from activity_results
  where (activity_results.user_id = auth.uid()))));

-- observation_records
create policy observation_records_rw on public.observation_records for all to public
  using ((app_is_platform_admin() or app_has_role(school_id, array['school_admin'::text, 'coordinator'::text]) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))))
  with check ((app_is_platform_admin() or app_has_role(school_id, array['school_admin'::text, 'coordinator'::text]) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))));

-- grade_corrections (append-only audit)
create policy grade_corrections_read on public.grade_corrections for select to public
  using ((app_is_platform_admin() or app_has_role(( select ar.school_id
   from activity_results ar
  where (ar.id = grade_corrections.activity_result_id)), array['school_admin'::text, 'coordinator'::text]) or (( select ar.class_id
   from activity_results ar
  where (ar.id = grade_corrections.activity_result_id)) in ( select app_user_taught_class_ids() as app_user_taught_class_ids))));
create policy grade_corrections_insert on public.grade_corrections for insert to public
  with check (((corrected_by = auth.uid()) and (app_is_platform_admin() or app_has_role(( select ar.school_id
   from activity_results ar
  where (ar.id = grade_corrections.activity_result_id)), array['school_admin'::text, 'coordinator'::text]) or (( select ar.class_id
   from activity_results ar
  where (ar.id = grade_corrections.activity_result_id)) in ( select app_user_taught_class_ids() as app_user_taught_class_ids)))));

-- gradebook_snapshots (client read-only; written by the cron as service_role)
create policy gradebook_snapshots_read on public.gradebook_snapshots for select to public
  using ((app_is_platform_admin() or app_has_role(school_id, array['school_admin'::text, 'coordinator'::text]) or (class_id in ( select app_user_taught_class_ids() as app_user_taught_class_ids))));

-- ---------------------------------------------------------------------
-- 9. Grants (mirror production; RLS still governs row visibility)
-- ---------------------------------------------------------------------
-- Tables where anon/authenticated hold DML but NOT truncate (post-hardening).
grant select, insert, update, delete, references, trigger on
  public.schools, public.profiles, public.classes, public.school_members,
  public.enrollments, public.class_teachers, public.school_modules,
  public.class_modules, public.activity_results, public.activity_result_items
  to anon, authenticated;

-- modules: read-only to anon/authenticated (writes only via the RPC).
grant select on public.modules to anon, authenticated;

-- NOTE (known wart, faithful to prod): these three gradebook-v2 tables still
-- grant TRUNCATE to anon/authenticated — the 2026-07-14 hardening that removed
-- TRUNCATE from the older tables never covered them. Captured here as-is; a
-- follow-up migration should REVOKE TRUNCATE ... FROM anon, authenticated.
grant select, insert, update, delete, references, trigger, truncate on
  public.observation_records, public.grade_corrections, public.gradebook_snapshots
  to anon, authenticated;

-- service_role holds everything on every table + the views.
grant all on public.schools, public.profiles, public.classes,
  public.school_members, public.enrollments, public.class_teachers,
  public.modules, public.school_modules, public.class_modules,
  public.activity_results, public.activity_result_items,
  public.observation_records, public.grade_corrections,
  public.gradebook_snapshots, public.public_schools, public.public_classes
  to service_role;

-- Views: safe subset readable by anon (pre-login pickers).
grant select on public.public_schools, public.public_classes to anon, authenticated;

-- Function EXECUTE: helpers/trigger fns keep the default PUBLIC EXECUTE.
-- Restrict the privileged/maintenance functions to service_role.
revoke all on function public.build_gradebook_snapshot(date) from public;
revoke all on function public.backfill_gradebook_snapshots() from public;
revoke all on function public.run_weekly_gradebook_snapshot() from public;
revoke all on function public.rls_auto_enable() from public;
grant execute on function public.build_gradebook_snapshot(date) to service_role;
grant execute on function public.backfill_gradebook_snapshots() to service_role;
grant execute on function public.run_weekly_gradebook_snapshot() to service_role;
grant execute on function public.rls_auto_enable() to service_role;

-- app_set_module_active: PUBLIC revoked; explicit to the API roles (it is a
-- no-op for non-platform-admins via its own WHERE clause).
revoke all on function public.app_set_module_active(uuid, boolean) from public;
grant execute on function public.app_set_module_active(uuid, boolean) to anon, authenticated, service_role;

-- Auth hook: only the auth admin (and service_role) may execute it.
revoke all on function public.hook_restrict_google_signups(jsonb) from public;
grant execute on function public.hook_restrict_google_signups(jsonb) to service_role, supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 10. Comments
-- ---------------------------------------------------------------------
comment on table public.activity_result_items is 'Per-question/per-item detail beneath activity_results. selected_answer/correct_answer are text (works for both MC option text and free-typed answers). category is a lightweight module-defined string, not a shared standards taxonomy.';
comment on table public.class_teachers is 'Which classes a teacher (school_members.role=educator, or any staff role) is assigned to teach. Distinct from enrollments, which tracks student roster membership — kept as a separate table on purpose, see migration file header.';
comment on view public.public_schools is 'Minimal public school directory (id, name only) for the pre-login school picker. Intentionally the ONLY thing in this schema anon can read — see migration file header.';
comment on view public.public_classes is 'Minimal public class directory (id, school_id, year, gumi, name only) for the pre-login school/year/class picker. See public_schools for the same pattern applied to schools.';

-- ---------------------------------------------------------------------
-- 11. pg_cron weekly snapshot — NOT auto-applied here (cron schema).
-- ---------------------------------------------------------------------
-- Production runs this schedule (job "weekly-gradebook-snapshot", 02:15 UTC
-- every Monday). It lives in the `cron` schema, needs the pg_cron extension,
-- and is intentionally excluded from this public-schema baseline. Re-create
-- it from db/2026-07-15_cron_gradebook_snapshots.sql when standing up a full
-- environment:
--
--   create extension if not exists pg_cron;
--   select cron.schedule('weekly-gradebook-snapshot', '15 2 * * 1',
--     $$ select public.run_weekly_gradebook_snapshot(); $$);
