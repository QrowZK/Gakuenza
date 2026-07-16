-- Register the 社会6年 (shakai6) module in public.modules.
--
-- Idempotent (update-then-insert-if-absent via ON CONFLICT (key)) so it can
-- be re-run safely and always converges the row to the intended state —
-- same shape as how sansu3/kokugo3/shakai3/shakai4/rika3/rika4 were registered.
--
--   key                 shakai6
--   subject             social        (valid against modules_subject_check)
--   launch_url          absolute       (/modules/shakai6/index.html)
--   is_active           true           (explicit, not relying on the default)
--   recommended_grades  {6}            (advisory only; nothing hard-blocks)
--
-- Content is national-scope (歴史・政治・国際関係) — no region substitution
-- needed, unlike shakai4. Built to honor class_modules.focus_units. Because
-- history (unit 2) is by far the largest unit, focus is matched at the SECTION
-- level with per-period keys:
--   u1_politics,
--   u2a_jomon_kofun, u2b_asuka_nara, u2c_heian, u2d_kamakura, u2e_muromachi,
--   u2f_sengoku_unification, u2g_edo_bakufu, u2h_edo_culture, u2i_meiji,
--   u2j_meiji_world, u2k_wwii, u2l_postwar_japan,
--   u3_japan_and_the_world
-- (also registered in hub/module-units.js for the assignment UIs).

insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('shakai6', '社会 6年', 'Social Studies 6', 'social', '/modules/shakai6/index.html', true, '{6}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
