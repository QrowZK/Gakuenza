-- Module workflow rework — Phase 4: platform-admin is_active soft-retire RPC.
--
-- Documentation mirror of the migration `add_app_set_module_active_rpc`
-- applied to the live project (ref ohnsawydclmsrgphasbn). The repo has no
-- supabase/ tooling.
--
-- The modules table is locked to service_role (lock_down_modules_table has no
-- write policy for API roles), so the modules.html catalog toggles is_active
-- through this platform-admin-only SECURITY DEFINER RPC rather than a client
-- write. A non-platform caller's update matches zero rows (the WHERE
-- app_is_platform_admin() fails), so the call is a safe no-op for them.

create or replace function public.app_set_module_active(p_module uuid, p_active boolean)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.modules
  set is_active = p_active
  where id = p_module and public.app_is_platform_admin();
$function$;

revoke all on function public.app_set_module_active(uuid, boolean) from public;
grant execute on function public.app_set_module_active(uuid, boolean) to authenticated;
