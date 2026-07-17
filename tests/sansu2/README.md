# sansu2 tests

Two tests, matching the project's testing bar for a generated-practice module.

## `generators.test.js` — structural stress test
```
node tests/sansu2/generators.test.js
```
Loads `generators.js` + `app.js` under a minimal DOM shim and generates 5,000
problems per section (110,000 total). Asserts, for every generated instance:
- each typed problem's canonical answer passes its **own**
  `SANSU2_CHECK.isCorrect` (with the shown unit suffix accepted; garbage and
  empty input rejected);
- each choice problem has 2–4 distinct options (binary yes/no and
  which-is-larger questions are legitimately 2-option), the correct option
  present exactly once, and no distractor equal to the correct value (the
  "secretly-also-correct" bug).

It then runs a dedicated **かけ算九九** pass (the grade-2 centerpiece, spec
§Distractor-collision cautions): 40,000 iterations per 九九 section that
**enumerate all 81 ordered (x,y) cells** (asserts full coverage), confirm every
九九 answer equals `x*y` with no numeric distractor equal to the answer, and
confirm missing-factor answers (`□×k=prod`) are **unique in 1–9** given the
shown operand (the `12 = 2×6 = 3×4` trap).

No dependencies — plain `node`.

## `flow.test.mjs` — headless end-to-end flow test
```
node tests/sansu2/flow.test.mjs
# if the pinned playwright build != the pre-installed chromium revision:
PLAYWRIGHT_MODULE=/path/to/playwright/index.js \
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-*/chrome-linux/chrome \
  node tests/sansu2/flow.test.mjs
```
Serves the site, stubs the hub scripts (supabase/config/hub-common) so no real
backend is needed, and drives a representative spread of sections — graphs
(choice + typed, figure), 2-digit addition (all typed), clock-reading (all
choice, figure), and both 九九 centerpiece sections (whole-table + missing
factor) — through the real menu→answer→score→review UI, answering every question
correctly. Asserts the shared reporting helper
`HubCommon.reportActivityWithItems` was called exactly once per section with:
the right `moduleId`/`schoolId`/`classId` (resolved via the enrollments join), a
fully-populated per-question `items[]` (one per question, every field present —
this is what backs `activity_result_items`), `score === maxScore === N`, and an
`activityRef` shaped `sansu2/<sectionId>/<timestamp>`.

Requires `playwright` + a chromium build.
