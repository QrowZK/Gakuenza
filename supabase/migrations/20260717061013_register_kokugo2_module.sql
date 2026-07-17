-- Register the 国語 2年 (kokugo2) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as kokugo3/kokugo5/kokugo6/sansu4.
--
-- kokugo2 ships the kanji drill (grade-2 配当漢字 全160字, the MEXT 学年別漢字
-- 配当表 grade-2 closed set) plus the grade-2 kana/orthography/grammar drills
-- (カタカナ・かなづかい・主語と述語・なかまの言葉と反対の言葉・丸点かぎ).
-- Mitsumura reading-comprehension units are deliberately deferred (same
-- discipline as kokugo1/3/5/6).
--
-- Publisher 光村図書 (Mitsumura Tosho) — NOT Tokyo Shoseki's 国語 line — carried
-- in the idempotent insert…on-conflict per hard rule 5 (publisher added #81) so
-- the catalog card shows its badge from day one.
--
-- launch_url is ABSOLUTE per project convention; subject 'japanese' matches the
-- modules_subject_check CHECK constraint; is_active set explicitly though it
-- defaults true; recommended_grades {2}.
--
-- ── PROVISIONAL VERSION — NOT YET APPLIED TO PROD ──────────────────────────
-- The filename version (20260717040000) is a PLACEHOLDER. Per supabase/README.md
-- and the deploy-ordering rule, a kokugo2 row must NOT exist in production until
-- the frontend files under gakuenza.com/modules/kokugo2/ have rsync-deployed —
-- otherwise the hub lists a module card whose launch_url 404s. So this migration
-- is intentionally NOT applied during the PR build.
--
-- AFTER this PR merges and the frontend deploy completes, apply it with the MCP
-- apply_migration (which stamps the real ledger version) and rename this file to
-- that stamped version so supabase/migrations/ and the prod ledger stay in
-- lockstep — exactly the placeholder→rename step documented for the grade-5/6
-- registrations in supabase/README.md.

insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('kokugo2', '国語 2年', 'Japanese 2', 'japanese', '/modules/kokugo2/index.html', true, '{2}', '光村図書')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
