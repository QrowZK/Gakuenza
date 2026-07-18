-- Register the 国語 4年 (kokugo4) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as kokugo2/kokugo3/kokugo5/kokugo6.
--
-- kokugo4 ships the kanji drill (grade-4 配当漢字 全202字, the MEXT 学年別漢字
-- 配当表 grade-4 closed set, post-2020 count — cross-checked between two
-- independent references that agreed character-for-character) plus five grade-4
-- language/grammar drills (部首・熟語の組み立て・つなぎ言葉・主語述語・慣用句).
-- Mitsumura reading-comprehension units are deliberately deferred (same
-- discipline as kokugo1/2/3/5/6).
--
-- Publisher 光村図書 (Mitsumura Tosho) — NOT Tokyo Shoseki's 国語 line — carried
-- in the idempotent insert…on-conflict per hard rule 5 (publisher added #81) so
-- the catalog card shows its badge from day one.
--
-- launch_url is ABSOLUTE per project convention; subject 'japanese' matches the
-- modules_subject_check CHECK constraint; is_active set explicitly though it
-- defaults true; recommended_grades {4}.
--
-- ── APPLIED TO PROD 2026-07-18 (ledger version 20260718140258) ─────────────
-- Applied via MCP apply_migration AFTER PR #101 merged and the frontend
-- rsync-deploy completed (so the hub card's launch_url resolves, not 404s).
-- The file was created under a placeholder version during the PR build and
-- renamed to the stamped ledger version 20260718140258 on apply, per the
-- placeholder→rename step in supabase/README.md — supabase/migrations/ and the
-- prod ledger are in lockstep.

insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('kokugo4', '国語 4年', 'Japanese 4', 'japanese', '/modules/kokugo4/index.html', true, '{4}', '光村図書')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
