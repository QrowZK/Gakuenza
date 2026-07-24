-- Roadmap debt #7 (safe subset): consolidate the two tables that had multiple
-- permissive policies for the SAME command (SELECT) into one policy each.
--
-- Merging permissive policies of the same command via OR is provably identical
-- to leaving them separate (Postgres already OR-combines permissive policies for
-- a given command) — zero access change. Verified live with before/after
-- visibility snapshots: a platform admin still sees 114 profiles / 2 schools and
-- a plain student still sees 1 profile / 0 schools, unchanged.
--
-- This is the risk-free portion of #7. The remaining multiple_permissive_policies
-- findings are all ALL-policy + SELECT-policy overlaps whose consolidation
-- requires splitting each ALL policy into INSERT/UPDATE/DELETE — a semantically
-- trickier change across ~10 tables that should be verified on a Supabase
-- branch. Branching needs the Pro plan (this project is on the free tier), so
-- that portion is deliberately deferred (see ROADMAP #7); the perf benefit is
-- marginal at single-school pilot scale.
-- Applied 2026-07-24, ledger 20260724012938.

-- profiles: fold profiles_read_admin + profiles_read_taught into profiles_read
alter policy profiles_read on public.profiles using (
  (id = (select auth.uid()))
  or (home_school_id in (select private.app_user_school_ids()))
  or (id in (select sm.user_id from school_members sm
              where sm.school_id in (select private.app_user_staff_school_ids())))
  or (id in (select e.user_id from enrollments e join classes c on c.id = e.class_id
              where c.school_id in (select private.app_user_staff_school_ids())))
  or (id in (select e.user_id from enrollments e
              where e.class_id in (select private.app_user_taught_class_ids())))
);
drop policy profiles_read_admin on public.profiles;
drop policy profiles_read_taught on public.profiles;

-- schools: fold schools_read_admin into schools_read
alter policy schools_read on public.schools using (
  (id in (select private.app_user_school_ids()))
  or private.app_is_platform_admin()
  or (id in (select private.app_user_staff_school_ids()))
);
drop policy schools_read_admin on public.schools;
