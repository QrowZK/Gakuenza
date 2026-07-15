# rika4 — new module build spec

Companion doc: SHARED_INFRA_CONTEXT.md — read that first.

Built against 東京書籍「新編 新しい理科」第4学年, 令和6年度版
(rika_nenkankeikaku_4.pdf, fetched directly from Tokyo Shoseki — same
publisher/series as the already-live rika3). Verified current.

## Module identity

Directory `modules/rika4/`, key `rika4`, subject `'science'`,
launch_url `/modules/rika4/index.html`, name `理科 4年`.

## Verified unit structure — 12 units + seasonal checkpoints, 105 hours

1. あたたかくなると — spring plant/animal observation (seasonal)
2. 動物のからだのつくりと運動 — arm/whole-body movement, joints & muscles
3. 天気と気温 — daily weather/temperature tracking
4. 電流のはたらき — battery function, series/parallel connections
5. 雨水のゆくえと地面のようす — rainwater flow, ground absorption
   (暑くなると / 夏の星 / わたしの研究 — summer checkpoints, open inquiry)
6. 月や星の見え方 — moon phase/position, star position over time
7. 自然のなかの水のすがた — evaporation, condensation, water cycle
   (すずしくなると — autumn checkpoint)
8. とじこめた空気と水 — compression properties of enclosed air vs water
9. 物の体積と温度 — air/water/metal volume change with temperature
10. 物のあたたまり方 — heat conduction/convection in metal, air, water
    (冬の星 / 寒くなると — winter checkpoints)
11. 水のすがたと温度 — boiling, freezing, evaporation/condensation
    relative to temperature
12. 生き物の1年をふり返って — year-long living-things review

## The two-strand design — confirmed to hold at this grade too

Same A/B split as rika3 (life/earth vs matter/energy), and the 学習指導
要領 codes in the source PDF confirm it applies cleanly here as well —
this is a real, reusable pattern, not a one-off:

- **B-strand (life/earth) — sequence/structure/classification
  questions**: units 1, 2, 3, 5, 6, 7, 12 (seasonal observation,
  animal structure, weather tracking, moon/star position, water
  cycle). Question shapes: ordering, classification, structure ID —
  same family as rika3's B-strand.
- **A-strand (matter/energy) — cause-effect property questions**:
  units 4, 8, 9, 10, 11 (electric current, air/water compression,
  volume-temperature relationships, heat transfer, water state
  changes). Question shapes: factual properties, if-then relationships,
  prediction — same family as rika3's A-strand.

Build rika4 with this same two-mode structure from the start, rather
than treating all 12 units uniformly.

## Content notes worth knowing before authoring questions

- **Unit 4 (electric current)** is the direct grade-4 predecessor to
  rika3's grade-3 content on this topic (rika3 doesn't cover circuits
  — this is genuinely new ground at grade 4, not a repeat). Covers
  battery function and, notably, **series vs parallel connections** —
  a good, well-defined classification/comparison question opportunity
  (does adding a second battery in series make the bulb brighter? in
  parallel?).
- **Units 8-11 form a connected sequence** on states/behavior of
  matter under pressure and temperature — enclosed air/water
  compressibility, then volume-temperature relationships across three
  materials (air, water, metal — notably different degrees of
  expansion, a real comparison question opportunity), then heat
  transfer mechanism differences (conduction in metal vs convection in
  air/water), then water's specific phase-change behavior. Worth
  building questions that test the *sequence/connection* between these
  units, not just each in isolation — e.g. "which expands most with
  the same temperature increase: air, water, or metal?"
- **Units 6-7 and the seasonal checkpoints are astronomy/observation-
  heavy** — moon phase and position tracking, star position over time.
  These are naturally sequence/time-based questions (what does the
  moon look like a week after a given phase; which direction do stars
  appear to move over an evening).

## Stress-testing requirement

Same as every generator in this project — large-batch programmatic
checks for degenerate cases and distractor collisions, not just
manual spot-checks. Rika3's kanji-adjacent stroke-count generator bug
class (a "wrong" answer secretly also correct) is exactly the kind of
thing to watch for in any A-strand classification question here too
(e.g. "does it conduct heat well" questions where two materials
generated as distractor and answer both happen to be good conductors).

## Copyright

Same discipline as rika3 — this is genuinely safer ground than
kokugo's reading units. The underlying science (battery circuits,
states of matter, moon phases) is universal, independently-documented
fact, not the textbook's copyrighted expression. Build original
question wording; anchor to the real unit sequence above for pacing;
never reproduce the source PDF's specific example activities,
diagrams, or exact phrasing verbatim.

## focus_units

Same situation as sansu4 — `class_modules.focus_units` exists, has no
current consumers, worth building rika4 to honor it from the start.
Suggested keys matching the unit list above, e.g. `u01_warm_season`
through `u12_year_review`. Document the exact key list used.
