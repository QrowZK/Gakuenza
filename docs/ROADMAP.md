# Gakuenza — Roadmap (single source of truth)

_Last updated: 2026-07-19. Living planning doc, not a spec._

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

Gakuenza has grown from a handful of grade-3 drills into a **complete
grades-1–6 curriculum platform** for the Mizuho pilot: **29 module
directories under `gakuenza.com/modules/`, all registered and active**, plus
one more `modules` catalog row (`kadaiban`, intentionally `is_active=false`)
that anchors `activity_results` for the platform's non-drill Kadaiban feature
— which lives under `hub/`, not `modules/`, so it has no directory of its
own. A five-tier role model, a real gradebook with weekly trend snapshots, a working automated bug-fix pipeline
(5 real fixes shipped through it so far), and **Kadaiban (課題板)**, the
platform's first non-drill feature and first use of Supabase Storage, shipped
2026-07-17. **算数/国語 now cover grades 1–6, 理科/社会 cover 3–6, and
外国語 covers 3/4 (Let's Try) + 5/6** — kokugo4 (#101) and eigo5 (#100)
shipped 2026-07-18, closing the last two holes in the core grid same-day (the
morning 07-18 roadmap update had called this "one clear action away"; it
landed by that evening). The architecture (static frontend + Supabase RLS, no
app server) has held up well across all of this; nothing this week required
bending that model. Mizuho (瑞穂小学校) remains the only populated school.

The two risks flagged the day Kadaiban and the grade-1/2 wave shipped both
turned out to matter within 24 hours: the shared `module-units.js` registry
that had already corrupted twice under parallel PRs is now permanently
decentralized (each module owns its own `units.js`), and Kadaiban's
holistic single-grade reporting had a real double-grading bug that had
already corrupted a production row before it was caught and fixed. Both
closed 2026-07-18. Correction to that day's own roadmap entry: it was
recorded in the moment as "a quiet, consolidation-only day... no new
modules" — written that morning, before kokugo4/eigo5 merged that afternoon.
Left here as a small process note: same-day roadmap updates written before
end-of-day can go stale within hours on an active day; MODULE_ROADMAP.md's
own update note already had the correct completion record.

## Today's progress (2026-07-19)

A light day, one PR so far and the first real run of the "recurring Supabase
advisor sweep" this roadmap has been proposing since 07-18:

- **PR #103 (open, unmerged as of this update): fixes raw NUL bytes embedded
  literally in five files' dedup-signature strings** (`rika3-gen.js` plus
  `sansu1/2/4/6/app.js`) — replaces the literal control character with the
  `'\\u0000'` escape sequence. Functionally identical output (same one-character
  U+0000 string, so dedup keys are byte-for-byte unchanged), but the raw byte
  made git treat those five files as **binary**, which hides real future
  changes from diff-based code review — a genuine, if quiet, repo-hygiene
  fix, not a no-op. **Notable:** the PR has zero CI checks attached (`0` check
  runs) — a live, concrete instance of the standing "no CI test suite" debt
  item below: a correct fix to five files is going in on review alone, same
  as every other PR so far.
- **First real Supabase advisor sweep run** (security + performance), the
  idea this roadmap has floated since 07-18 without anyone actually running
  it. Security: no new findings beyond the two already-tracked items (Near-term
  debt #3 SECURITY DEFINER EXECUTE surface, #4 leaked-password-protection
  toggle) plus one INFO-level `bug_reports` "RLS enabled, no policy" —
  **verified intentional**, not a gap: the table's migration
  (`20260716063714_bug_reports_table.sql`) explicitly revokes all
  anon/authenticated grants and is written/read only by the `report-bug` Edge
  Function under `service_role`, so deny-all-via-no-policy is the correct
  posture, not an oversight. Performance surfaced three real, previously
  unmeasured findings — see Near-term debt #7 below, added from this sweep.
- `CLAUDE.md` unchanged today — no new DB surface, no new hard-rule violation
  to record.

## Near-term debt (known, not yet done)

Debt items, not new ideas:

1. **Fix the five hand-rolled reporters.** `nh6`, `nhvocab`, `letstry1`,
   `letstry2`, and `shakai3` insert into `activity_results` directly instead of
   calling `HubCommon.reportActivityWithItems`, so none populate
   `activity_result_items` — the gradebook's per-question analysis has nothing
   to show for five of 29 modules. Flagged in `CLAUDE.md` as a repeat mistake;
   the largest remaining hole in gradebook data quality. Kadaiban shipped
   2026-07-17 using the correct helper from the start — proof the pattern is
   easy to follow when a module is built fresh; these five just need the same
   swap.
2. **Wire `rika3` into `focus_units`.** It exposes a unit-key list "for
   focus_units alignment" in `rika3-data.js` but never queries `class_modules`
   and ships no `modules/rika3/units.js` — the assignment UI can't scope it.
   Same shape as the `sansu3` reference; a small follow-up.
3. **SECURITY DEFINER EXECUTE pass** (advisor finding #6, open): revoke EXECUTE
   on `app_*` helpers only ever called from inside RLS (e.g. `app_class_school`,
   the `app_user_*_ids` family), to shrink the anonymous attack surface.
4. **Leaked-password protection is still off.** Dashboard-only toggle
   (Authentication → Policies) — someone with console access should flip it.
5. ~~Build `SPEC_decentralize_module_units.md`~~ **done 2026-07-18** (#99) —
   see today's progress above. The shared-registry corruption class is
   closed; `kokugo4`/`eigo5` are no longer blocked from building in parallel.
6. **Test coverage is inconsistent and un-enforced — and today's kadaiban bug
   is a concrete case, not a hypothetical one.** 13 of 29 modules have a
   `tests/<key>/` directory (kokugo4 and eigo5 both shipped with one) — the
   rest (`rika3/4`, `shakai3–6`, `sansu3/4`, all five English-family modules,
   `kanken*`, and `kadaiban`) have none. There is still no CI workflow
   enforcing `CLAUDE.md`'s stated testing bar
   (stress test + flow test + migration idempotency). Today's double-grading
   bug (#83/#97) shipped past a manual rolled-back-transaction test that only
   covered a single grade, not a re-grade — exactly the kind of scenario a
   real flow test would encode once and run on every future kadaiban PR. Use
   it as the motivating case when the "real CI test suite" engineering item
   below finally gets built.
7. **RLS performance debt, surfaced by today's first advisor sweep (new).**
   Three concrete findings, none urgent at Mizuho's single-school scale but
   worth tracking before a second school multiplies the row counts:
   - **`kadaiban_submissions` carries 12 "multiple permissive policies"
     findings — exactly 2x the next-highest table** (`class_modules`,
     `class_teachers`, `classes`, `enrollments`, `profiles`, and six others
     all sit at 6). Direct fallout of the taught-OR-staff-of-school RLS
     widening (#70, 2026-07-17): each added policy is a real per-row OR
     branch Postgres evaluates on every read. Worth a consolidation pass —
     collapsing to fewer, broader policies per action — before Kadaiban
     Phase 2 adds more query volume.
   - **13 `auth_rls_initplan` findings** (`profiles`, `enrollments`,
     `activity_result_items`, and others): these policies call
     `auth.uid()`/`current_setting()` directly instead of via
     `(select auth.uid())`, so Postgres re-evaluates it per row instead of
     once per query. Standard, well-documented Supabase fix; the two most
     PII-sensitive tables (`profiles`, `enrollments`) are on the list.
   - **14 unindexed foreign keys** (`activity_results.module_id`,
     `class_modules.module_id`, `class_teachers.user_id` ×2, and others) —
     ordinary query-plan debt, cheap to close.
   None of these are correctness bugs — they're the first concrete data
   points from actually running the sweep this roadmap has proposed since
   07-18, exactly the kind of thing a periodic check exists to catch before
   it's a production slowdown at a second school. Fold into the "recurring
   Supabase advisor sweep" engineering item below rather than a one-off fix.

## What's next — by domain

Each item below is a pointer; the linked doc holds the detail.

### Curriculum modules → [`planning/MODULE_ROADMAP.md`](planning/MODULE_ROADMAP.md)

**The grades-1–6 core grid is complete** (as of 2026-07-18: kokugo4 #101 and
eigo5 #100 closed the last two holes). 算数/国語 cover grades 1–6, 理科/社会
cover 3–6, 外国語 covers 3/4 (Let's Try) + 5/6. `docs/specs/pending/` is
empty — there is no queued curriculum spec right now. The two remaining,
explicitly-deferred gaps are both optional/supplementary rather than
core-grid holes:

- **Reading comprehension for kokugo4/5/6** — all three ship kanji+grammar
  only by design (the copyright-sensitive half, per the "reference, don't
  reproduce" rule); this is the one substantive curriculum-depth gap left in
  an otherwise-complete subject.
- **Tier D kanken (10級/9級/5級, grades 1/2/6)** — duplicates the per-grade
  kokugo kanji drills; build only if 漢検 prep becomes a distinct product
  goal, not for coverage (per `MODULE_ROADMAP.md` §2 tier D).

Neither is urgent. With the coverage milestone closed, this is a natural
point to let curriculum-module work go quiet for a bit and let engineering
debt (Near-term debt above) and the P0 product features below get attention
instead, rather than manufacturing new module specs to keep the pace of the
last three days.

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

**Phase 1 shipped 2026-07-17**: digital-ink annotation + **manual** grading of
teacher-uploaded worksheets is live (no OCR/auto-grade), proving Storage +
Storage RLS in isolation as planned. **A real bug already surfaced one day
in** — the double-grading fix (#97, today) — which is itself evidence for the
gate below: the launch-day rolled-back-transaction test didn't cover
re-grading, only a single grade. **Nothing has used it in a real classroom
yet** — before investing in Phase 2 (multi-page, eraser/colour, offline —
detail doc §10), get at least one real Mizuho teacher through a full
create → student-draw → grade → **re-grade** cycle and watch for friction
neither test caught (upload UX on a real device, image quality after the
EXIF-normalize/downscale pass, whether "no OCR/auto-grade" feels right in
practice). Treat that as the gate before scoping Phase 2 work.

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
  mode.** `module-units.js` itself was fixed 2026-07-18 (#99), and the very
  next parallel-module batch (`kokugo4` #101, `eigo5` #100, same day) landed
  cleanly with no registry conflict — good evidence the fix holds. The root
  cause — a single hand-edited file every parallel module PR touches,
  "protected" by a `merge=union` stopgap that actually corrupts structured JS
  — is a pattern, not a one-off, and still hasn't been checked anywhere else.
  Worth doing now, while there's no module actively mid-build to interfere
  with the audit: check the nav/menu registrations each hub page hand-edits,
  and any other `window.SOMETHING = {...}` registry a module PR is expected
  to append to.
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
- **A recurring Supabase advisor sweep.** Two real P0s surfaced from manual
  review earlier this week (the profiles self-escalation grant on 2026-07-17,
  the earlier advisor-flagged issues on 2026-07-15), plus the kadaiban
  double-grading bug (2026-07-18) — a data-integrity issue an advisor sweep
  wouldn't have caught but that strengthened the same underlying point.
  **Run for the first time today (2026-07-19)** — see Near-term debt #7 for
  the three performance findings it turned up (kadaiban RLS policy overlap,
  auth_rls_initplan, unindexed FKs) and the confirmation that `bug_reports`'
  no-policy INFO finding is intentional, not a gap. `get_advisors` took
  seconds to run and immediately paid for itself — this is still a one-off,
  though, not a schedule. Still worth an actual periodic (weekly?) mechanism
  — a `pg_cron` job writing findings somewhere visible, or a standing
  scheduled agent routine — rather than depending on someone remembering to
  ask for it, which is exactly what happened today and could just as easily
  not have.

## New ideas & frontiers (2026-07-19)

The grades-1–6 coverage milestone is now closed and the queue is empty
(`docs/specs/pending/` has nothing in it, one small open PR). That's a
natural inflection point — the module-building sprint of 07-16 through
07-18 has a real stopping point, and what's most valuable next is less
"which module" and more "is the platform sound underneath what's been
built." Fresh proposals below, not yet scoped as specs:

- **Treat "coverage complete" as the actual product milestone it is, and
  say so to whoever owns the Mizuho relationship.** This has been flagged as
  a to-do for two roadmap updates running (07-17, 07-18) without anyone
  actually doing it. It's a one-message action, not an engineering task —
  worth just doing rather than carrying forward a third day.
- **Turn the advisor sweep from a one-off into a schedule, now that it has
  proven its worth twice in two days.** Today's run (Near-term debt #7)
  found real, previously-invisible RLS performance debt on the first try,
  the same way the manual reviews on 07-15/07-17 found two real P0s. Three
  for three isn't a coincidence worth ignoring. Concretely: a weekly
  scheduled routine (this session type, or a `pg_cron` job) that runs
  `get_advisors` and appends findings to this roadmap or files an issue on
  drift — closing the exact gap the "recurring Supabase advisor sweep" item
  has named for two days without anyone wiring it up.
- **Now that the curriculum sprint has a lull, this is the moment for the
  debt list, not more modules.** Near-term debt #1 (five hand-rolled
  reporters missing `activity_result_items`) and the "real CI test suite"
  engineering item are both older than the last three modules that shipped
  instead of them. Neither is hard — the CI item's own text notes tests
  mostly already exist and just aren't wired up. With no module actively
  mid-build, this is as low-friction a window to spend a day on both as
  there's likely to be for a while.
- **kadaiban's RLS shape (12 multiple-permissive-policy findings, 2x every
  other table) is worth a design retrospective, not just a policy-count
  fix.** It's the platform's newest table family and already has the most
  RLS complexity of anything in the schema — a natural side effect of being
  built with the widest access rule (taught-OR-staff-of-school) from day
  one. Worth asking, before Phase 2 adds more surface: was the widened rule
  (#70) implemented as several stacked permissive policies where one
  broader policy would do? If so, Kadaiban is a good place to establish the
  house pattern for "wide access, few policies" before a second feature
  copies today's shape.
- **Two-day-old pattern, now a three-day one:** every real bug or security
  gap found this week (the profiles P0 on 07-17, the kadaiban double-grade
  on 07-18, and now the RLS performance debt on 07-19) was caught by a
  human/session deliberately going and looking, not by anything automated
  running on a schedule. There is still no CI and still no recurring
  advisor check — both proposed for three days running. The pattern itself
  is now the strongest argument for finally building the second one; the
  ideas above aren't new, but the evidence for them keeps compounding.

## Explicitly not proposing

- **No framework/build-step migration** — the static-HTML model is working and
  isn't the bottleneck on anything above.
- **No new backend service** — everything fits the existing
  browser-talks-to-Postgres-via-RLS shape.
- Product features deliberately rejected (student DMs/chat, student-facing AI
  tutor, public comparative leaderboards, native mobile app) are cataloged with
  reasons under **Recommend AGAINST** in
  [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md).
