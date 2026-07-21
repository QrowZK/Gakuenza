# Gakuenza — Roadmap (single source of truth)

_Last updated: 2026-07-21. Living planning doc, not a spec._

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

Gakuenza has grown from a handful of grade-3 drills into a genuinely complete
elementary curriculum platform for the Mizuho pilot: **29 module directories**
(all registered and active, except the intentionally-inactive `kadaiban`
catch-all reporting anchor), a five-tier role model, a real gradebook with
weekly trend snapshots, a working automated bug-fix pipeline (5 real fixes
shipped through it so far), and **Kadaiban (課題板)**, the platform's first
non-drill feature and first use of Supabase Storage, shipped 2026-07-17. As of
2026-07-18 (see below) **the grades 1–6 core curriculum grid is complete**:
算数/国語/理科/社会 all run grades 1–6 (国語/算数 grades 1–2 shipped
2026-07-17; 国語4 and 外国語5 — the last two holes — shipped 2026-07-18) and
外国語 covers grades 3–6 via `letstry1`/`letstry2`/`eigo5`/`nh6`. The
architecture (static frontend + Supabase RLS, no app server) has held up well
across all of this; nothing this week required bending that model. Mizuho
(瑞穂小学校) remains the only populated school.

The two risks flagged the day Kadaiban and the grade-1/2 wave shipped both
turned out to matter within 24 hours: the shared `module-units.js` registry
that had already corrupted twice under parallel PRs is now permanently
decentralized (each module owns its own `units.js`), and Kadaiban's
holistic single-grade reporting had a real double-grading bug that had
already corrupted a production row before it was caught and fixed. Both
closed 2026-07-18 — see the completed items in Near-term debt below.

A second school (羽咋市立羽咋小学校) is now provisioned (classes + staff, no
students yet), and coordinator management now exists end-to-end — so the
platform is no longer strictly single-school in either data or tooling, even
though Mizuho remains the only school with real student usage.

## Progress since last update (2026-07-20 → 2026-07-21)

A heavy consolidation + bug-fix window, mostly staff-reported issues via the
in-app bug button; no new curriculum modules. All merged and deployed:

- **Coordinator management shipped end-to-end** (#114 → #117). There was no way
  for a platform admin to create a coordinator or set the schools they oversee,
  and a latent `admin-common.js` bug (`.limit(1)` in `lookupAdminTier`) capped
  any coordinator at a single school regardless. Fixed: `provision-account` now
  accepts the `coordinator` kind (redeployed to prod as v6), `teachers.html`
  gained the create option + a platform-admin-only cross-school scope checklist,
  and the auth resolution now unions all of a staff member's schools.
- **Class-detail module-assignment consolidation** (#113 → #116). Removed the
  duplicate assignment write-surface (and a pointless required 問題数 field)
  from `hub/admin/class-detail.html`; that section is now a read-only view that
  links to the gradebook — the intended home for assignment/scheduling.
- **Second-school rollout groundwork** (#105). Added a bulk "enable modules for
  a school" action to the admin console (replacing ~24 individual toggles) and
  an onboarding runbook (`docs/second-school-onboarding.md`). Two stray test
  schools were cleaned out of prod; 羽咋 (`hakui-honsho`) kept as the real
  second-school candidate, awaiting student rosters.
- **Kadaiban draw-screen bug fixes** — three distinct issues on the same 戻る
  button, all staff-reported: resizing while drawing + a stray "フェーズ2" dev
  label (#106 — root cause was the recurring `button{width:100%}` footgun, fixed
  by self-containing `kadaiban.html`'s CSS), near-transparent styling (#107),
  and 戻る returning to the in-page worksheet list instead of the hub (#109).
- **Edge-function source recovery** (#115). Two functions live in prod
  (`update-teacher`, `student-login`) had no source in the repo — recovered
  verbatim, closing a source-of-truth drift hazard (the `db/`-mirror problem,
  but for Edge Functions).
- **`nh6` display rename** (#110) → "外国語 6年" to pair with `eigo5` in the
  catalog; the full internal key rekey to `eigo6` is deferred (debt #8).
- **Project handbook** (#118): added `docs/PROJECT_HANDBOOK.md`, a single
  entry-point orientation doc that ties the project together and defers to this
  roadmap and `CLAUDE.md` for live status and rules.

## Progress since last update (2026-07-18 → 2026-07-19)

The previous roadmap pass was written mid-day on 07-18, before that day's
biggest news landed a few hours later. Folding in everything since:

- **The grades 1–6 core curriculum grid shipped complete** (#101 `kokugo4`,
  #100 `eigo5`, both 2026-07-18 afternoon, built in parallel by separate
  subagents — the first real parallel-module batch since the
  `module-units.js` decentralization (#99) closed the shared-registry risk
  that morning, and it held up: no registry conflict). #102 followed same day
  reconciling the docs/migrations against what actually landed live. This
  closes the milestone flagged in the prior roadmap's "New ideas" section as
  "one clear action away" — reading comprehension for kokugo4/5/6 and the
  supplementary kanken/eiken tiers are the only curriculum gaps left; see
  Curriculum modules below.
- **A real (if narrow) code-quality bug from 07-18 was caught and fixed the
  next morning** (#103, 2026-07-19). Five generator files — `sansu1/2/4/6`
  `app.js` and `rika3-gen.js` — built their dedup signature as
  `q.q + ' ' + q.answer` using a **literal raw NUL byte** typed into the
  source instead of the `'\u0000'` escape sequence (rika3 used the escape;
  the sansu files had the raw byte baked into a compiled/minified string).
  The raw byte made `git diff`/`grep` treat those files as binary, silently
  hiding real changes from diff-based review — a review-tooling blind spot,
  not a runtime bug (`'\u0000'` and the literal byte are the same one-character
  string, so dedup keys were already correct). Fixed by normalizing all five
  to the `sansu3`-reference `'\u0000'` escape convention. Verified today: a
  repo-wide scan (`git grep` + `file` over every module `.js`) turns up no
  remaining binary-flagged JS files — the fix was complete, not partial.
- **07-20 is quiet as of this check:** zero open PRs, zero open issues,
  nothing merged yet today. `CLAUDE.md` needed no changes across this window
  — no new DB surface, no new hard-rule violation to record.

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
4. **Leaked-password protection is still off — blocked on the Supabase
   free tier.** The HaveIBeenPwned check is a **paid-plan feature**; the
   project is currently on the free tier, so it cannot be enabled yet. It's
   a Dashboard toggle (Authentication → Policies) once the project is on a
   paid plan — not something console access alone can flip today. Revisit
   after any tier upgrade.
5. ~~Build `SPEC_decentralize_module_units.md`~~ **done 2026-07-18** (#99) —
   the shared-registry corruption class is closed; `kokugo4`/`eigo5` built
   in parallel the same day with zero registry conflict, proving the fix.
6. **Test coverage is inconsistent and un-enforced — and the 07-18 kadaiban
   bug is a concrete case, not a hypothetical one.** Only 13 of 29 modules
   have a `tests/<key>/` directory — the rest (`rika3/4`, `shakai3–6`,
   `sansu3/4`, all five English-family modules, `kanken*`, and `kadaiban`)
   have none. There is still no CI workflow enforcing `CLAUDE.md`'s stated
   testing bar (stress test + flow test + migration idempotency). The
   double-grading bug (#83/#97) shipped past a manual rolled-back-transaction
   test that only covered a single grade, not a re-grade — exactly the kind
   of scenario a real flow test would encode once and run on every future
   kadaiban PR. Use it as the motivating case when the "real CI test suite"
   engineering item below finally gets built.
7. **First-ever performance advisor pass surfaced real findings — nobody has
   looked at this axis before.** `get_advisors(type=performance)` (run for
   this update, 2026-07-20) returns 106 lints across the live schema: **78
   `multiple_permissive_policies` WARNs** across 12 tables (`profiles`,
   `schools`, `enrollments`, `classes`, `school_members`, `class_teachers`,
   `class_modules`, `school_modules`, and all four `kadaiban_*` tables each
   have overlapping permissive policies for the same role/action — e.g.
   `class_modules` has both `cmod_read` and `cmod_write` as separate
   permissive `SELECT` policies for `anon`, which Postgres must OR-evaluate
   per row), **13 `auth_rls_initplan` WARNs** (RLS policies re-evaluating
   `auth.<function>()` per-row instead of `(select auth.<function>())`,
   `profiles_read` is one), and **14 `unindexed_foreign_keys` INFOs** (e.g.
   `activity_results.module_id` has no covering index). None of this is a
   security issue — the existing security-advisor debt (items 3–4 above) is
   unrelated and still separately open — but at Mizuho's current single-school
   scale it's cheap to defer and expensive to accumulate silently. Worth a
   dedicated pass before a second school multiplies the row counts these
   policies scan.
8. **Full rekey of `nh6` → `eigo6` (low priority).** As of 2026-07-21 the
   grade-6 English module's *display name* was aligned with `eigo5` (both now
   read `外国語 5年` / `外国語 6年` in the hub — migration
   `20260721000411`), but its internal key is still `nh6`: the directory
   (`modules/nh6/`), `launch_url`, `nh6-report.js` (whose `activity_results`
   lookup is `.eq('key','nh6')`), and the `nh6-*` localStorage keys all still
   use the old key. A full rekey to `eigo6` would make the 5/6 English pair
   consistent internally too, but it's URL/directory-invisible to users and
   carries a real deploy-ordering step (rsync `--delete` swaps the directory on
   merge, so the hub tile 404s until a post-deploy `key`/`launch_url` migration
   lands — same trap as a module registration). Not worth that risk for a
   cosmetic gain now; do it opportunistically if `nh6`'s files are being
   touched anyway (e.g. when fixing its hand-rolled reporter, debt #1).
9. **Admin-console UX thinness (surfaced by the #114 coordinator work).** The
   console is multi-school-capable now, but several staff-management gaps
   remain: no way to **edit a staff member's role** after creation (the
   edit-teacher modal only does name/password), no **staff removal/deactivation**
   (students have a delete action; staff don't), no **school edit/status editor**
   on `schools.html` (create-only; status is a read-only badge), and no
   **cross-school staff directory / user search** (can't tell if an email
   already has an account, or see a coordinator's full footprint at a glance).
   None are blocking at current scale; they get more painful as coordinators and
   a second school come online. Small, additive, reuse existing modal patterns.
10. **`modules.html` bulk-assign matrix drops assignment metadata.** The
    per-class assign matrix on the modules page writes `class_modules` rows with
    `total_items`/`due_date`/`focus_units` all null, unlike the gradebook's
    assign flow — so bulk-created assignments are shaped differently from
    individually-created ones (noticed during the #113 consolidation). Minor
    data-shape inconsistency; decide whether bulk-assign should carry defaults or
    prompt for them.

## What's next — by domain

Each item below is a pointer; the linked doc holds the detail.

### Curriculum modules → [`planning/MODULE_ROADMAP.md`](planning/MODULE_ROADMAP.md)

**The grades 1–6 core grid is now complete** — 算数/国語/理科/社会 all run
grades 1–6, 外国語 covers grades 3–6 (`letstry1/2`, `eigo5`, `nh6`). The last
two rungs, **kokugo4** and **eigo5**, shipped 2026-07-18 (#101, #100) the same
day the registry-corruption blocker closed, built in parallel with zero
conflict. With the empty-cell grid closed, remaining curriculum gaps are all
depth, not coverage: the still-deferred **reading comprehension for
kokugo4/5/6** (all three ship kanji+grammar only), and the kanken/eiken
supplementary tier gaps (漢検 grades 1/2/6 have no drill, largely duplicative
of kokugo kanji so still low priority — see `MODULE_ROADMAP.md`). Worth
flagging to whoever owns the Mizuho relationship: this is a real,
marketable "full elementary curriculum" milestone, not an internal-only one.

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
in** — the double-grading fix (#97, 2026-07-18) — which is itself evidence
for the gate below: the launch-day rolled-back-transaction test didn't cover
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
  prescribing exactly that testing bar per module, and despite 13 of 29
  modules now having hand-run tests sitting in `tests/<key>/` unused by any
  workflow. This is still the cheapest engineering win on the roadmap: the
  tests mostly already exist, they just aren't wired to run automatically.
  Stand up a lightweight `test.yml` (headless-browser flow test + generator
  stress test) on every PR touching `gakuenza.com/modules/**`, independent of
  the bug-report automation.
- **Extend the bug pipeline past UI bugs.** The autofix loop is now proven at
  5/5 real fixes across two days (#57, #58, #75, #77, #79) — solidly past
  "promising prototype." Natural next step: a scheduled (cron) sweep that runs
  the mandated generator stress tests and files its own `bug_reports` when a
  generator regresses — closing the loop between the testing bar and actual
  CI, and giving the pipeline a source of issues that doesn't depend on a
  human clicking the bug-report button first.
- **Audit other shared append-only files for the `module-units.js` failure
  mode.** `module-units.js` itself was fixed 2026-07-18 (#99), and the
  `kokugo4`/`eigo5` parallel batch that followed the same day confirms the
  fix holds. The root cause — a single hand-edited file every parallel module
  PR touches, "protected" by a `merge=union` stopgap that actually corrupts
  structured JS — is a pattern, not a one-off, and still hasn't been checked
  anywhere else in the repo: the nav/menu registrations each hub page
  hand-edits, and any other `window.SOMETHING = {...}` registry a module PR
  is expected to append to. Still open — no batch has forced it since.
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
  requires hand SQL via `provision-account`). **This is now the more urgent
  half of the "worth doing" set** — with the curriculum grid complete
  (2026-07-18) and the recent bug queue quiet, second-school readiness is the
  most concrete way to grow the platform's actual reach rather than deepen
  Mizuho's coverage further.
- **A recurring Supabase advisor sweep — now run once, still not scheduled.**
  A security-advisor pass was run for the 2026-07-18 update (no new findings
  beyond the already-tracked debt items 3–4); a **performance**-advisor pass
  was run for the first time for this 2026-07-20 update and surfaced real,
  previously-unrecorded findings — see Near-term debt #7. Two real P0s
  surfaced from manual review in the prior week (the profiles
  self-escalation grant on 2026-07-17, earlier advisor-flagged issues on
  2026-07-15) plus the kadaiban double-grading bug (2026-07-18, a
  data-integrity issue an advisor sweep wouldn't have caught, but which
  strengthens the same underlying point). Nothing currently runs this
  automatically — every pass so far, including today's, has depended on a
  human/session choosing to look. `get_advisors` is cheap to run for both
  `security` and `performance` types — worth a periodic (weekly?) scheduled
  check, covering both types, rather than relying on the next contributor to
  think to run it during unrelated work.

## New ideas & frontiers (2026-07-20)

Fresh proposals prompted by this update's review — not yet scoped as specs,
offered as directions worth a deliberate look rather than decisions:

- **The curriculum-coverage milestone is done — the platform's growth axis
  should shift from "build more modules" to "reach more schools / go
  deeper on data quality."** With 算数/国語/理科/社会 complete grades 1–6 and
  外国語 complete grades 3–6, the marginal next module (more kanken tiers,
  reading comprehension) has real but visibly smaller impact than the P0
  product features (F1 assignment dashboard, F16 offline resilience) or
  second-school rollout readiness. Worth a deliberate conversation about
  which of those three — feature depth, reach, or reliability — is the next
  quarter's actual priority, rather than defaulting back into module-building
  momentum out of habit.
- **Performance-advisor findings (Near-term debt #7) are cheap to fix now and
  expensive to leave for a second school.** All three finding classes —
  `multiple_permissive_policies`, `auth_rls_initplan`, `unindexed_foreign_keys`
  — get *worse*, not just *unaddressed*, as row counts grow: RLS policies
  that OR-evaluate two permissive policies per row, or re-run
  `auth.uid()` per row instead of once per query, scale linearly with
  table size. Fixing them now, against Mizuho's single-school data volume,
  is a low-stakes place to learn the pattern (consolidate `cmod_read`/
  `cmod_write`-style pairs into one policy with an OR'd `USING` clause; wrap
  `auth.<fn>()` calls in `(select …)`) before doing it under the pressure of
  a second school's traffic.
- **Audit closed-without-a-fix issues before this recurs a third time —
  still open, not yet done.** Issue #83 was closed as "completed" with no
  actual fix landed on 2026-07-17, and the bug it described corrupted
  production gradebook data for roughly a day before #97 (2026-07-18)
  actually fixed it. That's a process gap, not just a code bug — worth a
  cheap one-time pass cross-referencing other closed issues against whether
  a merged PR/commit actually references them, rather than trusting "closed"
  to mean "fixed." Still worth doing; nothing has forced it since it was
  first flagged.
- **Document the single-grade "update-in-place" reporting pattern before the
  next holistic-grading feature reinvents it wrong — still open.** The
  07-18 kadaiban fix established that its reporting shape (1 submission : 1
  grade, re-gradable, must update not insert) is a real, distinct variant of
  `reportActivityWithItems` usage from the standard per-attempt-insert
  pattern every drill module uses. Nothing currently documents *which shape a
  new feature should pick* — a future holistic-grading feature (an essay
  review tool, a portfolio-style assessment) could make the same
  `Date.now()`-in-the-ref mistake kadaiban did. A short note in
  `docs/codebase-and-db-structure.md` next to `HubCommon` would be enough.
- **The review-tooling blind spot behind #103 is worth a one-line style-guide
  addition, not just a one-time fix.** The raw-NUL-byte incident (five files
  silently binary-flagged, hiding real diffs from review for at least a day)
  happened because nothing in `CLAUDE.md` says "generator dedup separators
  use the `'\u0000'` escape, never a literal control character." The fix
  itself is verified complete (repo-wide scan today found no remaining
  binary-flagged `.js` files under `modules/`), but the convention that would
  have prevented it isn't written down anywhere a future module PR would see
  it — small enough to add as a one-line note near hard rule 2 in
  `CLAUDE.md` (or a "generator conventions" aside) next time that file is
  touched.
- **Three-day pattern worth watching, not yet acting on:** every real bug
  found this week (the profiles P0 on 07-17, the kadaiban double-grade on
  07-18, the binary-file blind spot on 07-19) was caught by a human/session
  reviewing shipped work after the fact, not by any automated check — there
  is still no CI, and the autofix pipeline only reacts to a human clicking
  the in-app bug button. That's a reasonable interim safety net for a
  single-teacher pilot, but it will not scale past one school; the "real CI
  test suite" and "recurring Supabase advisor sweep" engineering items above
  are the two concrete steps that would turn this from a lucky habit into a
  system property.

## Explicitly not proposing

- **No framework/build-step migration** — the static-HTML model is working and
  isn't the bottleneck on anything above.
- **No new backend service** — everything fits the existing
  browser-talks-to-Postgres-via-RLS shape.
- Product features deliberately rejected (student DMs/chat, student-facing AI
  tutor, public comparative leaderboards, native mobile app) are cataloged with
  reasons under **Recommend AGAINST** in
  [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md).
