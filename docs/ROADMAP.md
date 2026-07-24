# Gakuenza — Roadmap (single source of truth)

_Last updated: 2026-07-24. Living planning doc, not a spec._

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
weekly trend snapshots, a working automated bug-fix pipeline (8 real fixes
shipped through it so far), and **Kadaiban (課題板)**, the platform's first
non-drill feature and first use of Supabase Storage, shipped 2026-07-17. As of
2026-07-23 two foundations that were long missing are also in place: a **CI
test suite** covering all 28 drill modules (runs on every PR), and the
gradebook's per-question analysis now covers **all 29 modules** (the last five
hand-rolled reporters were fixed) — see the 07-23 progress section below. As of
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

**Adoption note (2026-07-23):** grades 3年 and 5年 are now **load-bearing** —
in real use by Mizuho students as of today onward; 6年 is expected to follow
shortly (recorded via #134). Today's live check showed no `activity_results`
traffic through the end of the school day, but that is discounted as
weekend/summer-break timing, not a platform problem.

## Progress since last update (2026-07-23 → 2026-07-24)

A follow-on batch after the big 07-23 window — debt burn-down, a catalog-wide
depth pass, and the first module UI redesigns since eigo5/nh6. All merged:

- **`nh6` → `eigo6` full rekey — closes Near-term debt #8 (#159, #160).** The
  grade-6 English module was rekeyed end-to-end (directory `modules/nh6/` →
  `modules/eigo6/`, `eigo6-report.js` querying `key='eigo6'`, localStorage
  `eigo6-*`, the guide + tests, and the `modules.key`/`launch_url` migration
  `20260723233907`) so the 外国語 5/6 pair is consistent internally too. Done
  **zero-downtime**: the frontend deployed first (verified `eigo6/` live), then
  the DB flipped, with a **redirect stub** left at `modules/nh6/index.html` so
  the deploy-ordering trap the debt item warned about never opened a 404 window.
  Safe timing — 6年 wasn't load-bearing yet and had zero traffic. The 2
  `class_modules` assignments survived (they key on `module_id`, not `key`).
- **Content-depth audit went catalog-wide — extends Near-term debt #11.** #11
  originally scoped `rika3–6` + `shakai4`; this pass audited **every remaining
  drill module** to the same shakai5 bar and filled the genuinely-thin ones:
  `kokugo3` reading units (8→11, #161), `eigo5` sentence mode (5→11/unit, #162),
  `nhvocab` 9 categories (→12 words, #163), and `shakai3` (84→143) + `shakai6`
  (115→198, all sections →11, #166). Confirmed already-deep and left untouched
  (no padding): `kokugo1/2/4/5/6`, `eigo6`, and `letstry1/2`. Every fill is
  original content, stress-tested for structural + distractor-collision bugs,
  with per-section depth-floor assertions added so it can't silently regress.
  **The whole catalog now clears the depth bar** — the "shakai5 isn't the only
  thin one" hypothesis (debt #11) was right, and it's now closed catalog-wide.
- **Let's Try 1 & 2 UI redesigns (#164, #165) — see `planning/UI_REDESIGN.md`.**
  `letstry1`/`letstry2` (外国語活動 3/4年), previously flagged "out of visual
  scope" (inline CSS, ported apps), were re-skinned to the shared washi/indigo
  design system from a design mockup — unit-card grids with per-unit accents +
  progress bars, cream mode-picker, quiz cards, conic-gradient results donut.
  All app logic / reporting preserved; self-contained CSS. **The entire 外国語
  family (grades 3–6: `letstry1/2` + `eigo5/6`) now shares one visual system.**
  A fail-soft `localStorage` per-unit progress tracker was added so the mockup's
  progress bars are real, not decorative. (Deeper polish of the ported English
  apps — `nhvocab` and Let's Try's activity internals — remains backlogged in
  design.)

## Progress since last update (2026-07-21 → 2026-07-23)

A very large merge window — ~30 PRs (#123–#157), the biggest single push since
the platform was assembled. No architecture changes; it was consolidation,
debt burn-down, test infrastructure, and content depth. Grouped by theme:

- **The five hand-rolled reporters are fixed (#126).** `nh6`, `nhvocab`,
  `letstry1`, `letstry2`, `shakai3` now route through
  `HubCommon.reportActivityWithItems` and populate `activity_result_items`, so
  the gradebook's per-question analysis finally covers **all 29 modules** (was
  the longest-standing correctness gap; see hard rule #2, now marked fixed in
  `CLAUDE.md`). This closes **Near-term debt #1** — was already listed done, now
  fully verified.
- **A real CI test suite exists (#144 + #145) — closes Near-term debt #6.** A
  plain-Node runner (`tests/run.mjs`) + GitHub Actions workflow (`ci.yml`: a
  syntax+unit job and a Playwright e2e job) now cover **all 28 drill modules**
  (Phase 1 shipped the harness + 13 modules; Phase 2 backfilled the other 16 via
  parallel subagents). The eiken data test caught a real bug in the process — 3
  of 2142 vocab questions had the answer duplicated into a distractor, fixed.
  **Ordering hazard, now resolved:** #145 (tests) merged before #144 (the
  harness), leaving `main` temporarily unable to run the suite; fixed by merging
  #144 and re-validating every open branch against it. The suite now runs green
  on every PR.
- **Debt burn-down (four items).** #2 `rika3` wired into `focus_units` (#146);
  #10 the `modules.html` bulk-assign matrix no longer clobbers/drops assignment
  metadata (#147, non-clobbering upsert + warn-before-destroy); #7 the
  **performance-advisor** pass, partial (#148) — 14 FK covering indexes + 13
  `auth.uid()` initplan wraps applied live, both advisor categories → 0, the 78
  `multiple_permissive_policies` deliberately deferred; #3 the
  **security-definer** pass, partial (#149) — `anon` EXECUTE revoked on the one
  mutating helper, the rest documented in-DB as accepted-by-design, full
  schema-move hardening deferred. See the updated debt items 3/7 below for the
  reasoning on what was deferred and why.
- **Content depth for the science/social modules — addresses Near-term debt
  #11.** An initial Tier-1 fill wave (#125, plus #130 `shakai4` / #131 `rika6` /
  #132 `rika5`) followed by a systematic per-section **audit** (#151–#155)
  across `rika3`–`rika6` + `shakai4`. The audit's finding: the roadmap's earlier
  napkin question-counts were consistent under-counts — most units were already
  at the ~10–12/section bar (shakai5's #121 depth), so only the genuinely-thin
  units were deepened (mostly A-strand generator units with no rotation headroom
  against the drill length; `rika3` needed nothing). Every fill is original
  content and was collision/structural stress-tested; `rika5` gained its first
  unit test.
- **Admin-console UX — partially addresses Near-term debt #9 (#155).** Shipped
  as pure-frontend over existing RLS: edit a staff member's role, remove a staff
  member from a school (both with self-lockout guards), and a cross-school staff
  directory/search. The auth-adjacent parts (school edit/status, staff
  soft-disable, account-lookup-by-email) were **specced, not built** —
  `docs/specs/SPEC_admin_staff_management.md` — because each needs a
  human-approved, branch-verified RLS/Edge-Function change.
- **Eiken (英検) fixes.** Interview Web-Speech hardening (#150 — `recognition.start()`
  guard so a throw can't strand the record button; wait for the voice list to
  load so English isn't read in a Japanese voice), plus autofix-pipeline fixes
  for the interview white-box (#143) and two other staff-reported issues
  (#137, #139).
- **Kadaiban catalog-anchor fix (#136)** resolving issue #133.
- **Owner/handoff docs.** `docs/OPERATIONS.md` owner runbook (#127), teacher
  enablement docs + an in-hub document viewer (#123/#124), and a
  teacher-guides-needing-curriculum-sign-off list (#128).
- **UI redesigns.** `eigo5` (#140) and `nh6`/外国語6 (#141) rebuilt from design
  mockups (layout handed off by design; code ours).
- **Migration-ledger reconciliation (#156).** Backfilled 10 missing
  module-registration migration files so `supabase/migrations/` matches the live
  ledger (the `db/`-is-a-mirror hazard, closed for those 10).
- **Security tooling (#157).** The official **Security Guidance** plugin is now
  enabled repo-wide via `.claude/settings.json`, so future Claude Code sessions
  get per-edit + per-commit security review. (Built-in `/security-review`
  remains available on demand; the GitHub-Action route was declined — it needs
  API billing, not the repo's subscription auth.)

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

Debt items, not new ideas.

> **Status as of 2026-07-24: the near-term-debt list is effectively cleared.**
> Items 1, 2, 5, 6, 8, 10, 11 are done; 3 and 9 are now **fully** done (below);
> 7 has its safe subset done. The **only** things left open are **#4
> (leaked-password protection)** and the **residual `ALL`+`SELECT` half of #7** —
> and both are blocked by the **same** cause: they need a Supabase **Pro plan**
> (leaked-password is a paid Auth feature; the RLS-split needs a dev *branch*,
> also Pro-only). Neither is an engineering task on the free tier. A single plan
> upgrade unblocks both.

1. ~~**Fix the five hand-rolled reporters.**~~ **Done 2026-07-23 (#126).**
   `nh6`, `nhvocab`, `letstry1`, `letstry2`, and `shakai3` now route through
   `HubCommon.reportActivityWithItems` and populate `activity_result_items`,
   so the gradebook's per-question analysis covers all 29 modules. Each app's
   answer state is threaded into a per-question `items` array
   (`itemRef/category/prompt/correct/selectedAnswer/correctAnswer`); verified
   end-to-end with a stubbed-Supabase headless flow test (21/21), including
   driving nhvocab's real UI to confirm items land. letstry1's match/build
   stay summary-only (they track no per-question outcome).
2. ~~**Wire `rika3` into `focus_units`.**~~ **Done 2026-07-23 (#146).**
   `rika3-report.js` now exposes `getFocusUnits()`, `app.js` foregrounds the
   assigned units (`unit-card--focus` + "★ 今週"), and it ships
   `modules/rika3/units.js` (keys `u1_haru … u11_jishaku`). `rika3` is now the
   6th runner reading `focus_units` (with `sansu3`/`kokugo3`/`rika4`/`sansu4`/
   `shakai4`). Same shape as the `sansu3` reference.
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
   - ~~**Deferred (optional hardening):** moving the read helpers into a
     non-exposed schema…~~ **DONE 2026-07-24 (migration `20260724011947`) — #3
     now fully closed.** The 8 read helpers (`app_user_*`, `app_has_role`,
     `app_is_platform_admin`, `app_class_school`) were moved to a `private`
     schema, so they're no longer reachable via `/rest/v1/rpc` — the SECURITY
     DEFINER function findings dropped **18 → 1** (only `app_set_module_active`
     remains, intentionally rpc-exposed + self-guarded + documented). The feared
     "all-RLS refactor" turned out unnecessary: RLS policies reference these
     functions by **OID**, so `ALTER FUNCTION ... SET SCHEMA` transparently
     re-qualified every dependent policy with no rewrite and no semantic change.
     Verified live: all policies intact, `authenticated`/`anon` retain EXECUTE +
     `private` USAGE, and RLS returns correct rows for both a no-data user (0)
     and a real platform admin (full visibility). No Supabase branch needed.
4. **Leaked-password protection is still off — BLOCKED on the Supabase
   free tier (not an engineering task).** The HaveIBeenPwned check is a
   **paid-plan feature**; the project is on the free tier, so it cannot be
   enabled yet. It's a Dashboard toggle (Authentication → Policies) once the
   project is on a paid plan — nothing in code or console access can flip it
   today. Revisit after any tier upgrade. **This same free-tier gate also
   blocks Supabase dev *branches*** (Pro-plan only, confirmed 2026-07-24), which
   is why the residual RLS-consolidation part of #7 can't be branch-verified —
   the two remaining open items share one root cause: **the free tier**. A
   plan upgrade closes both at once.
5. ~~Build `SPEC_decentralize_module_units.md`~~ **done 2026-07-18** (#99) —
   the shared-registry corruption class is closed; `kokugo4`/`eigo5` built
   in parallel the same day with zero registry conflict, proving the fix.
6. ~~**Test coverage is inconsistent and un-enforced.**~~ **Done 2026-07-23
   (#144 + #145).** A plain-Node runner (`tests/run.mjs`) + GitHub Actions
   workflow (`ci.yml`) now cover **all 28 drill modules** — Phase 1 shipped the
   harness + 13 modules, Phase 2 backfilled the other 16 via parallel subagents
   (`nh6`, `nhvocab`, `letstry1/2`, `shakai3–6`, `rika3/4`, `sansu3/4`,
   `kanken3–5`, `eiken`). CI runs a syntax+unit job and a Playwright e2e job on
   every PR. It already earned its keep: the eiken data test caught 3 of 2142
   vocab questions with the answer duplicated into a distractor (fixed). Note
   the motivating case for building it — the 07-18 kadaiban double-grading bug
   (#83/#97) shipped past a single-grade manual test; a real re-grade flow test
   would have caught it, and that class of test now runs on every kadaiban PR.
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
   are almost all an `ALL` write-policy overlapping a `SELECT` read-policy on
   the same table.
   **UPDATE 2026-07-24 (safe subset done, migration `20260724012938`).** The two
   tables with **same-command** overlaps — `profiles` (3 SELECT policies) and
   `schools` (2 SELECT) — were consolidated to one SELECT policy each. Merging
   permissive policies of the *same* command via OR is provably identical to
   leaving them separate (Postgres already OR-combines them), so this is
   zero-risk; verified live with before/after visibility snapshots (platform
   admin still 114 profiles / 2 schools, student still 1 / 0). **The residual —
   the `ALL`+`SELECT` overlaps across ~10 tables — stays deferred.** Closing
   those means splitting each `ALL` policy into INSERT/UPDATE/DELETE and folding
   its SELECT arm into the read policy: a semantically trickier change on the
   exact RLS machinery behind this project's documented P0s, for a WARN-level
   perf hint at single-school scale. It should be verified on a Supabase branch
   — which is **Pro-plan only** (see #4), so it's gated on the same free-tier
   upgrade. Not worth doing blind on prod for marginal benefit; revisit with the
   pre-second-school hardening once on a paid plan.
8. ~~**Full rekey of `nh6` → `eigo6` (low priority).**~~ **Done 2026-07-24
   (#159, #160, live migration `20260723233907`).** Rekeyed end-to-end
   (`modules/nh6/` → `modules/eigo6/`, `eigo6-report.js` key query, `eigo6-*`
   localStorage, guide + tests, and the `modules.key`/`launch_url` flip) so the
   5/6 English pair is consistent internally. The deploy-ordering trap described
   below was defused with a **redirect stub** at `modules/nh6/index.html` +
   deploy-then-migrate ordering (frontend verified live before the DB flip), so
   no 404 window. Done while 6年 was still zero-traffic. Original hazard note,
   kept for reference: As of 2026-07-21 the
   grade-6 English module's *display name* was aligned with `eigo5` (both now
   read `外国語 5年` / `外国語 6年` in the hub — migration
   `20260721000411`), but its internal key was still `nh6`: the directory
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
9. **Admin-console UX thinness (surfaced by the #114 coordinator work) —
   partially done 2026-07-23 (#155).** The console is multi-school-capable now,
   and three of the four gaps shipped as pure-frontend over existing RLS:
   **edit a staff member's role**, **remove a staff member from a school** (both
   with self-lockout guards), and a **cross-school staff directory / search**.
   ~~**Still open (specced, not built):** school edit/status, staff
   soft-disable, account-lookup-by-email…~~ **DONE 2026-07-24 (PR #170; backend
   applied/deployed live) — #9 now fully closed.** All three remaining gaps were
   built from `docs/specs/SPEC_admin_staff_management.md` and their backends
   applied to prod: **school edit/status** — `schools_platform_admin_update`
   RLS policy (platform-admin only, migration `20260724012414`, verified admin
   updates / non-admin blocked) + a `schools.html` edit modal; **staff
   soft-disable** — `set-staff-active` Edge Function (GoTrue ban;
   platform-admin-or-school_admin, refuses self / platform-admin / coordinator)
   + a `teachers.html` toggle; **account-lookup-by-email** — `lookup-account`
   Edge Function (platform-admin only, minimal projection, no auth internals) +
   a `staff-directory.html` lookup. Both functions deployed (ACTIVE, verify_jwt
   on). The frontend ships with PR #170.
10. ~~**`modules.html` bulk-assign matrix drops assignment metadata.**~~ **Done
    2026-07-23 (#147).** Decided: null `total_items`/`due_date`/`focus_units`
    are the correct defaults for a coarse grid toggle (per-cell prompting would
    duplicate the gradebook modal), so the fix made the matrix **non-destructive**
    instead: a new `ModuleAssign.assignModuleIfAbsent()` upsert (ignore-duplicates
    on the `(class_id, module_id)` PK) so a re-assign never clobbers or errors,
    plus a confirm-before-unassign warning when a row carries teacher-set
    metadata (due date / 問題数 / 今週の単元) configured in the gradebook.
11. **Content-depth audit likely needed for `rika3`–`rika6` (and worth
    re-checking `shakai4`) — shakai5 probably isn't the only thin module.**
    A rough per-module question-count check (grepping `q:`/question keys,
    napkin-level, not authoritative) run against this update: `rika4` ~49
    questions across 12 units, `rika5` ~50/10 units, `rika6` ~53/11 units,
    `rika3` ~59/11 units, `shakai4` ~66/5 units — all noticeably thinner than
    `shakai5`'s now-187 or `shakai6`'s 115. shakai5's fix (#121, debt item
    above) proves this failure mode is real, not hypothetical, and nothing
    upstream of that one bug report was checking for it — the grades-1–6
    "complete" grid milestone only ever meant *a module exists per cell*, not
    *the question bank is deep enough*. Before assuming this is scoped to
    shakai5, run a real per-section count (not the napkin total-file grep
    used here) against `rika3`–`rika6` and `shakai4`, using shakai5's ~10–12
    questions/section as the target bar.
    **Done 2026-07-23 (#125, #130–#132, #151–#155).** The authoritative
    per-section audit was run across all five. Key finding: the napkin counts
    above were consistent **under**-counts — most units were already at the
    ~10–12 bar, so only the genuinely-thin units were deepened (no padding of
    at-bar units). `rika3` needed nothing (121 authored, 11/unit). The thin
    cases were mostly A-strand **generator** units with too little rotation
    headroom against the fixed drill length — e.g. `rika5`'s electromagnet
    generator produced only 6 distinct items feeding a 5-slot drill (enriched to
    19), and a `rika6` unit was serving 9-question drills against a 10-question
    quiz. Every fill is original content, collision/structural stress-tested.
    Depth-floor assertions were added to the affected modules' tests to keep the
    bar enforced going forward.
    **Extended catalog-wide 2026-07-24 (#161, #162, #163, #166) — now fully
    closed.** The audit was taken beyond the original `rika3–6`+`shakai4` scope
    to **every remaining drill module**. Filled where genuinely thin: `kokugo3`
    reading units, `eigo5` sentence mode, `nhvocab` categories, `shakai3`
    (84→143) and `shakai6` (115→198). Confirmed already-deep and left untouched
    (no padding): `kokugo1/2/4/5/6`, `eigo6`, `letstry1/2`. The whole catalog now
    clears the ~10–12/section bar, each affected module guarded by a depth-floor
    test — so the "shakai5 isn't the only thin one" hypothesis is settled and
    the depth axis is closed platform-wide.

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

## Explicitly not proposing

- **No framework/build-step migration** — the static-HTML model is working and
  isn't the bottleneck on anything above.
- **No new backend service** — everything fits the existing
  browser-talks-to-Postgres-via-RLS shape.
- Product features deliberately rejected (student DMs/chat, student-facing AI
  tutor, public comparative leaderboards, native mobile app) are cataloged with
  reasons under **Recommend AGAINST** in
  [`planning/FEATURE_BACKLOG.md`](planning/FEATURE_BACKLOG.md).
