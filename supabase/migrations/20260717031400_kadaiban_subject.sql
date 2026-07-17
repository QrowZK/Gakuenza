-- Optional subject tag on a Kadaiban assignment, for display + filtering (#82).
alter table public.kadaiban_assignments add column if not exists subject text;

-- Mirror modules_subject_check's allowed set; nullable (subject is optional).
alter table public.kadaiban_assignments drop constraint if exists kadaiban_assignments_subject_check;
alter table public.kadaiban_assignments add constraint kadaiban_assignments_subject_check
  check (subject is null or subject in
    ('english','math','japanese','science','social','sougou','misc'));
