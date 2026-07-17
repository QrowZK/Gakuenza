# CLAUDE.md — Gakuenza

Standing context, loaded automatically at the start of every session in
this repo. This is not a one-time briefing — treat every rule here as
currently true and load-bearing, not historical trivia.

## What this is

Static-frontend learning platform for Japanese elementary schools
(pilot: 羽咋市立瑞穂小学校, Hakui City, Ishikawa). No build step, no
framework — plain HTML/CSS/JS. Backend is Supabase (Postgres + RLS +
Auth + Edge Functions). The browser talks to Postgres directly via the
public anon key; **RLS is the real security boundary, not client
code.** Deploy is GitHub → Actions → rsync to DreamHost on push to
`main` — commits here go live without further manual steps once
merged.

**Deep reference:** `docs/codebase-and-db-structure.md` is a full,
current map of the repo layout, runtime architecture, every table +
RLS policy, the five-tier role model, and the Edge Functions. Read it
before any nontrivial change to DB-adjacent or auth-adjacent code —
this file is only the load-bearing rules, that one is the map.

## Module directory convention

```
gakuenza.com/modules/<key>/
├── index.html
├── <content/generator files>.js
├── <key>-report.js
└── style.css   — fully self-contained, see rule below
```

## Hard rules — each backed by a real shipped bug, not a style preference

1. **Every module's `style.css` copies token values literally and
   never links the shared root `style.css`.** The shared stylesheet's
   generic `button { width:100% }` rule has broken production four
   separate times when a zone depended on it instead of being
   self-contained. Standard tokens to copy:
   ```css
   --ink: #1c2530; --ink-soft: #3a4555; --paper: #f7f3ea;
   --paper-dim: #efe9db; --border: #d8d2c2; --moss: #4a6b4f;
   --moss-deep: #34503a; --moss-tint: #e8ede6; --gold: #c9a24b;
   --clay: #b5572e; --error: #a23b2e;
   ```
   Font: Zen Maru Gothic for display text.

2. **Always use `HubCommon.reportActivityWithItems(sb, {schoolId,
   classId, moduleId, userId, activityRef, score, maxScore, payload,
   items})` for reporting. Never hand-roll the `activity_results`
   insert.** Five modules currently do (`nh6`, `nhvocab`, `letstry1`,
   `letstry2`, `shakai3`) — they got the `activity_results` column
   names right but never write to `activity_result_items`, so the
   gradebook's per-question analysis has nothing to show for them.
   Live, unfixed, don't repeat it (and note it's five, not the three
   this file once claimed — the ported English apps `nh6`/`nhvocab`/
   `letstry1`/`letstry2` plus `shakai3` all hand-roll).

3. **Resolve a student's context via `enrollments → classes.school_id`
   — never `profiles.home_school_id`.** That column is real (used in
   the `profiles_read` RLS policy) but is not the right source for a
   module's active class/school context. Caught mid-build once
   already (kokugo3); don't rediscover it. **Also: for real schools,
   `profiles.home_school_id` is intentionally left NULL and must stay
   that way — do not "backfill" it.** Real schools number students
   per-class (出席番号: a "#1" in every class), but the
   `profiles_student_no_per_school` unique index is on
   `(home_school_id, student_number)` — a per-*school* guarantee. NULL
   `home_school_id` is the only thing that lets per-class-numbered
   students coexist (Postgres treats `(null, "1")` rows as distinct).
   Setting it hits a duplicate-key violation (verified on Mizuho,
   2026-07-16). The seed schools only have it set because they're
   synthetic/uniquely-numbered. Login is unaffected either way (the
   student flow keys on `{class_id, student_number}`, unique per class).

4. **`launch_url` in any module registration migration is always
   absolute** (`/modules/<key>/index.html`). Relative paths have
   broken registration multiple times.

5. **Registration migrations are idempotent** — update-then-insert-
   if-absent, `is_active = true` set explicitly even though the
   column defaults to true, `subject` matching the real CHECK
   constraint on `modules`. The constraint currently allows exactly:
   `english`, `math`, `japanese`, `science`, `social`, `sougou`,
   `misc` — no others, no aliases (a 社会 module is `social`, not
   `japanese` or `english`). Include `publisher` (nullable free-text
   textbook-series attribution, added #81) in the idempotent insert…
   on-conflict-update alongside `key/name/subject/launch_url` so a new
   module's catalog card carries its publisher badge from day one.

## Schema notes worth knowing before touching module-adjacent tables

- `class_modules.focus_units` (jsonb) and `modules.recommended_grades`
  (int[]) are **both now wired into real code** (this changed
  2026-07-15). `focus_units` is read by the module runners — `sansu3`
  is the reference (reads the union of focus keys across the student's
  classes, fails soft to null = all units if any class is unscoped),
  with `kokugo3`, `rika4`, `sansu4`, and `shakai4` following the same
  pattern (5 total, matching the `module-units.js` registry exactly).
  **`rika3` is NOT wired** despite `rika3-data.js` exposing a
  unit-key list "for focus_units alignment" — it never queries
  `class_modules` and is absent from `module-units.js`, so the
  assignment UI can't offer it a unit picker. (Don't let the comment
  in `rika3-data.js` fool you, as this file's own note once did.) It
  is written by the assignment UIs (`hub/admin/class-detail.html`,
  `hub/gradebook/assign.html`, both via `module-assign-common.js`).
  `recommended_grades` is read by those same assignment UIs to suggest
  grade-appropriate modules. **Data caveat:** as of this review no
  `class_modules` row actually has `focus_units` populated yet
  (`cm_with_focus = 0`) — the plumbing exists end-to-end but no teacher
  has scoped an assignment, so test the null/"all units" path for real.
- **`module-units.js` now exists** at `gakuenza.com/hub/module-units.js`
  (`window.MODULE_UNITS`) — it is the canonical unit-key registry the
  assignment UIs use to render the focus-unit picker, and the keys
  **must** match each module's internal unit keys exactly (`sansu3`:
  `u01`–`u17`; `kokugo3`: `kanji` + `READING_UNITS` keys). When a
  module gains or renames units, update both the module and this
  registry — the assignment pages cannot load a module's generators.
  (The old note that this file "does not exist" is retired.)
- `modules.is_active` genuinely defaults to `true` at the column
  level — the earlier fear that an unset module is invisible by
  default was wrong — but set it explicitly anyway, it's convention.
- **`db/` is a documentation mirror, not an applied migration set.**
  Every `db/*.sql` was transcribed *after* being applied to the live
  project by hand — nothing replays it and nothing enforces that it
  matches production. A migration file existing in `db/` does **not**
  mean it ran. Verify module-adjacent state against the live DB (or
  `docs/codebase-and-db-structure.md`), not against `db/`. These are
  the **pre-adoption history** — new schema changes do not go here.
- **Schema changes now go through `supabase/migrations/`** (adopted
  2026-07-15 — see `supabase/README.md`). The prod ledger
  (`supabase_migrations.schema_migrations`) and `migrations/` are
  reconciled: a squashed baseline (`20260706000000_remote_schema.sql`,
  assembled by MCP introspection of the live DB) plus the one
  pre-existing tracked migration. The baseline is a hand-assembled
  snapshot, **not** `pg_dump` — verify it with `supabase db pull` on a
  branch before trusting a from-zero `db reset`. Going forward: in a CLI
  session use `supabase migration new` + `db push`; in an agent/CI
  session use the MCP `apply_migration` (it writes the ledger) **and**
  commit the matching `supabase/migrations/<ts>_<name>.sql` in the same
  PR. Never apply schema via `execute_sql`/dashboard — that bypasses the
  ledger and is how the untracked history accumulated.

## Copyright — "reference, don't reproduce"

Every module built against a real textbook builds original content
testing the same skills/facts/structure as the real curriculum unit —
**never** the textbook's actual passages, specific problems, diagrams,
or exact wording, even when the structural pattern gets close to the
source. Prefer independently-verifiable facts (general knowledge,
science, official curriculum structure) over anything that could only
have come from the copyrighted material itself. Seeing copyrighted
text during research does not make it safe to use — build from
structural/factual knowledge only regardless of what turned up in
search.

## Testing bar

- **Generators**: stress-test at real scale (hundreds–thousands of
  generated instances), checking programmatically for structural bugs
  AND the subtler distractor-collision bug (a "wrong" option that's
  secretly also correct). This project's own kanji generator shipped
  this twice — don't assume clean from a handful of manual examples.
- **Flow test**: real headless-browser test through the actual quiz
  flow, asserting the shared reporting helper was called correctly
  and `activity_result_items` actually got populated.
- **Migration**: idempotency (run twice, no duplicate row), correct
  `is_active`/`subject`/`launch_url`.

## Known, currently-unresolved things — don't be surprised by them,
## not your job to fix incidentally

- (Resolved 2026-07-16) The admin console (`hub/admin/*.html`) used to
  load the shared root `style.css` with no defense against the
  button-width bug. `admin.css` is now self-contained — it copies the
  `:root` token values literally and carries the base element rules the
  admin pages use (`h1`/`label`/`input`/`table`/`a`), **minus** the
  `button { width:100% }` footgun — and all five admin pages dropped the
  `../../style.css` `<link>` (they load `hub-shell.css` → `admin.css`
  only). `body` background/font stay owned by `hub-shell.css`. Keep the
  copied tokens in sync with root `style.css`.
- (Resolved 2026-07-15) `rika4` was built + deployed but unregistered
  in the live `modules` table; `db/2026-07-15_register_rika4_module.sql`
  had never been applied. Registered during this review — the live
  catalog now has 13 modules matching the 13 directories. Left here as
  the canonical example of the `db/`-is-a-mirror hazard: a fresh module
  is not live in the hub until its registration row exists in the DB,
  regardless of whether its migration file is committed.
- (Resolved 2026-07-15) `shakai3` had `subject = 'english'`; corrected
  to `'social'` (mirror: `db/2026-07-15_fix_shakai3_subject.sql`).

Educator-facing module assignment **now exists** (retired earlier note):
`hub/gradebook/assign.html` + `module-assign-common.js` let educators
write `class_modules` for their taught classes, and the `cmod_write`
RLS policy was widened from admin-only to cover taught classes.

## For automated/headless runs specifically

If you're running unattended (GitHub Actions), your job is to **build
against an already-written spec in `docs/specs/pending/`**, not to
invent scope. Open a PR, do not push directly to `main`. Move the spec
file from `docs/specs/pending/` to `docs/specs/completed/` as part of
the same PR so it doesn't get picked up again. If the spec is
ambiguous or you'd need to make a real judgment call beyond what it
specifies, stop and note that in the PR description rather than
deciding unilaterally.

**Two other Actions workflows exist besides the spec builder** (all three
now authenticate with the Claude **subscription** via
`claude_code_oauth_token` / the `CLAUDE_CODE_OAUTH_TOKEN` secret — NOT
API billing): `bug-diagnose.yml` (on a `user-report` issue → investigate
and comment only, never a PR) and `bug-autofix.yml` (only on the
human-added `approved-for-autofix` label → attempt a fix, PR-only, same
guardrails as the spec builder). The issues come from the staff-only
in-app bug button (`AdminCommon.bugReport` → `report-bug` Edge Function →
`bug_reports` table). Full reference: `docs/bug-report-automation.md`.
