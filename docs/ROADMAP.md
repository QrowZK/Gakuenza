# Gakuenza — Roadmap

_Last updated: 2026-07-16. This is a living planning doc, not a spec — see
`docs/specs/pending/` for work that's actually queued for the automated
builder, and `docs/codebase-and-db-structure.md` for the current-state map._

## Where things stand

Gakuenza has grown from a handful of grade-3 drills into a fairly complete
elementary curriculum platform for the Mizuho pilot: 24 module directories,
a five-tier role model, a real gradebook with weekly trend snapshots, and —
as of today — a working automated bug-fix pipeline. The architecture
(static frontend + Supabase RLS, no app server) has held up well; nothing
this week required bending that model.

## Today's progress (2026-07-16)

A big day, mostly consolidation rather than new surface area:

- **Migration tooling reached steady state.** `supabase/migrations/` and the
  live ledger are now fully reconciled (15 tracked migrations, 3 drifted
  files renamed to match what was actually applied in prod). The
  provisional-version-then-rename workflow for parallel module PRs worked,
  but cost real friction (3 of the last batch drifted for a few hours) —
  worth simplifying, see below.
- **Grade 5/6 coverage completed.** `kokugo5`, `kokugo6`, `rika5`, `rika6`,
  `sansu5`, `sansu6`, `shakai5`, `shakai6` all shipped and registered live.
  Combined with the existing grade-3/4 set, three of the four core subjects
  (算数, 理科, 社会) now span grades 3–6 completely.
- **The automated bug-report pipeline went live and already shipped two real
  fixes same-day**: staff-reported issues #57 (jammed-up teacher-tab text)
  and #58 (bug-report button eating the sidebar) went from report →
  diagnosis → `approved-for-autofix` → merged PR without a human writing
  code. This is the first time the `bug-diagnose.yml` / `bug-autofix.yml`
  workflows ran end-to-end in production, after several rounds of fixing
  the workflow plumbing itself (OIDC auth, sandboxed Bash, PR-open timing,
  stale git creds).
- **RLS tightened again**: educators can now read profiles of their taught
  classes' students (`profiles_read_taught_class_students`), closing a gap
  the gradebook UI already assumed was closed.
- **Gradebook UX**: class chips in multi-school lists now group by school.

## Near-term goals (things already known, not yet done)

Pulled from the codebase review addendum and today's `db/`/`supabase/`
notes — these are debt items, not new ideas:

1. **Fix the five hand-rolled reporters.** `nh6`, `nhvocab`, `letstry1`,
   `letstry2`, and `shakai3` still insert into `activity_results` directly
   instead of calling `HubCommon.reportActivityWithItems`, so none of them
   populate `activity_result_items` — the gradebook's per-question analysis
   view has nothing to show for five of 24 modules. This is flagged
   explicitly in `CLAUDE.md` as a repeat mistake; it's now the largest
   remaining hole in gradebook data quality and a good next spec.
2. **Wire `rika3` into `focus_units`.** It already exposes a unit-key list
   "for focus_units alignment" in `rika3-data.js` but never queries
   `class_modules` and is absent from `module-units.js` — the assignment UI
   can't scope it. Mechanically the same shape as the `sansu3` reference
   implementation; should be a small follow-up.
3. **Close the `kokugo4` gap.** `kokugo3`, `kokugo5`, and `kokugo6` all
   exist; grade 4 is the only missing rung in the 算数/理科/社会/国語 ×
   grades 3–6 grid. Worth a spec.
4. **Reading comprehension is still missing from `kokugo5`/`kokugo6`.**
   Both ship kanji + grammar only (documented as deliberate in their specs).
   `kokugo3` has 7 reading units; grades 5/6 having none is a curriculum
   gap, not just a nice-to-have.
5. **SECURITY DEFINER EXECUTE pass** (advisor finding #6, still open):
   revoke EXECUTE on `app_*` helpers that are only ever called from inside
   RLS policies, never directly over PostgREST RPC (e.g.
   `app_class_school`, the `app_user_*_ids` family), to shrink the
   anonymous attack surface.
6. **Leaked-password protection is still off.** Dashboard-only toggle
   (Authentication → Policies), can't be scripted — someone with console
   access should just flip it.
7. **Simplify the placeholder-migration-version workflow.** The
   cut-then-rename dance for module registrations that must land after a
   frontend deploy caused real drift this week (3 files). Consider either
   a deploy-then-migrate ordering that avoids placeholders entirely, or a
   CI check that fails a PR if a migration filename doesn't match its
   ledger-applied version.

## New ideas / where to go next

Bigger swings, roughly ordered by how directly they build on what already
exists:

- **Extend the bug pipeline past UI bugs.** The autofix loop proved itself
  on layout/formatting fixes today. A natural next step is a scheduled
  sweep (cron-triggered, not just report-triggered) that runs the
  generator stress tests `CLAUDE.md` already mandates ("hundreds–thousands
  of instances, check for distractor collisions") and files its own
  `bug_reports` when a generator regresses — closing the loop between the
  testing bar the project holds itself to and actual CI enforcement, which
  doesn't exist yet (`deploy.yml` is the only workflow that isn't
  bug-report-triggered, and it doesn't run any tests).
- **A real CI test suite.** There is currently no automated verification
  of anything — no lint, no generator stress tests, no flow tests — despite
  `CLAUDE.md` prescribing exactly that testing bar for every module. Worth
  standing up a lightweight `test.yml` (headless-browser flow test +
  generator stress test per module) that runs on every PR touching
  `gakuenza.com/modules/**`, independent of the bug-report automation.
- **Parent-facing read view.** Every role tier so far is staff or student;
  there's no parent/guardian access to a child's `karte`/grade trend, which
  is a common ask for Japanese elementary schools. Would need a new
  lightweight role (read-only, scoped to one's own children via a new
  `guardians` join table) rather than overloading `enrollments`.
- **English track beyond the ported apps.** `nh6`/`nhvocab`/`eiken`/
  `letstry1`/`letstry2` are all ported engines bolted onto the shared
  session — none are "native" in the `sansu3`/`kokugo3` sense (own
  generators, `focus_units` support, `activity_result_items`). Once the
  five-hand-rolled-reporters fix above lands, consider whether a genuinely
  native English module (grade-appropriate vocabulary/grammar drills,
  reusing the `sansu3` unit-scoping pattern) is worth building instead of
  continuing to maintain five separate legacy shims.
- **Snapshot trend is finally live (`gradebook_snapshots` populated via
  `pg_cron` as of 2026-07-15) — build the UI that uses it.** Confirm
  `karte.html`/`analysis.html` actually surface week-over-week trend now
  that there's real data (1,006 rows backfilled), rather than assuming the
  plumbing being wired means the UI story is finished.
- **Second-school rollout readiness.** The platform is architecturally
  multi-tenant already (`schools`, per-school RLS scoping, `school_modules`
  licensing), but has only ever run against the Mizuho pilot. Before
  onboarding a second real school, worth a deliberate pass: does the admin
  console handle a coordinator/school_admin managing two schools cleanly
  (the gradebook grouping fix today suggests multi-school UX is still
  being discovered reactively), and is there an onboarding runbook anywhere
  or does it still require hand SQL via `provision-account`.
- **Offline resilience for the classroom.** Elementary-school wifi is not
  always reliable; a module mid-drill that loses connectivity currently has
  no graceful degradation path (reporting is fire-and-forget-best-effort,
  but a dropped session mid-quiz isn't queued/retried). A small
  local-storage queue for `activity_results`/`activity_result_items`
  writes that flushes on reconnect could meaningfully reduce lost student
  work without touching the RLS/security model.

## Explicitly not proposing

- No framework/build-step migration — the static-HTML model is working and
  isn't the bottleneck on anything above.
- No new backend service — everything above fits the existing
  browser-talks-to-Postgres-via-RLS shape; nothing here needs a server.
