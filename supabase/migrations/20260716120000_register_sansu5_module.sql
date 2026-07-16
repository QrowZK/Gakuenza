-- Register the 算数5年 (sansu5) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/sansu4/rika4.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('sansu5', '算数 5年', 'Math 5', 'math', '/modules/sansu5/index.html', true, '{5}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
