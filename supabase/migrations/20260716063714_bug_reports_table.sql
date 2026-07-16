-- Audit log + rate-limit source for the staff bug-report button (report-bug
-- Edge Function). One row per submitted report. Only the Edge Function
-- (service_role) touches this table; RLS is enabled with NO client policies
-- and the default anon/authenticated grants are revoked, so report content is
-- never client-readable.
create table public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_role text,
  page_url text,
  description text not null,
  issue_number integer,
  issue_url text,
  created_at timestamptz not null default now()
);

create index bug_reports_reporter_created_idx
  on public.bug_reports (reporter_id, created_at desc);

alter table public.bug_reports enable row level security;
revoke all on public.bug_reports from anon, authenticated;
grant all on public.bug_reports to service_role;
