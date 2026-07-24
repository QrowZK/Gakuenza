-- Roadmap debt #9 (Gap #3): school edit/status editor needs an UPDATE policy on
-- `schools`. There was none, so every client schools.update(...) hit RLS
-- default-deny — schools.html could create a school and show status as a
-- read-only badge, but not rename/re-code it or change active/suspended/pending.
--
-- Platform-admin ONLY. Status is the lever a platform operator uses OVER a
-- tenant, so a school_admin must not be able to flip their own school's status
-- from suspended back to active. app_is_platform_admin() reads profiles (not
-- schools) so it is non-circular and covers the row being updated.
-- Qualified as private.app_is_platform_admin() because the RLS helpers moved to
-- the private schema in 20260724011947. Verified live: platform admin updates 1
-- row, non-admin student 0. Applied 2026-07-24, ledger 20260724012414.
drop policy if exists schools_platform_admin_update on public.schools;
create policy schools_platform_admin_update on public.schools
  for update
  to public
  using (private.app_is_platform_admin())
  with check (private.app_is_platform_admin());
