# 算数 5年 (sansu5) — generated-practice module

Ported directly from **sansu3 / sansu4**'s generator architecture
(parameterized problem generation, not a fixed question bank). Built
against the unit structure of 東京書籍『新編 新しい算数5』(令和6年度版) — 18
units across 上巻/下巻, 175 standard hours. All content is **original**:
no textbook passages, specific problems, or figures are reproduced;
problems are generated from the skill/structure of each unit only.

## Files (self-contained, same convention as every module)
- `index.html` — shell + screens (menu / drill / review)
- `generators.js` — `window.SANSU5_DATA.UNITS`; each section has a
  `gen()` returning one fresh problem object per call
- `app.js` — quiz flow, answer normalization, `window.SANSU5_CHECK`
- `sansu5-report.js` — `window.Sansu5Report`; resolves context via
  `enrollments → classes.school_id` and reports through the shared
  `HubCommon.reportActivityWithItems` helper (writes both
  `activity_results` and `activity_result_items`)
- `style.css` — fully self-contained; token *values* copied literally,
  variable *names* module-local (`--m5-*`), never links the root
  `style.css`

## Registration
`db/2026-07-16_register_sansu5_module.sql` (mirror) +
`supabase/migrations/<ts>_register_sansu5_module.sql` (applied ledger
entry) — idempotent (`ON CONFLICT (key)`), `subject = math`, absolute
`launch_url`, `is_active = true`, `recommended_grades = {5}`. Apply after
the frontend is deployed so the hub never links a live card at a 404.

## Canonical unit keys (for `class_modules.focus_units`)
`app.js` honors `focus_units` for unit-scoped pacing (foreground the
listed units under "今週の単元", never hide the rest; fail soft to "all
units" on null/empty/malformed). These keys are mirrored in
`hub/module-units.js` (`window.MODULE_UNITS.sansu5`) so the assignment
UIs offer them — the two lists must stay in sync.

| # | key | 単元 | 巻 |
|---|-----|------|----|
| 1 | `u01_decimals` | 整数と小数 | 上 |
| 2 | `u02_volume` | 直方体や立方体の体積 | 上 |
| 3 | `u03_proportion` | 比例 | 上 |
| 4 | `u04_decimal_mul` | 小数のかけ算 | 上 |
| 5 | `u05_decimal_div` | 小数のわり算 | 上 |
| 6 | `u06_congruence` | 合同な図形 | 上 |
| 7 | `u07_angles` | 図形の角 | 下 |
| 8 | `u08_multiples_factors` | 偶数と奇数、倍数と約数 | 下 |
| 9 | `u09_fraction_decimal` | 分数と小数、整数の関係 | 下 |
| 10 | `u10_fraction_addsub` | 分数のたし算とひき算 | 下 |
| 11 | `u11_average` | 平均 | 下 |
| 12 | `u12_per_unit` | 単位量あたりの大きさ | 下 |
| 13 | `u13_area` | 四角形と三角形の面積 | 下 |
| 14 | `u14_percentage` | 割合 | 下 |
| 15 | `u15_graphs` | 帯グラフと円グラフ | 下 |
| 16 | `u16_functional` | 変わり方調べ | 下 |
| 17 | `u17_polygon_circle` | 正多角形と円周の長さ | 下 |
| 18 | `u18_prisms_cylinders` | 角柱と円柱 | 下 |

(The 19th menu entry, `u19_review` "5年のまとめ", is a mixed review
drawing from every unit's generator; it is intentionally **not** a
focus-unit target and is excluded from `module-units.js`.)

## Design notes
- The "graph-reading" interaction that the spec flagged (units 3 比例,
  15 帯グラフ・円グラフ, 16 変わり方調べ) reuses sansu4's established
  figure-plus-typed/choice pattern — no new interaction type was needed.
  Graph units render an original SVG `帯グラフ` and ask the student to
  read a percentage, compute a count, or pick the largest category.
- Decimal arithmetic is kept in integer sub-units (tenths / hundredths /
  thousandths) via the `dec(intVal, scale)` helper to avoid float drift,
  then formatted with trailing zeros stripped.
- `π` is 3.14 (5th-grade convention); circumference answers are computed
  as `diameter × 314` in 1/100 units.

## Testing performed
- **Generators** — stress-tested large batches per section
  programmatically: every typed problem's canonical answer passes its
  own `SANSU5_CHECK.isCorrect`; garbage input is rejected; a shown unit
  suffix is accepted; every choice problem has exactly 4 options, a
  unique correct option, and no duplicate/secretly-correct distractor.
  Semantic distractor-collision guards: comparison questions verified so
  the correct option is the unique target; 割合 kept typed to avoid the
  "two representations of the same value both correct" collision the
  spec warned about.
- **Flow** — headless-browser playthrough of the actual
  menu→answer→score→review flow, asserting the report shim receives a
  fully-populated `items[]` (one per question, all fields present) and
  forwards to `HubCommon.reportActivityWithItems` with the correct
  `module_id`/`school_id`/`class_id`, the items array, and an
  `activity_ref` shaped `sansu5/<section>/<timestamp>`.
- **Migration** — idempotency (run twice, one row), correct
  `subject`/`launch_url`/`is_active`/`recommended_grades`.
