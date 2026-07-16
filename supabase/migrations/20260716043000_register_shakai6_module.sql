-- Register the 社会6年 (shakai6) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/kokugo3/shakai3/shakai4.
-- Content is national-scope (歴史・政治・国際関係); focus_units is matched at
-- the section level with per-period history keys (see hub/module-units.js).
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('shakai6', '社会 6年', 'Social Studies 6', 'social', '/modules/shakai6/index.html', true, '{6}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
