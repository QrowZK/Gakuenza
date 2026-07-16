# sansu5 — new module build spec

Built against 東京書籍「新編 新しい算数」第5学年, 令和6年度版
(sansu_keikaku_ryakuan_5.pdf, fetched directly from Tokyo Shoseki).
Same publisher/series as sansu3/sansu4.

## Module identity

Directory `modules/sansu5/`, key `sansu5`, subject `'math'`,
launch_url `/modules/sansu5/index.html`, name `算数 5年`.

## Verified unit structure — 18 units across 2 volumes, 175 standard hours

**上巻**
1. 整数と小数 — decimal place-value extension, ×10/×100/÷10/÷100
2. 直方体や立方体の体積 — volume, cm³/m³, formulas, composite shapes
3. 比例 — introduction to proportional relationships
4. 小数のかけ算 — decimal multiplication, written algorithm
5. 小数のわり算 — decimal division, remainders, rounding quotients
6. 合同な図形 — congruence, triangle/quadrilateral construction

**下巻**
7. 図形の角 — triangle angle sum (180°), polygon angle sums
8. 偶数と奇数、倍数と約数 — even/odd, multiples/LCM, factors/GCF
9. 分数と小数、整数の関係 — fraction/decimal/integer conversion
10. 分数のたし算とひき算 — common denominators, fraction arithmetic
11. 平均 — mean, including handling outliers
12. 単位量あたりの大きさ — rate quantities, population density, speed
13. 四角形と三角形の面積 — area formulas (parallelogram, triangle,
    trapezoid, rhombus)
14. 割合 — percentage, ratio notation (歩合)
15. 帯グラフと円グラフ — bar/pie chart reading and construction
16. 変わり方調べ — functional relationships via table/graph/formula
17. 正多角形と円周の長さ — regular polygons, circumference, π
18. 角柱と円柱 — prisms/cylinders, nets, surface properties

## Design approach

Same as sansu3/sansu4 — strongly proceduralizable, follow the
established generator architecture directly. Per-unit notes:
- Units 1, 4, 5, 8, 9, 10 (number operations): straightforward
  parameterized generation.
- Units 2, 7, 13, 17, 18 (geometry): generate specific
  shapes/measurements, not abstract proofs.
- Units 11, 12, 14 (statistics/rates): mean, speed, percentage all
  generate cleanly from randomized input sets.
- Units 3, 16 (proportional/functional relationships) and 15
  (graphs): may need the same graph-reading UI question sansu4 flagged
  as a possible new interaction pattern — check whether sansu4 already
  built this before reinventing it.

## Testing

Same stress-test bar as every generator in this project — large
batches, checking for wrong option counts and distractor collisions
(e.g. a 割合 question where two different percentage representations
of the same value could both appear as "correct").

## Copyright

No passage to avoid — build original problems from the verified unit
list above, same as every math module in this project.

## focus_units

Build to honor `class_modules.focus_units` from the start (real
column, no current consumers as of this writing per CLAUDE.md).
Suggested keys: `u01_decimals` through `u18_prisms_cylinders`,
matching the unit order above.
