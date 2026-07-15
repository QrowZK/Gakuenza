-- Platform admins could not create schools through the UI: the client does
-- `insert(...).select('id').single()` (INSERT ... RETURNING), and RETURNING
-- also enforces the SELECT policy on the new row. Both schools SELECT
-- policies decided visibility via app_user_staff_school_ids() /
-- app_user_school_ids(), which compute the allowed set by selecting from the
-- schools table itself — so a just-inserted school is not yet in that set and
-- the row fails its own RETURNING ("new row violates row-level security
-- policy"). app_is_platform_admin() reads profiles (not schools), so it is
-- non-circular and covers the new row immediately.
--
-- Behavior is otherwise unchanged: a platform admin already saw every school
-- via app_user_staff_school_ids(); non-platform staff keep their exact scope.
--
-- NOTE: this is the one migration that predates the baseline snapshot in the
-- ledger. Its effect is already present in 20260706000000_remote_schema.sql
-- (the squashed baseline reflects current state); replaying it on a fresh
-- reset is a harmless no-op (`drop policy if exists` + recreate identical).

drop policy if exists schools_read_admin on public.schools;
create policy schools_read_admin on public.schools
  for select
  to public
  using (
    app_is_platform_admin()
    or id in (select public.app_user_staff_school_ids())
  );
