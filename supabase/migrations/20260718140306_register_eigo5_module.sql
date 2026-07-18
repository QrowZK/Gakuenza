-- Register the 外国語5年 (eigo5) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu1/sansu5/rika4.
--
-- APPLIED TO PROD 2026-07-18 (ledger version 20260718140306), via MCP
-- apply_migration AFTER PR #100 merged and the frontend rsync-deploy completed
-- (so the catalog card's launch_url resolves, not 404s). Created under a
-- placeholder version during the PR build and renamed to the stamped ledger
-- version on apply, per supabase/README.md — migrations/ and the prod ledger
-- are in lockstep.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('eigo5', '外国語 5年', 'New Horizons 5', 'english', '/modules/eigo5/index.html', true, '{5}', '東京書籍')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
