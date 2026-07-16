-- Register the 算数4年 (sansu4) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/rika3/kokugo3.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('sansu4', '算数 4年', 'Math 4', 'math', '/modules/sansu4/index.html', true, '{4}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
