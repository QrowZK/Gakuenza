-- Gap #3 (roadmap Near-term-debt #9) — school edit / status editor.
--
-- `schools` today has SELECT policies (schools_read, schools_read_admin) and a
-- single INSERT policy (schools_platform_admin_insert, `with check
-- (app_is_platform_admin())`), but NO UPDATE policy — so every client
-- `schools.update(...)` is denied by RLS default-deny, regardless of tier.
-- schools.html can therefore create a school and show its status as a
-- read-only badge, but cannot rename/re-code it or change active/suspended/
-- pending after creation.
--
-- Add the symmetric counterpart to the INSERT policy: platform-admin only.
--
-- Who MAY / MUST NOT (RLS-safety reasoning):
--   MUST:     platform admin only. School lifecycle (rename, re-code,
--             suspend/activate) is a platform-global operation. schools.html is
--             already platform-admin-gated in the UI, schools_platform_admin_insert
--             is already platform-admin only, and app_is_platform_admin() reads
--             profiles (NOT schools), so it is non-circular and covers the row
--             being updated — no RETURNING self-violation like the insert path
--             once hit (20260715044642).
--   MUST NOT: school_admin or coordinator. Do NOT widen to
--             app_user_admin_school_ids(). A school_admin flipping their own
--             school's status from `suspended` back to `active` would let a
--             suspended tenant un-suspend itself — status is precisely the lever
--             a platform operator uses OVER a tenant, so it cannot be
--             tenant-writable. Renaming/re-coding is likewise a
--             cross-tenant-namespace concern (unique `code`).
--
-- The schools_status_check CHECK (active/suspended/pending) already backstops
-- the value. This policy touches only the schools table — no PII, no
-- is_platform_admin interaction.
--
-- Idempotent: drop-if-exists + recreate, safe to replay.

drop policy if exists schools_platform_admin_update on public.schools;
create policy schools_platform_admin_update on public.schools
  for update
  to public
  using (app_is_platform_admin())
  with check (app_is_platform_admin());
