-- Module workflow rework — Phase 2: unit-scoped assignment (pacing).
--
-- NOTE: documentation mirror of the migration
-- `add_class_modules_focus_units` already applied to the live project
-- (ref ohnsawydclmsrgphasbn). The repo has no supabase/ tooling.
--
-- focus_units: nullable jsonb. null = all units (today's behavior exactly;
-- existing rows need no migration and reproduce current behavior). Populated =
-- a JSON array of canonical unit keys the class is currently focused on, e.g.
-- ["u09","u10"] for sansu3. Modules read it and FOREGROUND (not hide) the
-- listed units; a module that doesn't understand the column ignores it.
--
-- Canonical unit keys per module live in gakuenza.com/hub/module-units.js and
-- MUST match each module's internal keys:
--   sansu3 : u01..u17  (= 'u' + zero-padded unit number, generators.js UNITS)
--   kokugo3: 'kanji' + READING_UNITS keys (currently 'daizu')

alter table public.class_modules
  add column if not exists focus_units jsonb;
