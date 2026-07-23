-- Register the 国語3年 (kokugo3) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/rika3/kokugo3.
--
-- Backfills the missing migration record for an already-live module
-- (registered before the supabase/migrations/ convention existed
-- 2026-07-15); values read from the live DB during the 2026-07-23 audit,
-- not changed.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('kokugo3', '国語 3年', null, 'japanese', '/modules/kokugo3/index.html', true, '{3}', '光村図書')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
