-- Correct the shakai3 (社会3年) module's subject.
--
-- Mirror of a change applied to the live project via the Supabase
-- management API (db/ is documentation, not an applied migration set —
-- see docs/codebase-and-db-structure.md §5).
--
-- shakai3 is a social-studies module but its modules.subject row read
-- 'english' (wrong tenant subject → mis-grouped in the subject-grouped
-- assignment UI). 'social' is a valid value under modules_subject_check
-- (english, math, japanese, science, social, sougou, misc).
--
-- Idempotent: re-running converges to the intended value.

update public.modules set subject = 'social' where key = 'shakai3';
