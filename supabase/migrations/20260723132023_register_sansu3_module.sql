-- Backfills the missing migration record for an already-live module (registered
-- before the supabase/migrations/ convention existed 2026-07-15); values read
-- from the live DB during the 2026-07-23 audit, not changed.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('sansu3', '算数 3年', null, 'math', '/modules/sansu3/index.html', true, '{3}', '東京書籍')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
