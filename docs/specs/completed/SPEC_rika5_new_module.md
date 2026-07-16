# rika5 — new module build spec

Built against 東京書籍「新編 新しい理科」第5学年, 令和6年度版
(rika_nenkankeikaku_5.pdf, fetched directly from Tokyo Shoseki).

## Module identity

Directory `modules/rika5/`, key `rika5`, subject `'science'`,
launch_url `/modules/rika5/index.html`, name `理科 5年`.

## Verified unit structure — 10 units, 105 hours

1. 天気の変化 — clouds and weather patterns, weather prediction
2. 植物の発芽と成長 — germination conditions, nutrient use, growth
   conditions
3. 魚のたんじょう — egg development/fish life cycle
4. 花から実へ — flower structure, pollination
5. 台風と天気の変化 — typhoon tracking, disaster preparedness
6. 流れる水のはたらき — river erosion/transport/deposition, flood
   disaster connection
7. 物のとけ方 — dissolving (saturation, amount dissolved, extraction)
8. 人のたんじょう — human prenatal development
9. 電流がうみ出す力 — electromagnets, electromagnet strength factors
10. ふりこのきまり — pendulum period and what does/doesn't affect it
    (length matters, weight/amplitude don't — a classic, well-defined
    "which variable actually matters" experiment)

## The A/B strand split — confirmed to hold at this grade too

Consistent with rika3/rika4:
- **B-strand (life/earth)**: units 1, 2, 3, 4, 5, 6, 8 — sequence,
  growth conditions, disaster-connected earth science. Sequence/
  classification/structure question types.
- **A-strand (matter/energy)**: units 7, 9, 10 — dissolving, magnetism,
  pendulum physics. Property/if-then/prediction question types.

Build with the same two-mode structure as rika3/rika4.

## Particularly strong generator/question opportunities

- **Unit 10 (ふりこのきまり)** is an unusually clean "control the
  variables" experiment — period depends on string length only, not
  weight or swing amplitude. This is genuinely well-suited to a
  "which variable, if changed, actually changes the outcome"
  classification question type, a slightly different shape than
  rika3/rika4's existing A-strand questions.
- **Unit 9 (電流がうみ出す力)** continues rika4's circuits work into
  electromagnet-specific factors (coil turns, current strength) — a
  natural comparison/prediction question set.
- **Unit 7 (物のとけ方)** parallels rika4's density/expansion
  comparisons — a good fit for "which dissolves more: X at this
  temperature, or Y" comparative questions.

## Copyright

Same as rika3/rika4 — the underlying science is universal,
independently-documented fact. Build original question wording;
anchor to the real unit sequence for pacing.

## Testing

Same stress-test bar as every generator in this project — this grade
introduces the "control the variables" question shape (unit 10)
specifically, which is a new pattern worth extra scrutiny for
distractor collisions (e.g. a question testing "does weight affect
period" where a wrong-answer option accidentally states something
also technically true).

## focus_units

Build to honor `class_modules.focus_units` from the start. Suggested
keys: `u01_weather` through `u10_pendulum`.
