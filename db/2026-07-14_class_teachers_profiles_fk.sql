-- class_teachers → profiles FK (applied to the Gakuenza Supabase project
-- ohnsawydclmsrgphasbn on 2026-07-14 via migration
-- `class_teachers_profiles_fk_for_embed`). Version-controlled record; the
-- repo has no supabase/ tooling, so this is documentation, not auto-applied.
--
-- BUG: hub/admin/class-detail.html loadClassTeachers() runs
--   sb.from('class_teachers').select('user_id, profiles(display_name)')
-- but class_teachers.user_id only FK'd to auth.users(id) — there was NO FK to
-- profiles(id), so PostgREST could not resolve the `profiles` embed and
-- returned PGRST200 ("Could not find a relationship between 'class_teachers'
-- and 'profiles'"). loadClassTeachers therefore errored on every call and the
-- page fell back to classTeachers = [].
--
-- SYMPTOM: with classTeachers empty, the teacher-assignment modal showed every
-- already-assigned teacher as UN-checked. Saving computed them as "to add" and
-- re-INSERTed an existing (class_id, user_id) → duplicate key (23505) →
-- "保存できませんでした". Latent until class_teachers actually had rows for the
-- classes being edited (surfaced by the Hakui test-data seed, which assigned a
-- teacher to every class).
--
-- FIX: add the missing FK. profiles.id = auth.users.id (profiles.id itself FKs
-- to auth.users), so this second FK on the same column coexists with the
-- existing auth.users FK and simply gives PostgREST the relationship it needs.
-- This mirrors enrollments, whose user_id already FKs to profiles(id).
-- No application code change required — the embed resolves after the schema
-- cache reload that DDL triggers.

ALTER TABLE public.class_teachers
  ADD CONSTRAINT class_teachers_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
