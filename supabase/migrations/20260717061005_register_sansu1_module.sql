-- Register the 算数1年 (sansu1) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/sansu4/sansu6.
--
-- Apply AFTER this PR is merged and the frontend is deployed, so the hub never
-- links a live catalog card at a 404 (launch_url must resolve to a shipped
-- index.html first). This file is committed but intentionally NOT applied to
-- the live project during the PR build for that reason; apply it (supabase db
-- push / MCP apply_migration) once modules/sansu1/ is on the server.
insert into public.modules (key, name, subject, launch_url, is_active, recommended_grades, publisher)
values ('sansu1', '算数 1年', 'math', '/modules/sansu1/index.html', true, '{1}', '東京書籍')
on conflict (key) do update set
  name               = excluded.name,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades,
  publisher          = excluded.publisher;
