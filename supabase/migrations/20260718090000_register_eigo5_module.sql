-- Register the 外国語5年 (eigo5) module in public.modules.
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu1/sansu5/rika4.
--
-- Apply AFTER this PR is merged and the frontend is deployed, so the hub never
-- links a live catalog card at a 404 (launch_url must resolve to a shipped
-- index.html first). This file is committed but intentionally NOT applied to
-- the live project during the PR build for that reason; apply it (supabase db
-- push / MCP apply_migration) once modules/eigo5/ is on the server.
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
