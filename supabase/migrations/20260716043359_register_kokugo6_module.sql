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
-- DEPLOY ORDERING: the hub lists modules live from this table, so a kokugo6 row
-- must not exist in production until the frontend files under
-- gakuenza.com/modules/kokugo6/ have been rsynced (which happens on merge to
-- main). Apply this migration AFTER the module ships, not before, or the hub
-- shows a card that 404s.
--
-- VERSION / LEDGER LOCKSTEP: this file's version (20260716043359) is stamped
-- after the prod ledger tip at the time of writing (…041856 register_kokugo5).
-- If further migrations reach the prod ledger before this PR merges, re-stamp
-- to a fresh unique version at apply time and rename this file to match, so the
-- repo migrations dir and prod ledger stay in the same order (per
-- supabase/README.md). Apply via MCP apply_migration (writes the ledger).
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('kokugo6', '国語 6年', 'Japanese 6', 'japanese', '/modules/kokugo6/index.html', true, '{6}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
