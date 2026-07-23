-- Backfills the missing migration record for an already-live module
-- (registered before the supabase/migrations/ convention existed 2026-07-15);
-- values read from the live DB during the 2026-07-23 audit, not changed.
--
-- Register the 漢字検定 4級 practice (kanken4) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu4/eigo5.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('kanken4', '漢字検定 4級 練習', null, 'japanese', '/modules/kanken4/index.html', true, '{6}', '日本漢字能力検定協会')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
