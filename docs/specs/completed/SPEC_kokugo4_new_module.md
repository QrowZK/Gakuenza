# kokugo4 — 国語 4年 — new module build spec

**Issue/roadmap:** MODULE_ROADMAP §3.3. **Status:** ready to build.
Kanji + grammar; reading deferred. Fills the one remaining rung in
算数/理科/社会/国語 × grades 3–6.

> **Placement note.** In `docs/specs/` (not `pending/`) — hand-assigned to an
> isolated-worktree subagent, matching every prior module wave. Do NOT drop this
> into `pending/` unless the owner wants the unattended spec-builder to fire.

## Module identity
Directory `modules/kokugo4/`, key `kokugo4`, subject `'japanese'`,
launch_url `/modules/kokugo4/index.html`, name `国語 4年`, recommended_grades `[4]`.

## Publisher & scope
Publisher **光村図書 (Mitsumura Tosho)** — the same publisher kokugo3/5/6 were
correctly built against. Do **NOT** pull Tokyo Shoseki's 国語 line (the exact
mistake the kokugo5 spec caught). Ship **kanji + grammar ONLY**; reading-
comprehension units are deferred to a properly-sourced Mitsumura research pass,
same discipline as kokugo5/6. A kanji-and-grammar kokugo4 is a real, testable
module on its own; a rushed reading set on unverified research is not.

## Units to build
1. **漢字 (grade-4 list)** — MEXT 学年別漢字配当表 grade-4 closed set (**verify
   the complete list + official count** against a dedicated reference, same rigor
   kokugo3's list got; do not reconstruct from memory). Follow kokugo3's
   `kanji-generator.js` exactly (reading / kanji-selection / stroke-count
   question types, procedural, not a fixed bank).
2. **Grammar / language-mechanics** — grade-4-appropriate closed rule systems,
   templated on kokugo3's `grammar-generators.js`. **Verify grade-4 topics from
   MEXT 学習指導要領 / Mitsumura materials** rather than assuming grade-3 carries
   over. Strong candidates (confirm against source):
   - 漢字の組み立て・部首 (radical/構成 of kanji; 漢字辞典の使い方: 音訓・部首索引)
   - 慣用句 (idioms) and/or ことわざ (grade-3 built ことわざ・故事成語; pick
     grade-4-level items)
   - つなぎ言葉・接続語 (conjunctions: だから/しかし/また…)
   - 主語・述語・修飾語の関係 (sentence structure, extends grade-3's 修飾語)
   - 熟語の意味 (two-kanji compound meaning)

## Design
kokugo3 architecture: procedural `kanji-generator.js` + closed rule-system
`grammar-generators.js`. Self-contained `style.css` (hard rule 1 — copy token
values literally, never link root `style.css`). Zen Maru Gothic for display text.

## Distractor-collision cautions (kokugo3 shipped this bug class TWICE)
- **Stroke-count questions:** guarantee ≥4 options and that no distractor equals
  the true stroke count.
- **Reading questions:** a "wrong reading" distractor must never be a *valid*
  reading of the same kanji (同訓/同音 leakage). By construction, draw distractors
  from readings that are provably not attached to the target.
- **Grammar (接続語, 部首):** a distractor must never also be a correct fit for
  the blank — kokugo3's grammar generators are built so a distractor can never be
  a valid answer *by construction* (see the COLLISION DISCIPLINE header in
  `kokugo3/grammar-generators.js`); replicate that.

**Stress-test 500–5000 generated instances per generator** — these bugs only
surface at scale.

## Reporting (hard rule 2)
`HubCommon.reportActivityWithItems(sb, {schoolId, classId, moduleId, userId,
activityRef, score, maxScore, payload, items})` with populated `items`. Never
hand-roll the `activity_results` insert. Resolve context via
`enrollments → classes.school_id`, never `profiles.home_school_id` (hard rule 3).

## units.js (per-module, post-#94/#99 — there is NO shared registry)
Ship `modules/kokugo4/units.js` self-registering `window.MODULE_UNITS.kokugo4` —
`kanji` + one key per GRAMMAR_UNIT, matching kokugo5/6's convention (they register
`kanji` + grammar keys, no reading keys). Suggested keys: `kanji`, `bushu`
(部首・漢字の組み立て), `setsuzoku` (つなぎ言葉), `kanyouku` (慣用句),
`shugo_jutsugo` (主語・述語・修飾語), `jukugo` (熟語の意味). **Final keys MUST
equal the module's internal GRAMMAR_UNITS keys exactly** — the assignment UIs
cannot load a module's generators, so `units.js` is the contract. **Never edit a
shared common file — that registry was deleted in #99; do not recreate it.**

## Registration migration (hard rule 5 — idempotent)
Update-then-insert-if-absent into `modules`: `key='kokugo4'`, `subject='japanese'`,
`launch_url='/modules/kokugo4/index.html'` (absolute — hard rule 4),
`name='国語 4年'`, `recommended_grades='{4}'`, `publisher='光村図書'`,
`is_active=true` set explicitly. Apply via MCP `apply_migration` (writes the prod
ledger) **and** commit the matching `supabase/migrations/<ts>_register_kokugo4.sql`
in the same PR. Never `execute_sql`/dashboard.

## Testing bar
- **Generators:** stress-test at hundreds–thousands of instances for structural
  bugs AND the distractor-collision bug (a "wrong" option secretly also correct).
- **Flow test:** real headless-browser run through the quiz flow, asserting
  `reportActivityWithItems` was called correctly and `activity_result_items`
  actually got populated.
- **Migration:** idempotency (run twice, no duplicate row), correct
  `is_active`/`subject`/`launch_url`.

## Copyright ("reference, don't reproduce" — §4)
Kanji/grammar are closed rule systems / official lists — zero passage-
reproduction risk. Build original items testing the same skills; never reproduce
Mitsumura passages, specific problems, or exact wording. When reading units are
eventually built, the rule applies exactly as for kokugo3.
