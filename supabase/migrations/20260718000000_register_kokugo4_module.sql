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
-- ── PROVISIONAL VERSION — NOT YET APPLIED TO PROD ──────────────────────────
-- The filename version (20260718000000) is a PLACEHOLDER. Per supabase/README.md
-- and the deploy-ordering rule, a kokugo4 row must NOT exist in production until
-- the frontend files under gakuenza.com/modules/kokugo4/ have rsync-deployed —
-- otherwise the hub lists a module card whose launch_url 404s. So this migration
-- is intentionally NOT applied during the PR build.
--
-- AFTER this PR merges and the frontend deploy completes, apply it with the MCP
-- apply_migration (which stamps the real ledger version) and rename this file to
-- that stamped version so supabase/migrations/ and the prod ledger stay in
-- lockstep — exactly the placeholder→rename step documented for the grade-5/6
-- registrations in supabase/README.md.

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
