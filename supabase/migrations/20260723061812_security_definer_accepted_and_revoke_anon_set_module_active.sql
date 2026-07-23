-- Security advisor: SECURITY DEFINER functions/views callable by anon/authenticated.
--
-- Investigated 2026-07-23. The advisor flags 9 SECURITY DEFINER functions
-- (0028/0029) and 2 SECURITY DEFINER views (0010) as reachable by anon/
-- authenticated. On inspection almost all of it is intentional and low-
-- exposure — see the reasoning captured as COMMENTs below so it isn't
-- re-litigated. This migration makes the ONE genuinely-safe change and records
-- the rest as accepted-by-design.
--
-- The one real change --------------------------------------------------------
-- app_set_module_active is the only *mutating* helper and the only one NOT
-- referenced by any RLS policy (it is called solely via an explicit
-- sb.rpc(...) from the admin-only modules page). It already self-guards
-- (`... where id = p_module and app_is_platform_admin()`), so a non-admin call
-- is a no-op — but anon has no business reaching it at all. Revoking anon
-- EXECUTE cannot cause an RLS lockout precisely because no policy calls it.
-- authenticated keeps EXECUTE (the platform admin who toggles a module is a
-- signed-in user; the self-guard is the real gate).
revoke execute on function public.app_set_module_active(uuid, boolean) from anon;

-- Accepted-by-design, documented in the DB -----------------------------------
-- The 8 read helpers are all auth.uid()-scoped: called directly via
-- /rest/v1/rpc they only ever reveal the CALLER'S OWN context (their school/
-- class ids, or a boolean about themselves). They are SECURITY DEFINER because
-- they must bypass RLS to resolve context, and they are called inside nearly
-- every RLS policy — so authenticated MUST retain EXECUTE (revoking it, or
-- switching to SECURITY INVOKER, would break RLS and lock users out). The
-- advisor WARN (0028/0029) is a generic "SECURITY DEFINER + API-reachable"
-- flag, not a data-leak here. A future hardening pass may move them into a
-- non-exposed schema to drop them from the API surface entirely (ROADMAP #3);
-- that is an all-RLS refactor, deliberately out of scope here.
comment on function public.app_user_school_ids() is
  'SECURITY DEFINER RLS helper. auth.uid()-scoped (returns only the caller''s own school memberships). Must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_user_staff_school_ids() is
  'SECURITY DEFINER RLS helper. auth.uid()-scoped. Must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_user_admin_school_ids() is
  'SECURITY DEFINER RLS helper. auth.uid()-scoped. Must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_user_class_ids() is
  'SECURITY DEFINER RLS helper. auth.uid()-scoped. Must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_user_taught_class_ids() is
  'SECURITY DEFINER RLS helper. auth.uid()-scoped. Must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_has_role(uuid, text[]) is
  'SECURITY DEFINER RLS helper. auth.uid()-scoped (only reveals whether the CALLER holds a role at a given school). Must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_is_platform_admin() is
  'SECURITY DEFINER RLS helper. Reveals only the caller''s own is_platform_admin boolean. Must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_class_school(uuid) is
  'SECURITY DEFINER RLS helper. Resolves a class -> its school_id (class/school assignment is not sensitive). Used in the activity_results INSERT policy; must keep EXECUTE for in-policy calls. Advisor 0028/0029 accepted-by-design (2026-07-23).';
comment on function public.app_set_module_active(uuid, boolean) is
  'SECURITY DEFINER admin mutator, called only via explicit rpc from the admin modules page (never from an RLS policy). Self-guards on app_is_platform_admin(). anon EXECUTE revoked 2026-07-23; authenticated retained (guard is the gate). Advisor 0028/0029 accepted-by-design.';

-- The 2 SECURITY DEFINER views expose only non-sensitive identifiers (school
-- id/name; class id/school_id/year/gumi/name) to anon so the login screen can
-- render its school + class pickers BEFORE sign-in. They are SECURITY DEFINER
-- on purpose: switching them to security_invoker would make them respect the
-- anon caller's RLS (no rows) and break login. Advisor 0010 (ERROR) is a
-- generic flag; this exposure is intentional and minimal.
comment on view public.public_classes is
  'Deliberately anon-readable, SECURITY DEFINER: feeds the pre-login class picker. Exposes only id/school_id/year/gumi/name. Do NOT set security_invoker (breaks login). Advisor 0010 accepted-by-design (2026-07-23).';
comment on view public.public_schools is
  'Deliberately anon-readable, SECURITY DEFINER: feeds the pre-login school picker. Exposes only id/name. Do NOT set security_invoker (breaks login). Advisor 0010 accepted-by-design (2026-07-23).';
