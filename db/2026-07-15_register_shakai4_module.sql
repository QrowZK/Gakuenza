-- Register the 社会4年 (shakai4) module in public.modules.
--
-- Idempotent (update-then-insert-if-absent via ON CONFLICT (key)) so it can
-- be re-run safely and always converges the row to the intended state —
-- same shape as how sansu3/kokugo3/shakai3/rika3 were registered.
--
--   key                 shakai4
--   subject             social        (valid against modules_subject_check)
--   launch_url          absolute       (/modules/shakai4/index.html)
--   is_active           true           (explicit, not relying on the default)
--   recommended_grades  {4}            (advisory only; nothing hard-blocks)
--
-- Content is 石川県版 (prefecture-specific: 白山/手取川, 令和6年能登半島地震,
-- 板屋兵四郎/辰巳用水, 輪島/金沢/加賀 …) matching the pilot school's region,
-- built to honor class_modules.focus_units with the unit keys:
--   u1_prefecture, u2_water_waste, u3_disaster_prep,
--   u4_heritage_and_pioneers, u5_featured_areas
-- (also registered in hub/module-units.js for the assignment UIs).

insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('shakai4', '社会 4年', 'Social Studies 4', 'social', '/modules/shakai4/index.html', true, '{4}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
