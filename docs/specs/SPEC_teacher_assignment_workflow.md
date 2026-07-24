# SPEC — Teacher-driven assignment workflow (drill modules)

**Roadmap:** relates to Product-feature **F1** (assignment progress / due-date
dashboard) in `planning/FEATURE_BACKLOG.md` — this is the *authoring* model F1
assumes but that doesn't exist yet.
**Origin:** user-report **#176** (gradebook `assign.html`).
**Status:** scoping only — design agreed, **no build** this session (owner
decision 2026-07-24). Decisions needed before implementation (see end).
**Written:** 2026-07-24.

> **Placement note (read first).** Lives in `docs/specs/`, **not**
> `docs/specs/pending/`. The `pending/` path auto-fires the module builder,
> which would misread this DB + gradebook + student-hub feature as a learning
> module to generate. Same placement reasoning as
> `SPEC_admin_staff_management.md`. Hand to a subagent or build by hand.

---

## The complaint (#176, verbatim intent)

> "I still don't get why we assign assignments like this. Ideal workflow:
> static on/off state for enabled modules per school, then module on/off within
> school per class (already exists); **then teachers assign assignments — from
> some already-enabled module, do X — and that thing shows up in the gradebook,
> assigns itself to the teacher, and also shows up on the student's hub home.**"

The owner is distinguishing two things the current model conflates:
**enablement** (what a class *may* use) vs **assignment** (a specific task a
teacher *hands out*). Today there is only the former.

## Current state (verified live against `ohnsawydclmsrgphasbn`, 2026-07-24)

- **`school_modules`** `(school_id, module_id, enabled, config, enabled_at)` —
  per-**school** licensing/enablement.
- **`class_modules`** `(class_id, module_id, created_at, total_items, due_date,
  focus_units)`, **PK `(class_id, module_id)`** — per-**class** enablement plus
  coarse config. Because the PK is one row per class-module pair, it **cannot
  represent two assignments of the same module** (this week's vs next week's),
  and it has **no `created_by`** — so an "assignment" can't be attributed to the
  teacher who made it. This row *is* what the gradebook `assign.html` +
  `hub/module-assign-common.js` write — which is exactly the surface #176 finds
  confusing: it looks like "assigning" but is really "configure the enablement
  row."
- **Student hub** (`hub/index.html`): reads `class_modules` for the student's
  class(es) → renders "割り当てられたモジュール"; **falls back to
  school-enabled modules** when none are assigned; shows `due_date`/`total_items`;
  clicking **launches the whole module** (the runner foregrounds
  `focus_units` via the `★ 今週` path — `sansu3` reference). So the student sees
  "available modules," not a **to-do list of assigned tasks**.
- **`activity_results`** `(user_id, class_id, school_id, module_id, score,
  max_score, activity_ref, …)` — drill attempts. **Not linked to any
  assignment.** Completion "for an assignment" is currently uninferable except
  heuristically (same module, after the assignment date).
- **Precedent that already does this right:** **`kadaiban_assignments`**
  `(id, class_id, created_by, title, instructions, due_date, page_count,
  subject)` — a real discrete-assignment entity: own PK, **multiple per class**,
  **attributed to a creator**, with a companion submissions table and
  taught-OR-staff-of-school RLS. #176 is asking for the drill-module analogue of
  this.

## Proposed design

Introduce a discrete **`module_assignments`** entity that mirrors
`kadaiban_assignments`, and make the gradebook and student hub treat it as the
first-class "assigned task." **Keep `class_modules` for enablement** — assignment
and availability become two separate facts, which is the mental model #176 wants.

### Data model

```
create table public.module_assignments (
  id           uuid primary key default gen_random_uuid(),
  class_id     uuid not null references public.classes(id) on delete cascade,
  module_id    uuid not null references public.modules(id) on delete cascade,
  created_by   uuid not null references public.profiles(id),   -- assigning teacher
  title        text,                    -- optional; UI derives a default from module + units
  focus_units  jsonb,                   -- which units (null = whole module); same key convention as class_modules.focus_units
  target_items integer,                 -- how many questions (null = module default)
  due_date     date,
  instructions text,
  created_at   timestamptz not null default now()
);
create index on public.module_assignments (class_id);
create index on public.module_assignments (module_id);          -- covering FK (perf-advisor rule)
create index on public.module_assignments (created_by);
revoke truncate on public.module_assignments from anon, authenticated;  -- new-table hardening rule (CLAUDE.md)
```

Multiple rows per `(class_id, module_id)` are intentional — that is the entire
point of a discrete assignment (history + concurrent tasks).

### RLS (mirror the kadaiban `taught-OR-staff-of-school` shape)

Helpers are in the **`private`** schema as of `20260724011947` — qualify them.

- **read** (`module_assignments_read`, SELECT): a student of the class **or** a
  teacher/staff of it — so both the hub and the gradebook read the same rows:
  ```
  using (
    class_id in (select private.app_user_class_ids())                     -- enrolled student
    or class_id in (select private.app_user_taught_class_ids())           -- teacher of class
    or class_id in (select c.id from public.classes c
                    where c.school_id in (select private.app_user_staff_school_ids()))  -- school staff
  )
  ```
- **write** (INSERT/UPDATE/DELETE, `module_assignments_write`): teacher/staff of
  the class only (the two teacher/staff arms above), and **`with check
  (created_by = auth.uid() and <same>)`** on INSERT so a row self-attributes to
  its creator. (Author it split-by-command from the start — do not use a single
  `FOR ALL` policy, so it doesn't re-introduce the `ALL`+`SELECT` overlap that
  perf-debt #7's residual is about.)

### Completion / progress ("shows up in the gradebook")

The genuinely hard part: `activity_results` has no `assignment_id`, so an
attempt can't be tied to a specific assignment.

- **MVP — inferred (recommended):** per assignment, count the class's students
  whose `activity_results` match `module_id` **and** `created_at >=
  assignment.created_at` (and, if `focus_units` is set, whose
  `activity_result_items.category` overlaps the assigned units) → "N of M
  students done / avg score." This needs **no reporting-path change** and mirrors
  how the gradebook already derives per-module analysis. Limitation: two
  assignments of the same module overlap, and it can't distinguish "did the
  assigned work" from "practised that module anyway."
- **Phase 2 — exact:** add nullable `activity_results.assignment_id`; the student
  launches *into* an assignment (hub passes the id), and
  `HubCommon.reportActivityWithItems` stamps it. Exact completion, at the cost of
  touching the shared reporting helper + every runner's launch path. Defer until
  inference proves too fuzzy in real use.

### UI surfaces

1. **Teacher authoring — gradebook `assign.html`.** Replace the current
   "configure the `class_modules` row" surface with **"課題を作成"**: pick an
   already-enabled module → optional units (`focus_units`) → target item count →
   due date → save = one `module_assignments` insert (`created_by = auth.uid()`,
   so it "assigns itself to the teacher"). List the class's existing assignments
   with inferred completion. (Optional convenience: if the chosen module isn't
   enabled for the class yet, upsert `class_modules` in the same action — see
   decision 3.)
2. **Gradebook display.** A per-class "課題" list (assignment, module, due,
   completion), filterable to "自分が出した課題." This is what F1 becomes once
   real assignments exist.
3. **Student hub `hub/index.html`.** Add a distinct **"課題 / やること"** section
   above "利用可能なモジュール," reading `module_assignments` for the student's
   classes, soonest-due first, with a done/not-done marker (from inferred
   completion). Clicking launches the module with the assignment's `focus_units`
   foregrounded (reuse the existing `★ 今週` path; pass the assignment id in the
   query string so Phase 2 can stamp it).

### Relationship to `class_modules` / `focus_units`

- `class_modules` stays = **enablement** (what a class *may* use) + optionally a
  standing "default focus" for the runner.
- `module_assignments` = **discrete teacher-issued tasks**.
- The runner's `focus_units` foregrounding can be fed by either the class default
  (`class_modules.focus_units`) or an active assignment — no runner change needed
  for MVP if the hub passes focus via the existing launch path.

## Phasing

- **Phase 1 (MVP):** table + split-command RLS + `revoke truncate`; gradebook
  create/list; student-hub 課題 section; **inferred** completion. No
  reporting-path change. Migration applied via MCP `apply_migration` + committed
  `supabase/migrations/<ts>_module_assignments.sql` (same PR).
- **Phase 2:** `activity_results.assignment_id` for exact completion; assignment
  edit/archive; per-student drill-down; optional due-date reminders.

## Open decisions (owner) — needed before build

1. **Completion for MVP: inferred (A) or exact (B)?** Recommend **A** first
   (no reporting-path risk); upgrade to B only if inference reads as too fuzzy.
2. **Deprecate `class_modules.due_date`/`total_items`?** Those columns are the
   old pseudo-assignment. Recommend: stop writing them from the new UI, keep the
   columns for back-compat, and let `module_assignments` own due/target.
3. **Auto-enable on assign?** If a teacher assigns a module the class hasn't
   enabled, silently upsert `class_modules` (recommend **yes** — one action) or
   block with "enable it first"?
4. **Whole-module vs unit-scoped assignments** — support both (`focus_units`
   null = whole module)? Recommend **yes**.
5. **Student-hub fallback** — when a class has assignments, does the hub still
   show the full "利用可能なモジュール" list below the 課題 list, or only the
   assigned tasks? Recommend keep both (assignments as the to-do, availability
   below for free practice).

## Non-goals

Not building anything this session (scoping only). No reporting-path change in
MVP. Not a broader gradebook redesign. `kadaiban_assignments` stays its own
worksheet-specific entity — this is the *drill-module* analogue, not a merge.
