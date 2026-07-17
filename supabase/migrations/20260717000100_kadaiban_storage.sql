-- Kadaiban Storage — two PRIVATE buckets + storage.objects RLS.
--
-- NET-NEW infrastructure: Kadaiban is the first Gakuenza feature to use
-- Supabase Storage at all (verified 2026-07-16 — zero storage.from(...) usage
-- anywhere else in app code). Both buckets are PRIVATE (never public): student
-- work and teacher materials must not be world-readable. The client reads
-- images through short-lived signed URLs (createSignedUrl), gated by the
-- policies below.
--
--   kadaiban-sources      <assignment_id>/<page_number>.<ext>   teacher scans
--   kadaiban-submissions  <assignment_id>/<student_id>/<page>.png  flattened work
--
-- Storage RLS is a DIFFERENT surface than table RLS — policies live on
-- storage.objects, scoped by bucket_id + path — but the same SECURITY DEFINER
-- helpers (app_user_taught_class_ids / app_user_class_ids) are callable.
--
-- Path segments are compared as TEXT (a.id::text = split_part(name,'/',1))
-- rather than casting the object path TO uuid. A malformed path segment then
-- fails the match instead of raising an invalid-uuid error during policy
-- evaluation — important because a single RLS expression can be evaluated
-- against objects in *other* buckets too, and we don't want kadaiban's policy
-- to be able to error out an unrelated Storage operation.
--
-- Idempotent: bucket upsert on conflict, drop-policy-if-exists then create.

-- ── buckets (private; 10 MB cap; images only) ─────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kadaiban-sources',     'kadaiban-sources',     false, 10485760, array['image/png','image/jpeg']),
  ('kadaiban-submissions', 'kadaiban-submissions', false, 10485760, array['image/png','image/jpeg'])
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── SOURCES: teacher of the assignment's class writes; teacher OR enrolled
--    student reads (a student must see the worksheet to draw on it). ────────
drop policy if exists kadaiban_src_write on storage.objects;
create policy kadaiban_src_write on storage.objects for all to authenticated using (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id::text = split_part(name,'/',1)
                and a.class_id in (select public.app_user_taught_class_ids()))
) with check (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id::text = split_part(name,'/',1)
                and a.class_id in (select public.app_user_taught_class_ids()))
);
drop policy if exists kadaiban_src_read on storage.objects;
create policy kadaiban_src_read on storage.objects for select to authenticated using (
  bucket_id = 'kadaiban-sources'
  and exists (select 1 from public.kadaiban_assignments a
              where a.id::text = split_part(name,'/',1)
                and (a.class_id in (select public.app_user_taught_class_ids())
                     or a.class_id in (select public.app_user_class_ids())))
);

-- ── SUBMISSIONS: student writes/reads only their OWN (student_id path segment
--    = auth.uid()); teacher of the assignment's class may read. ─────────────
drop policy if exists kadaiban_subm_student_write on storage.objects;
create policy kadaiban_subm_student_write on storage.objects for all to authenticated using (
  bucket_id = 'kadaiban-submissions'
  and split_part(name,'/',2) = auth.uid()::text
) with check (
  bucket_id = 'kadaiban-submissions'
  and split_part(name,'/',2) = auth.uid()::text
  and exists (select 1 from public.kadaiban_assignments a
              where a.id::text = split_part(name,'/',1)
                and a.class_id in (select public.app_user_class_ids()))
);
drop policy if exists kadaiban_subm_read on storage.objects;
create policy kadaiban_subm_read on storage.objects for select to authenticated using (
  bucket_id = 'kadaiban-submissions'
  and (split_part(name,'/',2) = auth.uid()::text
       or exists (select 1 from public.kadaiban_assignments a
                  where a.id::text = split_part(name,'/',1)
                    and a.class_id in (select public.app_user_taught_class_ids())))
);
