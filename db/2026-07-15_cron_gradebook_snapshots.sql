-- Weekly gradebook-snapshot cron (project ref ohnsawydclmsrgphasbn).
--
-- Applied to the live project on 2026-07-15 via Supabase migrations
-- (enable_pg_cron, gradebook_snapshot_builder) plus a cron.schedule call.
-- This file is the version-controlled record; the repo has no supabase/
-- CLI tooling, so it is documentation, not an auto-applied migration.
--
-- WHY: hub/gradebook/karte.html draws its per-student weekly trend line
-- from public.gradebook_snapshots, but nothing populated that table (it had
-- 0 rows) because the "weekly Supabase Cron job" the v2 schema referenced was
-- never actually created. pg_cron was not installed. This wires it up.
--
-- CONTRACT: karte's rollupVal() reads rollup.avg (a 0-100 percentage), so
-- each snapshot row carries {avg, n} for one (class, student, ISO-week).
-- One overall row per student per week (subject/category null) -> karte
-- plots one point per week.

create extension if not exists pg_cron;

-- Build (idempotently) all snapshots for the ISO week beginning p_week.
create or replace function public.build_gradebook_snapshot(p_week date)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
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
end $$;

-- Weekly entrypoint: snapshot the ISO week that just ended (Mon-Sun).
create or replace function public.run_weekly_gradebook_snapshot()
returns integer
language sql
security definer
set search_path to 'public'
as $$
  select public.build_gradebook_snapshot(
    (date_trunc('week', now()) - interval '7 days')::date
  );
$$;

-- One-time (re-runnable) backfill of every ISO week already present in
-- activity_results, so the karte trend works immediately (needs >= 2 weeks)
-- instead of only after two more Mondays pass.
create or replace function public.backfill_gradebook_snapshots()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
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
end $$;

-- Maintenance functions: never callable from the API roles.
revoke execute on function public.build_gradebook_snapshot(date)  from public, anon, authenticated;
revoke execute on function public.run_weekly_gradebook_snapshot() from public, anon, authenticated;
revoke execute on function public.backfill_gradebook_snapshots()  from public, anon, authenticated;
grant  execute on function public.build_gradebook_snapshot(date)  to service_role;
grant  execute on function public.run_weekly_gradebook_snapshot() to service_role;
grant  execute on function public.backfill_gradebook_snapshots()  to service_role;

-- Backfill history once (idempotent). Ran 2026-07-15 -> 1006 rows, 4 weeks.
select public.backfill_gradebook_snapshots();

-- Schedule the recurring job: every Monday 02:15 UTC, snapshot last week.
select cron.schedule('weekly-gradebook-snapshot', '15 2 * * 1',
  $$ select public.run_weekly_gradebook_snapshot(); $$);
