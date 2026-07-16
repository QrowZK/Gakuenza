-- Register the 算数5年 (sansu5) module in public.modules.
--
-- VERSION IS PROVISIONAL. This 14-digit prefix is a placeholder that sorts
-- after the current prod ledger tip (20260716041856_register_kokugo5_module)
-- and is deliberately distinct from the sibling module PRs. Do NOT `supabase
-- db push` this file as-is. Per supabase/README.md (agent/CI workflow), the
-- authoritative version is stamped by the MCP `apply_migration` tool when this
-- is applied to prod — which must happen only AFTER this frontend deploys, so
-- the hub never links a live module card at a 404 launch_url. At that point,
-- rename this file to the assigned <version>_register_sansu5_module.sql so the
-- repo and the ledger stay in lockstep.
--
-- Idempotent (ON CONFLICT (key) do update) so it converges the row to the
-- intended state on re-run — same shape as sansu3/sansu4/rika4.
insert into public.modules (key, name, name_en, subject, launch_url, is_active, recommended_grades)
values ('sansu5', '算数 5年', 'Math 5', 'math', '/modules/sansu5/index.html', true, '{5}')
on conflict (key) do update set
  name               = excluded.name,
  name_en            = excluded.name_en,
  subject            = excluded.subject,
  launch_url         = excluded.launch_url,
  is_active          = excluded.is_active,
  recommended_grades = excluded.recommended_grades;
