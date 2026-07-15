-- Retire the unused custom session-tracking / failed-login-audit subsystem
-- (project ref ohnsawydclmsrgphasbn). Applied to the live project on
-- 2026-07-15 via the Supabase migration retire_app_sessions_and_audit_log.
-- Documentation mirror; the repo has no supabase/ CLI tooling.
--
-- WHY: app_sessions and auth_audit_log were built but never wired into the
-- auth flow — login uses standard Supabase/GoTrue sessions, not app_sessions
-- or its resolve/touch/revoke RPCs. Both tables held 0 rows. Carrying dead,
-- security-adjacent code (and its purge cron dependency) is worse than
-- removing it. No frontend or Edge Function referenced any of this. Confirmed
-- via a repo-wide grep before dropping.

drop function if exists public.resolve_session(text)             cascade;
drop function if exists public.touch_session(text, timestamptz)  cascade;
drop function if exists public.revoke_all_sessions(uuid)         cascade;
drop function if exists public.log_failed_login(uuid, text, text) cascade;
drop function if exists public.purge_expired_sessions(integer)   cascade;
drop function if exists public.purge_old_audit_log(integer)      cascade;

-- cascade drops the RLS policies (sessions_self*, audit_self*) with the tables.
drop table if exists public.app_sessions   cascade;
drop table if exists public.auth_audit_log cascade;
