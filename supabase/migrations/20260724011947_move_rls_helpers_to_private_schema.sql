-- Roadmap debt #3 (remainder, now closed): move the 8 SECURITY DEFINER RLS
-- helper functions out of the API-exposed `public` schema into a non-exposed
-- `private` schema, so they are no longer reachable via /rest/v1/rpc (clears
-- security advisor 0028/0029 for them) while staying callable inside RLS
-- policies.
--
-- Why this is safe and needs no policy rewrites: RLS policy expressions
-- reference these functions by OID, so ALTER FUNCTION ... SET SCHEMA
-- transparently re-qualifies every dependent policy (e.g. `ar_read` now calls
-- `private.app_user_staff_school_ids()`), with no change in logic. Verified
-- live post-apply: all 38 policies intact and re-qualified, `authenticated`
-- and `anon` retain EXECUTE + `private` schema USAGE, RLS evaluates without
-- error AND returns correct rows for both a no-data user (0 rows) and a real
-- platform admin (full visibility). Applied 2026-07-24, ledger 20260724011947.
--
-- `app_set_module_active` deliberately stays in `public`: it is intentionally
-- rpc-exposed to the admin modules page (`sb.rpc('app_set_module_active')`),
-- is self-guarded on `app_is_platform_admin()`, and had its anon EXECUTE
-- revoked in 20260723061812. Its single remaining advisor finding is
-- accepted-by-design.
create schema if not exists private;
grant usage on schema private to anon, authenticated, service_role;

alter function public.app_class_school(uuid)            set schema private;
alter function public.app_has_role(uuid, text[])        set schema private;
alter function public.app_is_platform_admin()           set schema private;
alter function public.app_user_admin_school_ids()       set schema private;
alter function public.app_user_class_ids()              set schema private;
alter function public.app_user_school_ids()             set schema private;
alter function public.app_user_staff_school_ids()       set schema private;
alter function public.app_user_taught_class_ids()       set schema private;
