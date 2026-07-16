# sansu5 tests

Two tests, matching the project's testing bar for a generated-practice module.

## `generators.test.js` — structural stress test
```
node tests/sansu5/generators.test.js
```
Loads `generators.js` + `app.js` under a minimal DOM shim and generates 4,000
problems per section (76,000 total). Asserts, for every generated instance:
- each typed problem's canonical answer passes its **own**
  `SANSU5_CHECK.isCorrect` (with the shown unit suffix accepted; garbage and
  empty input rejected);
- each choice problem has 2–4 distinct options (binary yes/no and
  which-is-larger questions are legitimately 2-option, same as sansu4's
  comparison MCQs), the correct option present exactly once, and no
  distractor equal to the correct value (the "secretly-also-correct" bug).

No dependencies — plain `node`.

## `flow.test.mjs` — headless end-to-end flow test
```
node tests/sansu5/flow.test.mjs
# if the pinned playwright build != the pre-installed chromium revision:
PW_EXECUTABLE_PATH=/opt/pw-browsers/chromium-*/chrome-linux/chrome node tests/sansu5/flow.test.mjs
```
Serves the site, stubs the hub scripts (supabase/config/hub-common) so no real
backend is needed, and drives representative sections (typed-heavy, choice-heavy
and graph-figure units) through the real menu→answer→score→review UI answering
every question correctly. Asserts the shared reporting helper
`HubCommon.reportActivityWithItems` was called exactly once per section with:
the right `module_id`/`school_id`/`class_id` (resolved via the enrollments
join), a fully-populated per-question `items[]` (one per question, every field
present — this is what backs `activity_result_items`), `score === maxScore ===
N`, and an `activity_ref` shaped `sansu5/<sectionId>/<timestamp>`.

Requires `playwright` + a chromium build.
