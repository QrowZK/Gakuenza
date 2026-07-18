# Gakuenza — Roadmap (single source of truth)

_Last updated: 2026-07-18. Living planning doc, not a spec._

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
shipped through it so far), and **Kadaiban (課題板)**, the platform's first
non-drill feature and first use of Supabase Storage, shipped 2026-07-17. The
architecture (static frontend + Supabase RLS, no app server) has held up well
across all of this; nothing this week required bending that model. Mizuho
(瑞穂小学校) remains the only populated school.

The two risks flagged the day Kadaiban and the grade-1/2 wave shipped both
turned out to matter within 24 hours: the shared `module-units.js` registry
that had already corrupted twice under parallel PRs is now permanently
decentralized (each module owns its own `units.js`), and Kadaiban's
holistic single-grade reporting had a real double-grading bug that had
already corrupted a production row before it was caught and fixed. Both are
closed as of today — see below.

## Today's progress (2026-07-18)

A quiet, consolidation-only day after 07-17's spike — no new modules, no new
features, just two PRs, both paying down exactly the two risks flagged
yesterday. Zero open PRs and zero open issues as of end of day:

- **The `module-units.js` registry corruption risk is permanently closed**
  (#99, implementing `SPEC_decentralize_module_units.md`). Every unit-scoped
  module now owns its own `modules/<key>/units.js` (17 created, each
  self-registering `window.MODULE_UNITS.<key>`, content byte-identical to the
  old shared registry's entries), `moduleUnitsFor` was rewritten async +
  cached with a `loadScriptOnce` helper, `assign.html`/`class-detail.html`
  updated to await it, and the old shared `hub/module-units.js` (the file that
  had corrupted twice under parallel module PRs, most recently yesterday) is
  **deleted outright** — this was Near-term debt #5, promoted yesterday to
  "top engineering priority," and it shipped the very next day. Minor process
  note, not a real issue: the clean PR (#99) supersedes an earlier attempt
  (#98) that accidentally carried an unrelated commit from a shared-worktree
  slip — caught and re-pushed cleanly rather than merged as-is.
- **A real kadaiban data-integrity bug was found and fixed** (#97, reopening
  #83). `saveGrade()` stamped a fresh `Date.now()` into `activityRef` on
  *every* save and called the insert-only `reportActivityWithItems` — since a
  kadaiban submission is 1:1 with its grade, re-grading a submission inserted
  a **duplicate** `activity_results` row instead of updating the existing one.
  Real impact: `karte.html` sums all rows with no dedup (inflated semester
  average + 取組回数), and `grades.html`'s "higher score wins" logic silently
  hides a corrected-**down** grade. Fixed with a stable ref
  (`kadaiban/<assignment>/<submission>`, timestamp dropped) plus
  update-or-insert client-side logic (the teacher already holds the needed
  RLS INSERT + UPDATE grants, so no new policy). One duplicate group already
  existed in production — cleaned up directly via MCP (older row deleted,
  survivor's ref rewritten to the stable form). **Notable:** issue #83 had
  previously been closed as "completed" with no actual fix landed, so the bug
  was live in production for roughly a day — from Kadaiban's ship on
  2026-07-17 until this fix. Neither the rolled-back-transaction test at
  launch nor the "completed" close caught it; a re-grade-the-same-submission
  scenario would have. See Near-term debt #6 and New ideas below.
- `CLAUDE.md` unchanged today — no new DB surface, no new hard-rule violation
  to record.

## Near-term debt (known, not yet done)

Debt items, not new ideas:

1. **Fix the five hand-rolled reporters.** `nh6`, `nhvocab`, `letstry1`,
   `letstry2`, and `shakai3` insert into `activity_results` directly instead of
   calling `HubCommon.reportActivityWithItems`, so none populate
   `activity_result_items` — the gradebook's per-question analysis has nothing
   to show for five of 27 modules. Flagged in `CLAUDE.md` as a repeat mistake;
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
   is a concrete case, not a hypothetical one.** Only 12 of 27 modules have a
   `tests/<key>/` directory — the rest (`rika3/4`, `shakai3–6`, `sansu3/4`,
   all five English-family modules, `kanken*`, and `kadaiban`) have none.
   There is still no CI workflow enforcing `CLAUDE.md`'s stated testing bar
   (stress test + flow test + migration idempotency). Today's double-grading
   bug (#83/#97) shipped past a manual rolled-back-transaction test that only
   covered a single grade, not a re-grade — exactly the kind of scenario a
   real flow test would encode once and run on every future kadaiban PR. Use
   it as the motivating case when the "real CI test suite" engineering item
   below finally gets built.

## What's next — by domain

Each item below is a pointer; the linked doc holds the detail.

### Curriculum modules → [`planning/MODULE_ROADMAP.md`](planning/MODULE_ROADMAP.md)

Grades 1–2 are **done** (`sansu1`, `sansu2`, `kokugo1`, `kokugo2`, shipped
2026-07-17) — the empty-hub problem for the youngest grades is closed. The
core grid's only remaining holes are **kokugo4** (the one missing rung in
算数/理科/社会/国語 × grades 3–6) and **eigo5** (the last 外国語 grade gap),
plus the still-deferred **reading comprehension for kokugo4/5/6** (all three
ship kanji+grammar only). The registry-corruption blocker that held both back
is now resolved (Near-term debt #5, done today) — **the concrete next action
is moving the two ready spec sketches (`MODULE_ROADMAP.md` §3.3 kokugo4, §3.6
eigo5) into `docs/specs/pending/`** so the automated builder can pick them up,
in parallel this time without registry risk. Landing both closes a genuinely
marketable milestone — see New ideas below.

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
  mode.** `module-units.js` itself is fixed as of today (#99), but the root
  cause — a single hand-edited file every parallel module PR touches,
  "protected" by a `merge=union` stopgap that actually corrupts structured JS
  — is a pattern, not a one-off, and hasn't been checked anywhere else yet.
  With `kokugo4`/`eigo5` now clear to build in parallel (see Curriculum
  modules above), this is worth doing *before* that batch lands, not after:
  check the nav/menu registrations each hub page hand-edits, and any other
  `window.SOMETHING = {...}` registry a module PR is expected to append to.
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
  manual review this week (the profiles self-escalation grant on 2026-07-17,
  the earlier advisor-flagged issues on 2026-07-15) — plus the kadaiban
  double-grading bug (2026-07-18), a data-integrity issue an advisor sweep
  wouldn't have caught but that strengthens the same underlying point: nothing
  currently runs a periodic health check, everything so far has depended on a
  human choosing to look. `get_advisors` is cheap to run — worth a periodic
  (weekly?) scheduled check rather than relying on the next contributor to
  think to run it during unrelated work.

## New ideas & frontiers (2026-07-18)

Fresh proposals prompted by today's (quiet) work — not yet scoped as specs,
offered as directions worth a deliberate look rather than decisions:

- **Audit closed-without-a-fix issues before this recurs a third time.**
  Issue #83 was previously closed as "completed" with no actual fix landed,
  and the bug it described was live in production, corrupting gradebook data,
  for roughly a day before today's re-fix. That's a process gap, not just a
  code bug — worth a cheap one-time pass cross-referencing other closed
  issues against whether a merged PR/commit actually references them, rather
  than trusting "closed" to mean "fixed." Cheap because the full history is
  already in GitHub; the autofix pipeline's own `approved-for-autofix` →
  merged-PR discipline is a plausible reason this hasn't happened elsewhere,
  but #83 shows it *can* happen and is worth ruling out rather than assuming.
- **Document the single-grade "update-in-place" reporting pattern before the
  next holistic-grading feature reinvents it wrong.** Today's fix established
  that kadaiban's reporting shape (1 submission : 1 grade, re-gradable, must
  update not insert) is a real, distinct variant of
  `reportActivityWithItems` usage from the standard per-attempt-insert
  pattern every drill module uses. Nothing currently documents *which shape a
  new feature should pick* — a future holistic-grading feature (an essay
  review tool, a portfolio-style assessment) could easily make the same
  `Date.now()`-in-the-ref mistake kadaiban just did. A short note in
  `docs/codebase-and-db-structure.md` or a "reporting patterns" section next
  to `HubCommon` itself would be enough; folds naturally into the "Kadaiban
  RLS + Storage design write-up" idea already on this roadmap (2026-07-17) —
  broaden that write-up to cover this too rather than starting a second doc.
- **Run the shared-append-only-file audit now, while the queue is empty.**
  Zero open PRs/issues today is a rare quiet window. `kokugo4` and `eigo5`
  are both cleared to build next and would be the first real parallel-module
  batch since the registry fix — a good forcing function to actually do the
  "audit other shared files for the same failure mode" item (Engineering
  initiatives above) *before* that batch, not after a third file corrupts.
- **The completeness milestone from yesterday is now one clear action away.**
  With the registry blocker gone, moving the two ready spec sketches
  (kokugo4, eigo5 — both already written in `MODULE_ROADMAP.md` §3.3/§3.6)
  into `docs/specs/pending/` is a same-day-sized task that reaches "complete
  算数/理科/社会/国語 coverage, grades 1–6, plus English 3–6" — still worth
  flagging to whoever owns the Mizuho relationship once it lands, as noted
  yesterday.
- **Two-day pattern worth watching, not yet acting on:** both real bugs found
  this week (the profiles P0 on 07-17, the kadaiban double-grade on 07-18)
  were caught by a human/session reviewing shipped work within a day of
  ship, not by any automated check — there is still no CI, and the autofix
  pipeline only reacts to a human clicking the in-app bug button. That's a
  reasonable interim safety net for a single-teacher pilot, but it will not
  scale past one school; the "real CI test suite" and "recurring Supabase
  advisor sweep" engineering items above are the two concrete steps that
  would turn this from a lucky habit into a system property.

## Explicitly not proposing

- **No framework/build-step migration** — the static-HTML model is working and
  isn't the bottleneck on anything above.
- **No new backend service** — everything fits the existing
  browser-talks-to-Postgres-via-RLS shape.
- Product features deliberately rejected (student DMs/chat, student-facing AI
  tutor, public comparative leaderboards, native mobile app) are cataloged with
  reasons under **Recommend AGAINST** in
  [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md).
