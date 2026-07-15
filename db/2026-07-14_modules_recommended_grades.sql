-- Module workflow rework — Phase 5 (6a): module grade metadata.
--
-- Documentation mirror of migration `add_modules_recommended_grades` applied
-- to the live project (ref ohnsawydclmsrgphasbn). The repo has no supabase/
-- tooling.
--
-- recommended_grades: integer[] or null. null = no recommendation (no warning).
-- Populated = recommended grade years. Both assignment surfaces (admin
-- class-detail, Gradebook 課題) show a SOFT confirm when a class's year isn't
-- in this set. Advisory only — never a hard block (cross-grade use is valid).

alter table public.modules
  add column if not exists recommended_grades integer[];

update public.modules set recommended_grades = '{3}'    where key = 'sansu3';
update public.modules set recommended_grades = '{3}'    where key = 'kokugo3';
update public.modules set recommended_grades = '{3}'    where key = 'shakai3';
update public.modules set recommended_grades = '{3,4}'  where key = 'letstry1';
update public.modules set recommended_grades = '{4}'    where key = 'letstry2';
update public.modules set recommended_grades = '{6}'    where key = 'nh6';
update public.modules set recommended_grades = '{6}'    where key = 'nhvocab';
update public.modules set recommended_grades = '{6}'    where key = 'kanken5';
update public.modules set recommended_grades = '{6}'    where key = 'kanken4';
update public.modules set recommended_grades = '{6}'    where key = 'kanken3';
-- eiken stays null (broad English proficiency, no single grade).
