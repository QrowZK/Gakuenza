-- Register the 算数6年 (sansu6) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/sansu4/rika4.
-- Apply AFTER the frontend is deployed so the hub never links a live card at a
-- 404 (launch_url must resolve to a shipped index.html first).
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('sansu6', '算数 6年', 'Math 6', 'math', '/modules/sansu6/index.html', true, '{6}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
