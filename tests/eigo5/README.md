# eigo5 tests

- `generators.test.js` — pure Node. Structural + distractor-collision stress
  test (~80k generated questions). No dependencies:
  `node tests/eigo5/generators.test.js`
- `report.test.js` — pure Node. Loads the real `hub-common.js` +
  `eigo5-report.js` under a stubbed Supabase client and asserts the report goes
  through `HubCommon.reportActivityWithItems`, populating BOTH `activity_results`
  and per-question `activity_result_items` (CLAUDE.md hard rule 2). No deps:
  `node tests/eigo5/report.test.js`
- `flow.test.mjs` — headless end-to-end through the real quiz UI. Requires
  `playwright` + chromium (same optional dep as the other modules' flow tests):
  `node tests/eigo5/flow.test.mjs`
