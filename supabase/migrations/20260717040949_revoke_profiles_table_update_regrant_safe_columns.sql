-- SECURITY (P0) — completes revoke_is_platform_admin_client_write.
--
-- That migration's column-level `revoke update (is_platform_admin)` was a no-op:
-- anon/authenticated hold TABLE-level UPDATE on public.profiles (privs:
-- DELETE, REFERENCES, SELECT, TRIGGER, UPDATE), and Postgres will not downgrade
-- a table grant to per-column — so the escalation path was still open after it.
--
-- Revoke the table-level UPDATE and re-grant UPDATE on every column EXCEPT
-- is_platform_admin, preserving legitimate profile edits (display_name,
-- student_number, must_change_password, home_school_id) while making the
-- platform-admin flag unwritable from the client REST API. anon is left without
-- UPDATE entirely (it has no UPDATE policy on profiles, so it never had a
-- legitimate write path). service_role / postgres are unaffected.
--
-- Verified post-apply: is_platform_admin carries no INSERT/UPDATE for
-- anon/authenticated; display_name/student_number/must_change_password/
-- home_school_id retain UPDATE for authenticated; no table-level UPDATE remains.
revoke update on public.profiles from anon, authenticated;
grant update (id, home_school_id, display_name, student_number, created_at, must_change_password)
  on public.profiles to authenticated;
