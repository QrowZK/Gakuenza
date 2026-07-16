# sansu6 — new module build spec

Built against 東京書籍「新編 新しい算数」第6学年, 令和6年度版
(sansu_keikaku_ryakuan_6.pdf, fetched directly from Tokyo Shoseki).

## Module identity

Directory `modules/sansu6/`, key `sansu6`, subject `'math'`,
launch_url `/modules/sansu6/index.html`, name `算数 6年`.

## Verified unit structure — 12 core units + 2 capstone sections, 175 standard hours

1. 対称な図形 — line/point symmetry, axis of symmetry
2. 文字と式 — variable notation (x, y) for generalized quantities
3. 分数×整数、分数÷整数、分数×分数 — fraction multiplication
   (including by whole numbers), reciprocals
4. 分数÷分数 — fraction division, mixed operation problems
5. 比 — ratio notation, equivalent ratios, proportional division
6. 拡大図と縮図 — scale drawings, similarity
7. データの調べ方 — mean, mode, median, histograms, frequency tables
8. 円の面積 — circle area, composite shapes
9. 角柱と円柱の体積 — prism/cylinder volume
10. およその面積と体積 — estimating area/volume of irregular shapes
11. 比例と反比例 — direct and inverse proportion, graphs
12. 並べ方と組み合わせ方 — permutations/combinations (introductory)

**Capstone sections** (not skill-introducing, but real content worth
covering in a review/mixed-practice mode): 13．算数のしあげ (full
elementary review across all four 学習指導要領 strands) and
★算数卒業旅行 (enrichment — puzzles, international/historical math
context, informal bridge to middle-school math).

## Design approach

Same proceduralizable pattern as every sansu module. Per-unit notes:
- Units 3, 4, 5 (fraction operations, ratio): straightforward
  parameterized generation, same shape as sansu5's fraction unit.
- Units 1, 6, 8, 9, 10 (geometry): generate specific
  shapes/measurements.
- Unit 7 (data/statistics) and unit 11 (proportion/inverse
  proportion): likely needs the same graph-reading/table UI flagged
  in sansu4/sansu5's specs — check what's already built before
  reinventing.
- Unit 12 (permutations/combinations): a genuinely different question
  shape from anything in sansu3/4/5 — counting problems with a small
  enough case space to enumerate exhaustively rather than needing a
  combinatorics formula engine. Keep the generated cases small (this
  unit is explicitly introductory, not full combinatorics).
- The review/capstone sections are a natural fit for a "mixed review"
  mode drawing from all 12 units' generators once they exist, rather
  than needing their own dedicated content.

## Testing

Same stress-test bar as every generator in this project.

## Copyright

No passage to avoid — original problems from the verified unit list.

## focus_units

Same as sansu5 — build to honor `class_modules.focus_units` from the
start. Suggested keys: `u01_symmetry` through `u12_combinatorics`.
