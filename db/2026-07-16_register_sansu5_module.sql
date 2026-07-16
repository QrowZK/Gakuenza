-- Register the 算数5年 (sansu5) module in public.modules.
--
-- Idempotent (update-then-insert-if-absent via ON CONFLICT (key)) so it can
-- be re-run safely and always converges the row to the intended state —
-- same shape as how sansu3/sansu4/rika4 were registered.
--
--   key                sansu5
--   subject            math          (valid against modules_subject_check)
--   launch_url         absolute      (/modules/sansu5/index.html)
--   is_active          true          (explicit, not relying on the default)
--   recommended_grades {5}           (this module targets 5年; read by the
--                                      assignment UIs to suggest grade-
--                                      appropriate modules)
--
-- NOTE: db/ is a documentation mirror. The authoritative applied copy is
-- supabase/migrations/<ts>_register_sansu5_module.sql (identical body),
-- which is what writes the prod ledger. Apply after the frontend at
-- gakuenza.com/modules/sansu5/ is deployed, so the hub never links a live
-- module card at a 404 launch_url.

insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('sansu5', '算数 5年', 'Math 5', 'math', '/modules/sansu5/index.html', true, '{5}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
