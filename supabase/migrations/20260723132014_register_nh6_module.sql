-- Register the 外国語6年 (nh6) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu4/eigo5.
--
-- Backfills the missing migration record for an already-live module
-- (registered before the supabase/migrations/ convention existed
-- 2026-07-15); values read from the live DB during the 2026-07-23 audit,
-- not changed. Note: nh6's display name was later changed to "eigo6" via
-- 20260721000411_rename_nh6_display_name_to_eigo6.sql, but the module key
-- itself remains nh6 — the name/name_en values below reflect the live row
-- as of 2026-07-23 (post-rename).
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('nh6', '外国語 6年', 'New Horizons 6', 'english', '/modules/nh6/index.html', true, '{6}', '東京書籍（New Horizon Elementary）')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
