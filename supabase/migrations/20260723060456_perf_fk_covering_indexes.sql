-- Performance advisor: unindexed foreign keys.
--
-- The performance advisor flagged 14 foreign keys with no covering index.
-- Without one, Postgres has to seq-scan the child table to enforce ON DELETE
-- / ON UPDATE and to serve joins that filter on the FK column — fine at pilot
-- scale, increasingly not as activity_results / kadaiban_* grow. Each index
-- leads with the FK column so it covers the constraint.
--
-- Pure additive, idempotent (IF NOT EXISTS), no lock of consequence at current
-- row counts. class_teachers has two FKs on the same column (user_id) — one
-- index covers both.

create index if not exists idx_activity_results_module_id
  on public.activity_results (module_id);

create index if not exists idx_class_modules_module_id
  on public.class_modules (module_id);

create index if not exists idx_class_teachers_user_id
  on public.class_teachers (user_id);

create index if not exists idx_grade_corrections_corrected_by
  on public.grade_corrections (corrected_by);

create index if not exists idx_gradebook_snapshots_school_id
  on public.gradebook_snapshots (school_id);

create index if not exists idx_kadaiban_assignments_class_id
  on public.kadaiban_assignments (class_id);

create index if not exists idx_kadaiban_assignments_created_by
  on public.kadaiban_assignments (created_by);

create index if not exists idx_kadaiban_submissions_graded_by
  on public.kadaiban_submissions (graded_by);

create index if not exists idx_kadaiban_submissions_student_id
  on public.kadaiban_submissions (student_id);

create index if not exists idx_observation_records_school_id
  on public.observation_records (school_id);

create index if not exists idx_observation_records_student_id
  on public.observation_records (student_id);

create index if not exists idx_observation_records_teacher_id
  on public.observation_records (teacher_id);

create index if not exists idx_school_modules_module_id
  on public.school_modules (module_id);
