-- Register the 社会5年 (shakai5) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu4/shakai4.
--
-- APPLIED to prod at ledger version 20260716050039 (via MCP apply_migration,
-- after the frontend deploy). This file has been renamed from its original
-- placeholder version to match, per the repo ⇄ ledger lockstep convention in
-- supabase/README.md.
--   key                 shakai5
--   subject             social        (valid against modules_subject_check)
--   launch_url          absolute       (/modules/shakai5/index.html)
--   is_active           true           (explicit, not relying on the default)
--   recommended_grades  {5}
-- Content is national in scope (国土・食料生産・工業生産・情報・環境),
-- built to honor class_modules.focus_units with the unit keys:
--   u1_national_land, u2_food_production, u3_industrial_production,
--   u4_information_society, u5_environment
-- (also registered in hub/module-units.js for the assignment UIs).
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('shakai5', '社会 5年', 'Social Studies 5', 'social', '/modules/shakai5/index.html', true, '{5}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
