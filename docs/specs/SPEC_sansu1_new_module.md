# sansu1 — 算数 1年 — new module build spec

**Issue/roadmap:** MODULE_ROADMAP §3.1, Tier A. **Status:** ready to build.
Grade 1 currently has **zero** modules in any subject — an empty hub for a G1
class — so this (with `kokugo1`) is highest-ROI.

> **Placement note.** In `docs/specs/` (not `docs/specs/pending/`) on purpose:
> `pending/` auto-fires `auto-build-module.yml`; this is hand-assigned to a
> subagent. If you'd rather the auto-builder take it, move it to `pending/`
> instead — don't do both (they'd race).

## Module identity
Directory `modules/sansu1/`, key `sansu1`, subject `'math'`,
launch_url `/modules/sansu1/index.html`, name `算数 1年`, recommended_grades `[1]`.

## Source (verify before authoring)
Build against **東京書籍「新しい算数」1年**, current 令和 edition — same
publisher/series as sansu3–6. **Verify the exact unit list + titles from the
Tokyo Shoseki 年間指導計画 for the current edition before authoring** (every
sansu spec does this; don't reconstruct from memory).

## Unit structure (typical Tokyo Shoseki G1 order — confirm titles/edition)
1. 10までのかず — counting/reading numbers to 10
2. なんばんめ — ordinal position (前から3番目)
3. いくつといくつ — composition/decomposition of 10 (core G1 skill)
4. たしざん(1) — addition without carrying (sums ≤ 10)
5. ひきざん(1) — subtraction without borrowing (minuend ≤ 10)
6. 20までのかず — numbers 11–20, tens-and-ones intro
7. なんじ・なんじはん — clock: o'clock and half-past only
8. 3つのかずのけいさん — three-term add/subtract
9. たしざん(2) — addition with carrying (くり上がり)
10. ひきざん(2) — subtraction with borrowing (くり下がり)
11. 大きいかず — numbers to 100, tens-and-ones place value
12. たしざんとひきざん — two-digit ± one-digit (no regroup)
13. どちらがながい／おおい／ひろい — direct comparison of length/volume/area
14. かたちづくり・いろいろなかたち — shape recognition/composition

## Design
Reuse the **sansu3–6 generator architecture directly** (index.html + generator
JS + `<key>-report.js` + self-contained `style.css`). Per-unit:
- **Fully proceduralizable (core):** 1, 3, 4, 5, 8, 9, 10, 11, 12 — parameterized
  number generation.
- **Clock (7):** reuse the clock-reading UI from sansu3 unit 2 (時こくと時間);
  G1 restricts to o'clock/half-past.
- **Comparison (13) & shapes (14):** picture-native in the textbook — render as
  text comparisons ("12cm と 9cm、ながいのはどちら") and shape-name ID, not
  manipulatives; keep them a small share of the bank.
- **Ordinal (2):** 前から3番目・後ろから2番目 position questions.

## Distractor-collision cautions (this project shipped this bug class twice)
- 「いくつといくつ」: a "10 は 6 と □" item has one answer; for any multi-select
  "which pair makes 10", ensure no two distractor pairs both sum to the target.
- Comparison with equal magnitudes: exclude ties, or make 同じ an explicit
  option — never emit two options that are both the correct comparison.
- Clock: verify generated hand positions map to exactly one stated time
  (half-past vs o'clock).
**Stress-test hundreds–thousands per unit**, asserting exactly one correct
option and no secretly-also-correct distractor (see CLAUDE.md testing bar).

## Reporting (hard rule 2)
Report via `HubCommon.reportActivityWithItems(sb, {schoolId, classId, moduleId,
userId, activityRef, score, maxScore, payload, items})` — never hand-roll the
`activity_results` insert; **populate `items`** for per-question analysis.
Resolve context via `enrollments → classes.school_id`, never `home_school_id`
(rule 3).

## module-units.js keys (must equal the module's internal UNITS keys exactly)
`u01_to10`, `u02_ordinal`, `u03_compose`, `u04_add1`, `u05_sub1`, `u06_to20`,
`u07_clock`, `u08_three_terms`, `u09_add2`, `u10_sub2`, `u11_to100`,
`u12_addsub2digit`, `u13_compare`, `u14_shapes`. Add the `sansu1` block to
`gakuenza.com/hub/module-units.js`.

## Registration migration
Idempotent update-then-insert into `modules`: `key='sansu1'`, `subject='math'`,
`launch_url='/modules/sansu1/index.html'` (absolute — rule 4), `name='算数 1年'`,
`recommended_grades='{1}'`, `publisher='東京書籍'` (per #81), `is_active=true`
set explicitly. **Apply via MCP `apply_migration`** (writes the ledger) AND
commit `supabase/migrations/<applied_ledger_version>_register_sansu1.sql` named
to the applied version (avoid the filename↔ledger drift seen earlier).

## Testing / copyright / focus_units
- **Testing bar:** generator stress-test at scale + a headless flow test
  asserting `reportActivityWithItems` ran and `activity_result_items` populated;
  migration idempotency (run twice, correct subject/launch_url/is_active).
- **Copyright:** no passage risk — original problems from the verified unit
  list; never reproduce the textbook's specific example problems or illustrations.
- **focus_units:** honor `class_modules.focus_units` from the start (sansu3 is
  the reference consumer).
