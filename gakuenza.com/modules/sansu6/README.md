# 算数 6年 (sansu6) — generated-practice module

Ported directly from **sansu3 / sansu4**'s generator architecture
(parameterized problem generation, not a fixed question bank). Built
against the unit structure of 東京書籍『新編 新しい算数6』(令和6年度版) —
12 core units plus a mixed-review/しあげ section across 上巻/下巻. All
content is **original**: no textbook passages, specific problems, or
figures are reproduced; problems are generated from the skill/structure
of each unit only.

## Files (self-contained, same convention as every module)
- `index.html` — shell + screens (menu / drill / review)
- `generators.js` — `window.SANSU6_DATA.UNITS`; each section has a
  `gen()` returning one fresh problem object per call
- `app.js` — quiz flow, answer normalization, `window.SANSU6_CHECK`
- `sansu6-report.js` — `window.Sansu6Report`; resolves context via
  `enrollments → classes.school_id` and reports through the shared
  `HubCommon.reportActivityWithItems` helper (writes both
  `activity_results` and `activity_result_items`)
- `style.css` — fully self-contained; token *values* copied literally,
  variable *names* module-local (`--m6-*`), never links the root
  `style.css`

## Registration
`supabase/migrations/20260716120000_register_sansu6_module.sql` —
idempotent (`ON CONFLICT (key)`), `subject = math`, absolute
`launch_url`, `is_active = true`, `recommended_grades = {6}`. **Apply
after the frontend is deployed** so the hub never links a live card at a
404. (Not applied to prod as part of this PR — the module files must ship
first.)

## Canonical unit keys (for `class_modules.focus_units`)
`app.js` honors `focus_units` for unit-scoped pacing (foreground the
listed units under "今週の単元", never hide the rest; fail soft to "all
units" on null/empty/malformed). These keys are mirrored in
`hub/module-units.js` (`MODULE_UNITS.sansu6`), which the assignment UIs
read to render the focus-unit picker — kept in sync deliberately.

| # | key | 単元 |
|---|-----|------|
| 1 | `u01_symmetry` | 対称な図形 |
| 2 | `u02_letters` | 文字と式 |
| 3 | `u03_fraction_mul` | 分数のかけ算（×整数・÷整数・×分数・逆数） |
| 4 | `u04_fraction_div` | 分数のわり算 |
| 5 | `u05_ratio` | 比 |
| 6 | `u06_scale` | 拡大図と縮図 |
| 7 | `u07_data` | データの調べ方 |
| 8 | `u08_circle_area` | 円の面積 |
| 9 | `u09_volume` | 角柱と円柱の体積 |
| 10 | `u10_approx` | およその面積と体積 |
| 11 | `u11_proportion` | 比例と反比例 |
| 12 | `u12_combinatorics` | 並べ方と組み合わせ方 |

The 13th entry, `u13_review` (6年のまとめ／算数のしあげ), is a mixed
review drawing from every unit's generator — it covers the textbook's
capstone sections (13．算数のしあげ and ★算数卒業旅行) as mixed practice
and is intentionally **not** a focus-unit target (excluded from
`module-units.js`).

## Testing performed
- **Generators** (`tests/sansu6/generators.test.js`) — stress-tested
  65,000 generated instances (5,000 per section) programmatically: every
  typed problem's canonical answer passes the module's own
  `SANSU6_CHECK`-equivalent checker; every accepted form passes; a shown
  unit suffix (e.g. `cm²`, `本`, `通り`) is accepted; garbage/empty input
  is rejected; a clearly-wrong number is not accepted; every choice
  problem has a unique correct option among distinct options. Fraction
  answers are verified reduced/exact and circle-area/volume answers are
  computed with integer-hundredths math (`fmt2`) so there is no float
  drift (e.g. `3.14×5²` → exactly `78.5`).
- **Flow** (`tests/sansu6/flow.test.mjs`) — real headless-browser
  (Playwright) playthrough of the actual menu→drill→review UI for a
  choice unit, a typed unit, and the mixed-review section, asserting the
  report shim receives a fully-populated `items[]` (one per question, all
  fields present) and forwards to `HubCommon.reportActivityWithItems`
  with the correct `module_id` (resolved by key), `school_id`/`class_id`
  (resolved via the enrollments join), and an `activity_ref` shaped
  `sansu6/<section>/<timestamp>`.
- **Migration** — idempotency verified (ran twice in a rolled-back
  transaction against the live DB: exactly one row, correct
  `subject`/`launch_url`/`is_active`/`recommended_grades`).
