-- Register the 理科5年 (rika5) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/kokugo3/shakai3/rika3/rika4.
--
--   key                 rika5
--   subject             science      (valid against modules_subject_check)
--   launch_url          absolute     (/modules/rika5/index.html)
--   is_active           true         (explicit, not relying on the column default)
--   recommended_grades  {5}          (grade-5 module; advisory)
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('rika5', '理科 5年', 'Science 5', 'science', '/modules/rika5/index.html', true, '{5}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
