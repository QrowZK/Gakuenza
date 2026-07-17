-- Register the 算数2年 (sansu2) module in public.modules.
--
-- NOT YET APPLIED to prod at authoring time. Per the module convention
-- (see modules/sansu2/README.md and the sansu5 registration migration),
-- registration is applied AFTER the frontend deploys, so the hub never links
-- a live catalog card at a 404. When applied via MCP apply_migration, rename
-- this file to the actual ledger version if it differs, per the repo ⇄ ledger
-- lockstep convention in supabase/README.md.
--
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/sansu4/sansu5. `publisher`
-- (#81) is set here so the catalog card carries its badge from day one.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades, publisher)
values ('sansu2', '算数 2年', 'Math 2', 'math', '/modules/sansu2/index.html', true, '{2}', '東京書籍')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
