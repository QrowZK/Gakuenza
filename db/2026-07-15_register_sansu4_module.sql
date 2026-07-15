-- Register the 算数4年 (sansu4) module in public.modules.
--
-- Idempotent (update-then-insert-if-absent via ON CONFLICT (key)) so it can
-- be re-run safely and always converges the row to the intended state —
-- same shape as how sansu3/rika3/kokugo3 were registered.
--
--   key                sansu4
--   subject            math          (valid against modules_subject_check)
--   launch_url         absolute      (/modules/sansu4/index.html)
--   is_active          true          (explicit, not relying on the default)
--   recommended_grades {4}           (this module targets 4年; no consumer
--                                      reads this column yet, set for parity
--                                      with sansu3's {3} — good practice)
--
-- Apply after the frontend at gakuenza.com/modules/sansu4/ is deployed, so
-- the hub never links a live module card at a 404 launch_url.

insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('sansu4', '算数 4年', 'Math 4', 'math', '/modules/sansu4/index.html', true, '{4}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
