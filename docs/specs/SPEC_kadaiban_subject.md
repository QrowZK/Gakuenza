# SPEC — Kadaiban assignment dropdown: visibility + subject tagging/filter

**Issue:** #82 · **Status:** decisions locked, ready to build · **Written:** 2026-07-17

> **Placement note.** In `docs/specs/` (not `docs/specs/pending/`): `pending/`
> auto-fires the *module* builder, and this is a gradebook + schema change on the
> Kadaiban feature, not a module. Hand to a subagent or build directly.

## Decisions locked (by product owner, 2026-07-17)
- **Option A** — a `subject` column directly on `kadaiban_assignments` (NOT the
  "link a module to the assignment" Option B). Kadaiban stays decoupled from the
  module catalog.
- Ship the **visibility fix** (Part A) alongside the subject work (Part B).

## Motivation
Two compounding problems on `hub/gradebook/kadaiban.html`, both real:
1. The assignment picker (`kb-asg` `<select>`) only renders when a class has >1
   assignment, and even then it's a small `.gb-chip` pill tucked under the
   subtitle with an inline `margin-top:8px` — it reads as subtitle text, not a
   control. Every other gradebook page puts chips in a dedicated
   `gb-head-filters` row (e.g. `analysis.html:24` → `classChipHtml +
   subjectChipHtml`).
2. There is **no subject dimension** anywhere in Kadaiban — `kadaiban_assignments`
   has no `subject`, the create form never asks, and every grade anchors to the
   single `misc` catch-all module — so subject filtering is structurally
   impossible today, not just hidden.

---

## Part A — Visibility fix (CSS/markup only, no schema, low risk)
In `renderInbox()` (`kadaiban.html` ~309–321):
- Move the `kb-asg` `<select>` out of the title/subtitle block into a dedicated
  filter row directly under `.kb-headrow`, mirroring the `gb-head-filters`
  pattern used elsewhere.
- Give it a visible label (`課題`) via the existing `.gb-chip`/`.gb-chip-label`
  markup (see `subjectChipHtml` for the label span pattern).
- Keep the `assignments.length > 1` guard (a single-assignment class needs no
  picker), but when Part B lands the row also holds the subject chip (below), so
  render the row whenever **either** control is present.
- Style lives in the self-contained `gradebook.css` (do not link root
  `style.css`).

Ships independently of Part B — a teacher immediately sees the picker as a real
control.

---

## Part B — Subject tagging + filter (schema + create form + filter chip)

### B1. Schema migration
`supabase/migrations/<applied_ts>_kadaiban_subject.sql` — apply via MCP
`apply_migration`, commit the file **named to the applied ledger version** (avoid
the filename↔ledger drift the Kadaiban migrations already hit).

```sql
-- Optional subject tag on a Kadaiban assignment, for display + filtering (#82).
alter table public.kadaiban_assignments add column if not exists subject text;

-- Mirror modules_subject_check's allowed set; nullable (subject is optional).
alter table public.kadaiban_assignments drop constraint if exists kadaiban_assignments_subject_check;
alter table public.kadaiban_assignments add constraint kadaiban_assignments_subject_check
  check (subject is null or subject in
    ('english','math','japanese','science','social','sougou','misc'));
```
**RLS unaffected:** `kadaiban_asg_read`/`kadaiban_asg_write` key on `class_id`,
not content columns — a new nullable descriptive column needs no policy change
(re-confirm before merge, per CLAUDE.md DB-adjacent caution).

### B2. Create form — `renderCreate()` (`kadaiban.html` ~372–411)
- Add an **optional** subject `<select>` (label 教科, default "選択なし") to the
  form, next to 提出期限, using the 6 teacher-facing subjects from
  `GB.SUBJECTS` (`math/japanese/english/science/social/sougou` — omit `misc`
  from the picker; the column still permits it).
- Wire `create.subject` in state + the input handler; include `subject` in the
  `kadaiban_assignments` insert in `submitCreate()`.

### B3. Inbox filter — `renderInbox()`
- Show the subject as a small label in each assignment `<option>` (or a chip on
  the header) so a teacher sees what each is.
- Add a **subject filter chip** in the Part-A filter row (reuse the
  `GB.subjectChipHtml`-style markup) that narrows the `kb-asg` dropdown's options
  to the chosen subject (client-side filter over the already-loaded
  `assignments`; `null`-subject assignments show under "すべて"/no filter).
- Persist nothing server-side; this is pure client filtering of the loaded list.

### B4. Reporting note (no change required)
Kadaiban grades still anchor to the `misc` catch-all module for `activity_results`
(unchanged). The new `kadaiban_assignments.subject` is descriptive/for-filtering
only; it does **not** alter the reporting `module_id`. If per-subject Kadaiban
trends are wanted later, that's a separate design (Option B territory) — out of
scope here.

## Testing bar
- **Migration idempotency:** run twice — `add column if not exists` + the
  drop/add-constraint pair are safe to re-run.
- **RLS regression:** confirm a teacher/staff can still create + read assignments
  after the column add (the #70 taught-OR-staff policies must be unaffected —
  they key on `class_id`).
- **Flow (headless):** create two assignments with different subjects → the
  picker renders in the visible filter row → the subject chip narrows the
  dropdown → a null-subject assignment still appears under no-filter.
- Part A alone: verify the picker reads as a control, not subtitle text.

## Out of scope (future)
- Linking a Kadaiban assignment to a real `modules` row (Option B) — would give
  subject *and* publisher (#81) for free and feed the F1 dashboard, but was
  explicitly deferred in favor of the standalone column.
- Per-subject Kadaiban analytics / distinct reporting module per subject.

## Acceptance
The assignment picker is a clearly-visible header control; teachers can tag an
assignment's subject at creation; the inbox can filter assignments by subject;
null-subject assignments remain fully usable; migration applied via MCP with the
matching file committed and RLS confirmed unchanged.
