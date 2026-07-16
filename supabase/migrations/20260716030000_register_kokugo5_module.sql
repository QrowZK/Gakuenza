-- Register the 国語5年 (kokugo5) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu4/shakai4/kokugo3.
-- subject 'japanese' matches the modules_subject CHECK constraint; launch_url is
-- absolute per project convention; is_active set explicitly though it defaults
-- true; recommended_grades = {5}.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('kokugo5', '国語 5年', 'Japanese 5', 'japanese', '/modules/kokugo5/index.html', true, '{5}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
