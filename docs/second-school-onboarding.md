# Onboarding a new school — runbook

Ordered checklist for standing up a new school with today's tooling.
Written so a non-engineer platform admin can follow it end to end.
Each step is tagged **UI today** (do it by clicking through the admin
console) or **hand SQL / dashboard today** (no UI exists yet; a
developer runs it in the Supabase dashboard/SQL editor).

Worked example throughout: **羽咋市立羽咋小学校** (`hakui-honsho`),
which as of 2026-07-20 already has a school row, 6 classes, and 2
staff members — the remaining step for it is bulk student import.

> **WARNING — never set `profiles.home_school_id` for real-school
> students.** Leave it `NULL`. Real schools number students
> per-class (出席番号: a "#1" exists in every class), but the
> `profiles_student_no_per_school` unique index is on
> `(home_school_id, student_number)` — a per-*school* guarantee.
> Setting `home_school_id` on a real school's students hits a
> duplicate-key violation the moment two classes both have a "#1"
> (verified on Mizuho, 2026-07-16). `NULL` is what lets per-class
> numbering coexist (Postgres treats `(null, "1")` rows as distinct
> from each other). Login is unaffected either way — the student
> flow keys on `{class_id, student_number}`, which is unique per
> class regardless of `home_school_id`. The seed/demo schools only
> have it set because their students are synthetically,
> uniquely numbered — do not copy that pattern for a real school.

---

## 1. Create the school row — **UI today**

`hub/admin/schools.html`, platform-admin only. Add the school's
official name (and any other fields the form exposes). This creates
the `schools` row that everything else hangs off.

## 2. Create classes — **UI today**

`hub/admin/class-detail.html` (reached from the school's class list).
Create one row per class (e.g. 1年1組 … 6年2組). For
`hakui-honsho` this is already done — 6 classes exist.

## 3. Create the first school_admin / staff accounts — **UI-adjacent**

There is no dedicated "create first admin" screen; a platform admin
uses the staff creation flow in `hub/admin/teachers.html`, which
calls the `provision-account` Edge Function
(`supabase/functions/provision-account/index.ts`) with
`{ kind: "admin" | "teacher", school_id, email, display_name,
password? }`. The function:

- authenticates the caller's JWT and requires either
  `profiles.is_platform_admin = true` or an existing `school_admin`
  row in `school_members` for the target school — so the very first
  admin for a brand-new school **must** be provisioned by a platform
  admin (there's no `school_admin` yet to authorize themselves);
- creates the `auth.users` row (email/password login, no confirmation
  email — real email addresses only, unlike the synthetic student
  ones);
- inserts `profiles` (`must_change_password: true`) and
  `school_members` (`role`: `school_admin` for kind `admin`, `educator`
  for kind `teacher`);
- returns `initial_password` only when the caller didn't supply one —
  shown once, not recoverable afterward, so record/hand it off
  immediately.

For `hakui-honsho` this is already done — 2 staff accounts exist.

## 4. License modules for the school — **UI today**

`hub/admin/modules.html`. Pick the school in the toolbar (only shown
if you can see more than one school), then toggle "学校で有効" per
module. Coordinators see this read-only; `school_admin` and platform
admins can write.

As of this rollout there is a **bulk action** for exactly this step
(added alongside this runbook): a "全モジュールを有効化" button that
enables every currently-active module for the selected school in one
click, and a "他校からコピー…" control that copies another school's
enabled-module set onto the selected school. Both are additive only —
they never disable/remove a module that's already enabled, so it's
safe to run repeatedly (e.g. after a new module ships) without
clobbering hand-picked choices. For `hakui-honsho`, using "copy from
Mizuho" is the fastest way to reach parity with the reference school's
24 enabled modules (today it has 6).

## 5. Assign teachers to classes — **UI today**

`hub/admin/class-detail.html`, per class — writes `class_teachers`.
Do this for each class the school's teachers actually teach; it
gates gradebook/roster visibility for that teacher.

## 6. Bulk student import — **UI today**

`hub/admin/students.html` → "CSVからインポート" button (enabled once
a school is selected in the picker). This is the remaining step for
`hakui-honsho`.

**CSV format** (first row is a header row, columns matched
case-insensitively by name — read directly from `students.html`):

| column | required | notes |
|---|---|---|
| `student_number` | yes | 出席番号 — unique *within a class*, not school-wide |
| `display_name` | yes | student's display name |
| `year` + `gumi` | one of this pair, or `class_name` | numeric grade/組 (e.g. `5`, `2`) — the class is found or auto-created |
| `class_name` | one of this pair, or `year`+`gumi` | free-text class name, for e.g. 特別支援学級 that don't fit year/gumi |

Each row is auto-matched to a class (creating it if it doesn't exist
yet) and then POSTed to `provision-account` with
`{ kind: "student", school_id, class_id, student_number,
display_name }`. Two things matter operationally:

- **Idempotent re-import**: if a `(class_id, student_number)` pair
  already has a student enrolled, the function returns success
  without creating a duplicate (`existing: true`) — so re-running the
  same CSV (e.g. after fixing a few bad rows) is safe.
- **Initial passwords are shown exactly once**, in the results table
  at the end of the import, with a "印刷する" button. There is no way
  to recover them afterward — print or record them before closing the
  results modal.

## 7. Verify RLS scoping — **manual, no automated test today**

No automated cross-tenant test exists yet. Spot-check manually:
log in (or use a second browser profile) as `hakui-honsho`'s
`school_admin` and confirm they cannot see or write Mizuho's schools,
classes, students, or `school_modules` rows (and vice versa for a
Mizuho admin against `hakui-honsho`). This is the RLS boundary the
whole platform depends on (per `CLAUDE.md`: RLS is the real security
boundary, not client code) — worth doing once per new school as a
sanity check, not just trusting the policies were written correctly.

## 8. Student login check — **UI today**

`hub/login.html`'s school/class picker reads from the `public_schools`
/ `public_classes` views, so a newly created school and its classes
should appear there automatically once created (step 1–2) — no
separate registration step. After the CSV import (step 6), do one
real login as a freshly-imported student using their 出席番号 and
printed initial password, through the actual picker, to confirm the
whole chain works end to end.

---

## Summary table

| # | Step | Where | Status |
|---|---|---|---|
| 1 | School row | `hub/admin/schools.html` | UI today |
| 2 | Classes | `hub/admin/class-detail.html` | UI today |
| 3 | First staff accounts | `hub/admin/teachers.html` → `provision-account` | UI-adjacent |
| 4 | License modules | `hub/admin/modules.html` (+ new bulk action) | UI today |
| 5 | Assign teachers to classes | `hub/admin/class-detail.html` | UI today |
| 6 | Bulk student import | `hub/admin/students.html` CSV modal | UI today |
| 7 | Verify RLS scoping | manual, two admin sessions | manual — no tooling |
| 8 | Student login check | `hub/login.html` | UI today |
