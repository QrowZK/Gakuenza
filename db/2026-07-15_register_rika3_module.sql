-- Register the 理科3年 (rika3) module in public.modules.
--
-- Idempotent (update-then-insert-if-absent via ON CONFLICT (key)) so it can
-- be re-run safely and always converges the row to the intended state —
-- same shape as how sansu3/kokugo3/shakai3 were registered.
--
--   key         rika3
--   subject     science      (valid against modules_subject_check)
--   launch_url  absolute      (/modules/rika3/index.html)
--   is_active   true          (explicit, not relying on the column default)
--
-- Applied to the Gakuenza.com Supabase project on 2026-07-15.

insert into public.modules (key, name, name_en, subject, launch_url, is_active)
values ('rika3', '理科 3年', 'Science 3', 'science', '/modules/rika3/index.html', true)
on conflict (key) do update set
  name       = excluded.name,
  name_en    = excluded.name_en,
  subject    = excluded.subject,
  launch_url = excluded.launch_url,
  is_active  = excluded.is_active;
