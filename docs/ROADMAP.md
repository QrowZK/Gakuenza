# Gakuenza — Roadmap (single source of truth)

_Last updated: 2026-07-17. Living planning doc, not a spec._

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
elementary curriculum platform for the Mizuho pilot: **27 module directories**
(all registered and active, except the intentionally-inactive `kadaiban`
catch-all reporting anchor), a five-tier role model, a real gradebook with
weekly trend snapshots, a working automated bug-fix pipeline (5 real fixes
shipped through it so far), and — as of today — **Kadaiban (課題板)**, the
platform's first non-drill feature and first use of Supabase Storage. The
architecture (static frontend + Supabase RLS, no app server) has held up well
across all of this; nothing this week required bending that model. Mizuho
(瑞穂小学校) remains the only populated school.

## Today's progress (2026-07-17)

The single busiest day on record — a full feature ship, a real security
incident closed same-day, three more autofixes, and a second module wave:

- **Kadaiban (課題板) Phase 1 shipped end-to-end.** Digital-ink annotation of
  teacher-uploaded worksheets: 4 new tables + RLS + a submissions guard
  trigger, **the project's first two Supabase Storage buckets** (private,
  path-segment-policied), a forked writing-canvas frontend, teacher inbox/
  grade views, and a student draw/submit flow — reporting through the standard
  `HubCommon.reportActivityWithItems` path from day one (no hand-rolled
  insert, unlike the five legacy modules below). Verified end-to-end in a
  rolled-back transaction. RLS was widened same-day (#70: teacher-OR-staff-of-
  school, not teacher-only) and `kadaiban_assignments.subject` (#82) plus a
  visible subject picker followed a few hours later. Phase 2 (multi-page,
  eraser/colour, offline) is scoped in `planning/KADAIBAN_design.md` §10 —
  not started.
- **Grade 1–2 coverage shipped, closing yesterday's #1-priority gap.**
  `sansu1`, `sansu2`, `kokugo1`, `kokugo2` are live — grades 1 and 2 no longer
  see an empty hub. `sansu2` includes a full 九九 (times-table) generator with
  exhaustive 81-cell test coverage (`tests/sansu2/`). Catalog grew 23 → 27
  modules in one day.
- **A real security P0 was found and fixed same-day.** `authenticated`/`anon`
  held table-level `UPDATE` on `public.profiles`, and the existing
  `profiles_update_admin` policy has no `WITH CHECK` — a coordinator or
  school_admin could `PATCH` their own row's `is_platform_admin` to `true` and
  take over every tenant. Fixed by revoking the table-level grant and
  re-granting `UPDATE` only on safe columns; `is_platform_admin` is now
  client-write-proof at the grant layer, not just by policy convention. Also
  fixed in the same pass: XSS sinks and a re-inherited `TRUNCATE` grant on the
  new kadaiban tables (same default-privileges hazard flagged after the
  2026-07-15 hardening — it recurred on the first table created since).
- **`modules.publisher` shipped** (#81) — nullable textbook-series
  attribution, backfilled for existing modules, now required in every
  registration migration's idempotent insert, shown as a catalog badge.
- **Three more autofix-pipeline fixes landed** (#75 CSS/styling regression on
  completion, #77 teacher-name formatting, #79 return-home-button bug) — all
  report → diagnose → `approved-for-autofix` → merged PR, no human-written
  code. The pipeline is now proven at **5 total fixes** across two days.
- **The migration-drift pattern repeated — and got root-caused.** Three grade
  1–2 registration files again needed renaming to match their applied ledger
  versions (the exact friction flagged as debt yesterday). This time the
  *actual* cause was diagnosed: `hub/module-units.js` is a single hand-edited
  shared file every module PR appends to, and the `.gitattributes
  merge=union` stopgap silently corrupts it into invalid JS when two module
  PRs land in parallel — confirmed twice now (`node --check` failures on
  `sansu1`/`kokugo1`, hand-consolidated in #93). A scoped, build-ready fix
  (`docs/specs/SPEC_decentralize_module_units.md`: each module owns a lazy-
  loaded `modules/<key>/units.js`, the shared file goes away entirely) was
  written today and **built + merged the same day (#99)** — the shared file is
  gone; parallel module PRs can no longer collide on it.
- **`こくご③` support added to the print worksheet generator** (#71).
- `CLAUDE.md` updated twice today to record the new DB surface (Kadaiban,
  `publisher`, grades 1–2) and the security hardening.

## Near-term debt (known, not yet done)

Debt items, not new ideas:

1. **Fix the five hand-rolled reporters.** `nh6`, `nhvocab`, `letstry1`,
   `letstry2`, and `shakai3` insert into `activity_results` directly instead of
   calling `HubCommon.reportActivityWithItems`, so none populate
   `activity_result_items` — the gradebook's per-question analysis has nothing
   to show for five of 27 modules. Flagged in `CLAUDE.md` as a repeat mistake;
   the largest remaining hole in gradebook data quality. Kadaiban shipped
   today using the correct helper from the start — proof the pattern is easy
   to follow when a module is built fresh; these five just need the same
   swap.
2. **Wire `rika3` into `focus_units`.** It exposes a unit-key list "for
   focus_units alignment" in `rika3-data.js` but never queries `class_modules`
   and ships no `modules/rika3/units.js` — the assignment UI can't scope it.
   Same shape as the `sansu3` reference; a small follow-up. (Since #5 landed,
   the fix is now: add `modules/rika3/units.js` self-registering
   `window.MODULE_UNITS.rika3`, plus wire the runner to read `focus_units`.)
3. **SECURITY DEFINER EXECUTE pass** (advisor finding #6, open): revoke EXECUTE
   on `app_*` helpers only ever called from inside RLS (e.g. `app_class_school`,
   the `app_user_*_ids` family), to shrink the anonymous attack surface.
4. **Leaked-password protection is still off.** Dashboard-only toggle
   (Authentication → Policies) — someone with console access should flip it.
5. **~~Build `SPEC_decentralize_module_units.md`.~~ ✅ Done (#99, 2026-07-18).**
   The shared `module-units.js` registry had silently corrupted twice under
   parallel module PRs (first: the grade-5/6 wave's migration-version drift;
   then the same root cause, correctly diagnosed). #99 deleted the shared file
   and gave each module its own lazy-loaded `modules/<key>/units.js`, so the
   whole conflict class is gone. `kokugo4` and `eigo5` can now ship in parallel
   safely. Spec moved to `docs/specs/completed/`.
6. **Test coverage is inconsistent and un-enforced.** Only 12 of 27 modules
   have a `tests/<key>/` directory (`kokugo1/2/3/5/6`, `rika5/6`,
   `sansu1/2/5/6`) — the rest (`rika3/4`, `shakai3–6`, `sansu3/4`, all five
   English-family modules, `kanken*`) have none. There is still no CI
   workflow enforcing `CLAUDE.md`'s stated testing bar (stress test +
   flow test + migration idempotency) — it happens only when a session
   chooses to write it. This is the same gap as the "real CI test suite"
   engineering item below, restated as debt because it's now visibly
   inconsistent rather than uniformly absent.

## What's next — by domain

Each item below is a pointer; the linked doc holds the detail.

### Curriculum modules → [`planning/MODULE_ROADMAP.md`](planning/MODULE_ROADMAP.md)

Grades 1–2 are **done** (`sansu1`, `sansu2`, `kokugo1`, `kokugo2` shipped
today) — the empty-hub problem for the youngest grades is closed. The core
grid's only remaining holes are **kokugo4** (the one missing rung in
算数/理科/社会/国語 × grades 3–6) and **eigo5** (the last 外国語 grade gap),
plus the still-deferred **reading comprehension for kokugo4/5/6** (all three
ship kanji+grammar only). The registry-corruption blocker is **resolved** (#99,
Near-term debt #5) — kokugo4 and eigo5 can now ship **in parallel** safely, each
adding its own `modules/<key>/units.js`. The detail doc has the full coverage
matrix (needs a pass to mark sansu1/2, kokugo1/2 ✅) and drop-in spec sketches
for kokugo4/eigo5 — ready to move into `docs/specs/pending/`.

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

**Phase 1 shipped today (2026-07-17)**: digital-ink annotation + **manual**
grading of teacher-uploaded worksheets is live (no OCR/auto-grade), proving
Storage + Storage RLS in isolation as planned. **Nothing has used it in a real
classroom yet** — before investing in Phase 2 (multi-page, eraser/colour,
offline — detail doc §10), get at least one real Mizuho teacher through a full
create → student-draw → grade cycle and watch for friction the rolled-back-
transaction test couldn't surface (upload UX on a real device, image quality
after the EXIF-normalize/downscale pass, whether "no OCR/auto-grade" feels
right in practice). Treat that as the gate before scoping Phase 2 work.

### Engineering & ops initiatives (owned here — no separate detail doc)

- **A real CI test suite.** There is currently no `test.yml` — no lint, no
  generator stress tests, no flow tests running in CI — despite `CLAUDE.md`
  prescribing exactly that testing bar per module, and despite 12 of 27
  modules now having hand-run tests sitting in `tests/<key>/` unused by any
  workflow. This is now the cheapest engineering win on the roadmap: the tests
  mostly already exist, they just aren't wired to run automatically. Stand up
  a lightweight `test.yml` (headless-browser flow test + generator stress
  test) on every PR touching `gakuenza.com/modules/**`, independent of the
  bug-report automation.
- **Extend the bug pipeline past UI bugs.** The autofix loop is now proven at
  5/5 real fixes across two days (#57, #58, #75, #77, #79) — solidly past
  "promising prototype." Natural next step: a scheduled (cron) sweep that runs
  the mandated generator stress tests and files its own `bug_reports` when a
  generator regresses — closing the loop between the testing bar and actual
  CI, and giving the pipeline a source of issues that doesn't depend on a
  human clicking the bug-report button first.
- **Audit other shared append-only files for the `module-units.js` failure
  mode.** The root cause found today — a single hand-edited file every
  parallel module PR touches, "protected" by a `merge=union` stopgap that
  actually corrupts structured JS — is a pattern, not a one-off. Now that
  module velocity is 4-in-a-day (today), check whether the same shape exists
  elsewhere before it recurs in a different file: the nav/menu registrations
  each hub page hand-edits, and any other `window.SOMETHING = {...}` registry
  a module PR is expected to append to.
- **Snapshot trend UI.** Confirm `karte.html`/`analysis.html` actually surface
  week-over-week trend now that `gradebook_snapshots` is populated via `pg_cron`
  (since 2026-07-15). **Caveat:** only a handful of snapshot rows exist after
  the 2026-07-16 seed purge — there's still little real trend data, so validate
  the UI against Mizuho's accumulating data as `pg_cron` runs weekly, not
  against the old backfill volume.
- **Second-school rollout readiness.** Architecturally multi-tenant already
  (`schools`, per-school RLS, `school_modules` licensing), but only ever run
  against Mizuho — and the seed schools are empty, so there's no longer even
  synthetic multi-school data. Before onboarding a second real school: a
  deliberate multi-school admin-UX pass and an onboarding runbook (it still
  requires hand SQL via `provision-account`).
- **A recurring Supabase advisor sweep.** Two real P0s have now surfaced from
  manual review in three days (the profiles self-escalation grant today, the
  earlier advisor-flagged issues on 2026-07-15). `get_advisors` is cheap to
  run and nothing currently runs it on a schedule — worth a periodic
  (weekly?) check rather than relying on the next contributor to think to run
  it during unrelated work.

## New ideas & frontiers (2026-07-17)

Fresh proposals prompted by today's work — not yet scoped as specs, offered as
directions worth a deliberate look rather than decisions:

- **Kadaiban as the template for the next privileged-surface feature.** It's
  the first feature to touch Storage and the first to need a genuinely careful
  RLS design beyond the existing self-vs-staff split (a guard trigger to stop
  a student flipping their own submission to "graded"). **F13 (year-rollover)**
  and **F8 (guardian accounts)** are the next two features on the backlog with
  comparable privilege/PII stakes. Worth a short "what Kadaiban's RLS +
  Storage design got right" write-up before either of those starts, so they
  don't re-derive the same patterns (or re-discover the same TRUNCATE-grant
  hazard the kadaiban tables hit on day one).
- **A completeness milestone is close.** With kokugo4 and eigo5 as the only
  remaining core-grid holes, Gakuenza is one small build away from a genuinely
  marketable claim: *complete 算数/理科/社会/国語 coverage, grades 1–6, plus
  English 3–6*. That's worth flagging to whoever owns the Mizuho relationship
  and any second-school conversation — it's a concrete, demonstrable
  milestone, not just an internal coverage-matrix checkbox.
- **Shared small-state pattern worth naming before it's built twice.**
  Kadaiban just added per-user upload/draft state; **F15 (readability
  settings)** on the feature backlog wants per-user display preferences. Both
  are "a little JSON scoped to one user." Before F15 gets built, worth
  deciding whether it's a generic `user_preferences` table other small
  per-user-state features (including future ones) can share, versus each
  feature growing its own one-off table — a five-minute decision now is
  cheaper than an unwind later.
- **The autofix pipeline has earned a stress test of its own.** 5/5 real
  fixes is a strong track record, but every one so far has been a UI/layout
  bug. Before leaning on it more (the cron-sweep idea above would 10x its
  volume), worth deliberately feeding it a harder case — a data-correctness
  bug, or one that spans frontend + RLS — to see whether "approved-for-
  autofix" judgment holds up outside the class of bug it's been tuned on.
- **Today is a data point on parallel-PR scaling, not just a one-off spike.**
  4 modules + a full feature + a P0 fix + 3 autofixes landed in one day, and
  the one real failure (`module-units.js` corruption) was a shared-file
  contention problem, not a content or design problem. As module/feature
  velocity keeps climbing, it's worth periodically asking the same question
  that produced today's fix: *what other single-file, hand-edited,
  multiple-PRs-touch-it dependencies exist right now* — before they, too,
  become "the second time this broke."

## Explicitly not proposing

- **No framework/build-step migration** — the static-HTML model is working and
  isn't the bottleneck on anything above.
- **No new backend service** — everything fits the existing
  browser-talks-to-Postgres-via-RLS shape.
- Product features deliberately rejected (student DMs/chat, student-facing AI
  tutor, public comparative leaderboards, native mobile app) are cataloged with
  reasons under **Recommend AGAINST** in
  [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md).
