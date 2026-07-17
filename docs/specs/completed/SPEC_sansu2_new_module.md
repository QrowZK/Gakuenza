# sansu2 — 算数 2年 — new module build spec

**Issue/roadmap:** MODULE_ROADMAP §3.2, Tier A. **Status:** ready to build.
Centerpiece is **かけ算九九** — the single most drillable object in elementary
math. With `sansu1` this completes the grade-1/2 math shelf.

> **Placement note.** In `docs/specs/` (not `pending/`) — hand-assigned to a
> subagent; move to `pending/` only if you want the auto-builder instead (not both).

## Module identity
Directory `modules/sansu2/`, key `sansu2`, subject `'math'`,
launch_url `/modules/sansu2/index.html`, name `算数 2年`, recommended_grades `[2]`.

## Source (verify before authoring)
**東京書籍「新しい算数」2年**, current 令和 edition. Confirm the exact unit list
from the Tokyo Shoseki 年間指導計画 before authoring.

## Unit structure (typical Tokyo Shoseki G2 order — confirm edition)
1. 表とグラフ — simple tables and picture graphs
2. たし算のひっ算 — 2-digit column addition (with carry)
3. ひき算のひっ算 — 2-digit column subtraction (with borrow)
4. 長さ — length: cm / mm
5. 100より大きい数 — numbers to 1000, place value
6. かさ — volume: L / dL / mL
7. 時こくと時間 — time and elapsed duration (minutes)
8. 計算のくふう — grouping/order strategies for mental calc
9. たし算とひき算のひっ算 — 3-digit column add/subtract
10. 三角形と四角形 — triangles & quadrilaterals, right angles
11. かけ算(1) — multiplication intro + 九九 for 2,3,4,5
12. かけ算(2) — 九九 for 6,7,8,9,1; whole times-table
13. 長い長さ — length in m; unit conversion
14. 分数 — simple fractions (1/2, 1/4)
15. はこの形 — box shapes: faces/edges/vertices

## Design
Same sansu architecture. **九九 (units 11–12) is the centerpiece:** generate the
full 1×1…9×9 space with reading direction both ways, missing-factor (□×4=28),
and mixed review. Column arithmetic (2, 3, 9) and place value (5) are straight
parameterized generation. Unit conversion (4, 6, 13) generates cleanly.
Time/duration (7) reuses the sansu clock UI with elapsed-minute questions.
Geometry (10, 15) as shape-property ID / counting faces-edges-vertices.

## Distractor-collision cautions
- **九九:** with a numeric answer + numeric distractors, auto-assert
  `distractor !== answer` for every item (classic trap: 7×8=56 with 48/54/63 —
  fine as long as none equals 56).
- **Missing-factor 九九 (□×6=42):** answer must be unique in 1–9. Exclude
  products with two in-table factorizations when only the product is fixed
  (e.g. 12 = 2×6 = 3×4), or fix the other operand.
- **Unit conversion (1m20cm ↔ 120cm):** exactly one option is the correct
  equivalent; watch mixed-unit distractors that reduce to the same value.
- **分数:** don't let 2/4 and 1/2 both appear as options for "half."
**Stress-test the full 九九 space exhaustively (enumerate all 81)** plus
thousands of the parameterized units.

## Reporting (hard rule 2)
`HubCommon.reportActivityWithItems(...)` with populated `items`; context via
`enrollments → classes.school_id` (rules 2 & 3).

## module-units.js keys (`sansu2`)
`u01_tables_graphs`, `u02_add_column`, `u03_sub_column`, `u04_length_cm_mm`,
`u05_to1000`, `u06_volume`, `u07_time`, `u08_calc_tricks`, `u09_addsub3digit`,
`u10_tri_quad`, `u11_mult1`, `u12_mult2`, `u13_length_m`, `u14_fractions`,
`u15_boxes`. (If the edition has a 2年のまとめ review unit, exclude it from
focus_units like sansu5/6 exclude theirs.) Add the `sansu2` block to
`hub/module-units.js`.

## Registration migration
Idempotent: `key='sansu2'`, `subject='math'`,
`launch_url='/modules/sansu2/index.html'`, `name='算数 2年'`,
`recommended_grades='{2}'`, `publisher='東京書籍'`, `is_active=true` explicit.
Apply via MCP `apply_migration` + commit the file named to the applied ledger
version.

## Testing / copyright / focus_units
- **Testing:** exhaustive 九九 enumeration + scaled parameterized stress tests +
  a headless flow test (reporting + `activity_result_items`); migration
  idempotency.
- **Copyright:** no passage risk — original problems only.
- **focus_units:** honored from the start.
