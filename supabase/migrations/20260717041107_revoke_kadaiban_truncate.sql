-- SECURITY (defense-in-depth): the 4 kadaiban tables re-inherited TRUNCATE for
-- anon/authenticated via Supabase's default-privileges grant (they were created
-- after the 20260715235133 hardening that revoked TRUNCATE everywhere else).
-- TRUNCATE bypasses RLS. Not reachable through PostgREST today (no HTTP verb
-- maps to it), so this closes a baseline regression, not a live breach.
revoke truncate on
  public.kadaiban_assignments,
  public.kadaiban_assignment_pages,
  public.kadaiban_submissions,
  public.kadaiban_submission_pages
from anon, authenticated;
