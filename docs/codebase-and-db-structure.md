# Gakuenza — Codebase & Database Structure Review

_Review date: 2026-07-15 · Supabase project `ohnsawydclmsrgphasbn` (Gakuenza.com, ap-northeast-1, Postgres 17.6)_

Gakuenza (がくえん座) is a Japanese elementary/middle-school drill-and-gradebook
platform. It is a **pure static frontend** (no application server, no build step)
talking directly to **Supabase Cloud**. The entire security model rests on
**PostgreSQL Row-Level Security (RLS)** plus four Edge Functions for the few
operations a static site cannot perform. This document maps how the code and the
database are organized, how they relate, and where the notable risks and open
items are.

---

## 1. Repository layout

```
/
├── .github/workflows/deploy.yml   CI: rsync gakuenza.com/ → DreamHost on push to main
├── db/                            SQL migration MIRRORS (documentation only, see §5)
│   ├── 2026-07-14_security_hardening.sql
│   ├── 2026-07-14_gradebook_v2_schema.sql
│   ├── 2026-07-14_module_rls_widen.sql
│   ├── 2026-07-14_module_active_rpc.sql
│   ├── 2026-07-14_class_modules_focus_units.sql
│   ├── 2026-07-14_modules_recommended_grades.sql
│   └── 2026-07-15_register_rika3_module.sql
└── gakuenza.com/                  The deployed site (the ONLY thing rsynced)
    ├── index.html · features.html · onboarding.html · modules.html   marketing
    ├── marketing.css · style.css · logo/favicon assets
    └── hub/                        the authenticated app
        ├── config.js               Supabase URL + anon key (public by design)
        ├── supabase.js             vendored minified supabase-js (library, not app code)
        ├── hub-common.js           window.HubCommon — shared student-side helpers
        ├── module-units.js         window.MODULE_UNITS — canonical unit-key registry
        ├── module-assign-common.js window.ModuleAssign — class_modules writes + bulk pw
        ├── login.html · index.html · dashboard.html(legacy) · modules.html
        ├── grades.html · settings.html
        ├── admin/                  admin console (school_admin / coordinator / platform)
        │   ├── admin-common.js     window.AdminCommon — tier resolution + admin sidebar
        │   ├── teachers.html · students.html · class-detail.html · modules.html
        │   └── gradebook.html      redirect stub → ../gradebook/index.html
        ├── gradebook/              dedicated educator gradebook tool
        │   ├── gradebook-common.js window.Gradebook — context + class loading
        │   ├── index.html · assign.html · roster.html · observations.html
        │   ├── analysis.html · karte.html · print.html
        └── modules/                the learning drills (see §4)
            ├── sansu3 · kokugo3 · rika3 · shakai3          (native)
            ├── kanken3 · kanken4 · kanken5                 (native)
            └── nh6 · nhvocab · eiken · letstry1 · letstry2 (ported apps)
```

**Deployment.** `.github/workflows/deploy.yml` rsyncs only `./gakuenza.com/` to
DreamHost over SSH on every push to `main` (`-rltgoDzvc --delete`). Repo root
(`db/`, `.github/`, this `docs/` folder) is outside the rsync source and never
ships. There is no CI for tests, linting, or the database.

---

## 2. Runtime architecture

```
        Browser (static HTML/JS on gakuenza.com)
                │
    ┌───────────┼──────────────────────────────┐
    │ supabase-js (anon/publishable key)        │  Edge Functions (Deno)
    │  • PostgREST  /rest/v1  (tables/views)    │   • student-login   (public)
    │  • RPC        /rest/v1/rpc                 │   • provision-account (JWT)
    │  • GoTrue     /auth/v1  (sessions)         │   • update-student   (JWT)
    └───────────┬──────────────────────────────┘   • update-teacher   (JWT)
                ▼                                            │ service_role
         PostgreSQL 17 ◄───── RLS policies + SECURITY DEFINER helpers ─────┘
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

### 3.1 Tables (public schema, 15 tables)

| Table | Rows* | Purpose |
|---|---|---|
| `schools` | 4 | Tenants. `status ∈ {active,suspended,pending}`, unique `code`. |
| `profiles` | 457 | 1:1 with `auth.users`. `display_name`, `student_number`, `must_change_password`, **`is_platform_admin`**. |
| `school_members` | 6 | Staff membership. PK `(school_id,user_id)`, `role ∈ {school_admin,coordinator,educator,student}`. |
| `classes` | 25 | `year (1–6)` + `gumi (1–99)`; trigger derives `name`. Special-ed classes leave year/gumi null. Also legacy `grade_level/subject/academic_year`. |
| `enrollments` | 452 | Student↔class roster. PK `(class_id,user_id)`, `role ∈ {teacher,student}`. |
| `class_teachers` | 19 | Which classes an educator teaches (distinct from `enrollments` — see note). PK `(class_id,user_id)`. |
| `modules` | 12 | Drill catalog. Unique `key`, `subject` (check constraint), `launch_url`, `is_active`, `recommended_grades int[]`. |
| `school_modules` | 18 | Which modules a school has licensed/enabled. PK `(school_id,module_id)`, `enabled`, `config jsonb`. |
| `class_modules` | 51 | Per-class assignments. PK `(class_id,module_id)`, `due_date`, `total_items`, **`focus_units jsonb`** (null = all units). |
| `activity_results` | 1,359 | One row per drill attempt: `school_id,class_id,module_id,user_id,activity_ref,score,max_score,payload`. |
| `activity_result_items` | 7,682 | Per-question detail: `item_ref,category,prompt,correct,selected_answer,correct_answer` (answers stored as **text**). |
| `observation_records` | 55 | Teacher observations (unit-mode + free-notes): `subject,module_id,category,rating(A/B/C),note`, touched `updated_at`. |
| `grade_corrections` | 0 | Append-only audit of score edits: `activity_result_id,corrected_by,previous_score,new_score,reason`. |
| `gradebook_snapshots` | 0 | Weekly rollups for trend lines: `week_of,rollup jsonb,pinned_note`. **Not yet populated — see §6.** |
| `app_sessions` | 0 | Custom session table + `auth_audit_log` (0 rows). **Built but effectively unused — see §6.** |

_*Row counts are a 2026-07-15 snapshot._

### 3.2 Entity relationships

```
schools ─1─┬─< classes ─┬─< enrollments >─ profiles(students)
           │            ├─< class_teachers >─ profiles(educators)
           │            └─< class_modules >─ modules
           ├─< school_members >─ profiles(staff)
           └─< school_modules >─ modules

modules ─1─< activity_results ─1─< activity_result_items
                     └─< grade_corrections
classes/students ──< observation_records, gradebook_snapshots
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
  (written by a cron running as `service_role`).
- **`profiles`** — self + same-school visibility; a separate admin policy lets
  staff read/update profiles of members/enrolled students in their schools.

### 3.5 Triggers & derived data

| Trigger | Table | Effect |
|---|---|---|
| `classes_sync_name_trigger` | classes | Derives `name = "N年M組"` from year/gumi; leaves special-ed names untouched. |
| `class_modules_guard` | class_modules | `enforce_module_enabled()` — blocks assigning a module not enabled for the class's school. |
| `observation_records_touch_updated` | observation_records | Bumps `updated_at`. |

### 3.6 RPC / functions

- **`app_set_module_active(p_module, p_active)`** — SECURITY DEFINER; the only
  way to write `modules` from a client. Its `WHERE ... app_is_platform_admin()`
  makes it a no-op for anyone else (matches zero rows).
- **Session/audit maintenance** — `resolve_session`, `touch_session`,
  `revoke_all_sessions`, `log_failed_login`, `purge_expired_sessions`,
  `purge_old_audit_log`, plus the `rls_auto_enable` event trigger. All
  SECURITY DEFINER with pinned `search_path`. The purge functions have EXECUTE
  revoked from PUBLIC/anon/authenticated (granted only to `service_role`).

### 3.7 Views

`public_schools` (id, name) and `public_classes` (id, school_id, year, gumi,
name) are **SECURITY DEFINER** views exposing only a safe column subset to
**anonymous** users on the pre-login screen (so students can pick their school
and class before authenticating). This is a deliberate, documented exception to
the linter (see §6).

### 3.8 Edge Functions (Deno, the only `service_role` code)

| Function | JWT | Role |
|---|---|---|
| **`provision-account`** | required | The single privileged create endpoint. Verifies caller's JWT, confirms caller is school_admin of the **target** school (or platform admin) via a `service_role` query (never trusting client claims), then creates the auth user + profile + enrollment/membership with **best-effort rollback**. Students get synthetic emails `s{number}@{slug}-{id8}.students.gakuenza.com` (never real mailboxes). Maps the API's `admin/teacher` vocabulary to DB `school_admin/educator`. |
| **`student-login`** | public (`--no-verify-jwt`) | Lets young students log in with `{class_id, student_number, password}`. Uses `service_role` only to look up the matching account within that class, then performs the **real** password check through a normal anon-key `signInWithPassword` (not a bypass). Every failure path returns one identical generic error to prevent enumeration. |
| `update-student` | required | Edit student / reset password. |
| `update-teacher` | required | Edit staff / reset password. |

**Auth providers.** Staff: email+password or **Google OAuth**, gated by the
`hook_restrict_google_signups` before-user-created hook, which rejects any Google
sign-up whose email doesn't match a pre-provisioned account (calm, non-enumerating
403). Students: the synthetic-email shim above. No self-service signup anywhere.

---

## 4. Learning modules (`modules/`)

Twelve drills across subjects (registered rows in `modules`): `sansu3` (算数),
`kokugo3` (国語), `rika3` (理科), `shakai3` (社会), `kanken3/4/5` (漢検),
`nh6` / `nhvocab` / `eiken` / `letstry1` / `letstry2` (英語).

**Common shape.** `index.html` (topbar with "← ハブへもどる" + account bubble) +
drill logic + data files + a **`<key>-report.js` adapter shim**. Scripts load
in a fixed order: `supabase.js` → `config.js` → `hub-common.js` → data/generators
→ the report shim → `app.js`. Two families:

- **Native** (sansu3, kokugo3, rika3, shakai3, kanken3/4/5): purpose-built
  `app.js` + generators/data + a `window.<Name>Report`.
- **Ported** (nh6, nhvocab, eiken, letstry1/2): kept their upstream engine; the
  shim strips out the app's old standalone login and private Supabase backend and
  re-points it at the shared session + `activity_results` (see `nh6/README.md`).

**The result-reporting contract.** Every shim resolves the same context —
`session.user.id`, `modules.id WHERE key=<key>`, and `enrollments → classes.school_id`
— then writes to `activity_results`. `activity_ref` is always
`"<module>/<part>/…/<timestamp>"`; the gradebook strips the trailing timestamp
(`assignmentKeyFromRef`) to group retries into one assignment column. Two paths:

- **Preferred:** `HubCommon.reportActivityWithItems()` — inserts the summary row,
  then per-question rows into `activity_result_items` (best-effort; item failure
  never blocks the child's flow). Used by the native modules + eiken.
- **Legacy shim:** ported apps define a fresh `window.hk.syncQuizResult()` that
  inserts a summary-only row. A comment in `shakai-report.js` records the
  2026-07-09 bug (wrong column names `activity_key`/`detail`) that motivated
  standardizing on the shared helper.

**Assignment / pacing config.** `class_modules.focus_units` (jsonb array of
canonical unit keys, or null = all) lets a class foreground specific units without
hiding the rest. `sansu3` is the reference implementation: it reads the union of
focus keys across the student's classes but fails soft to null if any class is
unscoped. Unit keys must match `hub/module-units.js` exactly (`sansu3: u01–u17`,
`kokugo3: kanji/daizu`).

---

## 5. Migrations & source-of-truth caveat

**The `db/` folder is a documentation mirror, not an applied migration set.**
Every file's header says so explicitly: the repo has no `supabase/` CLI tooling,
and each change was applied to the live project directly via the Supabase
management API/dashboard, then transcribed here. Consequences:

- There is **no automated, ordered, reproducible migration history** in the repo.
  `db/` captures seven changes from 2026-07-14/15 but is not guaranteed complete
  or replayable, and the base schema (the original tables/policies) is not in the
  repo at all — it exists only in the live database.
- Nothing enforces that `db/*.sql` matches production. Drift is possible and
  invisible to code review.

Recommendation: adopt `supabase/migrations` (or the Supabase CLI) so schema
changes are version-controlled, ordered, and applied from the repo rather than
hand-mirrored after the fact.

---

## 6. Notable findings & open items

> **Remediation addendum (2026-07-15).** Findings 1–4 below were the state at
> review time; several have since been actioned on the live project (see
> `db/2026-07-15_*.sql` and `supabase/README.md`):
> - **#1 pg_cron** — installed; `weekly-gradebook-snapshot` job scheduled; the
>   snapshot builder added and history backfilled (1,006 rows, 4 weeks) so the
>   karte trend renders now. The purge jobs became moot (see #2).
> - **#2 app_sessions / auth_audit_log** — **retired** (tables + 6 functions
>   dropped); login already used GoTrue sessions.
> - **#3 educator read RLS** — tightened to taught classes on
>   `activity_results` / `activity_result_items`; coordinators (previously
>   absent from `ar_read`) folded into the staff read.
> - **#5 app_\* EXECUTE** — deliberately kept: those helpers are referenced by
>   RLS policies (Postgres requires the querying role to hold EXECUTE) and
>   expose only the caller's own memberships.
> - **#4 dead files** / **#7 leaked-password** — `dashboard.html` converted to
>   a redirect; leaked-password protection is still an Auth-dashboard toggle.
> Migration tooling was scaffolded under `supabase/` (Tier 3).

**Correctness / operational**

1. **`pg_cron` is not installed**, yet two pieces of the design depend on a
   scheduled job: (a) the weekly `gradebook_snapshots` rollup that feeds the
   karte trend line — the table has **0 rows** and the karte trend is therefore
   empty; and (b) the `purge_expired_sessions` / `purge_old_audit_log`
   maintenance jobs, which never run. Either install and schedule these jobs, or
   remove the dependence and update the docs. (`get_edge_function`/`list_extensions`
   confirm no `pg_cron`; the gradebook_v2 SQL header describes the intended job.)
2. **`app_sessions` / `auth_audit_log` are built but unused** (0 rows each). The
   login flow uses standard GoTrue sessions, not the custom `app_sessions` table
   or its `resolve/touch/revoke` RPCs. This is dormant infrastructure — either
   wire it in or retire it to avoid confusion.
3. **Educator read RLS is broader than the UI.** `activity_results` /
   `activity_result_items` READ is still school-wide for educators, while the
   gradebook UI scopes to taught classes. This is a known, documented follow-up
   (noted in `admin-common.js::requireGradebookAccess`), not silently assumed done.
4. **Dead/legacy files:** `hub/dashboard.html` is superseded by `hub/index.html`,
   and `hub/admin/gradebook.html` is only a redirect stub. Safe to remove once
   confirmed nothing links to them.

**Security posture (Supabase advisors)**

5. **`public_schools` / `public_classes` SECURITY DEFINER views** (linter ERROR):
   this is a **deliberate, documented exception**. They expose only id/name (and
   year/gumi) to anonymous pre-login users. Converting to `security_invoker` would
   force granting anon SELECT on the base tables and leak far more (school
   `name_kana/code/status`, class `grade_level/subject/academic_year`). Keep as-is.
6. **~15 SECURITY DEFINER helper functions executable by anon/authenticated**
   (linter WARN). These are the RLS helpers (`app_*`) plus session RPCs. Being
   callable is largely by design (RLS invokes them; `student-login` support). Worth
   a pass to `REVOKE EXECUTE` on any that never need to be called directly over the
   REST RPC surface (e.g. `app_class_school`, the `app_user_*_ids` helpers) to
   shrink the anonymous attack surface, even though they leak nothing on their own.
7. **Leaked-password protection (HaveIBeenPwned) is disabled** (linter WARN). It's
   an Auth setting, not SQL — enable in Dashboard → Authentication → Policies.

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

---

## 7. Summary

Gakuenza is a lean, deliberately server-less design: a static site plus Supabase,
with **RLS as the load-bearing security layer** and four Edge Functions for the
privileged edges. The domain model is clean and multi-tenant (school → class →
enrollment/assignment → result), the role system is coherent across five tiers,
and the client is well-factored into shared modules (`HubCommon`, `AdminCommon`,
`ModuleAssign`, `Gradebook`, `MODULE_UNITS`) with a single standardized
result-reporting contract for the drills.

The main structural gaps are operational rather than architectural: **no
in-repo migration tooling** (schema lives only in the live DB, `db/` is a
hand-kept mirror), a **missing `pg_cron`** that leaves the snapshot-rollup and
purge jobs unwired, and some **dormant/half-wired subsystems** (`app_sessions`,
gradebook snapshots, educator read-scope tightening). None of these block current
use, but closing them would make the platform reproducible and let the karte
trend and session-audit features actually function.
