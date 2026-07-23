# Gakuenza — Roadmap (single source of truth)

_Last updated: 2026-07-23. Living planning doc, not a spec._

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

## Progress since last update (2026-07-23 — the single biggest day yet)

Roughly 25 PRs landed in one day (#123 → #149), spanning docs, content depth,
a redesign, three autofixes, and — the headline item — the project's first
real CI test suite. Nearly every open near-term-debt item below got touched.
In rough chronological order:

- **Teacher-facing enablement**: an in-app teacher-documentation viewer
  (`hub/guides.html`, #124), an `OPERATIONS.md` owner/handoff runbook (#127),
  and a teacher-guide curriculum sign-off tracker (#128) — all ahead of the
  2学期 restart these docs were written for.
- **Content-depth fills for the modules debt #11 (2026-07-21) flagged as
  thin**: `rika3` (#125, 59→124 questions), `rika4` (49→106), `rika5`
  (50→103), `rika6` (53→98), and `shakai4` (66→150) all roughly doubled their
  question banks (verified by a fresh grep-count against this update, not
  just trusting the PR descriptions). **This closes debt #11** for the five
  modules it named; `shakai3`/`shakai6`/the `kokugo` family were never
  flagged as thin and weren't touched — worth a real per-section audit
  (not the napkin grep this and the 07-21 pass both used) before calling the
  whole catalog depth-clean.
- **The five hand-rolled reporters fixed** (#126) — `nh6`, `nhvocab`,
  `letstry1`, `letstry2`, `shakai3` now all route through
  `HubCommon.reportActivityWithItems` and populate `activity_result_items`.
  **This closes debt #1**, the oldest item on this list.
- **Adoption-status recorded** (#134): grades 3年/5年 went live for real
  students 2026-07-23, hours after the reporter fix above landed — see the
  adoption-watch item under New ideas below, including what today's actual
  numbers showed.
- **Kadaiban catalog-anchor fix** (#136): the `kadaiban` reporting-anchor
  module (`is_active=false`, `launch_url=null`) was showing up as a dead tile
  in the catalog/student grid; excluded modules with a null `launch_url`.
- **Three autofix-pipeline fixes**, all real staff/user reports, zero human
  code review needed beyond merge: gradebook-to-hub back-navigation (#138/139),
  an Eiken interview-question read-order bug (#135/137), and an Eiken
  listening-screen white-box UI bug (#142/143).
- **Two visual redesigns to the satoyama design mockup**: `eigo5` (#140) and
  `nh6` (#141), the two modules the UI-redesign doc flagged as visually
  plainest next to the polished `nhvocab`/`eiken` tier.
- **The CI test suite shipped — Phase 1 and Phase 2 in the same day** (#144,
  #145): a zero-dependency `tests/run.mjs` runner (`syntax` / `unit` / `e2e`
  modes) plus `.github/workflows/ci.yml` running on every PR — syntax +
  unit jobs, and a Playwright e2e job driving each module's real quiz flow
  headless. Test backfill brought coverage from 13/29 to **28/29 modules**
  (only `kadaiban`, which has no drill content, has none — reasonable). The
  eiken backfill pass itself caught and fixed **3 duplicated-option
  questions** (#145) — the first bug the new suite ever caught, on day one.
  **This substantially closes debt #6**, open since this doc's first draft.
- **Wired `rika3` into `focus_units`** (#146) — shipped `modules/rika3/units.js`
  and the `getFocusUnits()` read, same shape as `sansu3`. **Closes debt #2.**
- **`modules.html` bulk-assign no longer drops assignment metadata** (#147) —
  the matrix now writes `total_items`/`due_date`/`focus_units` like the
  gradebook's assign flow does. **Closes debt #10.**
- **First-ever performance-advisor fix pass** (#148): the 14
  `unindexed_foreign_keys` and all 13 `auth_rls_initplan` findings from debt
  #7 are fixed and confirmed at 0 by a fresh advisor run. The 78
  `multiple_permissive_policies` findings are deliberately still open — see
  debt #7 for why, and New ideas below for why this is now the most
  concrete piece of the "before a second school" list.
- **Security-definer pass** (#149): investigated all 9 SECURITY DEFINER
  functions + 2 views the security advisor flags; revoked `anon` EXECUTE on
  the one genuinely-unnecessary case (`app_set_module_active`), documented
  the rest as accepted-by-design with DB `COMMENT`s. **Closes the actionable
  part of debt #3**; the "move read helpers to a non-exposed schema" idea
  stays deliberately deferred (all-RLS-refactor risk).

Net effect: of the 11 near-term debt items tracked as of 2026-07-21, **6 are
now closed or substantially closed in a single day** (#1, #2, #3's actionable
part, #6, #10, #11), and a 7th (#7) is half-closed. What's left below is
either genuinely large (#7's remaining 78 findings, #9's admin UX gaps) or
deliberately deferred (#4's tier-locked feature, #8's cosmetic rekey). See
New ideas & frontiers below for what that clearing means for what's next.

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

## Progress since last update (2026-07-21, later the same day)

Two more PRs landed after the pass above — one docs, one real content fix:

- **Full docs-currency pass** (#119 → #120, `42482a0`/`ed21822`): a live
  verification sweep (`list_tables`, `execute_sql`, `list_edge_functions`,
  `list_migrations`, `get_advisors`) refreshed `codebase-and-db-structure.md`
  from its stale 2026-07-15 snapshot and corrected the handbook's DB counts to
  match (19 public tables, not 20; 30 migrations, not 29). **The row counts
  this pass surfaced are the more important finding than the doc fix itself:**
  `activity_results` is **14 rows**, `activity_result_items` **60**,
  `observation_records` **1**, live today — against 106 enrolled Mizuho
  students, 9 classes, and 29 active modules. (That snapshot was the
  summer-break lull; **real adoption began 2026-07-23** — see the adoption
  note under New ideas below.)
- **shakai5 content-depth fix** (#121, `0880b0c`): 89 new original questions
  (98 → 187) across all 5 units, closing a "low-variety audit flag" — some
  sections had as few as 4–8 questions. This is the first fix of its kind:
  every prior module milestone was about *coverage* (does a subject/grade
  cell exist), this one is about *depth* (is the cell's question bank thick
  enough to not repeat within a term). See Near-term debt #11 and New ideas
  below — the coverage grid being "done" (row 217) didn't mean depth was
  checked anywhere else.
- **Operationally quiet**: zero open issues, zero open PRs as of this check —
  the autofix pipeline has had nothing to react to since #107 (2026-07-21
  morning).

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

1. ~~**Fix the five hand-rolled reporters.**~~ **Done 2026-07-23 (#126).**
   `nh6`, `nhvocab`, `letstry1`, `letstry2`, and `shakai3` now route through
   `HubCommon.reportActivityWithItems` and populate `activity_result_items`,
   so the gradebook's per-question analysis covers all 29 modules. Each app's
   answer state is threaded into a per-question `items` array
   (`itemRef/category/prompt/correct/selectedAnswer/correctAnswer`); verified
   end-to-end with a stubbed-Supabase headless flow test (21/21), including
   driving nhvocab's real UI to confirm items land. letstry1's match/build
   stay summary-only (they track no per-question outcome).
2. ~~**Wire `rika3` into `focus_units`.**~~ **Done 2026-07-23 (#146).** Ships
   `modules/rika3/units.js` (keys `u1_haru … u11_jishaku`, matching
   `rika3-data.js` UNIT_KEYS exactly) and `getFocusUnits()` in
   `rika3-report.js`, same shape as the `sansu3` reference. `rika3` joins
   `sansu3`/`kokugo3`/`rika4`/`sansu4`/`shakai4` as the 6th module reading
   `focus_units` for real.
3. **SECURITY DEFINER EXECUTE pass** (advisor finding #6). **Investigated +
   partially closed 2026-07-23 (migration `20260723061812`, PR #149).** The
   security advisor flags 9 SECURITY DEFINER functions (0028/0029) and 2
   SECURITY DEFINER views (0010) as anon/authenticated-reachable. On inspection
   almost all of it is intentional and low-exposure, **not** the "shrink the
   anonymous attack surface" win the original note assumed:
   - The 8 read helpers (`app_user_*_ids`, `app_has_role`, `app_is_platform_admin`,
     `app_class_school`) are all `auth.uid()`-scoped — called via `/rpc` they
     reveal only the **caller's own** context. They are called inside nearly
     every RLS policy, so `authenticated` MUST keep EXECUTE (revoking it, or
     `SECURITY INVOKER`, would lock users out). Left as-is, documented as
     accepted with a DB `COMMENT` on each.
   - `public_classes` / `public_schools` are SECURITY DEFINER **on purpose** —
     they feed the pre-login school/class pickers to `anon`; `security_invoker`
     would break login. Documented with a `COMMENT` each; do not "fix".
   - **Done:** revoked `anon` EXECUTE on `app_set_module_active` — the only
     mutating helper and the only one not referenced by any RLS policy (so no
     lockout risk); it already self-guards on `app_is_platform_admin()`.
   - **Deferred (optional hardening):** moving the read helpers into a
     non-exposed schema would drop them from the API surface entirely and clear
     the 0028/0029 WARNs, but it is an all-RLS refactor (rewrite every policy
     reference) with real lockout risk — belongs in the pre-second-school
     hardening pass, verified on a Supabase branch, not a bulk sweep.
4. **Leaked-password protection is still off — blocked on the Supabase
   free tier.** The HaveIBeenPwned check is a **paid-plan feature**; the
   project is currently on the free tier, so it cannot be enabled yet. It's
   a Dashboard toggle (Authentication → Policies) once the project is on a
   paid plan — not something console access alone can flip today. Revisit
   after any tier upgrade.
5. ~~Build `SPEC_decentralize_module_units.md`~~ **done 2026-07-18** (#99) —
   the shared-registry corruption class is closed; `kokugo4`/`eigo5` built
   in parallel the same day with zero registry conflict, proving the fix.
6. ~~**Test coverage is inconsistent and un-enforced.**~~ **Substantially
   done 2026-07-23 (#144, #145).** `.github/workflows/ci.yml` now runs on
   every PR and push to `main`: a syntax + unit job (zero-dependency,
   `tests/run.mjs`) and a Playwright e2e job driving each module's real quiz
   flow headless. Backfill brought coverage from 13/29 to **28/29 modules**
   (only `kadaiban`, which has no drill content, has none — reasonable, not
   a gap). Verified live in this session: `node tests/run.mjs syntax` passes
   clean across all 28 test dirs. **The suite already caught a real bug on
   day one** — the eiken backfill pass found and fixed 3 duplicated-option
   questions (#145) — direct proof this isn't just checkbox coverage. The
   kadaiban double-grading bug (#83/#97) that motivated this item is exactly
   the class of regression a re-grade-scenario flow test would now catch
   automatically on every future kadaiban PR — worth adding one, since
   kadaiban is the one module still without any `tests/` directory.
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
   **UPDATE 2026-07-23 (partial pass done, PR #148):** the two low-risk,
   semantics-preserving categories are fixed and applied live — the **14
   `unindexed_foreign_keys`** now have covering indexes (migration
   `20260723060456`), and all **13 `auth_rls_initplan`** policies wrap their
   bare `auth.uid()` as `(select auth.uid())` via atomic `ALTER POLICY`
   (`20260723060519`); the performance advisor confirms both categories dropped
   to 0. (The advisor now shows 13 *new* `unused_index` INFOs — expected: a
   freshly-created index has zero scans until traffic hits it; do NOT "fix"
   these by dropping the FK indexes.) **The 78 `multiple_permissive_policies`
   are deliberately still open.** They are almost all an `ALL` write-policy
   overlapping a `SELECT` read-policy on the same table; consolidating them
   means splitting each `ALL` into INSERT/UPDATE/DELETE and folding its SELECT
   arm into the read policy — a security-model refactor on the exact RLS
   machinery behind this project's documented P0s, for a WARN-level perf hint at
   single-school scale. That belongs in a deliberate, per-table, branch-verified
   pass, not a bulk sweep — leave it for the pre-second-school hardening.
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
   cosmetic gain now; do it opportunistically the next time `nh6`'s files are
   being touched anyway. (The debt-#1 reporter fix touched `nh6` on 2026-07-23
   but deliberately kept the `nh6` key to avoid the deploy-ordering trap; a
   full rekey is still its own separate task.)
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
10. ~~**`modules.html` bulk-assign matrix drops assignment metadata.**~~
    **Done 2026-07-23 (#147).** The per-class assign matrix now writes
    `total_items`/`due_date`/`focus_units` the same way the gradebook's
    assign flow does — bulk- and individually-created assignments are the
    same shape again.
11. ~~**Content-depth audit for `rika3`–`rika6` and `shakai4`.**~~ **Done
    2026-07-23** (rika3/4/5/6 + shakai4 content-depth fills, #125/#130/#131/
    #132, plus the original rika3 fill folded into the same batch). Verified
    by a fresh grep-count against this update (not just the PR descriptions):
    `rika3` 59→124, `rika4` 49→106, `rika5` 50→103, `rika6` 53→98, `shakai4`
    66→150 — all now comparable to `shakai5`'s 187 and `shakai6`'s 115.
    **Not yet checked, and not currently flagged as thin:** `shakai3`,
    `shakai6`'s per-section balance, and the `kokugo` family. The underlying
    process gap from the 07-21 note still stands — "coverage complete" and
    "content-ready" are still two different, separately-tracked facts, and
    nothing runs this check automatically. A real per-section count (not the
    napkin whole-file grep this and the 07-21 pass both used) across the
    remaining untouched modules would be the next honest step, not assuming
    the fixed five were the only thin ones.

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
`nhvocab`/`eiken` tier. The detail doc defines a copy-paste **"Module UI
Kit"** that levels them up **without** violating hard-rule #1 (no shared
stylesheet), plus child-UX specifics (touch targets, furigana, contrast) and a
phased, per-module plan with a worked `kokugo3` before/after. **`eigo5` and
`nh6` were re-skinned to the satoyama mockup 2026-07-23** (#140, #141) — the
eigo5 redesign's reporting wiring is verified passing its flow test in this
session; `nh6` has no flow test to verify the same, see New ideas above.
`nhvocab` still carries the pre-Gakuenza beta layout and is the natural next
redesign target now that eigo5/nh6 are done.

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

- ~~**A real CI test suite.**~~ **Shipped 2026-07-23 (#144, #145).**
  `.github/workflows/ci.yml` runs syntax + unit + Playwright e2e flow tests
  on every PR and push to `main`; coverage went from 13/29 to 28/29 modules
  in the same day, and the suite caught a real bug (3 duplicated-option
  eiken questions) on its first run. Only `kadaiban` has no test directory —
  see New ideas (2026-07-23) above for why that's the natural next target.
- **Extend the bug pipeline past UI bugs — now cheaper than it was.** The
  autofix loop is proven at 8/8 real fixes (#57, #58, #75, #77, #79, #135,
  #138, #142). Natural next step, and easier now that `ci.yml` exists as a
  template: a scheduled (`schedule:`) workflow that runs the same
  `tests/run.mjs e2e`/generator stress tests nightly and files its own
  `bug_reports` (or GitHub issue) when a generator regresses — closing the
  loop between the testing bar and actual CI, and giving the pipeline a
  source of issues that doesn't depend on a human clicking the bug-report
  button first.
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
  think to run it during unrelated work. **Update 2026-07-23:** both types
  were run again and acted on (the security-definer pass, #149, and the
  perf-advisor fix pass, #148) — still by a human/session choosing to look,
  not on a schedule. This is the same idea as the "extend the bug pipeline"
  bullet above and is now equally cheap to wire into `ci.yml`'s pattern —
  worth doing together rather than as two separate efforts.

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

## New ideas & frontiers (2026-07-21)

Fresh proposals prompted by today's later pass — not yet scoped as specs:

- **ADOPTION STARTED 2026-07-23 — grades 5年 and 3年 are now load-bearing
  (actually in use by students from today onwards); 6年 follows soon.**
  This ends the summer-break lull ahead of the earlier "~late August 2学期"
  estimate — real student traffic on the grade-3 and grade-5 modules begins
  now. **Direct overlap with the same day's shipped work:** the content fills
  (#125: rika3/rika5/rika6) and the reporter fix (#126: shakai3 is grade-3,
  nh6 is grade-6) all landed 2026-07-23, hours before adoption — so the very
  code that just changed is now in front of real students. First read-only
  prod check right after the merges showed no post-fix attempts yet (only 4
  pre-fix `letstry1` attempts from 07-22 with 0 item rows — expected history,
  not a regression). **What to watch now:** `activity_results` growth for
  grades 3/5/6 and, specifically, that new attempts in the five fixed modules
  populate `activity_result_items` (`item_rows > 0`) — that's the live proof
  the #126 fix works with real students, not just the stub flow test. If real
  traffic appears but items stay empty, investigate the reporter wiring first.
  (Prior context, now superseded: the 2026-07-21 snapshot of 14
  `activity_results` / 1 `observation_records` rows was the seasonal lull,
  confirmed with the owner at the time; the drop from the doc's earlier ~1,359
  figure was partly the 2026-07-16 seed purge.)
- **NH English apps (`nh6`, `nhvocab`) are out for a design makeover
  (2026-07-23, in-flight).** Both still carry the pre-Gakuenza beta design
  layouts and were shipped to design for a visual refresh. **Guardrail for the
  redesign:** preserve the Gakuenza reporting wiring added in #126 — app.js
  accumulates per-question detail in `handleAnswer` and passes an `items`
  array to `window.hk.syncQuizResult`, which routes through
  `HubCommon.reportActivityWithItems`. A visual-only makeover must keep that
  data path intact (and the `module-account-mount` account bubble, the shared
  session, and `hub-common.js` load order) or the gradebook loses this
  module's per-question data again. Re-run the reporter flow test after the
  redesign lands.
- **"Coverage complete" and "content-ready" turned out to be two different
  claims, and only the first one was ever checked.** The grades-1–6 grid
  (row 217) was marked complete 2026-07-18 based on the coverage matrix — one
  ✅ per subject/grade cell. shakai5 had a ✅ and still needed 89 more
  questions to stop repeating within a section. Nothing between 07-18 and the
  bug report that triggered #121 was systematically checking per-section
  question depth across the 29-module catalog. Near-term debt #11 above is
  the concrete next step (audit `rika3`–`rika6`/`shakai4`); the broader
  point for future module work is that "the cell has a ✅" and "the cell has
  enough content" need to be tracked as separate facts, not conflated the way
  the coverage matrix currently does.
- **Documentation is unusually current right now — a good moment to let it
  rest.** Three docs (`CLAUDE.md`, this roadmap, `codebase-and-db-structure.md`)
  plus the new `PROJECT_HANDBOOK.md` all got real verification passes within
  the same 48 hours (07-20/07-21), each catching genuine drift (stale row
  counts, a table-count miscount that propagated from the handbook into
  nothing else, thankfully). That's a good state to be in, not a backlog to
  keep grinding on — the next update to any of these four should be forced
  by real work (a feature ships, a schema changes, a number goes stale again),
  not by another dedicated docs pass. Spend the next session's effort on
  term-start prep instead — teacher-facing materials (semester docs + a
  teacher user guide) and the content-depth fills (debt #11), ahead of the
  2学期 restart.

## New ideas & frontiers (2026-07-23)

Fresh proposals prompted by today's review — the biggest single day of work
this project has had, and a genuine inflection point: the near-term debt
list went from 11 open items to effectively 4. Checked live against the
Supabase project and this session's own test run, not just the PR
descriptions, before writing any of this:

- **Real finding, not a guess: adoption day itself produced zero real
  student activity.** The 07-21 note flagged "ADOPTION STARTED 2026-07-23"
  and set up a specific thing to watch — `activity_results` growth for
  grades 3/5/6, with item rows populating for the five newly-fixed
  reporters. Checked live at 20:09 JST (after the school day would be over):
  `activity_results` sits at **18 rows total, 0 of them from today** —
  unchanged in shape from the 07-21 snapshot (14 rows) plus the 4
  already-known pre-fix `letstry1` attempts from 07-22. **No new attempts at
  all today, in any module, let alone the fixed five.** This doesn't
  necessarily mean anything is broken — it may simply mean the actual
  in-classroom rollout hasn't started yet despite the code/docs being ready,
  or that today was a non-instructional day at Mizuho — but it's a real gap
  between what the roadmap expected and what happened, worth a direct check
  with whoever owns the Mizuho relationship rather than assuming the
  previous note's "starts now" was accurate. If tomorrow also shows zero,
  that's worth escalating; if traffic does appear, the specific thing to
  re-check is still `item_rows > 0` for the five fixed reporters, since that
  part of the watch was never actually exercised today.
- **The eigo5 redesign's reporting wiring is verified intact — but nh6's
  isn't, and can't be with today's test suite alone.** Ran
  `tests/eigo5/flow.test.mjs` live in this session (Playwright against the
  pre-installed Chromium): it passes, confirming the redesign (#140) kept
  the `HubCommon.reportActivityWithItems` data path the 07-21 guardrail note
  worried about. **`nh6` has no `flow.test.mjs`** — only a `report.test.js`
  that exercises the report function directly, not the actual redesigned UI
  end-to-end — so #141's redesign has no automated proof its `handleAnswer`
  → `items` → `syncQuizResult` chain survived the visual rewrite. Worth a
  `nh6` flow test specifically (not just relying on `report.test.js`) given
  it was touched twice in one day (reporter fix, then redesign) and is about
  to carry real grade-6 traffic.
- **The debt list clearing is itself the signal: this is the moment to
  actually make the "what's next" call the 2026-07-20 note raised and
  deferred.** Feature depth (F1/F16), reach (second-school rollout), and
  reliability (the remaining perf-advisor debt) were named as the three
  live options three days ago; today's work picked reliability by default
  (debt #3/#6/#7/#10/#11 are the ones that closed) without anyone deciding
  that on purpose. With the near-term list this thin for probably the first
  time in the project's life, it's worth an explicit choice rather than
  another day of whichever debt item is cheapest to close next.
- **The remaining performance-advisor debt (78
  `multiple_permissive_policies`) is now the single largest concrete item on
  the "before a second school" checklist** — everything else that used to
  share that list (unindexed FKs, RLS initplan wraps, the security-definer
  pass) closed today. It was deliberately deferred as a security-model
  refactor rather than a bulk sweep (see debt #7), which is still the right
  call, but it no longer has company on that list — worth scoping as its own
  dedicated, per-table, branch-verified pass rather than letting it become
  the one thing that never gets its turn.
- **Now that CI infra actually exists, two ideas from earlier this week stop
  being aspirational and become genuinely cheap.** The "recurring Supabase
  advisor sweep" and "extend the bug pipeline past UI bugs" engineering
  items (both still just proposals as of 07-21) can now piggyback on
  `.github/workflows/ci.yml`'s existing scheduling/runner pattern instead of
  needing new infrastructure from scratch — e.g. a weekly `schedule:` job
  calling `get_advisors` for both types and filing a `bug_reports` row (or a
  GitHub issue) on new findings, plus a nightly `tests/run.mjs e2e` sweep
  that does the same for generator/flow regressions. Both were "someday"
  ideas before today; today's CI PR made them a small addition to an
  existing workflow file instead of a new one.
- **`kadaiban` is now the one visibly overdue module for a test directory** —
  not because it's forgotten, but because it's the *only* one left at 28/29,
  and it's also the one module whose one production bug so far
  (double-grading, #83/#97) was a re-grade scenario a flow test would have
  caught. It's a natural, concrete first PR to write against the new e2e
  harness rather than an abstract "add kadaiban tests" backlog item.

## Explicitly not proposing

- **No framework/build-step migration** — the static-HTML model is working and
  isn't the bottleneck on anything above.
- **No new backend service** — everything fits the existing
  browser-talks-to-Postgres-via-RLS shape.
- Product features deliberately rejected (student DMs/chat, student-facing AI
  tutor, public comparative leaderboards, native mobile app) are cataloged with
  reasons under **Recommend AGAINST** in
  [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md).
