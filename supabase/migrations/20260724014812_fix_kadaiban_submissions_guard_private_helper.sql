-- Same root cause as 20260724014636: the private-schema move (20260724011947)
-- left this trigger function's BODY calling the RLS helpers with an explicit
-- public. qualifier. kadaiban_submissions_guard runs on EVERY insert/update to
-- kadaiban_submissions, so after the move every student submission and teacher
-- grade errored "function public.app_user_taught_class_ids() does not exist".
-- Re-point both helper calls at the private schema. Logic is otherwise
-- byte-for-byte unchanged.
--
-- Verified live post-apply: a full scan of pg_proc shows no remaining function
-- body references any moved helper via a public. qualifier. Applied 2026-07-24,
-- ledger 20260724014812.
create or replace function public.kadaiban_submissions_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_is_teacher boolean;
begin
  select exists (
    select 1 from public.kadaiban_assignments a
    where a.id = new.assignment_id
      and (a.class_id in (select private.app_user_taught_class_ids())
           or a.class_id in (select c.id from public.classes c
                             where c.school_id in (select private.app_user_staff_school_ids())))
  ) into v_is_teacher;

  if not v_is_teacher then
    if new.status = 'graded' then
      raise exception 'kadaiban: only a teacher/staff of the class may set status=graded';
    end if;
    if new.score is not null or new.max_score is not null
       or new.graded_by is not null or new.graded_at is not null then
      raise exception 'kadaiban: only a teacher/staff of the class may set grade fields';
    end if;
    if tg_op = 'UPDATE' and old.status = 'graded' then
      raise exception 'kadaiban: a graded submission cannot be modified by the student';
    end if;
  end if;
  return new;
end;
$function$;
