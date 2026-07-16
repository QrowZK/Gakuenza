# Gakuenza — Roadmap (single source of truth)

_Last updated: 2026-07-16. Living planning doc, not a spec._

> ### How this roadmap is organized — read before editing
>
> **This file is the single source of truth for _what's next and in what
> order_.** It is the index. Deep detail lives in four domain docs under
> `docs/planning/`, and a given piece of detail lives in **exactly one** place:
>
> | Domain | Detail doc | Owns |
> |---|---|---|
> | Curriculum modules | [`planning/MODULE_ROADMAP.md`](planning/MODULE_ROADMAP.md) | coverage matrix, gaps, build specs |
> | Product features | [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md) | F1–F17 catalog + recommend-against |
> | Visual / UI redesign | [`planning/UI_REDESIGN.md`](planning/UI_REDESIGN.md) | audit, design kit, per-module UI effort |
> | Kadaiban (課題板) | [`planning/KADAIBAN_design.md`](planning/KADAIBAN_design.md) | the ink-annotation feature build spec |
>
> **Anti-drift rule:** priority / ordering changes go **here**; domain detail
> goes in the **domain doc**. Never restate a module list, feature spec, or
> design in this file — link it. (`docs/specs/pending/` remains the queue for
> the automated builder; `docs/codebase-and-db-structure.md` is the
> current-state map.)

## Where things stand

Gakuenza has grown from a handful of grade-3 drills into a fairly complete
elementary curriculum platform for the Mizuho pilot: **23 module directories
(all registered and active)**, a five-tier role model, a real gradebook with
weekly trend snapshots, and — as of today — a working automated bug-fix
pipeline. The architecture (static frontend + Supabase RLS, no app server) has
held up well; nothing this week required bending that model. **As of today,
Mizuho (瑞穂小学校) is the only populated school** — the synthetic seed schools
were emptied of students (see Today's progress).

## Today's progress (2026-07-16)

A big day, mostly consolidation rather than new surface area:

- **Migration tooling reached steady state.** `supabase/migrations/` and the
  live ledger are now fully reconciled (15 tracked migrations, 3 drifted files
  renamed to match what was actually applied in prod). The
  provisional-version-then-rename workflow for parallel module PRs worked, but
  cost real friction — worth simplifying (Near-term debt #7).
- **Grade 5/6 coverage completed.** `kokugo5`, `kokugo6`, `rika5`, `rika6`,
  `sansu5`, `sansu6`, `shakai5`, `shakai6` all shipped and registered live.
  Three of four core subjects (算数, 理科, 社会) now span grades 3–6 completely.
- **The automated bug-report pipeline went live and shipped two real fixes
  same-day**: issues #57 (jammed-up teacher-tab text) and #58 (bug-report
  button eating the sidebar) went report → diagnosis → `approved-for-autofix`
  → merged PR without a human writing code — after several rounds of fixing the
  workflow plumbing itself (OIDC auth, sandboxed Bash + socat, PR-open timing,
  stale git creds, Actions-can't-open-PRs).
- **RLS tightened again**: educators can now read profiles of their taught
  classes' students (`profiles_read_taught_class_students`).
- **Gradebook UX**: class chips in multi-school lists now group by school.
- **Seed test data purged.** All non-Mizuho students removed: **450 seed
  students + 1,350 activity_results + 1,003 gradebook_snapshots + 54
  observation_records + their auth logins** deleted, across the three synthetic
  schools (余喜/羽咋/邑知). Mizuho (106 real students) and all staff + class
  shells left intact; roster backed up off-repo first. The seed schools now have
  0 students.
- **Planning consolidated into four domain docs** (see the table above): module
  roadmap, feature backlog, UI redesign, and the confirmed, build-ready
  **Kadaiban** spec.

## Near-term debt (known, not yet done)

Debt items, not new ideas:

1. **Fix the five hand-rolled reporters.** `nh6`, `nhvocab`, `letstry1`,
   `letstry2`, and `shakai3` insert into `activity_results` directly instead of
   calling `HubCommon.reportActivityWithItems`, so none populate
   `activity_result_items` — the gradebook's per-question analysis has nothing
   to show for five of 23 modules. Flagged in `CLAUDE.md` as a repeat mistake;
   the largest remaining hole in gradebook data quality.
2. **Wire `rika3` into `focus_units`.** It exposes a unit-key list "for
   focus_units alignment" in `rika3-data.js` but never queries `class_modules`
   and is absent from `module-units.js` — the assignment UI can't scope it.
   Same shape as the `sansu3` reference; a small follow-up.
3. **SECURITY DEFINER EXECUTE pass** (advisor finding #6, open): revoke EXECUTE
   on `app_*` helpers only ever called from inside RLS (e.g. `app_class_school`,
   the `app_user_*_ids` family), to shrink the anonymous attack surface.
4. **Leaked-password protection is still off.** Dashboard-only toggle
   (Authentication → Policies) — someone with console access should flip it.
5. **Simplify the placeholder-migration-version workflow.** The cut-then-rename
   dance for module registrations that must land after a frontend deploy caused
   real drift this week (3 files). Consider a deploy-then-migrate ordering that
   avoids placeholders, or a CI check that fails a PR when a migration filename
   doesn't match its ledger-applied version.

## What's next — by domain

Each item below is a pointer; the linked doc holds the detail.

### Curriculum modules → [`planning/MODULE_ROADMAP.md`](planning/MODULE_ROADMAP.md)

The real gap is **grades 1 and 2 — zero modules in any subject today** (science
and social start at grade 3, and no G1/G2 math or japanese exists yet, so a
grade-1/2 class currently sees an **empty hub**). After that: **kokugo4** (the
one missing rung in the core 算数/理科/社会/国語 × grades 3–6 grid), **reading
comprehension for kokugo5/6** (both ship kanji+grammar only), and **eigo5** (the
last 外国語 grade gap). The detail doc has the full coverage matrix, the
priority order (Tier A: sansu1, sansu2, kokugo4), and drop-in spec sketches for
the top six — ready to move into `docs/specs/pending/`.

### Product features → [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md)

17 features across 7 themes, tiered P0–P2, each with data/RLS impact, surface,
and effort — plus 4 recommend-against. The two **P0s**: **F1** assignment
progress / due-date dashboard (surfaces `class_modules` due-date data that's
written but never displayed) and **F16** offline-resilient result submission
(guards against lost work on flaky school Wi-Fi). The "parent-facing read view"
and "offline resilience" ideas that used to live in this roadmap now have full
entries there (F7/F8 guardian access; F16). The seasonally-urgent **F13**
進級・クラス替え year-rollover tool is the biggest recurring ops cliff.

### Visual / UI redesign → [`planning/UI_REDESIGN.md`](planning/UI_REDESIGN.md)

The `kokugo*` and `kanken*` modules are visually plain (system-font body, tiny
type, flat option lists, bare numeric result screens) next to the polished
`nhvocab`/`nh6`/`eiken` tier. The detail doc defines a copy-paste **"Module UI
Kit"** that levels them up **without** violating hard-rule #1 (no shared
stylesheet), plus child-UX specifics (touch targets, furigana, contrast) and a
phased, per-module plan with a worked `kokugo3` before/after.

### Kadaiban (課題板) → [`planning/KADAIBAN_design.md`](planning/KADAIBAN_design.md)

Confirmed, build-ready: digital-ink annotation + **manual** grading of
teacher-uploaded worksheets (no OCR/auto-grade). **The first Gakuenza feature to
need Supabase Storage** — Phase 1 is deliberately scoped to prove Storage +
Storage RLS in isolation before adding multi-page/tooling in Phase 2. Being
handed to a subagent: **do not place its spec in `docs/specs/pending/`** — that
path auto-fires the module builder, which would mis-build Kadaiban (it's a
Gradebook feature, not a module, and needs buckets created out-of-band).

### Engineering & ops initiatives (owned here — no separate detail doc)

- **A real CI test suite.** There is currently no automated verification of
  anything — no lint, no generator stress tests, no flow tests — despite
  `CLAUDE.md` prescribing exactly that testing bar per module. Stand up a
  lightweight `test.yml` (headless-browser flow test + generator stress test)
  on every PR touching `gakuenza.com/modules/**`, independent of the bug-report
  automation.
- **Extend the bug pipeline past UI bugs.** The autofix loop proved itself on
  layout fixes. Natural next step: a scheduled (cron) sweep that runs the
  mandated generator stress tests and files its own `bug_reports` when a
  generator regresses — closing the loop between the testing bar and actual CI.
- **Snapshot trend UI.** Confirm `karte.html`/`analysis.html` actually surface
  week-over-week trend now that `gradebook_snapshots` is populated via `pg_cron`
  (since 2026-07-15). **Caveat:** only **3 snapshot rows remain** after today's
  seed purge (was ~1,006, nearly all seed) — there's little real trend data yet,
  so validate the UI against Mizuho's accumulating data as `pg_cron` runs weekly,
  not against the old backfill volume.
- **Second-school rollout readiness.** Architecturally multi-tenant already
  (`schools`, per-school RLS, `school_modules` licensing), but only ever run
  against Mizuho — and now the seed schools are empty, so there's no longer even
  synthetic multi-school data. Before onboarding a second real school: a
  deliberate multi-school admin-UX pass (today's gradebook grouping fix suggests
  it's still being discovered reactively) and an onboarding runbook (it still
  requires hand SQL via `provision-account`).

## Explicitly not proposing

- **No framework/build-step migration** — the static-HTML model is working and
  isn't the bottleneck on anything above.
- **No new backend service** — everything fits the existing
  browser-talks-to-Postgres-via-RLS shape.
- Product features deliberately rejected (student DMs/chat, student-facing AI
  tutor, public comparative leaderboards, native mobile app) are cataloged with
  reasons under **Recommend AGAINST** in
  [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md).
