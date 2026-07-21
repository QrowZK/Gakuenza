# Gakuenza — Codebase & Database Structure Review

_Review date: 2026-07-21 · Supabase project `ohnsawydclmsrgphasbn` (Gakuenza.com, ap-northeast-1, Postgres 17.6)_

> This is the **deep-reference structure map** — every table, RLS policy, Edge
> Function, and module in the current live system. For higher-level
> orientation (what Gakuenza is, how the docs fit together, who reads what),
> start at `docs/PROJECT_HANDBOOK.md`. For live priorities, in-flight work,
> and status, see `docs/ROADMAP.md`. This doc stays factual/structural; it
> doesn't restate roadmap priorities.

Gakuenza (がくえん座) is a Japanese elementary/middle-school drill-and-gradebook
platform. It is a **pure static frontend** (no application server, no build step)
talking directly to **Supabase Cloud**. The entire security model rests on
**PostgreSQL Row-Level Security (RLS)** plus five Edge Functions for the few
operations a static site cannot perform. This document maps how the code and the
database are organized, how they relate, and where the notable risks and open
items are.

---

## 1. Repository layout

**`supabase/migrations/` is the real schema ledger** (30 tracked migrations as
of this review, most recent `20260721000411_rename_nh6_display_name_to_eigo6`;
see §5). **`db/*.sql` is a pre-adoption mirror only** — 17 hand-transcribed
files from 2026-07-14/15, before migration tooling existed; nothing replays it
and no new schema work goes there.

```
/
├── .github/workflows/              4 workflows, all Claude-subscription-authed
│   ├── deploy.yml                  CI: rsync gakuenza.com/ → DreamHost on push to main
│   ├── auto-build-module.yml       builds a module from docs/specs/pending/*.md → PR
│   ├── bug-diagnose.yml            on a user-report issue → investigate + comment only
│   └── bug-autofix.yml             on `approved-for-autofix` label → attempt a fix → PR
├── db/                             PRE-ADOPTION SQL mirror (17 files, 2026-07-14/15
│                                    only; documentation, not applied — see §5)
├── supabase/                       CLI project tooling (adopted 2026-07-15)
│   ├── migrations/                 the real ledger — 30 files (see §5)
│   ├── functions/                  Edge Function sources (see §3.8) — 5 dirs
│   ├── config.toml · seed.sql · README.md
├── docs/                           PROJECT_HANDBOOK.md, ROADMAP.md, this file,
│                                    planning/, specs/pending+completed/
├── tests/                          headless flow tests, per module (13 dirs currently:
│                                    eigo5, kokugo1–6, rika5/6, sansu1/2/5/6)
└── gakuenza.com/                   The deployed site (the ONLY thing rsynced)
    ├── index.html · features.html · onboarding.html · modules.html   marketing
    ├── marketing.css · style.css · logo/favicon assets
    └── hub/                        the authenticated app
        ├── config.js               Supabase URL + anon key (public by design)
        ├── supabase.js             vendored minified supabase-js (library, not app code)
        ├── hub-common.js           window.HubCommon — shared student-side helpers
        ├── module-assign-common.js window.ModuleAssign — class_modules writes + bulk pw
        │                           (moduleUnitsFor lazy-loads modules/<key>/units.js)
        ├── login.html · index.html · dashboard.html(legacy) · modules.html
        ├── grades.html · settings.html · kadaiban.html · kadaiban-draw.js
        ├── admin/                  admin console (school_admin / coordinator / platform)
        │   ├── admin-common.js     window.AdminCommon — tier resolution + admin sidebar
        │   ├── admin.css           self-contained tokens (no shared style.css, see rule)
        │   ├── schools.html · teachers.html · students.html · class-detail.html · modules.html
        │   └── gradebook.html      redirect stub → ../gradebook/index.html
        ├── gradebook/              dedicated educator gradebook tool
        │   ├── gradebook-common.js window.Gradebook — context + class loading
        │   ├── index.html · assign.html · roster.html · observations.html
        │   ├── analysis.html · karte.html · print.html · kadaiban.html
        └── modules/                29 launchable module directories (see §4):
            math: sansu1–6 · japanese: kokugo1–6 · science: rika3–6 · social: shakai3–6
            english: letstry1/2, eigo5, nh6, nhvocab, eiken · supplementary: kanken3/4/5
```

**Deployment.** `.github/workflows/deploy.yml` rsyncs only `./gakuenza.com/` to
DreamHost over SSH on every push to `main` (`-rltgoDzvc --delete`). Repo root
(`db/`, `supabase/`, `.github/`, `docs/`, `tests/`) is outside the rsync source
and never ships. There is no CI for tests, linting, or the database — the
three non-deploy workflows are agent-driven build/fix pipelines, not test runners.

---

## 2. Runtime architecture

```
        Browser (static HTML/JS on gakuenza.com)
                │
    ┌───────────┼──────────────────────────────┐
    │ supabase-js (anon/publishable key)        │  Edge Functions (Deno)
    │  • PostgREST  /rest/v1  (tables/views)    │   • student-login     (public)
    │  • RPC        /rest/v1/rpc                 │   • report-bug        (public)
    │  • GoTrue     /auth/v1  (sessions)         │   • provision-account (JWT)
    └───────────┬──────────────────────────────┘   • update-student     (JWT)
                ▼                                   • update-teacher     (JWT)
         PostgreSQL 17 ◄───── RLS policies + SECURITY DEFINER helpers ──┘ service_role
```

- **No server owns business logic.** The browser reads/writes tables directly;
  RLS decides what each `auth.uid()` may see or change.
- **Edge Functions hold the only `service_role` code** — the privileged
  operations (creating auth users, the student login shim) that must bypass RLS.
- **Config is public on purpose.** `hub/config.js` ships the project URL and the
  publishable anon key. The header comment states the model explicitly: security
  relies on RLS, never on secrecy of this key; the `service_role` key lives only
  in Edge Functions.

---

## 3. Database structure

### 3.1 Tables (public schema, 19 tables)

`app_sessions` and `auth_audit_log` — present in the 2026-07-15 revision of
this doc — were **retired** (`db/2026-07-15_retire_app_sessions_and_audit_log.sql`):
the login flow always used standard GoTrue sessions, the custom session table
and its `resolve/touch/revoke` RPCs were dormant, and both the tables and the
six supporting functions have been dropped. They no longer exist; do not
re-add them to this doc.

| Table | Rows* | Purpose |
|---|---|---|
| `schools` | 2 | Tenants. `status ∈ {active,suspended,pending}`, unique `code`. |
| `profiles` | 114 | 1:1 with `auth.users`. `display_name`, `student_number`, `must_change_password`, **`is_platform_admin`**. |
| `school_members` | 9 | Staff membership. PK `(school_id,user_id)`, `role ∈ {school_admin,coordinator,educator,student}`. |
| `classes` | 15 | `year (1–6)` + `gumi (1–99)`; trigger derives `name`. Special-ed classes leave year/gumi null. Also legacy `grade_level/subject/academic_year`. |
| `enrollments` | 106 | Student↔class roster. PK `(class_id,user_id)`, `role ∈ {teacher,student}`. |
| `class_teachers` | 14 | Which classes an educator teaches (distinct from `enrollments` — see note). PK `(class_id,user_id)`. |
| `modules` | 30 | Drill catalog. Unique `key`, `subject` (check constraint), `launch_url`, `is_active`, `recommended_grades int[]`, **`publisher`** (textbook-series attribution). |
| `school_modules` | 37 | Which modules a school has licensed/enabled. PK `(school_id,module_id)`, `enabled`, `config jsonb`. |
| `class_modules` | 79 | Per-class assignments. PK `(class_id,module_id)`, `due_date`, `total_items`, **`focus_units jsonb`** (null = all units; still 0 rows actually populated as of this review). |
| `activity_results` | 14 | One row per drill attempt: `school_id,class_id,module_id,user_id,activity_ref,score,max_score,payload`. |
| `activity_result_items` | 60 | Per-question detail: `item_ref,category,prompt,correct,selected_answer,correct_answer` (answers stored as **text**). |
| `observation_records` | 1 | Teacher observations (unit-mode + free-notes): `subject,module_id,category,rating(A/B/C),note`, touched `updated_at`. |
| `grade_corrections` | 0 | Append-only audit of score edits: `activity_result_id,corrected_by,previous_score,new_score,reason`. |
| `gradebook_snapshots` | 4 | Weekly rollups for trend lines: `week_of,subject,category,rollup jsonb,pinned_note`. Populated by `run_weekly_gradebook_snapshot` via `pg_cron` (see §3.6) — **no longer empty**, unlike the 2026-07-15 snapshot. |
| `bug_reports` | 23 | Staff-submitted bug reports from the in-app bug button: `reporter_id,reporter_role,page_url,description,issue_number,issue_url`. Written by the `report-bug` Edge Function, which files the matching GitHub issue. RLS-enabled with **no policies** (table only ever written/read via the `service_role` Edge Function — flagged by the linter as INFO, expected). |
| `kadaiban_assignments` | 2 | Kadaiban (課題板) assignment header: `class_id,created_by,title,instructions,due_date,page_count,subject`. |
| `kadaiban_assignment_pages` | 2 | Source page images for an assignment: `assignment_id,page_number,source_image_path` (path into the `kadaiban-sources` Storage bucket). |
| `kadaiban_submissions` | 2 | One row per student per assignment: `assignment_id,student_id,status(not_started/in_progress/submitted/graded),score,max_score,graded_by,graded_at`. Guarded by the `kadaiban_submissions_guard` trigger. |
| `kadaiban_submission_pages` | 2 | Per-page ink state: `submission_id,page_number,canvas_state jsonb,rendered_image_path` (path into the `kadaiban-submissions` bucket). |

_*Row counts are a 2026-07-21 snapshot (live query)._

### 3.2 Entity relationships

```
schools ─1─┬─< classes ─┬─< enrollments >─ profiles(students)
           │            ├─< class_teachers >─ profiles(educators)
           │            ├─< class_modules >─ modules
           │            └─< kadaiban_assignments >─< kadaiban_assignment_pages
           │                          └─< kadaiban_submissions >─< kadaiban_submission_pages
           │                                        (student_id, graded_by → profiles)
           ├─< school_members >─ profiles(staff)
           └─< school_modules >─ modules

modules ─1─< activity_results ─1─< activity_result_items
                     └─< grade_corrections
classes/students ──< observation_records, gradebook_snapshots
profiles(reporter) ──< bug_reports
```

Two separate teacher-membership tables exist on purpose: `enrollments`
(student roster + a legacy `teacher` role) and `class_teachers` (the modern
"who teaches this class" used for educator RLS scoping).

### 3.3 The role / permission model (five tiers)

Roles are derived, not stored as a single column. Resolution lives in
`admin-common.js::lookupAdminTier()` on the client and in SECURITY DEFINER
helper functions in the DB:

| Tier | Determined by | Scope |
|---|---|---|
| **platform_admin** | `profiles.is_platform_admin = true` | Every school, present & future. Only tier that can create schools and soft-retire modules. No `school_members` row needed. Set only via direct SQL. |
| **school_admin** | `school_members.role='school_admin'` | Full admin of one school; can create staff, reset passwords, license modules. |
| **coordinator** | `school_members.role='coordinator'` | Manage classes/enrollments/assignments school-wide, but **cannot** create staff, create schools, reset passwords, or license modules. |
| **educator** | `school_members.role='educator'` + `class_teachers` rows | Gradebook only, scoped to taught classes. Not admitted to the admin console. |
| **student** | `enrollments.role='student'` | Own hub, assigned modules, own grades. |

Client-side `requireAdminAccess` / `requireGradebookAccess` are explicitly
documented as **UX gating only** — RLS is the real boundary.

**`is_platform_admin` client-write lockdown (2026-07-17, P0, fixed).**
`authenticated`/`anon` held table-level `UPDATE` on `public.profiles`, and
`profiles_update_admin` (an UPDATE policy with **no `WITH CHECK`**) admits the
caller's own `school_members` row — so a coordinator/school_admin could
`PATCH /rest/v1/profiles {"is_platform_admin": true}` on their own row and
take over every tenant. Fixed by revoking the table-level `UPDATE` and
re-granting `UPDATE` only on the safe columns (`id, home_school_id,
display_name, student_number, created_at, must_change_password`) —
`is_platform_admin` deliberately excluded (migrations `20260717040743`,
`20260717040949`). Verified live: `anon`/`authenticated` currently hold no
`INSERT`/`UPDATE` grant on that column, table-level `UPDATE` is gone, and the
column-level regrant covers exactly the five safe columns above. **Never
`GRANT UPDATE ON public.profiles` at the table level again** — it silently
re-includes `is_platform_admin` (Postgres won't downgrade a table grant
per-column) and reopens the hole. The flag is only ever set via migration or
`service_role`.

**New-table default-privilege hazard.** `ALTER DEFAULT PRIVILEGES` re-grants
`TRUNCATE` (which bypasses RLS) to `anon`/`authenticated` on every freshly
created table. The 2026-07-14 hardening revoked it everywhere, but the
Kadaiban tables re-inherited it on creation and had to be re-revoked
(`20260717041107_revoke_kadaiban_truncate.sql`). Verified live: no
`TRUNCATE` grant exists for `anon`/`authenticated` on any `public` table as
of this review. Any migration that creates a table must `REVOKE TRUNCATE`
(and audit table-level `UPDATE`/`DELETE`) from `anon, authenticated` as part
of the same migration.

### 3.4 RLS policies

Every public table has `rls_enabled = true`. Policies are built from a set of
SECURITY DEFINER helper functions that centralize "what may this user reach":

| Helper | Returns |
|---|---|
| `app_is_platform_admin()` | bool from `profiles.is_platform_admin` |
| `app_has_role(school, roles[])` | bool — caller holds one of `roles` at `school` |
| `app_user_school_ids()` | schools the caller is a member of (any role) |
| `app_user_admin_school_ids()` | schools where caller is school_admin (+ all, if platform admin) |
| `app_user_staff_school_ids()` | school_admin **or** coordinator schools (+ all for platform admin) |
| `app_user_class_ids()` | classes the caller is enrolled in |
| `app_user_taught_class_ids()` | classes from `class_teachers` (educator scope) |
| `app_class_school(class)` | the school owning a class |

Representative policies:

- **`activity_results`** — `ar_read`: own rows OR educator/school_admin of the
  school. `ar_insert` (hardened): staff may insert freely; a student may insert
  only for **their own** `user_id`, into a class they're enrolled in, with
  `school_id = app_class_school(class_id)` and `0 ≤ score ≤ max_score`.
  `results_admin_write` (UPDATE): admin school or taught class.
- **`class_modules`** — `cmod_write` (FOR ALL): school staff (admin+coordinator)
  OR the educator's own taught classes. Widened 2026-07-14 from admin-only.
- **`modules`** — read-only to everyone (`USING true`); no write policy, so
  API roles cannot write. Toggling `is_active` goes through an RPC (§3.6).
- **`observation_records` / `grade_corrections` / `gradebook_snapshots`** — all
  reuse the same boundary: platform admin, or school_admin/coordinator of the
  school, or educator of the taught class. `grade_corrections` is insert+read
  only (append-only audit); `gradebook_snapshots` is read-only to clients
  (written by `run_weekly_gradebook_snapshot`, run as `service_role` via
  `pg_cron` — see §3.6, no longer a dormant dependency).
- **`profiles`** — self + same-school visibility (`profiles_read`,
  `profiles_read_admin`, and `profiles_read_taught` — the last widened
  2026-07-16 so an educator can read the profiles of students in their taught
  classes); `profiles_update_admin` lets staff update members/enrolled
  students in their schools, subject to the column-level lockdown above.
- **`kadaiban_assignments` / `kadaiban_submissions`** — `kadaiban_asg_read` /
  `kadaiban_asg_write` and `kadaiban_sub_read` scope to platform admin, staff
  (school_admin/coordinator) of the class's school, **or** an educator who
  teaches the class — widened from teacher-only in `20260717011536` (#70) so
  coordinators/admins can see and manage Kadaiban work school-wide, not just
  the assigning teacher. `kadaiban_sub_student_write` lets the enrolled
  student write their own submission/pages; `kadaiban_sub_teacher_grade`
  (UPDATE) is the separate staff-only grading path. The two `*_pages` tables
  carry their own mirrored policies: `kadaiban_asgpage_read`/`_write` on
  `kadaiban_assignment_pages`, `kadaiban_subpage_student` (ALL, own
  submission) / `kadaiban_subpage_teacher_read` (SELECT, staff/taught-class)
  on `kadaiban_submission_pages`.

### 3.5 Triggers & derived data

| Trigger | Table | Effect |
|---|---|---|
| `classes_sync_name_trigger` | classes | Derives `name = "N年M組"` from year/gumi; leaves special-ed names untouched. |
| `class_modules_guard` | class_modules | `enforce_module_enabled()` — blocks assigning a module not enabled for the class's school. |
| `observation_records_touch_updated` | observation_records | Bumps `updated_at`. |
| `kadaiban_submissions_guard` | kadaiban_submissions | SECURITY DEFINER guard on INSERT/UPDATE — closed a real double-grading bug (a submission could be graded twice, corrupting a production row before it was caught 2026-07-18). |

### 3.6 RPC / functions

Live SECURITY DEFINER/INVOKER function inventory (verified against
`information_schema.routines`), 18 functions total:

- **`app_set_module_active(p_module, p_active)`** — SECURITY DEFINER; the only
  way to write `modules` from a client. Its `WHERE ... app_is_platform_admin()`
  makes it a no-op for anyone else (matches zero rows).
- **Gradebook snapshot functions** — `build_gradebook_snapshot`,
  `backfill_gradebook_snapshots`, `run_weekly_gradebook_snapshot`. All
  SECURITY DEFINER. `run_weekly_gradebook_snapshot` is the `pg_cron` job body
  (see below); `build_gradebook_snapshot` computes one student/week rollup,
  `backfill_gradebook_snapshots` was the one-time historical backfill.
  `gradebook_snapshots` now genuinely has rows (4, growing weekly) — this is
  no longer the dormant/empty state the 2026-07-15 revision of this doc
  described.
- **`kadaiban_submissions_guard()`** — SECURITY DEFINER trigger function, see
  §3.5.
- **`rls_auto_enable`** — SECURITY DEFINER event trigger; auto-enables RLS on
  any newly created `public` table so a forgotten `ENABLE ROW LEVEL SECURITY`
  can't ship a wide-open table.
- **`hook_restrict_google_signups`, `classes_sync_name`,
  `enforce_module_enabled`, `observation_records_touch`** — SECURITY INVOKER
  trigger/hook functions backing the rows in the tables above.
- **`pg_cron` is installed and wired** (`pg_cron` extension `1.6.4`, schema
  `pg_catalog`; confirmed via `list_extensions`). One active job:
  `weekly-gradebook-snapshot`, schedule `15 2 * * 1` (Mondays 02:15 UTC),
  `active = true`. This closes the "pg_cron not installed" gap the
  2026-07-15 revision of this doc flagged — see §6.
- **Retired:** `resolve_session`, `touch_session`, `revoke_all_sessions`,
  `log_failed_login`, `purge_expired_sessions`, `purge_old_audit_log` no
  longer exist (dropped with `app_sessions`/`auth_audit_log`, §3.1). Do not
  reference them as live infrastructure.

### 3.7 Views

`public_schools` (id, name) and `public_classes` (id, school_id, year, gumi,
name) are **SECURITY DEFINER** views exposing only a safe column subset to
**anonymous** users on the pre-login screen (so students can pick their school
and class before authenticating). This is a deliberate, documented exception to
the linter (see §6).

### 3.8 Edge Functions (Deno, the only `service_role` code — 5 functions)

Verified against `list_edge_functions`: all 5 `ACTIVE`.

| Function | Version | verify_jwt | Role |
|---|---|---|---|
| **`provision-account`** | v6 | required | The single privileged create endpoint. Verifies caller's JWT, confirms caller is school_admin of the **target** school (or platform admin) via a `service_role` query (never trusting client claims), then creates the auth user + profile + enrollment/membership with **best-effort rollback**. Students get synthetic emails `s{number}@{slug}-{id8}.students.gakuenza.com` (never real mailboxes). Maps the API's `admin/teacher/coordinator` vocabulary to DB `school_admin/educator/coordinator`. **`kind: "coordinator"` (added #114, v6)** is now a supported creation kind alongside `student`/`teacher`/`admin` — it's a 1:1 mapping since the DB role constraint already spells it `coordinator`. |
| **`student-login`** | v3 | public (`--no-verify-jwt`) | Lets young students log in with `{class_id, student_number, password}`. Uses `service_role` only to look up the matching account within that class, then performs the **real** password check through a normal anon-key `signInWithPassword` (not a bypass). Every failure path returns one identical generic error to prevent enumeration. |
| **`update-student`** | v5 | required | Edit student / reset password. |
| **`update-teacher`** | v3 | required | Edit staff / reset password. |
| **`report-bug`** | v3 | public (`--no-verify-jwt`) | Backs the staff-only in-app bug button (`AdminCommon.bugReport`). Inserts a row into `bug_reports` and files the matching GitHub issue (labeled `user-report`, picked up by `bug-diagnose.yml`). Added 2026-07-16; not present in the 2026-07-15 revision of this doc. Full flow: `docs/bug-report-automation.md`. |

**Auth providers.** Staff: email+password or **Google OAuth**, gated by the
`hook_restrict_google_signups` before-user-created hook, which rejects any Google
sign-up whose email doesn't match a pre-provisioned account (calm, non-enumerating
403). Students: the synthetic-email shim above. No self-service signup anywhere.

---

## 4. Learning modules (`modules/`)

**30 registered rows in `modules`** — 29 launchable directories under
`gakuenza.com/modules/` plus one inactive anchor row (`kadaiban`, `is_active =
false`, `launch_url = null`, not a directory — it exists purely so Kadaiban
submissions can be recorded in `activity_results` under a `modules.id`). This
replaces the "twelve drills" / "13 modules" figures from earlier reviews —
always verify the count against the live `modules` table, not a note in a
doc. Grade coverage is now **complete for grades 1–6** in 算数/国語/理科(3–6)/
社会(3–6); 外国語 covers grades 3–6.

| Subject | Count | Modules |
|---|---|---|
| math (算数) | 6 | `sansu1`–`sansu6` |
| japanese (国語 + 漢検) | 9 | `kokugo1`–`kokugo6`, `kanken3`/`kanken4`/`kanken5` |
| science (理科) | 4 | `rika3`–`rika6` |
| social (社会) | 4 | `shakai3`–`shakai6` |
| english (英語) | 6 | `letstry1`, `letstry2`, `eigo5`, `nh6`, `nhvocab`, `eiken` |
| misc | 1 | `kadaiban` (anchor row only, not launchable) |

`nh6`'s catalog **display name** is `外国語 6年` (`name_en: "New Horizons
6"`) — deliberately paired with `eigo5`'s `外国語 5年` / `"New Horizons 5"`
so the hub reads as a consistent 5年/6年 pair
(`20260721000411_rename_nh6_display_name_to_eigo6`, the most recent migration
as of this review). The module **key stays `nh6`** — the migration is
display-name-only; a full rekey to `eigo6` is roadmapped as low priority, not
done. Don't confuse the display name with the key when searching the repo or
the DB.

**Common shape.** `index.html` (topbar with "← ハブへもどる" + account bubble) +
drill logic + data files + a **`<key>-report.js` adapter shim**. Scripts load
in a fixed order: `supabase.js` → `config.js` → `hub-common.js` → data/generators
→ the report shim → `app.js`. Two families:

- **Native** (25 modules: sansu1–6, kokugo1–6, rika3–6, shakai3–6, kanken3/4/5,
  eigo5, eiken): purpose-built `app.js` + generators/data + a
  `window.<Name>Report`.
- **Ported** (4 modules: nh6, nhvocab, letstry1, letstry2): kept their
  upstream engine; the shim strips out the app's old standalone login and
  private Supabase backend and re-points it at the shared session +
  `activity_results` (see `nh6/README.md`).

**The result-reporting contract.** Every shim resolves the same context —
`session.user.id`, `modules.id WHERE key=<key>`, and `enrollments → classes.school_id`
— then writes to `activity_results`. `activity_ref` is always
`"<module>/<part>/…/<timestamp>"`; the gradebook strips the trailing timestamp
(`assignmentKeyFromRef`) to group retries into one assignment column. Two paths:

- **Preferred/required:** `HubCommon.reportActivityWithItems(sb, {schoolId,
  classId, moduleId, userId, activityRef, score, maxScore, payload, items})` —
  inserts the summary row, then per-question rows into
  `activity_result_items` (best-effort; item failure never blocks the
  child's flow). Verified live (2026-07-21) as used by **24 modules**:
  sansu1–6, kokugo1–6, rika3–6, shakai4–6, kanken3/4/5, eigo5, eiken.
- **Hand-rolled (do not repeat) — 5 modules:** `nh6`, `nhvocab`, `letstry1`,
  `letstry2`, and **`shakai3`** insert into `activity_results` directly with
  the right column names but never write to `activity_result_items`, so the
  gradebook's per-question analysis has nothing to show for them. Note
  `shakai3` is **native**, not ported — it's not simply "the ported apps
  never got migrated"; a purpose-built module shipped this bug too, and
  `shakai4`/`shakai5`/`shakai6` (built later) correctly use the shared
  helper. A comment in `shakai-report.js` also records an earlier, now-fixed
  2026-07-09 bug (wrong column names `activity_key`/`detail`) that motivated
  standardizing on the shared helper in the first place — that specific bug
  is fixed; the missing-`activity_result_items` gap is not. See CLAUDE.md
  hard rule 2.

**Assignment / pacing config.** `class_modules.focus_units` (jsonb array of
canonical unit keys, or null = all) lets a class foreground specific units without
hiding the rest. **Five modules' runners actually read it** — `sansu3` (the
reference implementation: reads the union of focus keys across the student's
classes, fails soft to null = all units if any class is unscoped), plus
`kokugo3`, `rika4`, `sansu4`, and `shakai4` following the same pattern.
**`rika3` is NOT wired** despite `rika3-data.js` exposing a unit-key list "for
focus_units alignment" in a comment — it never queries `class_modules` and
ships no `modules/rika3/units.js`, so the assignment UI can't offer it a unit
picker; don't let the comment fool you. As of this review, **no
`class_modules` row actually has `focus_units` populated** (0 of 79) — the
plumbing is wired end-to-end but untested with a real assignment.

Unit keys live in each module's own `modules/<key>/units.js` (which
self-registers `window.MODULE_UNITS.<key>`; the assignment UIs lazy-load it via
`ModuleAssign.moduleUnitsFor`, async + cached) and must match the module's
internal keys exactly (`sansu3: u01–u17`, `kokugo3: kanji` + reading-unit
keys). **There is no shared registry file** — each module owns its own
`units.js`, and the old shared `hub/module-units.js` (repeatedly corrupted by
parallel-PR merges under a `.gitattributes merge=union` stopgap) was retired
for good in #94 (2026-07-18). Never reintroduce a shared append-only registry,
in JS or as a `modules` column.

---

## 5. Migrations & source-of-truth caveat

**Schema changes now go through `supabase/migrations/`** (adopted 2026-07-15;
see `supabase/README.md`). The prod ledger
(`supabase_migrations.schema_migrations`) and the repo's `migrations/` are
reconciled — **30 tracked migrations, 30 files, nothing pending**, verified
live via `list_migrations`. Most recent:
`20260721000411_rename_nh6_display_name_to_eigo6`. The chain runs from a
squashed baseline (`20260706000000_remote_schema.sql`, assembled by MCP
introspection of the live DB on 2026-07-15) through the security-hardening
and `is_platform_admin` P0 fixes, the Kadaiban build-out, and the ongoing
grade-1–6 module registrations.

The baseline is a **hand-assembled snapshot, not a `pg_dump`** — treat it as
reliable-but-verify (`supabase db pull` on a branch before trusting a
from-zero `db reset`). Going forward: in a CLI session use `supabase
migration new` + `db push`; in an agent/CI session use the MCP
`apply_migration` (it writes the ledger) **and** commit the matching
`supabase/migrations/<ts>_<name>.sql` file in the same PR. **Never apply
schema via `execute_sql`/dashboard** — that bypasses the ledger and is
exactly how the pre-adoption `db/` history accumulated in the first place.

**`db/` is the pre-adoption mirror, not an applied migration set — still
true, unchanged.** Its 17 files (2026-07-14/15 only) were transcribed by hand
*after* being applied via the dashboard/management API, before migration
tooling existed. Nothing replays it, nothing enforces it matches production,
and no new schema work goes there — new changes are exclusively
`supabase/migrations/` files from this point forward. Verify module-adjacent
or DB-adjacent state against the live DB (or this doc), never against `db/`.

---

## 6. Notable findings & open items

This section is a factual record of what's resolved and what's still open in
the DB/structure layer. For prioritization of what to work on next, see
`docs/ROADMAP.md` — this doc does not restate priorities.

**Resolved since the 2026-07-15 revision of this doc** (all verified live this
review, not just carried forward from the earlier addendum):

1. **`pg_cron` installed and wired.** The `pg_cron` extension (`1.6.4`) is
   installed; the `weekly-gradebook-snapshot` job runs Mondays 02:15 UTC
   (`15 2 * * 1`), `active = true`. `gradebook_snapshots` has real rows (4, as
   of this review) instead of the 0 the 2026-07-15 revision reported, so the
   karte trend line has data to render. See §3.6.
2. **`app_sessions` / `auth_audit_log` retired**, not just "unused." Both
   tables and their six supporting functions (`resolve_session`,
   `touch_session`, `revoke_all_sessions`, `log_failed_login`,
   `purge_expired_sessions`, `purge_old_audit_log`) were dropped
   (`db/2026-07-15_retire_app_sessions_and_audit_log.sql`). They no longer
   exist in the live schema — confirmed via `information_schema.routines`
   and `list_tables`. Do not reference them as live infrastructure.
3. **Educator read RLS tightened to taught classes.** `activity_results` /
   `activity_result_items` READ now scopes educators to their
   `class_teachers` rows rather than the whole school
   (`db/2026-07-15_scope_results_read_to_taught_classes.sql`); coordinators
   (previously absent from `ar_read`) were folded into the staff read.
4. **Dead/legacy files converted to redirect stubs**, confirmed live:
   `hub/dashboard.html` and `hub/admin/gradebook.html` are both now
   `<meta http-equiv="refresh">` redirects to their real destinations
   (`index.html` and `../gradebook/index.html` respectively), kept only so
   stale bookmarks/deep-links don't 404.
5. **`rika4` registration gap** (from the 2026-07-15 review) — fixed; `rika4`
   is registered and active, and every other grade-4/5/6 module across all
   four core subjects has since been registered the same way.
6. **`shakai3.subject` mislabel** — fixed; confirmed live `subject = 'social'`.
7. **The `is_platform_admin` client-write P0** (2026-07-17, not present in
   the 2026-07-15 revision) — closed via table-level `UPDATE` revoke +
   safe-column regrant; see §3.3.
8. **Shared `hub/module-units.js` registry retired** (#94, 2026-07-18) — each
   module now owns its own `units.js`; see §4.

**Still open (verified live this review)**

9. **`public_schools` / `public_classes` SECURITY DEFINER views** (linter
   ERROR) — still a **deliberate, documented exception**, unchanged reasoning
   from the prior review: they expose only id/name (and year/gumi) to
   anonymous pre-login users, and `security_invoker` would force granting
   anon SELECT on the base tables and leak far more (school
   `name_kana/code/status`, class `grade_level/subject/academic_year`).
10. **SECURITY DEFINER helper `EXECUTE` grants to anon/authenticated**
    (linter WARN) — still open by design. Live advisor output lists exactly
    the 8 `app_*` RLS helpers (`app_class_school`, `app_has_role`,
    `app_is_platform_admin`, `app_set_module_active`,
    `app_user_admin_school_ids`, `app_user_class_ids`,
    `app_user_school_ids`, `app_user_staff_school_ids`,
    `app_user_taught_class_ids`) as callable by both `anon` and
    `authenticated` — down from the "~15" the 2026-07-15 revision estimated
    once the session RPCs were retired (#2 above). Each is referenced by RLS
    policies (Postgres requires the querying role to hold EXECUTE) and
    exposes only the caller's own memberships; kept deliberately, not
    revisited this cycle.
11. **Leaked-password protection (HaveIBeenPwned) disabled** (linter WARN) —
    still an Auth-dashboard toggle, but now understood to be **blocked on the
    project's free tier** (a paid Auth feature), not merely un-toggled.
12. **Performance-advisor debt (2026-07-20 snapshot, reconfirmed live this
    review): 106 lints total** — 78 `multiple_permissive_policies`
    (overlapping PERMISSIVE policies per table/role/action; each is a real
    per-row cost since Postgres evaluates every matching policy), 14
    `unindexed_foreign_keys`, 13 `auth_rls_initplan` (RLS predicates that
    re-evaluate `auth.*()` per-row instead of once per statement), plus 1
    `unused_index`. Deferrable at current scale (a handful of schools, low
    hundreds of rows per table) but the fix pattern for `auth_rls_initplan`
    is well-known (wrap `auth.uid()` calls in `(select auth.uid())`) if this
    starts to matter.
13. **`class_modules.focus_units` still has zero real-world usage** — wired
    end-to-end in 5 module runners (§4) but no teacher has scoped an
    assignment yet (0 of 79 `class_modules` rows). Test the null/"all units"
    fallback path deliberately; it's the only path exercised so far.
14. **`bug_reports` has RLS enabled with no policies** (linter INFO) — by
    design: the table is only ever touched via the `report-bug` Edge
    Function's `service_role` client, so no client-facing policy is needed,
    but the linter flags it structurally regardless.

**Good practices already in place**

- The 2026-07-14 security hardening closed real holes: `modules` was previously
  RLS-off with anon write+TRUNCATE grants; `ar_insert` previously trusted
  client-supplied `school_id/class_id/score` (cross-tenant forgery + stored-XSS
  delivery vector); TRUNCATE was granted to anon/authenticated on every table;
  and the purge functions were PUBLIC-executable. All fixed and documented.
- `HubCommon.escapeHtml` is the enforced convention for any DB-originated string
  rendered into `innerHTML`, mitigating stored XSS in teacher/admin views.
- `provision-account` authorizes against the **target** school via a
  `service_role` query rather than trusting client claims, with rollback.
- `rls_auto_enable` (event trigger) auto-enables RLS on any newly created
  `public` table, closing off the "forgot to enable RLS" failure mode by
  construction.
- New-table TRUNCATE/UPDATE default-privilege hygiene is now a documented,
  repeated pattern (§3.3) rather than a one-time fix — caught and re-applied
  once already for the Kadaiban tables.

---

## 7. Summary

Gakuenza is a lean, deliberately server-less design: a static site plus Supabase,
with **RLS as the load-bearing security layer** and five Edge Functions for the
privileged edges. The domain model is clean and multi-tenant (school → class →
enrollment/assignment → result, now including the Kadaiban ink-annotation
surface as a parallel non-drill feature), the role system is coherent across
five tiers (including coordinator, now with end-to-end tooling to create and
scope one), and the client is well-factored into shared modules (`HubCommon`,
`AdminCommon`, `ModuleAssign`, `Gradebook`, per-module `MODULE_UNITS`) with a
single standardized result-reporting contract for the drills — though 5 of 29
modules (`nh6`, `nhvocab`, `letstry1`, `letstry2`, `shakai3`) still bypass the
per-question half of that contract (§4).

The operational gaps flagged in the 2026-07-15 revision of this doc are
**largely closed**: schema changes now go through a real, version-controlled
migration ledger (`supabase/migrations/`, 30 files, reconciled with the prod
ledger); `pg_cron` is installed and the gradebook-snapshot job runs weekly;
the dormant `app_sessions`/`auth_audit_log` subsystem was retired outright
rather than left half-wired; and educator read-scope was tightened to taught
classes. What remains open is smaller and more operational than structural:
a real (if deferrable at current scale) performance-advisor backlog (106
lints — mostly overlapping RLS policies and a few unindexed FKs, §6),
leaked-password protection blocked on the free tier, and `focus_units`
pacing config that's wired end-to-end but still untested against a real
teacher assignment. None of these block current use.
