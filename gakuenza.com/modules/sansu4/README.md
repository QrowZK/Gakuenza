# 算数 4年 (sansu4) — generated-practice module

Ported directly from **sansu3**'s generator architecture (parameterized
problem generation, not a fixed question bank). Built against the unit
structure of 東京書籍『新編 新しい算数4』(令和6年度版) — 14 units across
上巻/下巻. All content is **original**: no textbook passages, specific
problems, or figures are reproduced; problems are generated from the
skill/structure of each unit only.

## Files (self-contained, same convention as every module)
- `index.html` — shell + screens (menu / drill / review)
- `generators.js` — `window.SANSU4_DATA.UNITS`; each section has a
  `gen()` returning one fresh problem object per call
- `app.js` — quiz flow, answer normalization, `window.SANSU4_CHECK`
- `sansu4-report.js` — `window.Sansu4Report`; resolves context via
  `enrollments → classes.school_id` and reports through the shared
  `HubCommon.reportActivityWithItems` helper (writes both
  `activity_results` and `activity_result_items`)
- `style.css` — fully self-contained; token *values* copied literally,
  variable *names* module-local (`--m4-*`), never links the root
  `style.css`

## Registration
`db/2026-07-15_register_sansu4_module.sql` — idempotent
(`ON CONFLICT (key)`), `subject = math`, absolute `launch_url`,
`is_active = true`, `recommended_grades = {4}`. Apply after the frontend
is deployed so the hub never links a live card at a 404.

## Canonical unit keys (for `class_modules.focus_units`)
`app.js` honors `focus_units` for unit-scoped pacing (foreground the
listed units under "今週の単元", never hide the rest; fail soft to "all
units" on null/empty/malformed). Nothing else in the codebase currently
establishes these keys, so this is the authoritative list — one key per
textbook unit:

| # | key | 単元 |
|---|-----|------|
| 1 | `u01_big_numbers` | 大きい数のしくみ |
| 2 | `u02_line_graphs` | 折れ線グラフと表 |
| 3 | `u03_division1` | わり算の筆算(1) |
| 4 | `u04_angles` | 角の大きさ |
| 5 | `u05_decimals_structure` | 小数のしくみ |
| 6 | `u06_division2` | わり算の筆算(2) |
| 7 | `u07_rounding` | がい数の表し方と使い方 |
| 8 | `u08_calc_rules` | 計算のきまり |
| 9 | `u09_quadrilaterals` | 垂直、平行と四角形 |
| 10 | `u10_fractions` | 分数 |
| 11 | `u11_change` | 変わり方調べ |
| 12 | `u12_area` | 面積のくらべ方と表し方 |
| 13 | `u13_decimal_muldiv` | 小数のかけ算とわり算 |
| 14 | `u14_boxes` | 直方体と立方体 |

(The 15th entry, `u15_review` "4年のまとめ", is a mixed review drawing
from every unit's generator; it is intentionally not a focus-unit target.)

## Testing performed
- **Generators** — stress-tested 60,000 generated instances (4,000 per
  section) programmatically: every typed problem's canonical answer
  passes its own `SANSU4_CHECK.isCorrect`; garbage input is rejected;
  a shown unit suffix is accepted; every choice problem has a unique
  correct option and no duplicate options. Semantic distractor-collision
  guards: "which is larger" (大小くらべ) questions verified so the correct
  option is the unique numeric maximum, and the distributive-equivalence
  MCQ verified so no distractor evaluates to the target value. This pass
  caught and fixed a real collision (padding filler that exceeded the
  correct answer in comparison questions).
- **Flow** — real headless-browser (Playwright) playthrough of the actual
  menu→answer→score→review flow, asserting the report shim receives a
  fully-populated `items[]` (one per question, all fields present), and
  that the shim forwards to `HubCommon.reportActivityWithItems` with the
  correct `module_id` (resolved by key), `school_id`/`class_id` (resolved
  via the enrollments join), the items array, and an `activity_ref`
  shaped `sansu4/<section>/<timestamp>`.
- **Migration** — idempotency verified (ran twice in a rolled-back
  transaction: exactly one row, correct `subject`/`launch_url`/
  `is_active`/`recommended_grades`).
