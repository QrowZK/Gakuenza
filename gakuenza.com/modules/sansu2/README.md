# 算数 2年 (sansu2) — generated-practice module

Ported directly from **sansu3 / sansu5**'s generator architecture
(parameterized problem generation, not a fixed question bank). Built
against the unit structure of 東京書籍『新しい算数2』(令和 edition) — 15
units across 上巻/下巻. All content is **original**: no textbook
passages, specific problems, or figures are reproduced; problems are
generated from the skill/structure of each unit only.

The centerpiece is **かけ算九九** (units 11–12): the generator covers the
full 1×1…9×9 space with both reading directions, missing-factor
(□×4=28), and a whole-table mixed-review section.

## Files (self-contained, same convention as every module)
- `index.html` — shell + screens (menu / drill / review)
- `generators.js` — `window.SANSU2_DATA.UNITS`; each section has a
  `gen()` returning one fresh problem object per call
- `app.js` — quiz flow, answer normalization, `window.SANSU2_CHECK`
- `sansu2-report.js` — `window.Sansu2Report`; resolves context via
  `enrollments → classes.school_id` (never `profiles.home_school_id`)
  and reports through the shared `HubCommon.reportActivityWithItems`
  helper (writes both `activity_results` and `activity_result_items`)
- `style.css` — fully self-contained; token *values* copied literally,
  variable *names* module-local (`--m2-*`), never links the root
  `style.css`

## Registration
`supabase/migrations/<ts>_register_sansu2_module.sql` (applied ledger
entry) — idempotent (`ON CONFLICT (key)`), `subject = math`, absolute
`launch_url`, `is_active = true`, `recommended_grades = {2}`,
`publisher = 東京書籍`. Apply after the frontend is deployed so the hub
never links a live card at a 404.

## Canonical unit keys (for `class_modules.focus_units`)
`app.js` honors `focus_units` for unit-scoped pacing (foreground the
listed units under "今週の単元", never hide the rest; fail soft to "all
units" on null/empty/malformed). These keys are mirrored in
`hub/module-units.js` (`window.MODULE_UNITS.sansu2`) so the assignment
UIs offer them — the two lists must stay in sync.

| # | key | 単元 | 巻 |
|---|-----|------|----|
| 1 | `u01_tables_graphs` | 表とグラフ | 上 |
| 2 | `u02_add_column` | たし算のひっ算 | 上 |
| 3 | `u03_sub_column` | ひき算のひっ算 | 上 |
| 4 | `u04_length_cm_mm` | 長さ（cm・mm） | 上 |
| 5 | `u05_to1000` | 100より大きい数 | 上 |
| 6 | `u06_volume` | かさ（L・dL・mL） | 上 |
| 7 | `u07_time` | 時こくと時間 | 上 |
| 8 | `u08_calc_tricks` | 計算のくふう | 上 |
| 9 | `u09_addsub3digit` | たし算とひき算のひっ算（3けた） | 下 |
| 10 | `u10_tri_quad` | 三角形と四角形 | 下 |
| 11 | `u11_mult1` | かけ算(1)（2・3・4・5のだん） | 下 |
| 12 | `u12_mult2` | かけ算(2)（6・7・8・9・1のだん・全段・□） | 下 |
| 13 | `u13_length_m` | 長い長さ（m） | 下 |
| 14 | `u14_fractions` | 分数 | 下 |
| 15 | `u15_boxes` | はこの形 | 下 |

Every unit is a real focus-unit target — this build has no 2年のまとめ
mixed-review unit to exclude (unlike sansu5/sansu6).

## Testing
- **Generators (`test_sansu2.js`)**: ~6000 iterations per section plus a
  dedicated 九九 pass (~40000 iters/section) that **enumerates all 81
  ordered (x,y) cells**, asserts every typed answer passes its own
  `SANSU2_CHECK.isCorrect`, verifies no numeric distractor equals the
  answer, and verifies missing-factor answers are **unique in 1–9**
  given the shown operand.
- **Flow (`flow_sansu2.js`)**: headless Chromium drives the real quiz UI
  to completion with only the Supabase network client stubbed, asserting
  `HubCommon.reportActivityWithItems` wrote one `activity_result_items`
  row per question with populated `item_ref`/`category`/`prompt`.
