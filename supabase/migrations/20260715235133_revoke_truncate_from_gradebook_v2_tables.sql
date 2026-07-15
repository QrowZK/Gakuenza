-- Close the leftover TRUNCATE over-grant on the gradebook-v2 tables.
--
-- The 2026-07-14 security hardening removed TRUNCATE from anon/authenticated
-- on the original tables, but observation_records, grade_corrections, and
-- gradebook_snapshots were created around then and kept the default full
-- grant, so anon/authenticated still held TRUNCATE on all three. TRUNCATE is
-- not subject to RLS row filtering, so this brings them in line with every
-- other table (DML stays, TRUNCATE goes; service_role is unaffected).
--
-- Idempotent: revoking an already-absent privilege is a no-op.

revoke truncate on
  public.observation_records,
  public.grade_corrections,
  public.gradebook_snapshots
  from anon, authenticated;
