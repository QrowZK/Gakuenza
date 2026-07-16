-- Register the 理科6年 (rika6) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as rika4/sansu4/shakai4.
--
--   key                 rika6
--   subject             science      (valid against modules_subject_check)
--   launch_url          absolute     (/modules/rika6/index.html)
--   is_active           true         (explicit, not relying on the column default)
--   recommended_grades  {6}          (grade-6 module; advisory, read by the
--                                      assignment UIs to suggest grade-fit)
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('rika6', '理科 6年', 'Science 6', 'science', '/modules/rika6/index.html', true, '{6}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
