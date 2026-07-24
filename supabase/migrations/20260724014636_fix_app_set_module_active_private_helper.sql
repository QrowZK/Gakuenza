-- 20260724011947 moved app_is_platform_admin (and the other RLS helpers) from
-- public into the private schema. app_set_module_active's BODY calls the helper
-- with an explicit public. qualifier, so after that move it references a
-- now-nonexistent function and every sb.rpc('app_set_module_active') from the
-- admin modules page errors "function public.app_is_platform_admin() does not
-- exist". Re-point it at private.app_is_platform_admin(). This function stays in
-- public on purpose (it is intentionally rpc-exposed and self-guarded); only its
-- internal reference to the moved helper needed fixing.
--
-- Verified live post-apply via impersonation: a platform admin toggles is_active
-- without error; a non-admin student is a silent no-op (self-guard intact).
-- Applied 2026-07-24, ledger 20260724014636.
create or replace function public.app_set_module_active(p_module uuid, p_active boolean)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.modules
  set is_active = p_active
  where id = p_module and private.app_is_platform_admin();
$function$;
