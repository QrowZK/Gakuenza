-- Register the 国語1年 (kokugo1) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as kokugo5/sansu4/shakai4.
-- subject 'japanese' matches the modules_subject CHECK constraint; launch_url is
-- absolute per project convention; is_active set explicitly though it defaults
-- true; recommended_grades = {1}; publisher '光村図書' (Mitsumura Tosho) so the
-- catalog card carries its badge from day one (hard rule 5, #81).
--
-- Filename matches the version apply_migration stamped in the prod ledger
-- (20260717035944), per the repo ⇄ ledger lockstep convention in
-- supabase/README.md.
insert into public.modules (key, name, subject, launch_url, is_active, recommended_grades, publisher)
values ('kokugo1', '国語 1年', 'japanese', '/modules/kokugo1/index.html', true, '{1}', '光村図書')
on conflict (key) do update set
  name               = excluded.name,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
