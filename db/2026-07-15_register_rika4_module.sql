-- Register the 理科4年 (rika4) module in public.modules.
--
-- Idempotent (update-then-insert-if-absent via ON CONFLICT (key)) so it can
-- be re-run safely and always converges the row to the intended state —
-- same shape as how rika3/sansu3/kokugo3/shakai3 were registered.
--
--   key                 rika4
--   subject             science      (valid against modules_subject_check)
--   launch_url          absolute      (/modules/rika4/index.html)
--   is_active           true          (explicit, not relying on the column default)
--   recommended_grades  {4}           (grade-4 module; advisory only, no
--                                       current hard consumer — see
--                                       db/2026-07-14_modules_recommended_grades.sql)

insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('rika4', '理科 4年', 'Science 4', 'science', '/modules/rika4/index.html', true, '{4}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
