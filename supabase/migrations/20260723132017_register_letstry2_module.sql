-- Register the Let's Try 2 (letstry2) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu4/eigo5.
--
-- Backfills the missing migration record for an already-live module
-- (registered before the supabase/migrations/ convention existed
-- 2026-07-15); values read from the live DB during the 2026-07-23 audit,
-- not changed.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('letstry2', 'Let''s Try 2 練習', 'Let''s Try 2', 'english', '/modules/letstry2/index.html', true, '{4}', '文部科学省（Let''s Try!）')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
