# Gakuenza — Project Handbook

_The single entry point to the project. Last updated: 2026-07-21._

> **What this document is.** A comprehensive, authoritative overview of
> Gakuenza — its purpose, scope, architecture, database, codebase,
> roadmap, documentation, and working process. It is the map to the
> other maps: where a topic has a dedicated deep-reference doc, this
> handbook summarizes it and points there rather than duplicating it
> (duplication drifts). If you read one file to understand the project,
> read this. If you're about to change DB- or auth-adjacent code, also
> read `CLAUDE.md` (the standing rules) and
> `docs/codebase-and-db-structure.md` (the deep map).
>
> **What this document is not.** It is not the priority queue (that's
> `docs/ROADMAP.md`) and not the standing ruleset (that's `CLAUDE.md`).
> When those disagree with this handbook on a live number or a current
> priority, they win — this is the orientation layer, they are the
> operational source of truth.

---

## 1. Purpose & product

**Gakuenza (がくえん座)** is a learning platform for Japanese public
elementary schools. It gives students self-paced drill practice aligned
to the national curriculum (算数 math, 国語 Japanese, 理科 science,
社会 social studies, 外国語 English), gives teachers a gradebook with
per-question analysis and weekly trend snapshots, and gives school and
platform administrators the tools to provision classes, staff, and
students.

- **Pilot school:** 羽咋市立瑞穂小学校 (Mizuho Elementary, Hakui City,
  Ishikawa) — the only school with real student usage today (106
  students, 9 classes, 7 staff). A second Hakui-city school
  (羽咋市立羽咋小学校) is provisioned but not yet populated with students.
- **Who it serves (five tiers):** platform admins (Gakuenza staff),
  school admins, coordinators (multi-school oversight), educators
  (classroom teachers), and students.
- **Design ethos:** young children are the primary users, so the student
  surfaces favor legibility and low friction (e.g. login by
  class + attendance number rather than an email; passwords in an
  unambiguous alphabet teachers can read aloud). Content is built
  original against the curriculum's skills and facts — never reproducing
  a textbook's actual passages or problems (see "Copyright" in
  `CLAUDE.md`).

---

## 2. Scope

**In scope (what exists today):**
- A static, framework-free web frontend (plain HTML/CSS/JS, no build step).
- A Supabase backend: Postgres + Row-Level Security + Auth + Edge Functions + Storage.
- A complete grades 1–6 core curriculum grid of drill modules (see §6/§7).
- A five-tier role/permission model enforced at the database layer.
- A real gradebook (results, per-question items, observations, weekly snapshots).
- **Kadaiban (課題板)** — handwriting-worksheet annotation + submission (the
  first non-drill feature and first use of file storage).
- An in-app staff bug-report button feeding an automated GitHub triage pipeline.
- Automated deploy on merge to `main`.

**Explicitly out of scope (decided against — see `docs/planning/FEATURE_BACKLOG.md` R1–R4):**
- Student-to-student direct messaging / chat.
- A student-facing AI tutor.
- Public leaderboards / competitive ranking.
- A native mobile app.

**Architectural boundary that defines scope:** there is **no application
server**. The browser talks to Postgres directly (via PostgREST) using a
public anon key. Everything a static site cannot safely do — creating auth
accounts, resetting passwords, opening GitHub issues — lives in a small set
of `service_role` Edge Functions. This keeps the system cheap and simple,
and it makes **Row-Level Security the real security boundary**, not client
code.

---

## 3. Architecture & infrastructure

```
Browser (static site)  ──PostgREST + anon key──▶  Supabase Postgres (RLS enforced)
      │                                                    ▲
      │                                                    │ service_role
      └──── HTTPS ────▶  Edge Functions (Deno) ────────────┘
                         provision-account, update-student,
                         update-teacher, student-login, report-bug
```

- **Frontend hosting:** the `gakuenza.com/` directory is served as a static
  site on **DreamHost**. Nothing outside `gakuenza.com/` ships.
- **Backend:** **Supabase Cloud** (project `ohnsawydclmsrgphasbn`, region
  `ap-northeast-1`, Postgres 17). The browser reads/writes Postgres directly
  through the anon/publishable key shipped in `gakuenza.com/hub/config.js`
  (intentionally public — security is RLS, not key secrecy).
- **Privileged operations:** five Deno Edge Functions hold the only
  `service_role` code (see §5).
- **Deploy pipeline:** `.github/workflows/deploy.yml` — on every `push` to
  `main`, an rsync-over-SSH (`--delete`) mirrors `gakuenza.com/` to DreamHost.
  **Merges to `main` go live automatically**, with no further manual step.
  Because rsync uses `--delete`, a renamed/removed file disappears from prod
  on the next deploy (this is why directory/`launch_url` renames need
  deploy-ordering care — see §9).
- **Backend changes deploy separately** from the frontend: schema via the
  migration ledger, Edge Functions via `supabase functions deploy` / MCP
  `deploy_edge_function`. Neither is triggered by the frontend rsync.
- **Known infrastructure notes:** DreamHost deploys occasionally fail on a
  transient SSH connection timeout (re-runs or the next push resolve it — it
  is not a code problem). There is **no CI test suite** (`test.yml` does not
  exist) despite per-module tests existing in `tests/` — the single biggest
  reliability gap (see §7, §9).

---

## 4. The database

Supabase Postgres, **20 tables in the `public` schema, all with RLS enabled.**
The deep, policy-by-policy reference is `docs/codebase-and-db-structure.md`
(note: that doc's row counts predate mid-July and are stale; the live figures
below are current as of 2026-07-21).

### 4.1 Schema by domain

**Tenancy & identity**
| Table | Purpose |
|---|---|
| `schools` | Tenants. `status ∈ {active,suspended,pending}`, unique `code`. |
| `profiles` | 1:1 with `auth.users`. Carries `student_number`, `must_change_password`, `home_school_id` (**intentionally NULL for real schools** — see §6), and `is_platform_admin` (the master key). |
| `school_members` | Staff membership, PK `(school_id, user_id)`. `role ∈ {school_admin, coordinator, educator}` (+ a legacy student row). |
| `classes` | `year` (1–6) / `gumi`, trigger-derived `name`. |
| `enrollments` | Student↔class roster, PK `(class_id, user_id)`, `role ∈ {student, teacher(legacy)}`. |
| `class_teachers` | Modern "who teaches this class," PK `(class_id, user_id)`. |

**Catalog & assignment**
| Table | Purpose |
|---|---|
| `modules` | Drill catalog, unique `key`. `subject` (CHECK: english/math/japanese/science/social/sougou/misc), `launch_url` (absolute; null = not launchable), `is_active`, `recommended_grades int[]`, `publisher`. |
| `school_modules` | Per-school licensing, PK `(school_id, module_id)`, `enabled`, `config`. |
| `class_modules` | Per-class assignment/pacing, PK `(class_id, module_id)`. `due_date`, `total_items`, `focus_units jsonb` (null = all units). |

**Results & gradebook**
| Table | Purpose |
|---|---|
| `activity_results` | One row per drill attempt (`activity_ref`, `score`, `max_score`, `payload`). |
| `activity_result_items` | Per-question detail (prompt, correct, selected/correct answer). |
| `observation_records` | Teacher observations (rating A/B/C + notes). |
| `grade_corrections` | Append-only audit of manual score edits. |
| `gradebook_snapshots` | Weekly rollups for the trend line; written by `pg_cron`, read-only to clients. |

**Kadaiban (課題板)** — `kadaiban_assignments`, `kadaiban_assignment_pages`,
`kadaiban_submissions`, `kadaiban_submission_pages`. A teacher uploads a
worksheet image; students annotate on a canvas; teachers grade. First
subsystem to use Supabase Storage.

**Misc** — `bug_reports` (staff bug button → GitHub issues; RLS-enabled with
**zero policies**, so it is reachable only via the `report-bug` Edge Function's
`service_role`).

### 4.2 Roles & Row-Level Security

RLS is the security boundary. Client-side tier checks (`admin-common.js`,
`gradebook-common.js`) are UX gating only.

| Tier | Determined by | Scope |
|---|---|---|
| **platform_admin** | `profiles.is_platform_admin` | Every school. Only tier that creates schools / retires modules. **Never client-writable** (column-grant lockdown). |
| **school_admin** | `school_members.role='school_admin'` | Full admin of one school. |
| **coordinator** | `school_members.role='coordinator'` | Class/enrollment/assignment management across their school(s); cannot create staff, reset passwords, or license modules. |
| **educator** | `role='educator'` + `class_teachers` | Gradebook, scoped to taught classes. |
| **student** | `enrollments.role='student'` | Own hub / results. |

Policies are expressed through `SECURITY DEFINER` helper functions (all
`STABLE`, `search_path=public`): `app_is_platform_admin()`,
`app_has_role(school, roles[])`, `app_user_school_ids()`,
`app_user_admin_school_ids()`, `app_user_staff_school_ids()`,
`app_user_class_ids()`, `app_user_taught_class_ids()`,
`app_class_school(class)`. Reads and writes are layered (self vs.
staff-of-school vs. taught-class); e.g. `activity_results` is readable as
own-rows OR staff-of-school OR teacher-of-class, and student inserts are
constrained to their own `user_id`, an enrolled class, the derived
`school_id`, and `0 ≤ score ≤ max_score`. `modules` is world-readable and
has **no write policy** — its `is_active` flips only through the
platform-admin-guarded `app_set_module_active` RPC.

**Two security invariants that must never regress** (both back real incidents):
1. `profiles.is_platform_admin` is protected by **column-level grants** — never
   `GRANT UPDATE ON public.profiles` at the table level (that reopens a
   coordinator self-escalation P0 from 2026-07-17).
2. New tables must explicitly `revoke truncate` from `anon, authenticated`
   (Supabase's default privileges re-grant `TRUNCATE`, which bypasses RLS).

### 4.3 Edge Functions (the only `service_role` code)

| Function | Public? | What it does |
|---|---|---|
| `provision-account` | No (JWT) | The single privileged account-creation endpoint. Re-verifies the caller is platform admin or `school_admin` of the target school, then creates the auth user + profile + membership/enrollment with rollback. Accepts `kind ∈ {student, teacher, admin, coordinator}`. |
| `update-student` | No (JWT) | Edit a student's name/number/class/password; rebuilds the synthetic login email only when it changed. |
| `update-teacher` | No (JWT) | **Top-tier only** (school_admin/platform admin, not coordinators) — edit a staff member's name/password. |
| `student-login` | **Yes** | Login by `{class_id, student_number, password}` (no email). Uses `service_role` only to look up the account, then a normal `signInWithPassword` for the real credential check. Uniform generic error on every failure (enumeration-resistant). |
| `report-bug` | **Yes** (staff-gated in-code) | Staff bug button → GitHub issue (label `user-report`) + a `bug_reports` row. Verifies JWT and staff role in-code, rate-limited per reporter. |

The two public functions (`verify_jwt=false`) perform their own JWT/role
checks in code, since they must be reachable before a session exists
(`student-login`) or need custom gating (`report-bug`).

### 4.4 Storage

Two **private** buckets (10 MB, image/png|jpeg): `kadaiban-sources` (teacher
worksheet images) and `kadaiban-submissions` (flattened student work).
`storage.objects` RLS is path-segment based (`<assignment_id>/<student_id>/…`)
and scoped to `authenticated` only — no anon access.

### 4.5 Migrations & the ledger

- Schema changes go through **`supabase/migrations/`** (29 files as of
  2026-07-21, `20260706000000` … `20260721000411`), reconciled with the prod
  ledger `supabase_migrations.schema_migrations`.
- The baseline `20260706000000_remote_schema.sql` is a hand-assembled snapshot
  (not `pg_dump`) — verify with `supabase db pull` before trusting a
  from-zero reset.
- **`db/` is a documentation mirror only** — transcribed after being applied
  by hand, replayed by nothing. A file existing there does **not** mean it
  ran. New schema work never goes there.
- Allowed change paths: CLI (`supabase migration new` → `db push`) **or**
  agent/CI (MCP `apply_migration`, which writes the ledger, **plus** commit
  the matching migration file in the same PR). Never `execute_sql`/dashboard
  DDL — that bypasses the ledger and is how the pre-adoption drift accumulated.

---

## 5. The codebase

No build step, no framework. Everything under `gakuenza.com/` is shipped as-is.

### 5.1 Layout

```
gakuenza.com/                     ← the ONLY deployed directory
├── index.html, features.html, onboarding.html, modules.html   ← public/marketing
├── style.css                     ← shared root stylesheet — modules must NEVER link this
├── hub/                          ← the authenticated app
│   ├── config.js                 ← public Supabase URL + anon key
│   ├── supabase.js               ← vendored supabase-js
│   ├── hub-common.js             ← window.HubCommon (sidebar, escapeHtml, reportActivityWithItems, …)
│   ├── module-assign-common.js   ← window.ModuleAssign (class_modules CRUD, moduleUnitsFor, …)
│   ├── hub-shell.css             ← page frame / sidebar (hub pages may link this + style.css)
│   ├── index.html, login.html, grades.html, settings.html, …
│   ├── kadaiban.html, kadaiban-draw.js   ← student Kadaiban surface + canvas
│   ├── admin/                    ← admin console (school_admin / coordinator / platform_admin)
│   │   ├── admin-common.js       ← window.AdminCommon (tier resolution, bug button)
│   │   ├── admin.css             ← SELF-CONTAINED (copies tokens, omits the button{width:100%} footgun)
│   │   └── schools/teachers/students/class-detail/modules .html
│   └── gradebook/                ← educator tool
│       ├── gradebook-common.js   ← window.Gradebook (context, class loading, nav)
│       └── index/assign/roster/observations/analysis/karte/print/kadaiban .html
└── modules/<key>/                ← 29 drill modules (see §6)

supabase/   functions/ · migrations/ (real ledger) · config.toml · seed.sql · README.md
docs/       this handbook · ROADMAP · codebase-and-db-structure · bug-report-automation ·
            second-school-onboarding · planning/ · specs/(pending|completed)/
tests/      per-module test dirs (13/29 modules) — NOT wired to CI
db/         documentation mirror only (pre-adoption history)
.github/    workflows/ (deploy, bug-diagnose, bug-autofix, auto-build-module)
```

### 5.2 The module system

Each drill is a self-contained directory:

```
gakuenza.com/modules/<key>/
├── index.html
├── <content/generator files>.js
├── <key>-report.js         ← reporting adapter
├── units.js                ← optional: self-registers window.MODULE_UNITS.<key>
└── style.css               ← FULLY self-contained
```

Load order: `supabase.js → config.js → hub-common.js → data/generators → report shim → app.js`.

**Unit scoping is decentralized.** A unit-scoped module ships its own
`units.js` self-registering `window.MODULE_UNITS.<key> = [{key,label}, …]`,
whose keys must exactly match the module's internal unit keys. The assignment
UIs lazy-load a module's `units.js` on demand (`moduleUnitsFor`, async +
cached). **There is no shared registry and never should be** — the old shared
`hub/module-units.js` corrupted repeatedly under parallel PRs and was deleted
(#94/#99). Do not reintroduce a shared append-only registry, in JS or as a
`modules` column.

### 5.3 The hard rules (from `CLAUDE.md` — each backed by a shipped bug)

1. **Every module's `style.css` is fully self-contained** — copies the design
   tokens literally, never links the root `style.css` (whose generic
   `button{width:100%}` has broken production four times). Font: Zen Maru
   Gothic for display text.
2. **Always report via `HubCommon.reportActivityWithItems(...)`** — never
   hand-roll the `activity_results` insert. Five modules currently violate
   this (`nh6`, `nhvocab`, `letstry1`, `letstry2`, `shakai3`): they populate
   `activity_results` but not `activity_result_items`, so per-question analysis
   has nothing to show. This is the largest gradebook-data gap (roadmap debt #1).
3. **Resolve student context via `enrollments → classes.school_id`**, never
   `profiles.home_school_id` (which is intentionally NULL for real schools;
   setting it hits a per-school uniqueness collision).
4. **`launch_url` is always absolute** (`/modules/<key>/index.html`).
5. **Registration migrations are idempotent** (update-then-insert-if-absent),
   set `is_active` explicitly, use a `subject` matching the real CHECK
   constraint (`english/math/japanese/science/social/sougou/misc`), and
   include `publisher`.

### 5.4 Testing bar (aspirational — enforced by convention, not CI)

Per `CLAUDE.md`: generators stress-tested at scale (hundreds–thousands of
instances, checking structural bugs *and* distractor-collision bugs); a real
headless-browser flow test asserting the shared reporter populated
`activity_result_items`; migration idempotency. Tests exist in `tests/` for 13
of 29 modules but **no workflow runs them** — see §9.

---

## 6. Modules (curriculum coverage)

**30 registered modules** (29 launchable directories + the non-launchable
`kadaiban` reporting anchor). The grades 1–6 core grid is **complete**.

| Subject | Modules | Coverage |
|---|---|---|
| 算数 math | sansu1–6 | grades 1–6 ✅ |
| 国語 Japanese | kokugo1–6 | grades 1–6 ✅ |
| 理科 science | rika3–6 | grades 3–6 (not taught below 3) ✅ |
| 社会 social | shakai3–6 | grades 3–6 ✅ |
| 外国語 English | letstry1 (G3), letstry2 (G4), eigo5 (G5), nh6 (G6) | grades 3–6 ✅ |
| supplementary | kanken3/4/5 (漢検), eiken (英検), nhvocab (NH vocab) | cross-grade |
| misc | kadaiban | reporting anchor, `is_active=false` |

Note: `nh6`'s display name is "外国語 6年" (paired with eigo5) but its module
`key`/directory remains `nh6`; a full rekey to `eigo6` is roadmapped low-priority.

---

## 7. Roadmap & current status

The authoritative, continuously-updated priority queue is **`docs/ROADMAP.md`**;
domain detail lives in `docs/planning/{MODULE_ROADMAP, FEATURE_BACKLOG,
UI_REDESIGN, KADAIBAN_design}.md`. Snapshot as of 2026-07-21:

**Complete / shipped:** the grades 1–6 curriculum grid; Kadaiban Phase 1;
coordinator management (create + multi-school scope); the bug-report automation
(5 real autofixes shipped); decentralized module units.

**Near-term debt (open items, from `docs/ROADMAP.md`):**
1. Fix the 5 hand-rolled reporters to populate `activity_result_items`.
2. Wire `rika3` into `focus_units` (+ ship its `units.js`).
3. Revoke EXECUTE on RLS-internal `app_*` helpers (security-advisor pass).
4. Turn on leaked-password protection (Auth dashboard toggle — needs console access).
5. ~~Decentralize module units~~ ✅ done.
6. Stand up a CI test suite (tests exist, nothing runs them).
7. Pay down RLS performance debt (78 multiple-permissive-policies, 13
   auth-initplan, 14 unindexed FKs) — cheap now, expensive at multi-school scale.
8. Full `nh6 → eigo6` rekey (low priority, cosmetic, deploy-ordering risk).

**Open decision points (not yet chosen):** where next-quarter effort should
go — feature depth (F1 assignment dashboard, F16 offline resilience), reach
(second-school rollout), or reliability (CI + advisor automation + the perf
debt). The data argues that real usage is still minimal (one active school),
which tends to favor reach/adoption before deeper infrastructure investment.

**Deliberately not proposing:** the R1–R4 items in §2.

---

## 8. Documentation map & update processes

| Doc | Role | Authority |
|---|---|---|
| `CLAUDE.md` | Standing, load-bearing rules; loaded every session. | **Authoritative, always-current.** |
| `docs/PROJECT_HANDBOOK.md` (this file) | Orientation / single entry point. | Overview layer; defers to the operational docs on live specifics. |
| `docs/ROADMAP.md` | Single-source priority queue + progress log + near-term debt. | **Authoritative for "what's next."** |
| `docs/codebase-and-db-structure.md` | Deep architecture/DB/RLS map. | Authoritative deep reference; **some row counts are stale** — cross-check live. |
| `docs/planning/MODULE_ROADMAP.md` | Curriculum-module domain detail. | Authoritative for the module domain. |
| `docs/planning/FEATURE_BACKLOG.md` | Product features F1–F17 + the R1–R4 "don't build" list. | Authoritative for the feature domain. |
| `docs/planning/UI_REDESIGN.md` | UI quality audit + the (not-yet-authored) Module UI Kit plan. | Authoritative for the design domain. |
| `docs/planning/KADAIBAN_design.md` | Kadaiban build spec (Phase 1 = record, Phase 2 = spec). | Authoritative for Kadaiban. |
| `docs/bug-report-automation.md` | The bug pipeline (setup, flow, guardrails). | Authoritative for that subsystem. |
| `docs/second-school-onboarding.md` | Ordered runbook to stand up a new school. | Authoritative living runbook. |
| `supabase/README.md` | Migration workflow / ledger relationship. | Authoritative for the migration process. |
| `docs/specs/pending/` → `completed/` | Spec queue for the auto-builder (see §9). | Process directories. |
| `db/*.sql` | Pre-adoption history. | **Mirror only — not applied migrations.** |

**Update processes:**
- **Roadmap** is edited in place — progress appended chronologically, debt items
  struck through with `done <date> (#N)` rather than deleted, "what's next"
  kept as pointers into the domain docs (to prevent drift).
- **Specs** flow `authored → docs/specs/pending/ → (auto-build) → docs/specs/completed/`;
  the builder moves the file as part of the same PR so it isn't re-picked-up.
  Non-module specs (schema/admin changes) are placed *outside* `pending/` so
  they don't trigger the module builder, and are built by a human/agent directly.
- **Migrations** follow the ledger discipline in §4.5.
- **This handbook** should be refreshed when a structural fact changes (a new
  table/function/edge function, a new subsystem, a change to the deploy or
  role model) — not for every roadmap tick.

---

## 9. Workflows & chain of command

Two overlapping systems govern change: the **automated pipelines** (CI/CD +
bug automation) and the **human/agent working process**.

### 9.1 Automated pipelines (`.github/workflows/`)

All three Claude-driven workflows authenticate with the Claude **subscription**
(`CLAUDE_CODE_OAUTH_TOKEN`), not API billing, and run Sonnet.

| Workflow | Trigger | Does | Boundary |
|---|---|---|---|
| `deploy.yml` | push to `main` | rsync `gakuenza.com/` → DreamHost | frontend only |
| `bug-diagnose.yml` | issue opened w/ label `user-report` | Read-only investigation → posts a **Stage-1 diagnosis** comment | **never edits, never PRs** |
| `bug-autofix.yml` | issue **labeled** `approved-for-autofix` (human gate) | Attempts the smallest correct fix → opens a PR | **PR only, never auto-merges** |
| `auto-build-module.yml` | push to `main` touching `docs/specs/pending/**` | Builds the spec'd module, runs the testing bar, moves the spec to `completed/` | **PR only** |

The bug pipeline's **chain of command** is deliberate: a `user-report` issue is
auto-diagnosed (comment only); a **human must add `approved-for-autofix`** before
any code is written; the resulting PR is reviewed and merged by a human. The
in-app bug button (staff-only) is the entry point (`AdminCommon.bugReport` →
`report-bug` → `bug_reports` → GitHub issue).

**The CI gap:** there is no `test.yml`. No lint, no generator stress test, no
flow test runs on any PR, even though 13/29 modules have hand-run tests ready.
This is the cheapest reliability win on the roadmap (debt #6).

### 9.2 Human / agent working process

The working discipline demonstrated across recent sessions:

1. **Branch → PR → review → merge → auto-deploy.** Never push to `main`; open a
   PR. Merging is a human act; the merge is what deploys the frontend.
2. **Verify, don't trust.** Before shipping a fix — including an
   auto-diagnosis's proposed fix — read the actual code and confirm the claim.
   (Recent example: an auto-diagnosis called a change to `admin-common.js`
   "unnecessary"; reading the code showed it was the crux of the bug.)
3. **Review is not optional for sensitive surfaces.** Auth-tier resolution,
   RLS, the privileged Edge Functions, and any DB write path get read line by
   line, whatever produced the diff.
4. **Deploy-ordering rules** (backend deploys are separate from the frontend rsync):
   - **Schema:** apply via MCP `apply_migration` (writes the ledger) and commit
     the matching file in the same PR. A module **registration** migration is
     applied only *after* the frontend deploys, or the hub lists a card whose
     `launch_url` 404s.
   - **Edge Functions:** a source change in the repo does nothing until the
     function is redeployed (`supabase functions deploy` / MCP
     `deploy_edge_function`). Backward-compatible function changes can be
     deployed before the frontend that uses them; breaking ones must be
     sequenced.
   - **Directory/`launch_url` renames:** rsync `--delete` swaps the directory
     on merge, so update the DB `launch_url` right after the deploy (the same
     404 window as registrations).
5. **Data-correctness checks are the author's job.** Confirm live state before
   and after a destructive or schema-adjacent change (e.g. verify blast radius
   before deleting a school; verify a migration's effect against the live DB).
6. **No secrets in the repo.** Edge Functions read secrets from `Deno.env`;
   `config.js` ships only the public anon key by design.
7. **Watch for the raw-NUL-byte class of bug** — a literal control character in
   source makes git treat a file as binary and hides diffs from review; use the
   `'\u0000'` escape, never a raw byte.

### 9.3 Who can do what (authority summary)

- **Platform admin:** creates schools, retires modules, sets coordinator scope,
  provisions any account. The `is_platform_admin` flag is set only via migration
  / `service_role`, never the client.
- **School admin:** full admin within one school (create staff/students, license
  modules, assign).
- **Coordinator:** class/enrollment/assignment management across their scoped
  school(s); cannot create staff, reset passwords, or license modules.
- **Educator:** gradebook for taught classes.
- **Student:** own practice and results.

Every one of these is enforced by RLS at the database, with the client tiers as
UX convenience only.

---

## 10. Quick reference (live snapshot, 2026-07-21)

- **Schools:** 2 — Mizuho (active; 9 classes, 106 students, 7 staff),
  羽咋小学校 (active; 6 classes, 0 students, 2 staff).
- **Modules:** 30 (japanese 9, english 6, math 6, science 4, social 4, misc 1).
- **Public tables:** 20 (all RLS-enabled). **Edge Functions:** 5.
  **Storage buckets:** 2. **Migrations:** 29.
- **Supabase project:** `ohnsawydclmsrgphasbn` (ap-northeast-1, Postgres 17).
- **Repo:** `QrowZK/Gakuenza`. **Deploy:** rsync to DreamHost on push to `main`.
- **Advisors (2026-07-20 pass):** security — no net-new holes beyond documented,
  accepted exceptions; performance — 106 lints (78 multiple-permissive-policies,
  13 auth-initplan, 14 unindexed FKs), all deferrable at current scale.

---

_Maintainers: keep this handbook's structural facts in sync with reality;
defer live numbers and priorities to `docs/ROADMAP.md` and the domain docs.
When in doubt, `CLAUDE.md` is the standing rule of law._
