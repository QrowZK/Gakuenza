-- Register the 国語 6年 (kokugo6) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu4/shakai4/kokugo3/rika4.
--
-- kokugo6 currently ships the kanji drill (grade-6 配当漢字 全191字, the final
-- elementary grade — this completes the full elementary 学年別漢字配当表) plus
-- the grade-6 language/grammar drills (敬語・熟語の成り立ち・和語漢語外来語・
-- 四字熟語故事成語). Reading-comprehension units are deliberately deferred.
--
-- launch_url is ABSOLUTE per project convention; subject 'japanese' matches the
-- modules CHECK constraint; is_active set explicitly though it defaults true.
--
-- STATUS: APPLIED to prod on 2026-07-16 (ledger version 20260716045905), after
-- PR #36 merged and the frontend rsync deploy completed (04:57Z) — so the hub's
-- live module list did not surface a 404 card. This file is retained as the
-- committed record of that applied migration.
--
-- VERSION / LEDGER LOCKSTEP: apply_migration auto-stamped a fresh version at
-- apply time (the prod ledger had advanced past this PR's original placeholder
-- 20260716043359 — sansu5 landed at …045252). This file has been renamed to the
-- applied version 20260716045905 so the repo migrations dir and prod ledger stay
-- in the same order (per supabase/README.md).
--
-- DEPLOY ORDERING (kept for the record): the hub lists modules live from this
-- table, so a kokugo6 row must not exist in production until the frontend files
-- under gakuenza.com/modules/kokugo6/ have rsynced. Applied AFTER the module
-- shipped, per that rule.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('kokugo6', '国語 6年', 'Japanese 6', 'japanese', '/modules/kokugo6/index.html', true, '{6}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
